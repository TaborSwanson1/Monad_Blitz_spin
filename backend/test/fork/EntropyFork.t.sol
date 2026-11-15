// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {IEntropyV2} from "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";
import {PythEntropyAdapter} from "../../contracts/randomness/PythEntropyAdapter.sol";

/// Read-only checks against the REAL Pyth Entropy on Monad testnet. Spends nothing.
/// Foundry must fork Monad from the command line (it picks Monad's EVM that way):
///   forge test --match-path "test/fork/*" --fork-url https://testnet-rpc.monad.xyz -vv
/// Without --fork-url these tests show as skipped.
contract EntropyForkTest is Test {
    uint256 constant MONAD_TESTNET = 10143;
    // Verified 2026-11-15: docs.pyth.network/entropy/chainlist + on-chain code.
    address constant DEFAULT_ENTROPY = 0x825c0390f379C631f3Cf11A82a37D20BddF93c07;

    IEntropyV2 entropy;

    modifier onlyMonadFork() {
        if (block.chainid != MONAD_TESTNET) vm.skip(true);
        _;
    }

    function setUp() public {
        entropy = IEntropyV2(vm.envOr("PYTH_ENTROPY_ADDRESS", DEFAULT_ENTROPY));
    }

    function test_EntropyIsLiveWithFeeAndProvider() public onlyMonadFork {
        assertGt(address(entropy).code.length, 0, "no contract at entropy address");
        uint128 fee = entropy.getFeeV2();
        address provider = entropy.getDefaultProvider();
        console.log("Monad block:      ", block.number);
        console.log("Entropy fee (wei):", uint256(fee));
        console.log("Default provider: ", provider);
        assertGt(fee, 0);
        assertTrue(provider != address(0));
    }

    function test_AdapterReadsLiveFee() public onlyMonadFork {
        PythEntropyAdapter adapter = new PythEntropyAdapter(address(entropy));
        assertEq(adapter.fee(), uint256(entropy.getFeeV2()));
    }
}
