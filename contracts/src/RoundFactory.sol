// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {QFRound} from "./QFRound.sol";

/// @title RoundFactory
/// @notice Factory tạo và theo dõi các vòng gọi vốn của nhiều Organizer trên Avalanche Fuji.
contract RoundFactory is Ownable {
    address[] public rounds;
    address public immutable studentRegistry;
    // Quyền này chỉ cho phép tạo vòng mới, không cấp quyền quản trị vòng của ví khác.
    mapping(address => bool) public authorizedOrganizers;
    error InvalidRegistry();

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
    ) external onlyOrganizer returns (address roundAddress) {
        QFRound round = new QFRound(
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
            studentRegistry
        );

        roundAddress = address(round);
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
