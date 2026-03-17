// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/// @title ClawTreasury — 税收池管理 + 奖励分发
/// @notice 接收 $CLAW 税收，按比例分配到四个池子
contract ClawTreasury is UUPSUpgradeable, OwnableUpgradeable {
    address public registry;   // AgentRegistry
    address public executor;   // 执行者（Oracle/multisig）

    // 池子余额
    uint256 public rewardPool;    // 40% 活跃奖励
    uint256 public executionPool; // 30% Oracle + gas
    uint256 public stakingPool;   // 20% 菜园质押
    uint256 public devPool;       // 10% 开发

    // 分配比例（basis points, 总和 10000）
    uint16 public constant REWARD_BPS = 4000;
    uint16 public constant EXECUTION_BPS = 3000;
    uint16 public constant STAKING_BPS = 2000;
    uint16 public constant DEV_BPS = 1000;

    // 奖励领取记录
    mapping(address => uint256) public lastClaimEpoch;
    mapping(uint256 => uint256) public epochRewardPool;    // epoch => 该轮总奖励
    mapping(uint256 => uint256) public epochTotalScore;    // epoch => 该轮总活跃分
    mapping(uint256 => mapping(address => uint256)) public epochScore; // epoch => agent => 分数
    uint256 public currentEpoch;

    event Received(uint256 amount, uint256 reward, uint256 execution, uint256 staking, uint256 dev);
    event RewardClaimed(address indexed agent, uint256 epoch, uint256 amount);
    event ExecutionWithdrawn(address indexed to, uint256 amount);
    event DevClaimed(address indexed to, uint256 amount);
    event ScoreRecorded(uint256 epoch, address indexed agent, uint256 score);
    event EpochAdvanced(uint256 epoch, uint256 rewardAmount);

    function initialize(address _registry) external initializer {
        __Ownable_init(msg.sender);
        registry = _registry;
        currentEpoch = 1;
    }

    /// @notice 接收 BNB 税收，自动分池（只分账不转账）
    receive() external payable {
        uint256 r = msg.value * REWARD_BPS / 10000;
        uint256 e = msg.value * EXECUTION_BPS / 10000;
        uint256 s = msg.value * STAKING_BPS / 10000;
        uint256 d = msg.value - r - e - s;
        rewardPool += r;
        executionPool += e;
        stakingPool += s;
        devPool += d;
        emit Received(msg.value, r, e, s, d);
    }

    /// @notice 记录 Agent 活跃分（由后端调用）
    function recordScores(address[] calldata _agents, uint256[] calldata _scores) external onlyOwner {
        require(_agents.length == _scores.length, "length mismatch");
        for (uint i = 0; i < _agents.length; i++) {
            epochScore[currentEpoch][_agents[i]] = _scores[i];
            epochTotalScore[currentEpoch] += _scores[i];
            emit ScoreRecorded(currentEpoch, _agents[i], _scores[i]);
        }
    }

    /// @notice 结束当前 epoch，将 rewardPool 快照到 epochRewardPool
    function advanceEpoch() external onlyOwner {
        epochRewardPool[currentEpoch] = rewardPool;
        rewardPool = 0;
        emit EpochAdvanced(currentEpoch, epochRewardPool[currentEpoch]);
        currentEpoch++;
    }

    /// @notice Agent 领取某 epoch 的奖励
    function claimReward(uint256 epoch) external {
        require(epoch < currentEpoch, "epoch not ended");
        require(epochScore[epoch][msg.sender] > 0, "no score");
        require(lastClaimEpoch[msg.sender] < epoch, "already claimed");

        uint256 amount = epochRewardPool[epoch] * epochScore[epoch][msg.sender] / epochTotalScore[epoch];
        require(amount > 0, "zero reward");
        lastClaimEpoch[msg.sender] = epoch;

        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        emit RewardClaimed(msg.sender, epoch, amount);
    }

    /// @notice 执行池提款（Oracle 费用等）
    function withdrawExecution(address payable to, uint256 amount) external {
        require(msg.sender == executor || msg.sender == owner(), "unauthorized");
        require(amount <= executionPool, "insufficient");
        executionPool -= amount;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "transfer failed");
        emit ExecutionWithdrawn(to, amount);
    }

    /// @notice 开发池领取
    function claimDev(address payable to) external onlyOwner {
        uint256 amount = devPool;
        require(amount > 0, "empty");
        devPool = 0;
        (bool ok,) = to.call{value: amount}("");
        require(ok, "transfer failed");
        emit DevClaimed(to, amount);
    }

    function setExecutor(address _executor) external onlyOwner { executor = _executor; }
    function setRegistry(address _registry) external onlyOwner { registry = _registry; }

    /// @notice 紧急提款（清零所有池子 — HIVEMIND 教训 #8）
    function emergencyWithdraw(address payable to) external onlyOwner {
        uint256 bal = address(this).balance;
        rewardPool = 0;
        executionPool = 0;
        stakingPool = 0;
        devPool = 0;
        (bool ok,) = to.call{value: bal}("");
        require(ok, "transfer failed");
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
