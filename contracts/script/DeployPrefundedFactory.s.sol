// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RoundFactory} from "../src/RoundFactory.sol";

/// @notice Deploy only the deposit-before-creation factory, preserving old deployment records.
contract DeployPrefundedFactory is Script {
    function run() external {
        address registry = vm.envAddress("STUDENT_REGISTRY_ADDRESS");
        vm.startBroadcast();
        RoundFactory factory = new RoundFactory(registry);
        vm.stopBroadcast();
        console2.log("Prefunded Factory:", address(factory));
        console2.log("Owner:", factory.owner());
        console2.log("StudentRegistry:", factory.studentRegistry());
        console2.log("Funding version:", factory.fundingVersion());
        // Update manifests and frontend configuration only after checking the real receipt.
    }
}
