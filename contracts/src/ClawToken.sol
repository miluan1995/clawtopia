// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./IAgentRegistry.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";


/// @title ClawToken — $CLAW with Agent-Only early access + 3% tax
contract ClawToken is ERC20Upgradeable, UUPSUpgradeable, OwnableUpgradeable {
    IAgentRegistry public registry;
    address public treasury;
    address public devWallet;      // dev 钱包，收 1% 税
    address public pair;           // DEX pair address
    uint256 public marketCapThreshold;
    uint16 public constant TAX_BPS = 300;      // 总税 3%
    uint16 public constant DEV_TAX_BPS = 100;  // dev 回流 1%
    bool public agentOnlyLifted;

    mapping(address => bool) public taxExempt;

    event AgentOnlyLifted();

    function initialize(
        address _registry,
        address _treasury,
        address _devWallet,
        uint256 _threshold
    ) external initializer {
        __ERC20_init("ClawTopia", "CLAW");
        __Ownable_init(msg.sender);
        registry = IAgentRegistry(_registry);
        treasury = _treasury;
        devWallet = _devWallet;
        marketCapThreshold = _threshold;
        taxExempt[msg.sender] = true;
        taxExempt[_treasury] = true;
        taxExempt[_devWallet] = true;
        _mint(msg.sender, 1_000_000_000 ether);
    }

    function _update(address from, address to, uint256 amount) internal override {
        // 买入检测：from == pair 且 pair 已设置
        bool isBuy = (pair != address(0) && from == pair && to != address(0));

        // Agent-Only 限制
        if (isBuy && !agentOnlyLifted) {
            require(registry.isAgent(to), "Agent-only phase: register first");
        }

        // 3% 税收：2% → treasury, 1% → devWallet
        bool isSell = (pair != address(0) && to == pair && from != address(0));
        if ((isBuy || isSell) && !taxExempt[isBuy ? to : from]) {
            uint256 devTax = amount * DEV_TAX_BPS / 10000;
            uint256 treasuryTax = amount * (TAX_BPS - DEV_TAX_BPS) / 10000;
            super._update(from, devWallet, devTax);
            super._update(from, treasury, treasuryTax);
            amount -= (devTax + treasuryTax);
        }

        super._update(from, to, amount);
    }

    /// @notice Owner 手动解除 Agent-Only（或达到市值自动解除）
    function liftAgentOnly() external onlyOwner {
        agentOnlyLifted = true;
        emit AgentOnlyLifted();
    }

    function setPair(address _pair) external onlyOwner {
        pair = _pair;
        taxExempt[_pair] = true;
    }
    function setTaxExempt(address addr, bool exempt) external onlyOwner { taxExempt[addr] = exempt; }
    function setRegistry(address _r) external onlyOwner { registry = IAgentRegistry(_r); }
    function setTreasury(address _t) external onlyOwner { treasury = _t; }
    function setDevWallet(address _d) external onlyOwner { devWallet = _d; taxExempt[_d] = true; }
    function setThreshold(uint256 _t) external onlyOwner { marketCapThreshold = _t; }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
