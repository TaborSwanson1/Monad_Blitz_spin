// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ChipToken} from "../contracts/ChipToken.sol";
import {BlockCasino} from "../contracts/BlockCasino.sol";
import {UniformGame} from "../contracts/games/UniformGame.sol";
import {MockRandomness} from "../contracts/randomness/MockRandomness.sol";
import {IGame} from "../contracts/interfaces/IGame.sol";

contract BlockCasinoTest is Test {
    uint256 constant ROUND = 20;
    uint256 constant WINDOW = 15;
    uint256 constant TIMEOUT = 100;
    uint256 constant FEE = 0.01 ether;

    ChipToken chips;
    MockRandomness rng;
    BlockCasino casino;
    UniformGame highLow;
    UniformGame digit;
    UniformGame race;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        chips = new ChipToken();
        rng = new MockRandomness(FEE);
        highLow = new UniformGame("High / Low", 100, 2);
        digit = new UniformGame("Exact Digit", 10, 10);
        race = new UniformGame("Block Race", 4, 4);

        IGame[] memory games = new IGame[](3);
        games[0] = highLow;
        games[1] = digit;
        games[2] = race;
        casino = new BlockCasino(chips, rng, games, ROUND, WINDOW, TIMEOUT, 1e18, 500e18);
        chips.setMinter(address(casino));

        for (uint256 i; i < 2; ++i) {
            address p = i == 0 ? alice : bob;
            vm.startPrank(p);
            chips.faucet();
            chips.approve(address(casino), type(uint256).max);
            vm.stopPrank();
            vm.deal(p, 1 ether);
        }
    }

    // ---- helpers

    /// Finds a seed whose High / Low outcome for round 0 matches `want`.
    function _seedFor(uint8 gameId, uint8 want) internal view returns (bytes32 seed) {
        IGame g = casino.games(gameId);
        for (uint256 i;; ++i) {
            seed = bytes32(i);
            if (g.outcome(keccak256(abi.encode(seed, gameId))) == want) return seed;
        }
    }

    function _settle(uint256 roundId, bytes32 seed) internal {
        vm.roll(casino.lockBlock(roundId));
        casino.requestSettlement{value: FEE}(roundId);
        (, uint64 reqId,,) = casino.rounds(roundId);
        rng.fulfill(reqId, seed);
    }

    // ---- games

    function test_PayoutsHaveTwoPercentEdge() public view {
        assertEq(highLow.payoutBps(), 19_600);
        assertEq(digit.payoutBps(), 98_000);
        assertEq(race.payoutBps(), 39_200);
    }

    function test_HighLowBuckets() public view {
        // rawResult 0-49 is low (0), 50-99 is high (1).
        assertEq(highLow.outcome(bytes32(uint256(49))), 0);
        assertEq(highLow.outcome(bytes32(uint256(50))), 1);
        assertEq(highLow.outcome(bytes32(uint256(199))), 1);
    }

    function test_BadGameConfigReverts() public {
        vm.expectRevert(UniformGame.BadConfig.selector);
        new UniformGame("bad", 10, 3);
    }

    // ---- timing

    function test_BetRejectedAtLockBlock() public {
        vm.roll(casino.lockBlock(0));
        vm.prank(alice);
        vm.expectRevert(BlockCasino.BettingClosed.selector);
        casino.placeBet(0, 1, 10e18);
    }

    function test_BetGoesToNextRoundAfterRoundEnds() public {
        vm.roll(casino.roundStartBlock(1));
        vm.prank(alice);
        (uint256 roundId,) = casino.placeBet(0, 1, 10e18);
        assertEq(roundId, 1);
    }

    function test_CannotSettleBeforeLock() public {
        vm.prank(alice);
        casino.placeBet(0, 1, 10e18);
        vm.expectRevert(BlockCasino.NotLocked.selector);
        casino.requestSettlement{value: FEE}(0);
    }

    function test_CannotSettleEmptyRound() public {
        vm.roll(casino.lockBlock(0));
        vm.expectRevert(BlockCasino.NoBets.selector);
        casino.requestSettlement{value: FEE}(0);
    }

    function test_SettlementNeedsFee() public {
        vm.prank(alice);
        casino.placeBet(0, 1, 10e18);
        vm.roll(casino.lockBlock(0));
        vm.expectRevert(abi.encodeWithSelector(BlockCasino.InsufficientFee.selector, FEE));
        casino.requestSettlement{value: FEE - 1}(0);
    }

    // ---- settlement and payouts

    function test_WinnerPaid_LoserNot() public {
        vm.prank(alice);
        (, uint256 aliceBet) = casino.placeBet(0, 1, 100e18); // high
        vm.prank(bob);
        (, uint256 bobBet) = casino.placeBet(0, 0, 100e18); // low

        _settle(0, _seedFor(0, 1));

        casino.claim(0, aliceBet);
        casino.claim(0, bobBet);
        assertEq(chips.balanceOf(alice), 1_000e18 - 100e18 + 196e18);
        assertEq(chips.balanceOf(bob), 1_000e18 - 100e18);
    }

    function test_ExactDigitPays9_8x() public {
        bytes32 seed = _seedFor(1, 7);
        vm.prank(alice);
        casino.placeBet(1, 7, 10e18);
        _settle(0, seed);
        casino.claim(0, 0);
        assertEq(chips.balanceOf(alice), 1_000e18 - 10e18 + 98e18);
    }

    function test_CannotClaimTwice() public {
        vm.prank(alice);
        casino.placeBet(0, 1, 10e18);
        _settle(0, _seedFor(0, 1));
        casino.claim(0, 0);
        vm.expectRevert(BlockCasino.BetClosed.selector);
        casino.claim(0, 0);
    }

    function test_OnlyRandomnessCanCallback() public {
        vm.expectRevert(BlockCasino.OnlyRandomness.selector);
        casino.onRandomness(1, bytes32(0));
    }

    function test_GamesUseIndependentSeeds() public {
        vm.prank(alice);
        casino.placeBet(0, 1, 10e18);
        _settle(0, bytes32(uint256(12345)));
        assertTrue(casino.gameSeed(0, 0) != casino.gameSeed(0, 1));
    }

    // ---- refunds

    function test_RefundAfterTimeout() public {
        vm.prank(alice);
        casino.placeBet(0, 1, 50e18);
        vm.roll(casino.lockBlock(0));
        casino.requestSettlement{value: FEE}(0);

        vm.roll(casino.lockBlock(0) + TIMEOUT + 1);
        casino.refund(0, 0);
        assertEq(chips.balanceOf(alice), 1_000e18);

        // A late VRF answer is ignored and doesn't revert.
        rng.fulfill(1, bytes32(uint256(1)));
        vm.expectRevert(BlockCasino.NotSettled.selector);
        casino.claim(0, 0);
    }

    function test_NoRefundBeforeTimeout() public {
        vm.prank(alice);
        casino.placeBet(0, 1, 50e18);
        vm.roll(casino.lockBlock(0) + TIMEOUT);
        vm.expectRevert(BlockCasino.NotRefundable.selector);
        casino.refund(0, 0);
    }

    // ---- fuzz: payout math matches stated odds

    function testFuzz_PayoutMath(uint256 seed, uint8 choice, uint128 amount) public {
        choice = uint8(bound(choice, 0, 3));
        amount = uint128(bound(amount, 1e18, 500e18));
        vm.prank(alice);
        casino.placeBet(2, choice, amount);
        _settle(0, bytes32(seed));

        (, uint8 winner) = casino.gameResult(0, 2);
        uint256 before = chips.balanceOf(alice);
        casino.claim(0, 0);
        uint256 expected = winner == choice ? (uint256(amount) * 39_200) / 10_000 : 0;
        assertEq(chips.balanceOf(alice) - before, expected);
    }
}
