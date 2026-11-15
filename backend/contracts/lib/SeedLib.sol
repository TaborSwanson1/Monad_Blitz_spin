// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SeedLib
/// @notice The single place that turns a round's VRF number into game randomness.
///
///   Pyth Entropy ──► roundSeed (one per round, bytes32)
///                       │
///                       ├─ gameSeed(roundSeed, 0) ──► High / Low
///                       ├─ gameSeed(roundSeed, 1) ──► Exact Digit
///                       ├─ gameSeed(roundSeed, 2) ──► Block Race
///                       └─ gameSeed(roundSeed, id) ─► any future game
///                                  │
///                                  ├─ uint256(gameSeed)       the game's main number
///                                  └─ draw(gameSeed, i)       extra numbers (per lane, per step, ...)
///
/// Two conventions every game follows:
///   1. Functions that take only a seed use the seed's own value (the main number).
///   2. Functions that take (seed, index) hash first: draw(seed, index). Use a
///      different index for every unrelated thing, so no number is reused.
///
/// Every function is pure, so anyone can recompute a result from the public
/// round seed. `sdk/seedlib.mjs` is the JavaScript copy, and
/// test/SeedVectors.t.sol checks that both give the same answers.
/// The frontend copies `gameSeed` and `crashX100`: changing either breaks it
/// (see frontend/INTEGRATION.md, sync item 3).
library SeedLib {
    uint256 internal constant BPS = 10_000;
    uint256 internal constant TWO_52 = 1 << 52;

    error NoWeight();

    // ------------------------------------------------------------ derivation

    /// @notice Independent seed for one game in one round.
    /// @dev keccak256(abi.encode(bytes32, uint8)). Must match the frontend exactly.
    function gameSeed(bytes32 roundSeed, uint8 gameId) internal pure returns (bytes32) {
        return keccak256(abi.encode(roundSeed, gameId));
    }

    /// @notice The i-th independent 256-bit number derived from a seed.
    /// For games that need more than one number per round: a speed per lane,
    /// a value per block step, a card per player.
    function draw(bytes32 seed, uint256 index) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(seed, index)));
    }

    // ------------------------------------------------------------ distributions

    /// @notice A number in [0, n). Modulo bias from a 256-bit value is below
    /// n / 2^256, so for any game-sized n it can be ignored.
    function uniform(bytes32 seed, uint256 index, uint256 n) internal pure returns (uint256) {
        return draw(seed, index) % n;
    }

    /// @notice True with probability bps / 10_000. chance(s, i, 2_500) is 25%.
    function chance(bytes32 seed, uint256 index, uint256 bps) internal pure returns (bool) {
        return uniform(seed, index, BPS) < bps;
    }

    /// @notice Picks index k with probability weights[k] / sum(weights).
    /// Weights [1, 1, 2] give 25%, 25%, 50%. Reverts if every weight is 0.
    function weighted(bytes32 seed, uint256 index, uint256[] memory weights) internal pure returns (uint256) {
        uint256 total;
        for (uint256 k; k < weights.length; ++k) {
            total += weights[k];
        }
        if (total == 0) revert NoWeight();
        uint256 r = uniform(seed, index, total);
        for (uint256 k; k < weights.length; ++k) {
            if (r < weights[k]) return k;
            r -= weights[k];
        }
        revert NoWeight(); // unreachable
    }

    /// @notice A fair coin from the seed's main number: true means up / heads.
    /// Block Walk step k: coin(gameSeed(roundSeed of round r + k, walkGameId)).
    function coin(bytes32 seed) internal pure returns (bool) {
        return uint256(seed) & 1 == 1;
    }

    // ------------------------------------------------------------ game curves

    /// @notice Crash point in hundredths (237 = 2.37x), from the seed's main number.
    /// Same as frontend/src/lib/crash.ts:
    ///   r = seed % 2^52;  x = 98 * 2^52 / (2^52 - r);  at least 100.
    /// P(crashX100 >= T) = 98 / T, so any target T returns 0.98 per chip: a 2% edge.
    /// About 2% of rounds crash instantly at 1.00x.
    function crashX100(bytes32 seed) internal pure returns (uint256 x) {
        uint256 r = uint256(seed) % TWO_52;
        x = (98 * TWO_52) / (TWO_52 - r);
        if (x < 100) x = 100;
    }
}
