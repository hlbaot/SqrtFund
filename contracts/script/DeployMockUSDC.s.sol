// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @title DeployMockUSDC
/// @notice Deploys ONLY a new MockUSDC on Avalanche Fuji, preserving existing entries in deployments/fuji.json and adding a separate key.
contract DeployMockUSDC is Script {
    function run() external {
        string memory path = "deployments/fuji.json";
        string memory json = vm.readFile(path);
        uint256 chainId = vm.parseJsonUint(json, ".chainId");
        address mockUsdcAddress = vm.parseJsonAddress(json, ".mockUsdc");
        address factoryAddress = vm.parseJsonAddress(json, ".roundFactory");

        console2.log("=== SqrtFund MockUSDC Deployment ===");
        console2.log("Existing MockUSDC at:", mockUsdcAddress);
        console2.log("Existing RoundFactory at:", factoryAddress);

        vm.startBroadcast();
        MockUSDC usdc = new MockUSDC();
        vm.stopBroadcast();

        address newMockUsdcAddress = address(usdc);
        console2.log("New MockUSDC deployed at:", newMockUsdcAddress);

        string memory jsonOutput = string.concat(
            "{\n",
            '  "chainId": ', vm.toString(chainId), ',\n',
            '  "mockUsdc": "', vm.toString(mockUsdcAddress), '",\n',
            '  "roundFactory": "', vm.toString(factoryAddress), '",\n',
            '  "newMockUsdc": "', vm.toString(newMockUsdcAddress), '"\n',
            "}\n"
        );

        vm.writeFile(path, jsonOutput);
        console2.log("Updated deployments/fuji.json with separate newMockUsdc entry.");
    }
}
