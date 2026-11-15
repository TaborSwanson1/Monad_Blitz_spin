// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice A source of verifiable randomness. The casino only talks to this,
/// so the provider (Pyth Entropy, a mock, something else) can be swapped.
interface IRandomnessSource {
    /// @notice Fee in native MON for one request.
    function fee() external view returns (uint256);

    /// @notice Ask for a random number. The source calls back the sender's
    /// `onRandomness` later with the same request ID.
    function request() external payable returns (uint64 requestId);
}

interface IRandomnessConsumer {
    function onRandomness(uint64 requestId, bytes32 randomNumber) external;
}
