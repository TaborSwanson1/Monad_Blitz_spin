// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SeedLib} from "../contracts/lib/SeedLib.sol";
import {UniformGame} from "../contracts/games/UniformGame.sol";

contract SeedLibTest is Test {
    /// The frontend computes keccak256(encodeAbiParameters([bytes32, uint8], [seed, id])).
    /// abi.encode pads uint8 to 32 bytes, so this is the 64-byte layout both sides hash.
    function test_GameSeedMatchesFrontendLayout() public pure {
        bytes32 roundSeed = keccak256("round");
        bytes memory packed = bytes.concat(roundSeed, bytes32(uint256(2)));
        assertEq(SeedLib.gameSeed(roundSeed, 2), keccak256(packed));
    }

    function test_GamesGetDifferentSeeds() public pure {
        bytes32 s = keccak256("round");
        assertTrue(SeedLib.gameSeed(s, 0) != SeedLib.gameSeed(s, 1));
        assertTrue(SeedLib.gameSeed(s, 1) != SeedLib.gameSeed(s, 2));
    }

    function test_DrawsAreIndependentOfEachOther() public pure {
        bytes32 g = keccak256("game");
        assertTrue(SeedLib.draw(g, 0) != SeedLib.draw(g, 1));
        assertTrue(SeedLib.draw(g, 0) != uint256(g));
    }

    function testFuzz_UniformInRange(bytes32 seed, uint256 index, uint256 n) public pure {
        n = bound(n, 1, type(uint64).max);
        assertLt(SeedLib.uniform(seed, index, n), n);
    }

    /// Rough fairness check: 4,000 rounds of Exact Digit through the real
    /// pipeline (round seed → game seed → UniformGame). Each digit should land
    /// near 400. The bounds are ±25%, loose enough never to flake.
    function test_ExactDigitIsRoughlyUniform() public {
        UniformGame digit = new UniformGame("Exact Digit", 10, 10);
        uint256[10] memory counts;
        for (uint256 r; r < 4_000; ++r) {
            bytes32 roundSeed = keccak256(abi.encode("pyth", r));
            counts[digit.outcome(SeedLib.gameSeed(roundSeed, 1))]++;
        }
        for (uint256 d; d < 10; ++d) {
            assertGt(counts[d], 300);
            assertLt(counts[d], 500);
        }
    }
}
