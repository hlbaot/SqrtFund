// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {QFRound} from "./QFRound.sol";

/// @title RoundFactory
/// @notice Factory contract to deploy and track QFRounds on Avalanche Fuji.
contract RoundFactory is Ownable {
    address[] public rounds;

    event RoundCreated(address indexed roundAddress, address indexed admin, address token, string name);

    constructor() Ownable(msg.sender) {}

    /// @notice Deploys a new QFRound with admin = msg.sender. Callable only by the factory owner.
    function createRound(
        string calldata name,
        string calldata organizer,
        address token,
        uint256 startTime,
        uint256 endTime,
        uint256 minDonation,
        uint256 maxDonation,
        uint256 maxMatchBps
    ) external onlyOwner returns (address roundAddress) {
        QFRound round = new QFRound(
            name,
            organizer,
            msg.sender,
            token,
            startTime,
            endTime,
            minDonation,
            maxDonation,
            maxMatchBps
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
