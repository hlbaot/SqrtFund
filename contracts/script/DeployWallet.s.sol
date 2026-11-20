// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Script, console2} from "forge-std/Script.sol";
import {WalletFactory} from "../src/WalletFactory.sol";
import {MultiSigTreasury} from "../src/MultiSigTreasury.sol";

/// @notice Deploy WalletFactory (and optionally a MultiSigTreasury when TREASURY_OWNERS is set).
/// TREASURY_OWNERS: comma separated addresses; TREASURY_THRESHOLD: uint.
contract DeployWallet is Script {
    function run() external {
        vm.startBroadcast();
        WalletFactory factory = new WalletFactory();
        console2.log("WalletFactory deployed at:", address(factory));
        console2.log("SmartWallet implementation:", factory.implementation());

        address[] memory owners = vm.envOr("TREASURY_OWNERS", ",", new address[](0));
        if (owners.length > 0) {
            uint32 threshold = uint32(vm.envUint("TREASURY_THRESHOLD"));
            MultiSigTreasury treasury = new MultiSigTreasury(owners, threshold);
            console2.log("MultiSigTreasury deployed at:", address(treasury));
        }
        vm.stopBroadcast();
    }
}
