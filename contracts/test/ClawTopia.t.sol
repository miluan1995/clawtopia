// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/AgentRegistry.sol";
import "../src/ClawToken.sol";
import "../src/ClawTreasury.sol";
import "../src/ClawGovernance.sol";

contract ClawTopiaTest is Test {
    AgentRegistry registry;
    ClawToken token;
    ClawTreasury treasury;
    ClawGovernance governance;

    address owner = address(this);
    address agent1 = vm.addr(1);
    address agent2 = vm.addr(2);
    address human = vm.addr(3);
    address devWallet = vm.addr(4);
    address pair = address(0xDEAD);

    function setUp() public {
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

        // Deploy Token
        ClawToken tokenImpl = new ClawToken();
        ERC1967Proxy tokenProxy = new ERC1967Proxy(
            address(tokenImpl), abi.encodeCall(ClawToken.initialize, (address(registry), address(treasury), devWallet, 35_000 ether))
        );
        token = ClawToken(address(tokenProxy));
        token.setPair(pair);

        // Deploy Governance
        ClawGovernance govImpl = new ClawGovernance();
        ERC1967Proxy govProxy = new ERC1967Proxy(
            address(govImpl), abi.encodeCall(ClawGovernance.initialize, (address(registry), owner, address(treasury)))
        );
        governance = ClawGovernance(address(govProxy));

        // Register agents
        registry.register(agent1);
        registry.register(agent2);

        // Give agents some tokens (simulate DEX buy by transferring from owner)
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
        // Simulate DEX buy: pair → agent1
        token.transfer(pair, 10000 ether);
        vm.prank(pair);
        token.transfer(agent1, 100 ether); // pair → agent = buy
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
        token.transfer(human, 100 ether); // should work now
        assertGt(token.balanceOf(human), 0);
    }

    // === Tax Tests ===

    function test_BuyTax3Percent() public {
        token.transfer(pair, 10000 ether);
        uint256 treasuryBefore = token.balanceOf(address(treasury));
        uint256 devBefore = token.balanceOf(devWallet);
        vm.prank(pair);
        token.transfer(agent1, 1000 ether);
        assertEq(token.balanceOf(address(treasury)) - treasuryBefore, 20 ether); // 2%
        assertEq(token.balanceOf(devWallet) - devBefore, 10 ether); // 1%
    }

    function test_SellTax3Percent() public {
        uint256 treasuryBefore = token.balanceOf(address(treasury));
        uint256 devBefore = token.balanceOf(devWallet);
        vm.prank(agent1);
        token.transfer(pair, 100 ether);
        assertEq(token.balanceOf(address(treasury)) - treasuryBefore, 2 ether); // 2%
        assertEq(token.balanceOf(devWallet) - devBefore, 1 ether); // 1%
    }

    function test_NoTaxOnRegularTransfer() public {
        uint256 treasuryBefore = token.balanceOf(address(treasury));
        vm.prank(agent1);
        token.transfer(agent2, 100 ether); // agent → agent, not via pair
        uint256 taxCollected = token.balanceOf(address(treasury)) - treasuryBefore;
        assertEq(taxCollected, 0);
    }

    // === Treasury Tests ===

    function test_TreasuryReceiveSplits() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(treasury).call{value: 1 ether}("");
        assertTrue(ok);
        assertEq(treasury.rewardPool(), 0.4 ether);
        assertEq(treasury.executionPool(), 0.3 ether);
        assertEq(treasury.stakingPool(), 0.2 ether);
        assertEq(treasury.devPool(), 0.1 ether);
    }

    function test_EmergencyWithdrawClearsAll() public {
        vm.deal(address(this), 1 ether);
        (bool ok,) = address(treasury).call{value: 1 ether}("");
        assertTrue(ok);
        treasury.emergencyWithdraw(payable(owner));
        assertEq(treasury.rewardPool(), 0);
        assertEq(treasury.executionPool(), 0);
        assertEq(treasury.stakingPool(), 0);
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

        // Advance time past deadline
        vm.warp(block.timestamp + 2 days);

        // Oracle approves
        governance.fulfillDecision(id, true, "Community consensus");

        // Execute
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
