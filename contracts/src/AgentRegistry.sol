// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @title AgentRegistry — AI Agent 身份验证 + 白名单
/// @notice 只有注册的 Agent 地址能在早期购买 $CLAW
contract AgentRegistry is UUPSUpgradeable, OwnableUpgradeable {
    mapping(address => bool) public isAgent;
    mapping(address => uint256) public registeredAt;
    address[] public agents;

    // 验证挑战：注册时需要 Agent 签名一个 nonce
    mapping(address => bytes32) public pendingChallenge;

    event AgentRegistered(address indexed agent);
    event AgentRemoved(address indexed agent);
    event ChallengeIssued(address indexed agent, bytes32 challenge);

    function initialize() external initializer {
        __Ownable_init(msg.sender);
    }

    /// @notice Owner 直接注册（信任的 Agent）
    function register(address agent) external onlyOwner {
        _register(agent);
    }

    /// @notice 批量注册
    function registerBatch(address[] calldata _agents) external onlyOwner {
        for (uint i = 0; i < _agents.length; i++) _register(_agents[i]);
    }

    /// @notice 发起验证挑战（Agent 需要回调签名）
    function issueChallenge(address agent) external onlyOwner returns (bytes32) {
        bytes32 challenge = keccak256(abi.encodePacked(agent, block.timestamp, blockhash(block.number - 1)));
        pendingChallenge[agent] = challenge;
        emit ChallengeIssued(agent, challenge);
        return challenge;
    }

    /// @notice Agent 提交签名完成验证
    function completeChallenge(bytes calldata signature) external {
        bytes32 challenge = pendingChallenge[msg.sender];
        require(challenge != bytes32(0), "no pending challenge");
        bytes32 hash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", challenge));
        require(_recover(hash, signature) == msg.sender, "invalid signature");
        delete pendingChallenge[msg.sender];
        _register(msg.sender);
    }

    /// @notice 移除 Agent（治理投票踢人）
    function remove(address agent) external onlyOwner {
        require(isAgent[agent], "not registered");
        isAgent[agent] = false;
        emit AgentRemoved(agent);
    }

    function agentCount() external view returns (uint256) { return agents.length; }

    function _register(address agent) internal {
        require(!isAgent[agent], "already registered");
        isAgent[agent] = true;
        registeredAt[agent] = block.timestamp;
        agents.push(agent);
        emit AgentRegistered(agent);
    }

    function _recover(bytes32 hash, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "bad sig len");
        bytes32 r; bytes32 s; uint8 v;
        assembly { r := calldataload(sig.offset) s := calldataload(add(sig.offset, 32)) v := byte(0, calldataload(add(sig.offset, 64))) }
        return ecrecover(hash, v, r, s);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
