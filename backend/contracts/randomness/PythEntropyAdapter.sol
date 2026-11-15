// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEntropyConsumer} from "@pythnetwork/entropy-sdk-solidity/IEntropyConsumer.sol";
import {IEntropyV2} from "@pythnetwork/entropy-sdk-solidity/IEntropyV2.sol";
import {IRandomnessSource, IRandomnessConsumer} from "../interfaces/IRandomness.sol";

/// @title PythEntropyAdapter
/// @notice Wraps Pyth Entropy so the casino only sees IRandomnessSource.
///
/// Flow (verified against @pythnetwork/entropy-sdk-solidity 2.2.1):
///   casino.requestSettlement ─► adapter.request{fee} ─► entropy.requestV2{fee}() returns sequence
///   ...the default provider reveals (2 blocks on Monad testnet)...
///   entropy ─► adapter._entropyCallback (SDK checks msg.sender == entropy)
///           ─► adapter.entropyCallback ─► casino.onRandomness(sequence, randomNumber)
///
/// One adapter serves one consumer: the casino, set once after both are deployed.
contract PythEntropyAdapter is IRandomnessSource, IEntropyConsumer {
    IEntropyV2 public immutable entropy;
    address public immutable deployer;
    IRandomnessConsumer public consumer;

    event ConsumerSet(address indexed consumer);

    error OnlyDeployer();
    error ConsumerAlreadySet();
    error OnlyConsumer();

    constructor(address entropy_) {
        entropy = IEntropyV2(entropy_);
        deployer = msg.sender;
    }

    /// @dev The casino needs this adapter's address and this adapter needs the
    /// casino's, so the link is made once after both exist.
    function setConsumer(address consumer_) external {
        if (msg.sender != deployer) revert OnlyDeployer();
        if (address(consumer) != address(0)) revert ConsumerAlreadySet();
        consumer = IRandomnessConsumer(consumer_);
        emit ConsumerSet(consumer_);
    }

    /// @notice Current Entropy fee in MON (wei) for the default provider.
    function fee() external view returns (uint256) {
        return entropy.getFeeV2();
    }

    function request() external payable returns (uint64) {
        if (msg.sender != address(consumer)) revert OnlyConsumer();
        return entropy.requestV2{value: msg.value}();
    }

    // ---------------------------------------------------------------- IEntropyConsumer

    function getEntropy() internal view override returns (address) {
        return address(entropy);
    }

    /// @dev Pyth's keeper can't deliver a callback that reverts, so this only
    /// forwards. The casino ignores unknown or late requests instead of reverting.
    function entropyCallback(uint64 sequenceNumber, address, bytes32 randomNumber) internal override {
        consumer.onRandomness(sequenceNumber, randomNumber);
    }
}
