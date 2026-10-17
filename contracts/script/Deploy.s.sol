// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {StudentRegistry} from "../src/StudentRegistry.sol";
import {RoundFactory} from "../src/RoundFactory.sol";

/// @title Deploy
/// @notice Deploys MockUSDC and RoundFactory on Avalanche Fuji.
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        MockUSDC usdc = new MockUSDC();
        StudentRegistry registry = new StudentRegistry(vm.envAddress("ATTESTER_ADDRESS"));
        RoundFactory factory = new RoundFactory(address(registry));

        vm.stopBroadcast();

        address usdcAddress = address(usdc);
        address factoryAddress = address(factory);

        console2.log("=== SqrtFund Deployment ===");
        console2.log("MockUSDC deployed at:", usdcAddress);
        console2.log("RoundFactory deployed at:", factoryAddress);
        console2.log("StudentRegistry deployed at:", address(registry));

        string memory jsonOutput = string.concat(
            "{\n",
            '  "chainId": 43113,\n',
            '  "mockUsdc": "', vm.toString(usdcAddress), '",\n',
            '  "roundFactory": "', vm.toString(factoryAddress), '",\n',
            '  "studentRegistry": "', vm.toString(address(registry)), '"\n',
            "}\n"
        );

        vm.writeFile("deployments/fuji.json", jsonOutput);
        console2.log("Deployment info written to deployments/fuji.json");
    }
}
