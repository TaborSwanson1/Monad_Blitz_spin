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

/// forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast
/// Leave PYTH_ENTROPY_ADDRESS empty to deploy the mock (local anvil only).
contract Deploy is Script {
    // Round timing in blocks. Tune once real block times are measured.
    uint256 constant ROUND_LENGTH = 30;
    uint256 constant BETTING_WINDOW = 20;
    uint256 constant SETTLE_TIMEOUT = 600;

    function run() external {
        address entropy = vm.envOr("PYTH_ENTROPY_ADDRESS", address(0));
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        ChipToken chips = new ChipToken();

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
            new BlockCasino(chips, source, games, ROUND_LENGTH, BETTING_WINDOW, SETTLE_TIMEOUT, 1e18, 500e18);
        chips.setMinter(address(casino));
        if (address(adapter) != address(0)) adapter.setConsumer(address(casino));

        vm.stopBroadcast();

        console.log("ChipToken  ", address(chips));
        console.log("Randomness ", address(source));
        console.log("BlockCasino", address(casino));
    }
}
