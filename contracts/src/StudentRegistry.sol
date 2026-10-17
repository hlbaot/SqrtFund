// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Shared student identity. A verification applies to every round using this registry.
contract StudentRegistry is Ownable, EIP712 {
    address public attester;
    mapping(address => bool) public isStudent;
    mapping(bytes32 => address) public emailOwner;
    mapping(address => bytes32) public walletEmail;
    bytes32 public constant STUDENT_VERIFICATION_TYPEHASH = keccak256(
        "StudentVerification(address student,bytes32 emailHash,uint256 expiry)"
    );
    error ZeroAddress();
    error InvalidEmailHash();
    error VerificationExpired();
    error InvalidAttestation();
    error EmailAlreadyUsed();
    error StudentAlreadyVerified();
    event StudentVerified(address indexed student, bytes32 indexed emailHash);
    event AttesterUpdated(address indexed attester);

    constructor(address initialAttester) Ownable(msg.sender) EIP712("SqrtFundStudentRegistry", "1") {
        if (initialAttester == address(0)) revert ZeroAddress();
        attester = initialAttester;
    }
    function setAttester(address next) external onlyOwner {
        if (next == address(0)) revert ZeroAddress();
        attester = next;
        emit AttesterUpdated(next);
    }
    function verifyStudent(bytes32 emailHash, uint256 expiry, bytes calldata signature) external {
        if (block.timestamp > expiry) revert VerificationExpired();
        if (emailHash == bytes32(0)) revert InvalidEmailHash();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            STUDENT_VERIFICATION_TYPEHASH, msg.sender, emailHash, expiry
        )));
        if (ECDSA.recover(digest, signature) != attester) revert InvalidAttestation();
        address owner = emailOwner[emailHash];
        if (owner != address(0) && owner != msg.sender) revert EmailAlreadyUsed();
        if (isStudent[msg.sender] && walletEmail[msg.sender] != emailHash) revert StudentAlreadyVerified();
        emailOwner[emailHash] = msg.sender;
        walletEmail[msg.sender] = emailHash;
        isStudent[msg.sender] = true;
        emit StudentVerified(msg.sender, emailHash);
    }
}
