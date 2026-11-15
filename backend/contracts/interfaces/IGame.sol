// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice A game maps a seed to one of `numOutcomes()` equally likely outcomes.
/// A bet picks one outcome. If it matches, the bet pays `payoutBps()` / 10_000
/// times the stake (stake included).
interface IGame {
    function name() external view returns (string memory);

    function numOutcomes() external view returns (uint8);

    /// @notice Total payout multiplier in basis points. 19_600 = 1.96x.
    function payoutBps() external view returns (uint256);

    /// @notice The raw number shown in the UI (for example 0-99 for High / Low).
    function rawResult(bytes32 seed) external view returns (uint256);

    /// @notice The winning outcome index, in [0, numOutcomes()).
    function outcome(bytes32 seed) external view returns (uint8);
}
