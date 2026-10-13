// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {RoundFactory} from "../src/RoundFactory.sol";

/// @title Deploy
/// @notice Deploys MockUSDC and RoundFactory on Avalanche Fuji.
contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        MockUSDC usdc = new MockUSDC();
        RoundFactory factory = new RoundFactory();

        vm.stopBroadcast();

        address usdcAddress = address(usdc);
        address factoryAddress = address(factory);

        console2.log("=== SqrtFund Deployment ===");
        console2.log("MockUSDC deployed at:", usdcAddress);
        console2.log("RoundFactory deployed at:", factoryAddress);

        string memory jsonOutput = string.concat(
            "{\n",
            '  "chainId": 43113,\n',
            '  "mockUsdc": "', vm.toString(usdcAddress), '",\n',
            '  "roundFactory": "', vm.toString(factoryAddress), '"\n',
            "}\n"
        );

        vm.writeFile("deployments/fuji.json", jsonOutput);
        console2.log("Deployment info written to deployments/fuji.json");
    }
}
