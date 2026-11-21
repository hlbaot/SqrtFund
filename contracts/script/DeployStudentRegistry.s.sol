// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Script, console2} from "forge-std/Script.sol";
import {StudentRegistry} from "../src/StudentRegistry.sol";

/// @notice Triển khai identity riêng; không cần factory, round hay token.
contract DeployStudentRegistry is Script {
    function run() external {
        address attester = vm.envAddress("ATTESTER_ADDRESS");
        vm.startBroadcast();
        StudentRegistry registry = new StudentRegistry(attester);
        vm.stopBroadcast();
        console2.log("StudentRegistry deployed at:", address(registry));
        console2.log("Attester:", registry.attester());
        // Registry có thể deploy trước factory; in địa chỉ công khai
        // cho NEXT_PUBLIC_STUDENT_REGISTRY_ADDRESS.
    }
}
