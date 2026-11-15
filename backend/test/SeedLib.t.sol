// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SeedLib} from "../contracts/lib/SeedLib.sol";
import {UniformGame} from "../contracts/games/UniformGame.sol";

/// External wrapper so expectRevert can see a library revert.
contract WeightedHarness {
    function pick(bytes32 seed, uint256[] memory w) external pure returns (uint256) {
        return SeedLib.weighted(seed, 0, w);
    }
}

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

    // ------------------------------------------------------------ toolkit

    function testFuzz_ChanceExtremes(bytes32 seed, uint256 index) public pure {
        assertFalse(SeedLib.chance(seed, index, 0));
        assertTrue(SeedLib.chance(seed, index, 10_000));
    }

    function testFuzz_WeightedNeverPicksZeroWeight(bytes32 seed, uint256 index) public pure {
        uint256[] memory w = new uint256[](3);
        (w[0], w[1], w[2]) = (5, 0, 5);
        assertTrue(SeedLib.weighted(seed, index, w) != 1);
    }

    function test_WeightedRevertsWithoutWeight() public {
        WeightedHarness h = new WeightedHarness();
        vm.expectRevert(SeedLib.NoWeight.selector);
        h.pick(keccak256("s"), new uint256[](2));
    }

    /// 8,000 picks with weights 1:3 should land near 25% / 75%.
    function test_WeightedFollowsWeights() public pure {
        uint256[] memory w = new uint256[](2);
        (w[0], w[1]) = (1, 3);
        bytes32 seed = keccak256("weights");
        uint256 ones;
        for (uint256 i; i < 8_000; ++i) {
            ones += SeedLib.weighted(seed, i, w);
        }
        assertGt(ones, 5_700); // expected 6,000
        assertLt(ones, 6_300);
    }

    /// 10,000 game seeds: the coin should be near 50/50.
    function test_CoinIsFair() public pure {
        uint256 heads;
        for (uint256 r; r < 10_000; ++r) {
            if (SeedLib.coin(SeedLib.gameSeed(keccak256(abi.encode("walk", r)), 4))) heads++;
        }
        assertGt(heads, 4_800);
        assertLt(heads, 5_200);
    }

    function testFuzz_CrashAtLeastOne(bytes32 seed) public pure {
        assertGe(SeedLib.crashX100(seed), 100);
    }

    /// Crash's promise: every target returns about 0.98 per chip. 20,000 rounds
    /// through the real pipeline, checked at 1.25x, 2x and 5x. Win rate should
    /// be near 98 / target; bounds are wide enough never to flake.
    function test_CrashEdgeIsTwoPercentAtEveryTarget() public pure {
        uint256[3] memory targets = [uint256(125), 200, 500];
        uint256[3] memory wins;
        uint256 instant;
        uint256 n = 20_000;
        for (uint256 r; r < n; ++r) {
            uint256 x = SeedLib.crashX100(SeedLib.gameSeed(keccak256(abi.encode("pyth", r)), 3));
            if (x == 100) instant++;
            for (uint256 t; t < 3; ++t) {
                if (x >= targets[t]) wins[t]++;
            }
        }
        // Expected wins: 98/125 = 78.4%, 49%, 19.6%. Return = winRate * target / 100.
        for (uint256 t; t < 3; ++t) {
            uint256 returnBps = (wins[t] * targets[t] * 100) / n; // 9,800 means 0.98
            assertGt(returnBps, 9_500);
            assertLt(returnBps, 10_100);
        }
        assertGt(instant, 250); // about 2% = 400
        assertLt(instant, 600);
    }
}
