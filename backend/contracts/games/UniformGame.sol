// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IGame} from "../interfaces/IGame.sol";

/// @notice One contract covers all three planned games. Each draws a number in
/// [0, range) and groups it into `numOutcomes` equal buckets.
///
///   High / Low:  range 100, 2 outcomes (0-49 low, 50-99 high), 1.96x
///   Exact Digit: range 10,  10 outcomes,                       9.8x
///   Block Race:  range 4,   4 outcomes (lanes),                3.92x
///
/// Every game has a 2% house edge: payout = numOutcomes * 0.98.
/// Modulo bias from a 256-bit seed is around 1e-75, so it's ignored.
contract UniformGame is IGame {
    uint256 public constant HOUSE_EDGE_BPS = 200;

    string private _name;
    uint256 public immutable range;
    uint8 public immutable override numOutcomes;

    error BadConfig();

    constructor(string memory name_, uint256 range_, uint8 numOutcomes_) {
        if (numOutcomes_ < 2 || range_ % numOutcomes_ != 0) revert BadConfig();
        _name = name_;
        range = range_;
        numOutcomes = numOutcomes_;
    }

    function name() external view returns (string memory) {
        return _name;
    }

    function payoutBps() external view returns (uint256) {
        return uint256(numOutcomes) * (10_000 - HOUSE_EDGE_BPS);
    }

    function rawResult(bytes32 seed) public view returns (uint256) {
        return uint256(seed) % range;
    }

    function outcome(bytes32 seed) external view returns (uint8) {
        return uint8(rawResult(seed) / (range / numOutcomes));
    }
}
