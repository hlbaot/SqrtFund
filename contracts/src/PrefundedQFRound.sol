// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {QFRound} from "./QFRound.sol";

/// @notice Initial pool accounting for rounds funded atomically by RoundFactory.
/// @dev The factory must transfer the tokens in the same creation transaction.
contract PrefundedQFRound is QFRound {
    constructor(
        string memory roundName, string memory roundOrganizer, address roundAdmin, address asset,
        uint256 start, uint256 end, uint256 minimum, uint256 maximum, uint256 matchBps,
        uint256 budget, address registry, uint256 initialPool
    ) QFRound(roundName, roundOrganizer, roundAdmin, asset, start, end, minimum, maximum, matchBps, budget, registry) {
        pool = initialPool;
        if (initialPool > 0) emit PoolDeposited(roundAdmin, initialPool, initialPool);
    }
}
