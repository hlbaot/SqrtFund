// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Script, console2} from "forge-std/Script.sol";
import {StudentRegistry} from "../src/StudentRegistry.sol";

/// @notice Deploy identity separately; no factory, round or token is required.
contract DeployStudentRegistry is Script {
    function run() external {
        address attester = vm.envAddress("ATTESTER_ADDRESS");
        vm.startBroadcast();
        StudentRegistry registry = new StudentRegistry(attester);
        vm.stopBroadcast();
        console2.log("StudentRegistry deployed at:", address(registry));
        console2.log("Attester:", registry.attester());
        // The registry can be deployed before any factory; print its public address
        // for NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS.
    }
}
