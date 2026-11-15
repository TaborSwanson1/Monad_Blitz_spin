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

/// Use the npm scripts instead of calling this directly:
///   npm run dev              local anvil + MockRandomness + auto-settling keeper
///   npm run deploy:testnet   Monad testnet + real Pyth Entropy (asks for your keystore password)
///
/// Writes deployments/<chainId>.json, which `npm run export` turns into the
/// frontend's .env, ABIs and game list.
contract Deploy is Script {
    uint256 constant ANVIL = 31337;
    // Verified 2026-11-15: docs.pyth.network/entropy/chainlist + on-chain code.
    address constant PYTH_ENTROPY_MONAD_TESTNET = 0x825c0390f379C631f3Cf11A82a37D20BddF93c07;

    function run() external {
        // Round timing in blocks. Monad testnet ≈0.3 s/block, so 60/40 ≈ 18 s rounds with 12 s of betting.
        // Locally, `npm run dev` passes shorter values because anvil mines one block per second.
        uint256 roundLength = vm.envOr("ROUND_LENGTH", uint256(60));
        uint256 bettingWindow = vm.envOr("BETTING_WINDOW", uint256(40));
        uint256 settleTimeout = vm.envOr("SETTLE_TIMEOUT", uint256(2_000));
        uint256 minBet = vm.envOr("MIN_BET", uint256(1e18));
        uint256 maxBet = vm.envOr("MAX_BET", uint256(500e18));

        // Anvil can't reach Pyth, so local deploys use MockRandomness (settled by
        // scripts/local-keeper.mjs). Every other chain gets real Pyth Entropy.
        bool local = block.chainid == ANVIL;
        address entropy = local ? address(0) : vm.envOr("PYTH_ENTROPY_ADDRESS", PYTH_ENTROPY_MONAD_TESTNET);

        vm.startBroadcast();

        ChipToken chips = new ChipToken();

        // Order = game IDs. Must match frontend/src/lib/games.ts (INTEGRATION.md sync item 2).
        // scripts/export.mjs reads this list back from the chain, so the export is always truthful.
        IGame[] memory games = new IGame[](3);
        games[0] = new UniformGame("High / Low", 100, 2);
        games[1] = new UniformGame("Exact Digit", 10, 10);
        games[2] = new UniformGame("Block Race", 4, 4);

        IRandomnessSource source;
        PythEntropyAdapter adapter;
        if (local) {
            source = new MockRandomness(0);
        } else {
            adapter = new PythEntropyAdapter(entropy);
            source = adapter;
        }

        BlockCasino casino =
            new BlockCasino(chips, source, games, roundLength, bettingWindow, settleTimeout, minBet, maxBet);
        chips.setMinter(address(casino));
        if (address(adapter) != address(0)) adapter.setConsumer(address(casino));

        vm.stopBroadcast();

        _record(chips, source, casino, entropy, local);

        console.log("ChipToken   ", address(chips));
        console.log("Randomness  ", address(source));
        console.log("BlockCasino ", address(casino));
        console.log("VRF fee (wei)", source.fee());
    }

    function _record(ChipToken chips, IRandomnessSource source, BlockCasino casino, address entropy, bool local)
        internal
    {
        string memory k = "deployment";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeUint(k, "genesisBlock", casino.genesisBlock());
        vm.serializeString(k, "randomnessKind", local ? "mock" : "pyth-entropy");
        vm.serializeAddress(k, "pythEntropy", entropy);
        vm.serializeAddress(k, "chipToken", address(chips));
        vm.serializeAddress(k, "randomness", address(source));
        string memory json = vm.serializeAddress(k, "blockCasino", address(casino));
        string memory path = string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console.log("Wrote", path);
    }
}
