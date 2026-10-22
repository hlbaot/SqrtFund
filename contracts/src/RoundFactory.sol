// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PrefundedQFRound} from "./PrefundedQFRound.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title RoundFactory
/// @notice Multi-Organizer round factory with wallet-owned deposits before creation.
contract RoundFactory is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    address[] public rounds;
    mapping(address depositor => mapping(address token => uint256 amount)) public initialPoolDeposits;
    address public immutable studentRegistry;
    // Quyền này chỉ cho phép tạo vòng mới, không cấp quyền quản trị vòng của ví khác.
    mapping(address => bool) public authorizedOrganizers;
    error InvalidRegistry();
    error InvalidDeposit();
    error InsufficientDeposit();
    error UnsupportedToken();
    event InitialPoolDeposited(address indexed depositor, address indexed token, uint256 amount);
    event InitialPoolWithdrawn(address indexed depositor, address indexed token, uint256 amount);

    function fundingVersion() external pure returns (uint256) { return 1; }

    /// @notice Reserve funds before creating any round. Credits belong to the depositing wallet.
    function depositInitialPool(address token, uint256 amount) external nonReentrant onlyOrganizer {
        if (amount == 0 || token.code.length == 0) revert InvalidDeposit();
        IERC20 asset = IERC20(token);
        uint256 beforeBalance = asset.balanceOf(address(this));
        asset.safeTransferFrom(msg.sender, address(this), amount);
        if (asset.balanceOf(address(this)) != beforeBalance + amount) revert UnsupportedToken();
        initialPoolDeposits[msg.sender][token] += amount;
        emit InitialPoolDeposited(msg.sender, token, amount);
    }

    /// @notice Refund unused credit, including after factory ownership has changed.
    function withdrawInitialPool(address token, uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidDeposit();
        if (initialPoolDeposits[msg.sender][token] < amount) revert InsufficientDeposit();
        initialPoolDeposits[msg.sender][token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit InitialPoolWithdrawn(msg.sender, token, amount);
    }

    event RoundCreated(address indexed roundAddress, address indexed admin, address token, string name);
    event OrganizerUpdated(address indexed organizer, bool authorized);

    modifier onlyOrganizer() {
        // Platform Owner vẫn được tạo vòng mà không cần tự thêm vào danh sách Organizer.
        require(authorizedOrganizers[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor(address registry) Ownable(msg.sender) {
        if (registry == address(0) || registry.code.length == 0) revert InvalidRegistry();
        studentRegistry = registry;
    }

    /// @notice Platform Owner cấp hoặc thu hồi quyền tạo vòng của một ví Organizer.
    /// @dev Thu hồi không thay đổi admin hoặc nguồn quỹ của các QFRound đã tạo (BR-08).
    function setOrganizer(address organizer, bool authorized) external onlyOwner {
        require(organizer != address(0), "Invalid address");
        authorizedOrganizers[organizer] = authorized;
        emit OrganizerUpdated(organizer, authorized);
    }

    /// @notice Owner hoặc Organizer được phê duyệt tạo QFRound với admin là ví gọi hàm.
    /// @dev Chuỗi organizer chỉ là tên hiển thị; quyền được kiểm tra bằng địa chỉ msg.sender.
    function createRound(
        string calldata name,
        string calldata organizer,
        address token,
        uint256 startTime,
        uint256 endTime,
        uint256 minDonation,
        uint256 maxDonation,
        uint256 maxMatchBps,
        uint256 maxPerRound
    ) external nonReentrant onlyOrganizer returns (address roundAddress) {
        return _createRound(name, organizer, token, startTime, endTime, minDonation, maxDonation, maxMatchBps, maxPerRound, 0);
    }

    /// @notice Consumes this wallet's confirmed deposit. Any failure restores both funds and credit.
    function createFundedRound(
        string calldata name, string calldata organizer, address token,
        uint256 startTime, uint256 endTime, uint256 minDonation, uint256 maxDonation,
        uint256 maxMatchBps, uint256 maxPerRound, uint256 initialPool
    ) external nonReentrant onlyOrganizer returns (address roundAddress) {
        if (initialPool == 0) revert InvalidDeposit();
        if (initialPoolDeposits[msg.sender][token] < initialPool) revert InsufficientDeposit();
        initialPoolDeposits[msg.sender][token] -= initialPool;
        return _createRound(name, organizer, token, startTime, endTime, minDonation, maxDonation, maxMatchBps, maxPerRound, initialPool);
    }

    function _createRound(
        string calldata name, string calldata organizer, address token,
        uint256 startTime, uint256 endTime, uint256 minDonation, uint256 maxDonation,
        uint256 maxMatchBps, uint256 maxPerRound, uint256 initialPool
    ) private returns (address roundAddress) {
        PrefundedQFRound round = new PrefundedQFRound(
            name,
            organizer,
            msg.sender, // Cố định admin theo ví tạo vòng, không cho truyền một admin tùy ý.
            token,
            startTime,
            endTime,
            minDonation,
            maxDonation,
            maxMatchBps,
            maxPerRound,
            studentRegistry,
            initialPool
        );

        roundAddress = address(round);
        if (initialPool > 0) {
            IERC20 asset = IERC20(token);
            uint256 beforeBalance = asset.balanceOf(roundAddress);
            asset.safeTransfer(roundAddress, initialPool);
            if (asset.balanceOf(roundAddress) != beforeBalance + initialPool) revert UnsupportedToken();
        }
        rounds.push(roundAddress);

        emit RoundCreated(roundAddress, msg.sender, token, name);
    }

    /// @notice Returns total number of deployed rounds.
    function roundCount() external view returns (uint256) {
        return rounds.length;
    }

    /// @notice Returns list of all deployed rounds.
    function getRounds() external view returns (address[] memory) {
        return rounds;
    }
}
