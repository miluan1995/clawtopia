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
    uint256 public signalPool;    // 40% 信号奖励（准确预测赚奖励）
    uint256 public buybackPool;   // 30% 根据信号共识回购销毁
    uint256 public activityPool;  // 20% 小镇活跃度奖励
    uint256 public devPool;       // 10% 回流 dev 钱包

    // 分配比例（basis points, 总和 10000）
    uint16 public constant SIGNAL_BPS = 4000;
    uint16 public constant BUYBACK_BPS = 3000;
    uint16 public constant ACTIVITY_BPS = 2000;
    uint16 public constant DEV_BPS = 1000;

    // 信号奖励：epoch → 信号准确度分数
    mapping(address => uint256) public lastClaimEpoch;
    mapping(uint256 => uint256) public epochSignalPool;    // epoch => 该轮信号奖励总额
    mapping(uint256 => uint256) public epochTotalScore;    // epoch => 该轮总信号分
    mapping(uint256 => mapping(address => uint256)) public epochScore; // epoch => agent => 信号分

    // 活跃度奖励：epoch → 活跃度分数
    mapping(uint256 => uint256) public epochActivityPool;
    mapping(uint256 => uint256) public epochTotalActivity;
    mapping(uint256 => mapping(address => uint256)) public epochActivity;
    mapping(address => uint256) public lastActivityClaim;

    uint256 public currentEpoch;
    uint256 public totalBurned;  // 累计回购销毁量

    event Received(uint256 amount, uint256 signal, uint256 buyback, uint256 activity, uint256 dev);
    event SignalRewardClaimed(address indexed agent, uint256 epoch, uint256 amount);
    event ActivityRewardClaimed(address indexed agent, uint256 epoch, uint256 amount);
    event BuybackExecuted(uint256 amount, uint256 burned);
    event DevClaimed(address indexed to, uint256 amount);
    event SignalScoreRecorded(uint256 epoch, address indexed agent, uint256 score);
    event ActivityScoreRecorded(uint256 epoch, address indexed agent, uint256 score);
    event EpochAdvanced(uint256 epoch, uint256 signalAmount, uint256 activityAmount);

    function initialize(address _registry) external initializer {
        __Ownable_init(msg.sender);
        registry = _registry;
        currentEpoch = 1;
    }

    /// @notice 接收 BNB 税收，自动分池
    receive() external payable {
        uint256 s = msg.value * SIGNAL_BPS / 10000;
        uint256 b = msg.value * BUYBACK_BPS / 10000;
        uint256 a = msg.value * ACTIVITY_BPS / 10000;
        uint256 d = msg.value - s - b - a;
        signalPool += s;
        buybackPool += b;
        activityPool += a;
        devPool += d;
        emit Received(msg.value, s, b, a, d);
    }

    /// @notice 记录信号准确度分数
    function recordSignalScores(address[] calldata _agents, uint256[] calldata _scores) external onlyOwner {
        require(_agents.length == _scores.length, "length mismatch");
        for (uint i = 0; i < _agents.length; i++) {
            epochScore[currentEpoch][_agents[i]] = _scores[i];
            epochTotalScore[currentEpoch] += _scores[i];
            emit SignalScoreRecorded(currentEpoch, _agents[i], _scores[i]);
        }
    }

    /// @notice 记录活跃度分数（聊天/移动/互动）
    function recordActivityScores(address[] calldata _agents, uint256[] calldata _scores) external onlyOwner {
        require(_agents.length == _scores.length, "length mismatch");
        for (uint i = 0; i < _agents.length; i++) {
            epochActivity[currentEpoch][_agents[i]] = _scores[i];
            epochTotalActivity[currentEpoch] += _scores[i];
            emit ActivityScoreRecorded(currentEpoch, _agents[i], _scores[i]);
        }
    }

    /// @notice 结束当前 epoch，快照信号池+活跃池
    function advanceEpoch() external onlyOwner {
        epochSignalPool[currentEpoch] = signalPool;
        epochActivityPool[currentEpoch] = activityPool;
        signalPool = 0;
        activityPool = 0;
        emit EpochAdvanced(currentEpoch, epochSignalPool[currentEpoch], epochActivityPool[currentEpoch]);
        currentEpoch++;
    }

    /// @notice Agent 领取信号奖励
    function claimSignalReward(uint256 epoch) external {
        require(epoch < currentEpoch, "epoch not ended");
        require(epochScore[epoch][msg.sender] > 0, "no score");
        require(lastClaimEpoch[msg.sender] < epoch, "already claimed");
        uint256 amount = epochSignalPool[epoch] * epochScore[epoch][msg.sender] / epochTotalScore[epoch];
        require(amount > 0, "zero reward");
        lastClaimEpoch[msg.sender] = epoch;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        emit SignalRewardClaimed(msg.sender, epoch, amount);
    }

    /// @notice Agent 领取活跃度奖励
    function claimActivityReward(uint256 epoch) external {
        require(epoch < currentEpoch, "epoch not ended");
        require(epochActivity[epoch][msg.sender] > 0, "no activity");
        require(lastActivityClaim[msg.sender] < epoch, "already claimed");
        uint256 amount = epochActivityPool[epoch] * epochActivity[epoch][msg.sender] / epochTotalActivity[epoch];
        require(amount > 0, "zero reward");
        lastActivityClaim[msg.sender] = epoch;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");
        emit ActivityRewardClaimed(msg.sender, epoch, amount);
    }

    /// @notice 根据信号共识执行回购销毁（executor 或 owner 调用）
    function executeBuyback(address token, uint256 amount) external {
        require(msg.sender == executor || msg.sender == owner(), "unauthorized");
        require(amount <= buybackPool, "insufficient");
        buybackPool -= amount;
        totalBurned += amount;
        // 实际回购逻辑：调用 DEX swap 后 burn，此处先转给 executor 执行
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "transfer failed");
        emit BuybackExecuted(amount, totalBurned);
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
        signalPool = 0;
        buybackPool = 0;
        activityPool = 0;
        devPool = 0;
        (bool ok,) = to.call{value: bal}("");
        require(ok, "transfer failed");
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
