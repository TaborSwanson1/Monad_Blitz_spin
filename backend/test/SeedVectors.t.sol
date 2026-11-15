// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SeedLib} from "../contracts/lib/SeedLib.sol";

/// Solidity SeedLib vs the JavaScript copy in sdk/seedlib.mjs.
/// test/vectors/seed.json is written by `npm run vectors` from the JS side.
/// Every entry must match here, so neither copy can drift from the other.
contract SeedVectorsTest is Test {
    // Must match the constants in scripts/seed-vectors.mjs.
    uint8 constant GAME_ID = 3;
    uint256 constant INDEX = 7;
    uint256 constant UNIFORM_N = 100;
    uint256 constant CHANCE_BPS = 2_500;

    function _weights() internal pure returns (uint256[] memory w) {
        w = new uint256[](4);
        (w[0], w[1], w[2], w[3]) = (1, 2, 3, 4);
    }

    function test_SolidityMatchesJavaScript() public view {
        string memory json = vm.readFile(string.concat(vm.projectRoot(), "/test/vectors/seed.json"));
        bytes32[] memory roundSeeds = vm.parseJsonBytes32Array(json, ".roundSeeds");
        bytes32[] memory gameSeeds = vm.parseJsonBytes32Array(json, ".gameSeeds");
        uint256[] memory draws = vm.parseJsonUintArray(json, ".draws");
        uint256[] memory uniforms = vm.parseJsonUintArray(json, ".uniforms");
        bool[] memory chances = vm.parseJsonBoolArray(json, ".chances");
        uint256[] memory picks = vm.parseJsonUintArray(json, ".weighted");
        bool[] memory coins = vm.parseJsonBoolArray(json, ".coins");
        uint256[] memory crash = vm.parseJsonUintArray(json, ".crash");
        uint256[] memory crashRaw = vm.parseJsonUintArray(json, ".crashRaw");

        assertGt(roundSeeds.length, 0, "no vectors: run npm run vectors");
        for (uint256 i; i < roundSeeds.length; ++i) {
            bytes32 gs = SeedLib.gameSeed(roundSeeds[i], GAME_ID);
            assertEq(gs, gameSeeds[i], "gameSeed");
            assertEq(SeedLib.draw(gs, INDEX), draws[i], "draw");
            assertEq(SeedLib.uniform(gs, INDEX, UNIFORM_N), uniforms[i], "uniform");
            assertEq(SeedLib.chance(gs, INDEX, CHANCE_BPS), chances[i], "chance");
            assertEq(SeedLib.weighted(gs, INDEX, _weights()), picks[i], "weighted");
            assertEq(SeedLib.coin(gs), coins[i], "coin");
            assertEq(SeedLib.crashX100(gs), crash[i], "crashX100");
            assertEq(SeedLib.crashX100(roundSeeds[i]), crashRaw[i], "crashX100 edge");
        }
    }
}
