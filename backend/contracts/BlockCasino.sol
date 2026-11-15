// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ChipToken} from "./ChipToken.sol";
import {IGame} from "./interfaces/IGame.sol";
import {IRandomnessSource, IRandomnessConsumer} from "./interfaces/IRandomness.sol";
import {SeedLib} from "./lib/SeedLib.sol";

/// @title BlockCasino
/// @notice Play-money rounds timed by Monad blocks, settled by a VRF.
///
/// Round `r` covers blocks [start, start + roundLength), where
/// start = genesisBlock + r * roundLength.
///   Open:    start <= block < start + bettingWindow      bets accepted
///   Locked:  block >= start + bettingWindow              anyone may request settlement
///   Settled: VRF callback stored the seed                players claim
///   Expired: no seed within settleTimeout after lock     players refund
///
/// One seed per round. Each game derives its own seed as
/// keccak256(roundSeed, gameId), so results across games are independent.
contract BlockCasino is IRandomnessConsumer {
    enum Status {
        None,
        Requested,
        Settled,
        Expired
    }

    struct Round {
        Status status;
        uint64 requestId;
        bytes32 seed;
        uint256 totalStaked;
    }

    struct Bet {
        address player;
        uint8 gameId;
        uint8 choice;
        bool closed; // claimed or refunded
        uint128 amount;
    }

    ChipToken public immutable chips;
    IRandomnessSource public immutable randomness;

    uint256 public immutable genesisBlock;
    uint256 public immutable roundLength;
    uint256 public immutable bettingWindow;
    uint256 public immutable settleTimeout;
    uint256 public immutable minBet;
    uint256 public immutable maxBet;

    IGame[] public games;

    mapping(uint256 => Round) public rounds;
    mapping(uint256 => Bet[]) internal _bets;
    mapping(uint256 => mapping(address => uint256[])) internal _playerBets;
    mapping(uint64 => uint256) public roundOfRequest;

    event BetPlaced(uint256 indexed roundId, address indexed player, uint256 betIndex, uint8 gameId, uint8 choice, uint256 amount);
    event SettlementRequested(uint256 indexed roundId, uint64 requestId);
    event RoundSettled(uint256 indexed roundId, bytes32 seed);
    event RoundExpired(uint256 indexed roundId);
    event BetClaimed(uint256 indexed roundId, uint256 indexed betIndex, address indexed player, bool won, uint256 payout);
    event BetRefunded(uint256 indexed roundId, uint256 indexed betIndex, address indexed player, uint256 amount);

    error BadConfig();
    error BettingClosed();
    error UnknownGame();
    error BadChoice();
    error BadAmount();
    error NotLocked();
    error AlreadyRequested();
    error NoBets();
    error InsufficientFee(uint256 required);
    error OnlyRandomness();
    error NotSettled();
    error BetClosed();
    error NotRefundable();
    error TooLate();

    constructor(
        ChipToken chips_,
        IRandomnessSource randomness_,
        IGame[] memory games_,
        uint256 roundLength_,
        uint256 bettingWindow_,
        uint256 settleTimeout_,
        uint256 minBet_,
        uint256 maxBet_
    ) {
        if (bettingWindow_ == 0 || bettingWindow_ >= roundLength_) revert BadConfig();
        if (games_.length == 0 || games_.length > type(uint8).max) revert BadConfig();
        if (minBet_ == 0 || minBet_ > maxBet_ || maxBet_ > type(uint128).max) revert BadConfig();
        chips = chips_;
        randomness = randomness_;
        genesisBlock = block.number;
        roundLength = roundLength_;
        bettingWindow = bettingWindow_;
        settleTimeout = settleTimeout_;
        minBet = minBet_;
        maxBet = maxBet_;
        for (uint256 i; i < games_.length; ++i) {
            games.push(games_[i]);
        }
    }

    // ---------------------------------------------------------------- timing

    function currentRoundId() public view returns (uint256) {
        return (block.number - genesisBlock) / roundLength;
    }

    function roundStartBlock(uint256 roundId) public view returns (uint256) {
        return genesisBlock + roundId * roundLength;
    }

    function lockBlock(uint256 roundId) public view returns (uint256) {
        return roundStartBlock(roundId) + bettingWindow;
    }

    function isOpen(uint256 roundId) public view returns (bool) {
        return roundId == currentRoundId() && block.number < lockBlock(roundId);
    }

    // ---------------------------------------------------------------- betting

    /// @notice Bet on the current round. Needs a prior `chips.approve`.
    function placeBet(uint8 gameId, uint8 choice, uint256 amount) external returns (uint256 roundId, uint256 betIndex) {
        roundId = currentRoundId();
        if (block.number >= lockBlock(roundId)) revert BettingClosed();
        if (gameId >= games.length) revert UnknownGame();
        if (choice >= games[gameId].numOutcomes()) revert BadChoice();
        if (amount < minBet || amount > maxBet) revert BadAmount();

        chips.transferFrom(msg.sender, address(this), amount);

        betIndex = _bets[roundId].length;
        _bets[roundId].push(Bet(msg.sender, gameId, choice, false, uint128(amount)));
        _playerBets[roundId][msg.sender].push(betIndex);
        rounds[roundId].totalStaked += amount;

        emit BetPlaced(roundId, msg.sender, betIndex, gameId, choice, amount);
    }

    // ---------------------------------------------------------------- settlement

    /// @notice Anyone can trigger settlement once betting is locked. The caller
    /// pays the VRF fee in MON. Extra MON is sent back.
    function requestSettlement(uint256 roundId) external payable {
        if (block.number < lockBlock(roundId)) revert NotLocked();
        Round storage round = rounds[roundId];
        if (round.status != Status.None) revert AlreadyRequested();
        if (_bets[roundId].length == 0) revert NoBets();
        if (block.number > lockBlock(roundId) + settleTimeout) revert TooLate();

        uint256 fee = randomness.fee();
        if (msg.value < fee) revert InsufficientFee(fee);

        round.status = Status.Requested;
        uint64 requestId = randomness.request{value: fee}();
        round.requestId = requestId;
        roundOfRequest[requestId] = roundId;
        emit SettlementRequested(roundId, requestId);

        if (msg.value > fee) {
            (bool ok,) = msg.sender.call{value: msg.value - fee}("");
            require(ok, "refund failed");
        }
    }

    /// @dev Must not revert for a late callback, so an expired round is ignored.
    function onRandomness(uint64 requestId, bytes32 randomNumber) external {
        if (msg.sender != address(randomness)) revert OnlyRandomness();
        uint256 roundId = roundOfRequest[requestId];
        Round storage round = rounds[roundId];
        if (round.status != Status.Requested || round.requestId != requestId) return;
        round.seed = randomNumber;
        round.status = Status.Settled;
        emit RoundSettled(roundId, randomNumber);
    }

    // ---------------------------------------------------------------- payouts

    /// @notice Pay out one bet. Anyone can call it, and chips go to the player.
    function claim(uint256 roundId, uint256 betIndex) external {
        if (rounds[roundId].status != Status.Settled) revert NotSettled();
        Bet storage bet = _bets[roundId][betIndex];
        if (bet.closed) revert BetClosed();
        bet.closed = true;

        (bool won, uint256 payout) = _result(roundId, bet);
        if (payout > 0) _pay(bet.player, payout);
        emit BetClaimed(roundId, betIndex, bet.player, won, payout);
    }

    /// @notice If the VRF never answers, stakes come back after the timeout.
    function refund(uint256 roundId, uint256 betIndex) external {
        Round storage round = rounds[roundId];
        if (round.status == Status.Settled) revert NotRefundable();
        if (block.number <= lockBlock(roundId) + settleTimeout) revert NotRefundable();
        if (round.status != Status.Expired) {
            round.status = Status.Expired;
            emit RoundExpired(roundId);
        }
        Bet storage bet = _bets[roundId][betIndex];
        if (bet.closed) revert BetClosed();
        bet.closed = true;
        _pay(bet.player, bet.amount);
        emit BetRefunded(roundId, betIndex, bet.player, bet.amount);
    }

    // ---------------------------------------------------------------- views

    function gameCount() external view returns (uint256) {
        return games.length;
    }

    function betCount(uint256 roundId) external view returns (uint256) {
        return _bets[roundId].length;
    }

    function getBet(uint256 roundId, uint256 betIndex) external view returns (Bet memory) {
        return _bets[roundId][betIndex];
    }

    function betsOf(uint256 roundId, address player) external view returns (uint256[] memory) {
        return _playerBets[roundId][player];
    }

    function gameSeed(uint256 roundId, uint8 gameId) public view returns (bytes32) {
        return SeedLib.gameSeed(rounds[roundId].seed, gameId);
    }

    /// @notice Result for a settled round and game, for the UI and for anyone checking.
    function gameResult(uint256 roundId, uint8 gameId) external view returns (uint256 raw, uint8 winningOutcome) {
        if (rounds[roundId].status != Status.Settled) revert NotSettled();
        bytes32 seed = gameSeed(roundId, gameId);
        IGame game = games[gameId];
        return (game.rawResult(seed), game.outcome(seed));
    }

    // ---------------------------------------------------------------- internal

    function _result(uint256 roundId, Bet storage bet) internal view returns (bool won, uint256 payout) {
        IGame game = games[bet.gameId];
        won = game.outcome(gameSeed(roundId, bet.gameId)) == bet.choice;
        payout = won ? (uint256(bet.amount) * game.payoutBps()) / 10_000 : 0;
    }

    /// @dev Pays from the house balance and mints any shortfall. Chips are
    /// play money, so the house can't go broke.
    function _pay(address to, uint256 amount) internal {
        uint256 bal = chips.balanceOf(address(this));
        if (bal < amount) chips.mint(address(this), amount - bal);
        chips.transfer(to, amount);
    }
}
