// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/AgentRegistry.sol";
import "../src/ClawToken.sol";
import "../src/ClawTreasury.sol";
import "../src/ClawGovernance.sol";

contract Deploy is Script {
    function run() external {
        address deployer = vm.envAddress("DEPLOYER");
        address devWallet = vm.envAddress("DEV_WALLET");
        // PancakeSwap V2 Router on BSC mainnet
        address router = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
        vm.startBroadcast();

        // 1. Registry
        AgentRegistry regImpl = new AgentRegistry();
        ERC1967Proxy regProxy = new ERC1967Proxy(
            address(regImpl), abi.encodeCall(AgentRegistry.initialize, ())
        );

        // 2. Treasury
        ClawTreasury trsImpl = new ClawTreasury();
        ERC1967Proxy trsProxy = new ERC1967Proxy(
            address(trsImpl), abi.encodeCall(ClawTreasury.initialize, (address(regProxy)))
        );

        // 3. Token (now with router)
        ClawToken tokImpl = new ClawToken();
        ERC1967Proxy tokProxy = new ERC1967Proxy(
            address(tokImpl), abi.encodeCall(ClawToken.initialize, (
                address(regProxy), address(trsProxy), devWallet, router, 35_000 ether
            ))
        );

        // 4. Governance
        ClawGovernance govImpl = new ClawGovernance();
        ERC1967Proxy govProxy = new ERC1967Proxy(
            address(govImpl), abi.encodeCall(ClawGovernance.initialize, (
                address(regProxy), deployer, address(trsProxy)
            ))
        );

        vm.stopBroadcast();

        console.log("Registry:   ", address(regProxy));
        console.log("Treasury:   ", address(trsProxy));
        console.log("Token:      ", address(tokProxy));
        console.log("Governance: ", address(govProxy));
    }
}
