// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./IAgentRegistry.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";


/// @title ClawGovernance — 会议堂投票 + Oracle 决策执行
/// @notice Agent 持币投票，Oracle 记录决策，manualExecute 执行
contract ClawGovernance is UUPSUpgradeable, OwnableUpgradeable {
    IAgentRegistry public registry;
    address public oracle;
    address public treasury;

    enum Action { BUY, SELL, BURN, DISTRIBUTE, CUSTOM }

    struct Proposal {
        string description;
        Action action;
        bytes data;          // 执行参数
        uint256 deadline;
        uint256 yesVotes;
        uint256 noVotes;
        bool executed;
        bool oracleApproved;
    }

    Proposal[] public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    // Oracle 决策记录（HIVEMIND 教训 #1：回调只记录不执行）
    struct Decision {
        uint256 proposalId;
        bool approved;
        string reasoning;
        uint256 timestamp;
    }
    Decision[] public decisions;

    event ProposalCreated(uint256 indexed id, string description, Action action, uint256 deadline);
    event Voted(uint256 indexed id, address indexed agent, bool support, uint256 weight);
    event OracleDecision(uint256 indexed proposalId, bool approved, string reasoning);
    event Executed(uint256 indexed proposalId);

    function initialize(address _registry, address _oracle, address _treasury) external initializer {
        __Ownable_init(msg.sender);
        registry = IAgentRegistry(_registry);
        oracle = _oracle;
        treasury = _treasury;
    }

    /// @notice 创建提案（仅注册 Agent）
    function propose(string calldata desc, Action action, bytes calldata data, uint256 duration) external returns (uint256) {
        require(registry.isAgent(msg.sender), "not agent");
        uint256 id = proposals.length;
        proposals.push(Proposal(desc, action, data, block.timestamp + duration, 0, 0, false, false));
        emit ProposalCreated(id, desc, action, block.timestamp + duration);
        return id;
    }

    /// @notice 投票（权重 = 1，后续可改为持币量加权）
    function vote(uint256 id, bool support) external {
        require(registry.isAgent(msg.sender), "not agent");
        Proposal storage p = proposals[id];
        require(block.timestamp < p.deadline, "ended");
        require(!hasVoted[id][msg.sender], "voted");
        hasVoted[id][msg.sender] = true;
        if (support) p.yesVotes++; else p.noVotes++;
        emit Voted(id, msg.sender, support, 1);
    }

    /// @notice Oracle 回调 — 只记录决策（教训 #1）
    function fulfillDecision(uint256 proposalId, bool approved, string calldata reasoning) external {
        require(msg.sender == oracle || msg.sender == owner(), "unauthorized");
        Proposal storage p = proposals[proposalId];
        require(block.timestamp >= p.deadline, "voting ongoing");
        p.oracleApproved = approved;
        decisions.push(Decision(proposalId, approved, reasoning, block.timestamp));
        emit OracleDecision(proposalId, approved, reasoning);
    }

    /// @notice 手动执行决策（教训 #1：分离记录和执行）
    function manualExecute(uint256 proposalId) external onlyOwner {
        Proposal storage p = proposals[proposalId];
        require(!p.executed, "already executed");
        require(p.oracleApproved, "not approved");
        require(p.yesVotes > p.noVotes, "vote failed");
        p.executed = true;
        // 执行逻辑由 owner 通过 data 字段解析
        // 具体操作在链下完成，避免回调 revert 风险
        emit Executed(proposalId);
    }

    function proposalCount() external view returns (uint256) { return proposals.length; }
    function decisionCount() external view returns (uint256) { return decisions.length; }

    function setOracle(address _oracle) external onlyOwner { oracle = _oracle; }
    function setRegistry(address _r) external onlyOwner { registry = IAgentRegistry(_r); }
    function setTreasury(address _t) external onlyOwner { treasury = _t; }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
