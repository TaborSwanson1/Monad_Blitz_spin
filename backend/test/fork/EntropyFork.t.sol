// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {IEntropyV2} from "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";
import {PythEntropyAdapter} from "../../contracts/randomness/PythEntropyAdapter.sol";

/// Read-only checks against the REAL Pyth Entropy on Monad testnet. Spends nothing.
/// Skipped unless MONAD_TESTNET_RPC and PYTH_ENTROPY_ADDRESS are set (see .env.example):
///   source .env && forge test --match-path test/fork/* -vv
contract EntropyForkTest is Test {
    IEntropyV2 entropy;
    bool live;

    function setUp() public {
        string memory rpc = vm.envOr("MONAD_TESTNET_RPC", string(""));
        address addr = vm.envOr("PYTH_ENTROPY_ADDRESS", address(0));
        if (bytes(rpc).length == 0 || addr == address(0)) return;
        vm.createSelectFork(rpc);
        entropy = IEntropyV2(addr);
        live = true;
    }

    function test_ForkIsMonadTestnet() public view {
        if (!live) return;
        assertEq(block.chainid, 10143);
    }

    function test_EntropyIsLiveWithFeeAndProvider() public view {
        if (!live) return;
        assertGt(address(entropy).code.length, 0, "no contract at entropy address");
        uint128 fee = entropy.getFeeV2();
        address provider = entropy.getDefaultProvider();
        console.log("Entropy fee (wei):", uint256(fee));
        console.log("Default provider: ", provider);
        assertGt(fee, 0);
        assertTrue(provider != address(0));
    }

    function test_AdapterReadsLiveFee() public {
        if (!live) return;
        PythEntropyAdapter adapter = new PythEntropyAdapter(address(entropy));
        assertEq(adapter.fee(), uint256(entropy.getFeeV2()));
    }
}
