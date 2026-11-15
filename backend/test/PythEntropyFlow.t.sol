// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockEntropy} from "@pythnetwork/entropy-sdk-solidity/MockEntropy.sol";
import {ChipToken} from "../contracts/ChipToken.sol";
import {BlockCasino} from "../contracts/BlockCasino.sol";
import {UniformGame} from "../contracts/games/UniformGame.sol";
import {PythEntropyAdapter} from "../contracts/randomness/PythEntropyAdapter.sol";
import {IGame} from "../contracts/interfaces/IGame.sol";

/// End-to-end with Pyth's own MockEntropy from the official SDK:
/// bet → lock block → requestSettlement → Pyth reveal → callback → claim.
contract PythEntropyFlowTest is Test {
    uint256 constant ROUND = 60;
    uint256 constant WINDOW = 40;
    uint256 constant TIMEOUT = 2_000;

    MockEntropy entropy;
    PythEntropyAdapter adapter;
    ChipToken chips;
    BlockCasino casino;

    address provider = makeAddr("pythProvider");
    address alice = makeAddr("alice");

    function setUp() public {
        entropy = new MockEntropy(provider);
        adapter = new PythEntropyAdapter(address(entropy));
        chips = new ChipToken();

        IGame[] memory games = new IGame[](3);
        games[0] = new UniformGame("High / Low", 100, 2);
        games[1] = new UniformGame("Exact Digit", 10, 10);
        games[2] = new UniformGame("Block Race", 4, 4);
        casino = new BlockCasino(chips, adapter, games, ROUND, WINDOW, TIMEOUT, 1e18, 500e18);
        chips.setMinter(address(casino));
        adapter.setConsumer(address(casino));

        vm.startPrank(alice);
        chips.faucet();
        chips.approve(address(casino), type(uint256).max);
        vm.stopPrank();
        vm.deal(alice, 1 ether);
    }

    function _requestSettlement(uint256 roundId) internal returns (uint64 seq) {
        vm.roll(casino.lockBlock(roundId));
        uint256 fee = adapter.fee();
        vm.prank(alice);
        casino.requestSettlement{value: fee}(roundId);
        (, seq,,) = casino.rounds(roundId);
    }

    function test_FullRoundThroughPyth() public {
        vm.prank(alice);
        casino.placeBet(1, 7, 10e18); // Exact Digit, pick 7

        uint64 seq = _requestSettlement(0);
        (BlockCasino.Status status,,,) = casino.rounds(0);
        assertEq(uint8(status), uint8(BlockCasino.Status.Requested));

        // Find a Pyth number that makes 7 win, then have the provider reveal it.
        bytes32 rnd;
        for (uint256 i;; ++i) {
            rnd = bytes32(i);
            if (casino.games(1).outcome(keccak256(abi.encode(rnd, uint8(1)))) == 7) break;
        }
        entropy.mockReveal(provider, seq, rnd);

        bytes32 seed;
        (status,, seed,) = casino.rounds(0);
        assertEq(uint8(status), uint8(BlockCasino.Status.Settled));
        assertEq(seed, rnd, "round seed is exactly Pyth's number");

        casino.claim(0, 0);
        assertEq(chips.balanceOf(alice), 1_000e18 - 10e18 + 98e18);
    }

    function test_SettlementPaysEntropyFee() public {
        vm.prank(alice);
        casino.placeBet(0, 1, 10e18);
        uint256 before = address(entropy).balance;
        _requestSettlement(0);
        assertEq(address(entropy).balance - before, adapter.fee());
    }

    function test_OnlyEntropyCanDeliverRandomness() public {
        vm.expectRevert(bytes("Only Entropy can call this function"));
        adapter._entropyCallback(1, provider, bytes32(uint256(1)));
    }

    function test_OnlyCasinoCanRequest() public {
        vm.prank(alice);
        vm.expectRevert(PythEntropyAdapter.OnlyConsumer.selector);
        adapter.request{value: 1}();
    }

    function test_ConsumerSetOnce() public {
        vm.expectRevert(PythEntropyAdapter.ConsumerAlreadySet.selector);
        adapter.setConsumer(alice);
    }

    function test_LateRevealAfterRefundDoesNotRevert() public {
        vm.prank(alice);
        casino.placeBet(0, 1, 50e18);
        uint64 seq = _requestSettlement(0);

        vm.roll(casino.lockBlock(0) + TIMEOUT + 1);
        casino.refund(0, 0);
        assertEq(chips.balanceOf(alice), 1_000e18);

        // Pyth's keeper can still call back. It must not revert, and must not settle.
        entropy.mockReveal(provider, seq, bytes32(uint256(42)));
        (BlockCasino.Status status,,,) = casino.rounds(0);
        assertEq(uint8(status), uint8(BlockCasino.Status.Expired));
    }
}
