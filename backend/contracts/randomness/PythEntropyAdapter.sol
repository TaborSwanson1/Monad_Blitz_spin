// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRandomnessSource, IRandomnessConsumer} from "../interfaces/IRandomness.sol";

// UNVERIFIED: these signatures follow Pyth Entropy v2 as I remember it.
// Check them against Pyth's current docs (or swap in their official SDK
// package) before deploying. The rest of the system doesn't depend on them.
interface IEntropyV2 {
    function getFeeV2() external view returns (uint128);
    function requestV2() external payable returns (uint64 sequenceNumber);
}

/// @notice Wraps Pyth Entropy so the casino only sees IRandomnessSource.
/// One adapter serves one consumer (the casino).
contract PythEntropyAdapter is IRandomnessSource {
    IEntropyV2 public immutable entropy;
    address public immutable deployer;
    IRandomnessConsumer public consumer;

    error OnlyConsumer();
    error OnlyEntropy();
    error ConsumerAlreadySet();

    /// @dev The casino needs this adapter's address and this adapter needs the
    /// casino's, so the consumer is set once after both are deployed.
    constructor(address entropy_) {
        entropy = IEntropyV2(entropy_);
        deployer = msg.sender;
    }

    function setConsumer(address consumer_) external {
        if (msg.sender != deployer || address(consumer) != address(0)) revert ConsumerAlreadySet();
        consumer = IRandomnessConsumer(consumer_);
    }

    function fee() external view returns (uint256) {
        return entropy.getFeeV2();
    }

    function request() external payable returns (uint64) {
        if (msg.sender != address(consumer)) revert OnlyConsumer();
        return entropy.requestV2{value: msg.value}();
    }

    /// @dev Pyth's consumer base exposes `_entropyCallback` and checks the
    /// caller. We do the same check by hand to avoid the dependency.
    function _entropyCallback(uint64 sequenceNumber, address, bytes32 randomNumber) external {
        if (msg.sender != address(entropy)) revert OnlyEntropy();
        consumer.onRandomness(sequenceNumber, randomNumber);
    }
}
