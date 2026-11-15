// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ChipToken} from "../contracts/ChipToken.sol";
import {BlockCasino} from "../contracts/BlockCasino.sol";
import {UniformGame} from "../contracts/games/UniformGame.sol";
import {MockRandomness} from "../contracts/randomness/MockRandomness.sol";
import {PythEntropyAdapter} from "../contracts/randomness/PythEntropyAdapter.sol";
import {IGame} from "../contracts/interfaces/IGame.sol";
import {IRandomnessSource} from "../contracts/interfaces/IRandomness.sol";

/// Monad testnet (key comes from the encrypted keystore, never from .env):
///   forge script script/Deploy.s.sol --rpc-url monad_testnet --account monad-deployer --broadcast
/// Local anvil (deploys MockRandomness; leave PYTH_ENTROPY_ADDRESS empty):
///   forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast \
///     --private-key <one of anvil's printed test keys>
contract Deploy is Script {
    // Round timing in blocks. Monad testnet measured about 0.3 s per block on
    // 2026-11-15, so 60 blocks ≈ 18 s per round and 40 blocks ≈ 12 s of betting.
    uint256 constant ROUND_LENGTH = 60;
    uint256 constant BETTING_WINDOW = 40;
    // About 10 minutes of blocks for the VRF to answer before refunds open.
    uint256 constant SETTLE_TIMEOUT = 2_000;

    uint256 constant MIN_BET = 1e18;
    uint256 constant MAX_BET = 500e18;

    error MockOnlyOnAnvil();

    function run() external {
        address entropy = vm.envOr("PYTH_ENTROPY_ADDRESS", address(0));
        // The mock lets the caller choose the "random" number. Refuse it anywhere but anvil.
        if (entropy == address(0) && block.chainid != 31337) revert MockOnlyOnAnvil();

        vm.startBroadcast();

        ChipToken chips = new ChipToken();

        // Order = game IDs. Must match frontend/src/lib/games.ts (INTEGRATION.md sync item 2).
        IGame[] memory games = new IGame[](3);
        games[0] = new UniformGame("High / Low", 100, 2);
        games[1] = new UniformGame("Exact Digit", 10, 10);
        games[2] = new UniformGame("Block Race", 4, 4);

        IRandomnessSource source;
        PythEntropyAdapter adapter;
        if (entropy == address(0)) {
            source = new MockRandomness(0);
        } else {
            adapter = new PythEntropyAdapter(entropy);
            source = adapter;
        }

        BlockCasino casino =
            new BlockCasino(chips, source, games, ROUND_LENGTH, BETTING_WINDOW, SETTLE_TIMEOUT, MIN_BET, MAX_BET);
        chips.setMinter(address(casino));
        if (address(adapter) != address(0)) adapter.setConsumer(address(casino));

        vm.stopBroadcast();

        console.log("ChipToken   ", address(chips));
        console.log("Randomness  ", address(source));
        console.log("BlockCasino ", address(casino));
        console.log("VRF fee (wei)", source.fee());
    }
}
