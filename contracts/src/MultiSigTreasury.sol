// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice M-of-N multisig treasury for platform funds (AVAX and any token via arbitrary calls).
/// Owner set and threshold can only be changed through the multisig itself.
contract MultiSigTreasury is ReentrancyGuard {
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint32 confirmations;
    }

    address[] private _owners;
    mapping(address => bool) public isOwner;
    uint32 public threshold;

    Transaction[] private _txs;
    mapping(uint256 => mapping(address => bool)) public confirmed;

    error NotOwner();
    error NotSelf();
    error ZeroAddress();
    error DuplicateOwner();
    error InvalidThreshold();
    error InvalidTx();
    error AlreadyExecuted();
    error AlreadyConfirmed();
    error NotConfirmed();
    error NotEnoughConfirmations();
    error CallFailed(bytes reason);

    event Submitted(uint256 indexed txId, address indexed proposer, address indexed to, uint256 value, bytes data);
    event Confirmed(uint256 indexed txId, address indexed owner);
    event Revoked(uint256 indexed txId, address indexed owner);
    event Executed(uint256 indexed txId);
    event Deposit(address indexed from, uint256 amount);
    event OwnerAdded(address indexed owner);
    event OwnerRemoved(address indexed owner);
    event ThresholdChanged(uint32 threshold);

    modifier onlyOwner() {
        if (!isOwner[msg.sender]) revert NotOwner();
        _;
    }

    modifier onlySelf() {
        if (msg.sender != address(this)) revert NotSelf();
        _;
    }

    constructor(address[] memory owners_, uint32 threshold_) {
        if (threshold_ == 0 || threshold_ > owners_.length) revert InvalidThreshold();
        for (uint256 i = 0; i < owners_.length; i++) {
            address o = owners_[i];
            if (o == address(0)) revert ZeroAddress();
            if (isOwner[o]) revert DuplicateOwner();
            isOwner[o] = true;
            _owners.push(o);
        }
        threshold = threshold_;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function owners() external view returns (address[] memory) {
        return _owners;
    }

    function txCount() external view returns (uint256) {
        return _txs.length;
    }

    function getTransaction(uint256 txId) external view returns (Transaction memory) {
        if (txId >= _txs.length) revert InvalidTx();
        return _txs[txId];
    }

    /// @notice Propose a transaction; the proposer's confirmation is recorded automatically.
    function submit(address to, uint256 value, bytes calldata data) external onlyOwner returns (uint256 txId) {
        if (to == address(0)) revert ZeroAddress();
        txId = _txs.length;
        _txs.push(Transaction({to: to, value: value, data: data, executed: false, confirmations: 0}));
        emit Submitted(txId, msg.sender, to, value, data);
        _confirm(txId);
    }

    function confirm(uint256 txId) external onlyOwner {
        _confirm(txId);
    }

    function revoke(uint256 txId) external onlyOwner {
        Transaction storage t = _get(txId);
        if (!confirmed[txId][msg.sender]) revert NotConfirmed();
        confirmed[txId][msg.sender] = false;
        t.confirmations--;
        emit Revoked(txId, msg.sender);
    }

    function execute(uint256 txId) external nonReentrant onlyOwner {
        Transaction storage t = _get(txId);
        if (t.confirmations < threshold) revert NotEnoughConfirmations();
        t.executed = true;
        (bool ok, bytes memory ret) = t.to.call{value: t.value}(t.data);
        if (!ok) revert CallFailed(ret);
        emit Executed(txId);
    }

    // ---- governance (reachable only via submit -> execute against address(this)) ----

    function addOwner(address o) external onlySelf {
        if (o == address(0)) revert ZeroAddress();
        if (isOwner[o]) revert DuplicateOwner();
        isOwner[o] = true;
        _owners.push(o);
        emit OwnerAdded(o);
    }

    function removeOwner(address o) external onlySelf {
        if (!isOwner[o]) revert NotOwner();
        if (_owners.length - 1 < threshold) revert InvalidThreshold();
        isOwner[o] = false;
        for (uint256 i = 0; i < _owners.length; i++) {
            if (_owners[i] == o) {
                _owners[i] = _owners[_owners.length - 1];
                _owners.pop();
                break;
            }
        }
        emit OwnerRemoved(o);
    }

    function changeThreshold(uint32 next) external onlySelf {
        if (next == 0 || next > _owners.length) revert InvalidThreshold();
        threshold = next;
        emit ThresholdChanged(next);
    }

    function _confirm(uint256 txId) internal {
        Transaction storage t = _get(txId);
        if (confirmed[txId][msg.sender]) revert AlreadyConfirmed();
        confirmed[txId][msg.sender] = true;
        t.confirmations++;
        emit Confirmed(txId, msg.sender);
    }

    function _get(uint256 txId) internal view returns (Transaction storage t) {
        if (txId >= _txs.length) revert InvalidTx();
        t = _txs[txId];
        if (t.executed) revert AlreadyExecuted();
    }
}
