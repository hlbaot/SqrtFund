// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RoundFactory} from "../src/RoundFactory.sol";

/// @title DeployFactory
/// @notice Deploys ONLY a new RoundFactory on Avalanche Fuji, reusing the existing MockUSDC from deployments/fuji.json.
contract DeployFactory is Script {
    function run() external {
        string memory path = "deployments/fuji.json";
        string memory json = vm.readFile(path);
        address mockUsdcAddress = vm.parseJsonAddress(json, ".mockUsdc");

        console2.log("=== SqrtFund RoundFactory Deployment ===");
        console2.log("Reusing existing MockUSDC at:", mockUsdcAddress);

        vm.startBroadcast();
        RoundFactory factory = new RoundFactory(vm.envAddress("STUDENT_REGISTRY_ADDRESS"));
        vm.stopBroadcast();

        address factoryAddress = address(factory);
        console2.log("New RoundFactory deployed at:", factoryAddress);

        string memory jsonOutput = string.concat(
            "{\n",
            '  "chainId": 43113,\n',
            '  "mockUsdc": "', vm.toString(mockUsdcAddress), '",\n',
            '  "roundFactory": "', vm.toString(factoryAddress), '",\n',
            '  "studentRegistry": "', vm.toString(factory.studentRegistry()), '"\n',
            "}\n"
        );

        vm.writeFile(path, jsonOutput);
        console2.log("Updated deployments/fuji.json with new roundFactory address.");
    }
}
