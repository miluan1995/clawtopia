// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

interface IAgentRegistry {
    function isAgent(address) external view returns (bool);
}
