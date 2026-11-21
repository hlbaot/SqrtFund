// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {SmartWallet} from "./SmartWallet.sol";

/// @notice Triển khai clone SmartWallet tại địa chỉ xác định (CREATE2), nên có thể hiển thị và nạp tiền vào ví trước khi deploy.
contract WalletFactory {
    address public immutable implementation;

    mapping(address => address[]) private _walletsOf;
    mapping(address => address) public ownerOfWallet;
    uint256 public walletCount;

    error ZeroAddress();

    event WalletCreated(address indexed wallet, address indexed owner, bytes32 salt);

    constructor() {
        implementation = address(new SmartWallet());
    }

    function createWallet(address walletOwner, bytes32 salt) external returns (address wallet) {
        if (walletOwner == address(0)) revert ZeroAddress();
        bytes32 finalSalt = _salt(walletOwner, salt);
        wallet = Clones.predictDeterministicAddress(implementation, finalSalt, address(this));
        // Idempotent: trả về ví đã có thay vì revert.
        if (wallet.code.length > 0) return wallet;
        wallet = Clones.cloneDeterministic(implementation, finalSalt);
        SmartWallet(payable(wallet)).initialize(walletOwner);
        _walletsOf[walletOwner].push(wallet);
        ownerOfWallet[wallet] = walletOwner;
        walletCount++;
        emit WalletCreated(wallet, walletOwner, salt);
    }

    function getAddress(address walletOwner, bytes32 salt) external view returns (address) {
        return Clones.predictDeterministicAddress(implementation, _salt(walletOwner, salt), address(this));
    }

    function walletsOf(address walletOwner) external view returns (address[] memory) {
        return _walletsOf[walletOwner];
    }

    function _salt(address walletOwner, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encode(walletOwner, salt));
    }
}
