// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/AgentRegistry.sol";
import "../src/ClawToken.sol";
import "../src/ClawTreasury.sol";
import "../src/ClawGovernance.sol";

// Mock PancakeSwap Router for testing
contract MockRouter {
    address public WETH;
    constructor() { WETH = address(0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c); }

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn, uint256, address[] calldata path, address to, uint256
    ) external {
        // Pull tokens from sender
        (bool ok1,) = path[0].call(abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), amountIn));
        require(ok1);
        // Send 1 ETH back
        (bool ok2,) = to.call{value: 1 ether}("");
        require(ok2);
    }

    receive() external payable {}
}

contract ClawTopiaTest is Test {
    AgentRegistry registry;
    ClawToken token;
    ClawTreasury treasury;
    ClawGovernance governance;
    MockRouter mockRouter;

    address owner = address(this);
    address agent1 = vm.addr(1);
    address agent2 = vm.addr(2);
    address human = vm.addr(3);
    address devWallet = vm.addr(4);
    address pair = address(0xDEAD);

    function setUp() public {
        // Deploy mock router
        mockRouter = new MockRouter();
        vm.deal(address(mockRouter), 100 ether);

        // Deploy Registry
        AgentRegistry registryImpl = new AgentRegistry();
        ERC1967Proxy registryProxy = new ERC1967Proxy(
            address(registryImpl), abi.encodeCall(AgentRegistry.initialize, ())
        );
        registry = AgentRegistry(address(registryProxy));

        // Deploy Treasury
        ClawTreasury treasuryImpl = new ClawTreasury();
        ERC1967Proxy treasuryProxy = new ERC1967Proxy(
            address(treasuryImpl), abi.encodeCall(ClawTreasury.initialize, (address(registry)))
        );
        treasury = ClawTreasury(payable(address(treasuryProxy)));

        // Deploy Token with router
        ClawToken tokenImpl = new ClawToken();
        ERC1967Proxy tokenProxy = new ERC1967Proxy(
            address(tokenImpl), abi.encodeCall(ClawToken.initialize, (
                address(registry), address(treasury), devWallet,
                address(mockRouter), 35_000 ether
            ))
        );
        token = ClawToken(payable(address(tokenProxy)));
        token.setPair(pair);

        // Deploy Governance
        ClawGovernance govImpl = new ClawGovernance();
        ERC1967Proxy govProxy = new ERC1967Proxy(
            address(govImpl), abi.encodeCall(ClawGovernance.initialize, (
                address(registry), owner, address(treasury)
            ))
        );
        governance = ClawGovernance(address(govProxy));

        // Register agents
        registry.register(agent1);
        registry.register(agent2);

        // Give agents some tokens
        token.transfer(agent1, 1000 ether);
        token.transfer(agent2, 500 ether);
    }

    // === AgentRegistry Tests ===

    function test_RegisterAgent() public view {
        assertTrue(registry.isAgent(agent1));
        assertTrue(registry.isAgent(agent2));
        assertFalse(registry.isAgent(human));
        assertEq(registry.agentCount(), 2);
    }

    function test_RemoveAgent() public {
        registry.remove(agent1);
        assertFalse(registry.isAgent(agent1));
    }

    function test_CannotRegisterTwice() public {
        vm.expectRevert("already registered");
        registry.register(agent1);
    }

    // === ClawToken Agent-Only Tests ===

    function test_AgentCanBuyFromPair() public {
        token.transfer(pair, 10000 ether);
        vm.prank(pair);
        token.transfer(agent1, 100 ether);
    }

    function test_HumanCannotBuyFromPair() public {
        token.transfer(pair, 10000 ether);
        vm.prank(pair);
        vm.expectRevert("Agent-only phase: register first");
        token.transfer(human, 100 ether);
    }

    function test_HumanCanBuyAfterLift() public {
        token.liftAgentOnly();
        token.transfer(pair, 10000 ether);
        vm.prank(pair);
        token.transfer(human, 100 ether);
        assertGt(token.balanceOf(human), 0);
    }

    // === Tax Tests (tokens accumulate in contract) ===

    function test_BuyTax3Percent() public {
        token.transfer(pair, 10000 ether);
        uint256 contractBefore = token.balanceOf(address(token));
        vm.prank(pair);
        token.transfer(agent1, 1000 ether);
        // 3% tax goes to token contract (not treasury/dev directly)
        assertEq(token.balanceOf(address(token)) - contractBefore, 30 ether);
        // Agent receives 97%
        // (agent1 already had 1000, now gets 970 more)
    }

    function test_SellTax3Percent() public {
        uint256 contractBefore = token.balanceOf(address(token));
        vm.prank(agent1);
        token.transfer(pair, 100 ether);
        assertEq(token.balanceOf(address(token)) - contractBefore, 3 ether);
    }

    function test_NoTaxOnRegularTransfer() public {
        uint256 contractBefore = token.balanceOf(address(token));
        vm.prank(agent1);
        token.transfer(agent2, 100 ether);
        assertEq(token.balanceOf(address(token)) - contractBefore, 0);
    }

    // === Swap & Distribute Test ===

    function test_SwapAndDistribute() public {
        // Accumulate tax tokens above threshold
        token.transfer(pair, 500_000_000 ether);
        token.setSwapThreshold(1 ether); // lower threshold for test

        // Trigger a sell which should auto-swap
        // First put some tax tokens in the contract
        vm.prank(pair);
        token.transfer(agent1, 100_000_000 ether); // buy → 3% tax

        uint256 taxInContract = token.balanceOf(address(token));
        assertGt(taxInContract, 0);

        // Manual swap to test distribution
        uint256 treasuryBnbBefore = address(treasury).balance;
        uint256 devBnbBefore = devWallet.balance;
        token.manualSwap();

        // Treasury should get 2/3 of BNB, dev gets 1/3
        assertGt(address(treasury).balance, treasuryBnbBefore);
        assertGt(devWallet.balance, devBnbBefore);
        // Tokens in contract should be 0 after swap
        assertEq(token.balanceOf(address(token)), 0);
    }

    // === Treasury Tests ===

    function test_TreasuryReceiveSplits() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(treasury).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(treasury.signalPool(), 0.4 ether);
        assertEq(treasury.buybackPool(), 0.3 ether);
        assertEq(treasury.activityPool(), 0.2 ether);
        assertEq(treasury.devPool(), 0.1 ether);
    }

    function test_EmergencyWithdrawClearsAll() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(treasury).call{value: 1 ether}("");
        assertTrue(ok);
        treasury.emergencyWithdraw(payable(owner));
        assertEq(treasury.signalPool(), 0);
        assertEq(treasury.buybackPool(), 0);
        assertEq(treasury.activityPool(), 0);
        assertEq(treasury.devPool(), 0);
        assertEq(address(treasury).balance, 0);
    }

    // === Governance Tests ===

    function test_AgentCanPropose() public {
        vm.prank(agent1);
        uint256 id = governance.propose("Burn 10%", ClawGovernance.Action.BURN, "", 1 days);
        assertEq(id, 0);
        assertEq(governance.proposalCount(), 1);
    }

    function test_HumanCannotPropose() public {
        vm.prank(human);
        vm.expectRevert("not agent");
        governance.propose("hack", ClawGovernance.Action.CUSTOM, "", 1 days);
    }

    function test_VoteAndExecute() public {
        vm.prank(agent1);
        uint256 id = governance.propose("Burn", ClawGovernance.Action.BURN, "", 1 days);
        vm.prank(agent1);
        governance.vote(id, true);
        vm.prank(agent2);
        governance.vote(id, true);
        vm.warp(block.timestamp + 2 days);
        governance.fulfillDecision(id, true, "Community consensus");
        governance.manualExecute(id);
    }

    function test_CannotExecuteWithoutApproval() public {
        vm.prank(agent1);
        uint256 id = governance.propose("Burn", ClawGovernance.Action.BURN, "", 1 days);
        vm.prank(agent1);
        governance.vote(id, true);
        vm.warp(block.timestamp + 2 days);
        vm.expectRevert("not approved");
        governance.manualExecute(id);
    }

    receive() external payable {}
}
