// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Ví hợp đồng cho người dùng Core wallet (Avalanche), triển khai dạng clone EIP-1167 bởi WalletFactory.
/// Tính năng: execute / executeBatch, meta-transaction không gas (EIP-712), giới hạn chi tiêu hằng ngày và social recovery qua guardian có độ trễ.
contract SmartWallet is ReentrancyGuard {
    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    struct Recovery {
        address newOwner;
        uint64 executeAfter;
        uint32 approvals;
        uint32 round; // vòng khôi phục, vô hiệu hóa approval cũ khi bắt đầu lần mới
    }

    // --- EIP-712 (an toàn cho clone: domain tính khi cần, không dùng immutable) ---
    bytes32 private constant _DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant EXECUTE_TYPEHASH =
        keccak256("Execute(address target,uint256 value,bytes32 dataHash,uint256 nonce,uint256 deadline)");

    uint256 public constant MIN_RECOVERY_DELAY = 1 days;
    uint256 public constant MAX_GUARDIANS = 10;

    address public owner;
    bool private _initialized;
    uint256 public nonce;

    // Giới hạn AVAX native mỗi ngày; 0 = không giới hạn. Áp dụng cho owner và meta-tx.
    uint256 public dailyLimit;
    uint256 public spentToday;
    uint256 public windowStart;

    // Social recovery
    address[] private _guardians;
    mapping(address => bool) public isGuardian;
    uint32 public recoveryThreshold;
    uint64 public recoveryDelay;
    Recovery public recovery;
    mapping(uint32 => mapping(address => bool)) public recoveryApproved;

    error AlreadyInitialized();
    error NotOwner();
    error NotGuardian();
    error ZeroAddress();
    error LengthMismatch();
    error SignatureExpired();
    error InvalidSignature();
    error CallFailed(uint256 index, bytes reason);
    error DailyLimitExceeded();
    error InvalidThreshold();
    error TooManyGuardians();
    error DuplicateGuardian();
    error DelayTooShort();
    error NoRecovery();
    error AlreadyApproved();
    error RecoveryNotReady();

    event Initialized(address indexed owner);
    event Executed(address indexed target, uint256 value, bytes data);
    event DailyLimitUpdated(uint256 limit);
    event GuardiansUpdated(address[] guardians, uint32 threshold, uint64 delay);
    event RecoveryStarted(address indexed newOwner, address indexed by, uint64 executeAfter);
    event RecoveryApproved(address indexed guardian, uint32 approvals);
    event RecoveryCancelled();
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event Received(address indexed from, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        _initialized = true; // khóa implementation; ví thật là clone
    }

    function initialize(address initialOwner) external {
        if (_initialized) revert AlreadyInitialized();
        if (initialOwner == address(0)) revert ZeroAddress();
        _initialized = true;
        owner = initialOwner;
        emit Initialized(initialOwner);
    }

    receive() external payable {
        emit Received(msg.sender, msg.value);
    }

    // ------------------------------------------------------------------ execute

    function execute(address target, uint256 value, bytes calldata data)
        external
        nonReentrant
        onlyOwner
        returns (bytes memory)
    {
        return _call(target, value, data, 0);
    }

    function executeBatch(Call[] calldata calls) external nonReentrant onlyOwner {
        for (uint256 i = 0; i < calls.length; i++) {
            _call(calls[i].target, calls[i].value, calls[i].data, i);
        }
    }

    /// @notice Relayer bất kỳ có thể gửi lời gọi đã được owner ký và trả gas.
    function executeWithSig(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 deadline,
        bytes calldata signature
    ) external nonReentrant returns (bytes memory) {
        if (block.timestamp > deadline) revert SignatureExpired();
        bytes32 structHash =
            keccak256(abi.encode(EXECUTE_TYPEHASH, target, value, keccak256(data), nonce, deadline));
        if (ECDSA.recover(_hashTypedData(structHash), signature) != owner) revert InvalidSignature();
        nonce++;
        return _call(target, value, data, 0);
    }

    function _call(address target, uint256 value, bytes calldata data, uint256 index)
        internal
        returns (bytes memory)
    {
        if (target == address(0)) revert ZeroAddress();
        if (value > 0) _checkLimit(value);
        (bool ok, bytes memory ret) = target.call{value: value}(data);
        if (!ok) revert CallFailed(index, ret);
        emit Executed(target, value, data);
        return ret;
    }

    function _checkLimit(uint256 value) internal {
        uint256 limit = dailyLimit;
        if (limit == 0) return;
        if (block.timestamp >= windowStart + 1 days) {
            windowStart = block.timestamp;
            spentToday = 0;
        }
        if (spentToday + value > limit) revert DailyLimitExceeded();
        spentToday += value;
    }

    function setDailyLimit(uint256 limit) external onlyOwner {
        dailyLimit = limit;
        emit DailyLimitUpdated(limit);
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(_DOMAIN_TYPEHASH, keccak256("SqrtFundSmartWallet"), keccak256("1"), block.chainid, address(this))
        );
    }

    function _hashTypedData(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    // ----------------------------------------------------------------- guardians

    function guardians() external view returns (address[] memory) {
        return _guardians;
    }

    /// @notice Thay toàn bộ guardian và hủy recovery đang chờ.
    function setGuardians(address[] calldata newGuardians, uint32 threshold, uint64 delay) external onlyOwner {
        if (newGuardians.length > MAX_GUARDIANS) revert TooManyGuardians();
        if (delay < MIN_RECOVERY_DELAY) revert DelayTooShort();
        if (newGuardians.length == 0 ? threshold != 0 : (threshold == 0 || threshold > newGuardians.length)) {
            revert InvalidThreshold();
        }
        for (uint256 i = 0; i < _guardians.length; i++) {
            isGuardian[_guardians[i]] = false;
        }
        delete _guardians;
        for (uint256 i = 0; i < newGuardians.length; i++) {
            address g = newGuardians[i];
            if (g == address(0) || g == owner) revert ZeroAddress();
            if (isGuardian[g]) revert DuplicateGuardian();
            isGuardian[g] = true;
            _guardians.push(g);
        }
        recoveryThreshold = threshold;
        recoveryDelay = delay;
        _clearRecovery();
        emit GuardiansUpdated(newGuardians, threshold, delay);
    }

    // ------------------------------------------------------------------ recovery

    /// @notice Guardian đề xuất owner mới (tính là approval của họ) và mở vòng mới.
    function startRecovery(address newOwner) external {
        if (!isGuardian[msg.sender]) revert NotGuardian();
        if (newOwner == address(0)) revert ZeroAddress();
        uint32 round = recovery.round + 1;
        recovery = Recovery({
            newOwner: newOwner,
            executeAfter: uint64(block.timestamp) + recoveryDelay,
            approvals: 1,
            round: round
        });
        recoveryApproved[round][msg.sender] = true;
        emit RecoveryStarted(newOwner, msg.sender, recovery.executeAfter);
        emit RecoveryApproved(msg.sender, 1);
    }

    function approveRecovery() external {
        if (!isGuardian[msg.sender]) revert NotGuardian();
        Recovery storage r = recovery;
        if (r.newOwner == address(0)) revert NoRecovery();
        if (recoveryApproved[r.round][msg.sender]) revert AlreadyApproved();
        recoveryApproved[r.round][msg.sender] = true;
        r.approvals++;
        emit RecoveryApproved(msg.sender, r.approvals);
    }

    /// @notice Ai cũng có thể hoàn tất khi đủ threshold và hết thời gian chờ.
    function executeRecovery() external {
        Recovery memory r = recovery;
        if (r.newOwner == address(0)) revert NoRecovery();
        if (r.approvals < recoveryThreshold || block.timestamp < r.executeAfter) revert RecoveryNotReady();
        address previous = owner;
        owner = r.newOwner;
        // Guardian cũ có thể trùng owner mới; loại ra để giữ bất biến owner != guardian.
        if (isGuardian[r.newOwner]) _removeGuardian(r.newOwner);
        _clearRecovery();
        emit OwnerChanged(previous, r.newOwner);
    }

    /// @notice Owner hiện tại có thể hủy recovery sai/độc hại trong thời gian chờ.
    function cancelRecovery() external onlyOwner {
        if (recovery.newOwner == address(0)) revert NoRecovery();
        _clearRecovery();
        emit RecoveryCancelled();
    }

    function _clearRecovery() internal {
        recovery.newOwner = address(0);
        recovery.executeAfter = 0;
        recovery.approvals = 0;
    }

    function _removeGuardian(address g) internal {
        isGuardian[g] = false;
        for (uint256 i = 0; i < _guardians.length; i++) {
            if (_guardians[i] == g) {
                _guardians[i] = _guardians[_guardians.length - 1];
                _guardians.pop();
                break;
            }
        }
        if (recoveryThreshold > _guardians.length) recoveryThreshold = uint32(_guardians.length);
    }
}
