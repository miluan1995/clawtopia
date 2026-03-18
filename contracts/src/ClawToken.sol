// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./IAgentRegistry.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

interface IPancakeRouter {
    function WETH() external pure returns (address);
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn, uint256 amountOutMin, address[] calldata path,
        address to, uint256 deadline
    ) external;
}

/// @title ClawToken — $CLAWTOPIA with Agent-Only early access + 3% BNB tax
contract ClawToken is ERC20Upgradeable, UUPSUpgradeable, OwnableUpgradeable {
    IAgentRegistry public registry;
    address public treasury;
    address public devWallet;
    address public pair;
    IPancakeRouter public router;
    uint256 public marketCapThreshold;

    uint16 public constant TAX_BPS = 300;       // 3% total
    uint16 public constant DEV_TAX_BPS = 100;   // 1% dev
    uint256 public swapThreshold;                // min tokens before swap
    bool public agentOnlyLifted;
    bool private _inSwap;

    mapping(address => bool) public taxExempt;

    event AgentOnlyLifted();
    event SwapAndDistribute(uint256 tokensSwapped, uint256 bnbReceived);

    modifier lockSwap() { _inSwap = true; _; _inSwap = false; }

    function initialize(
        address _registry, address _treasury, address _devWallet,
        address _router, uint256 _threshold
    ) external initializer {
        __ERC20_init("ClawTopia", "CLAWTOPIA");
        __Ownable_init(msg.sender);
        registry = IAgentRegistry(_registry);
        treasury = _treasury;
        devWallet = _devWallet;
        router = IPancakeRouter(_router);
        marketCapThreshold = _threshold;
        swapThreshold = 1_000_000 ether; // 0.1% of supply
        taxExempt[msg.sender] = true;
        taxExempt[_treasury] = true;
        taxExempt[_devWallet] = true;
        _mint(msg.sender, 1_000_000_000 ether);
    }

    function _update(address from, address to, uint256 amount) internal override {
        bool isBuy = (pair != address(0) && from == pair && to != address(0));
        bool isSell = (pair != address(0) && to == pair && from != address(0));

        // Agent-Only restriction
        if (isBuy && !agentOnlyLifted) {
            require(registry.isAgent(to), "Agent-only phase: register first");
        }

        // Auto swap accumulated tax tokens before sell
        if (isSell && !_inSwap && balanceOf(address(this)) >= swapThreshold) {
            _swapAndDistribute();
        }

        // 3% tax on buy/sell: tokens go to this contract, later swapped to BNB
        if ((isBuy || isSell) && !_inSwap && !taxExempt[isBuy ? to : from]) {
            uint256 tax = amount * TAX_BPS / 10000;
            super._update(from, address(this), tax);
            amount -= tax;
        }

        super._update(from, to, amount);
    }

    function _swapAndDistribute() internal lockSwap {
        uint256 tokenAmount = balanceOf(address(this));
        if (tokenAmount == 0) return;

        // Approve router
        _approve(address(this), address(router), tokenAmount);

        // Swap tokens → BNB
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = router.WETH();

        uint256 bnbBefore = address(this).balance;
        router.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount, 0, path, address(this), block.timestamp
        );
        uint256 bnbReceived = address(this).balance - bnbBefore;

        // Split: 2/3 treasury, 1/3 dev (ratio of 2% vs 1%)
        uint256 devShare = bnbReceived * DEV_TAX_BPS / TAX_BPS;
        uint256 treasuryShare = bnbReceived - devShare;

        if (treasuryShare > 0) {
            (bool ok,) = treasury.call{value: treasuryShare}("");
            require(ok, "treasury transfer failed");
        }
        if (devShare > 0) {
            (bool ok,) = devWallet.call{value: devShare}("");
            require(ok, "dev transfer failed");
        }

        emit SwapAndDistribute(tokenAmount, bnbReceived);
    }

    /// @notice Manual trigger swap (in case auto doesn't fire)
    function manualSwap() external onlyOwner { _swapAndDistribute(); }

    function liftAgentOnly() external onlyOwner {
        agentOnlyLifted = true;
        emit AgentOnlyLifted();
    }

    function setPair(address _pair) external onlyOwner { pair = _pair; taxExempt[_pair] = true; }
    function setTaxExempt(address addr, bool exempt) external onlyOwner { taxExempt[addr] = exempt; }
    function setRegistry(address _r) external onlyOwner { registry = IAgentRegistry(_r); }
    function setTreasury(address _t) external onlyOwner { treasury = _t; }
    function setDevWallet(address _d) external onlyOwner { devWallet = _d; taxExempt[_d] = true; }
    function setThreshold(uint256 _t) external onlyOwner { marketCapThreshold = _t; }
    function setSwapThreshold(uint256 _t) external onlyOwner { swapThreshold = _t; }
    function setRouter(address _r) external onlyOwner { router = IPancakeRouter(_r); }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    receive() external payable {}
}
