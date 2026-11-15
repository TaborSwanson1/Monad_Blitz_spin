// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRandomnessSource, IRandomnessConsumer} from "../interfaces/IRandomness.sol";

/// @notice Test and local-dev randomness. Whoever calls `fulfill` picks the
/// number, so this is NOT fair. Never deploy it to a shared network.
contract MockRandomness is IRandomnessSource {
    uint256 public override fee;
    uint64 public nextId = 1;
    mapping(uint64 => address) public consumerOf;

    constructor(uint256 fee_) {
        fee = fee_;
    }

    function request() external payable returns (uint64 requestId) {
        require(msg.value >= fee, "fee");
        requestId = nextId++;
        consumerOf[requestId] = msg.sender;
    }

    function fulfill(uint64 requestId, bytes32 randomNumber) external {
        address consumer = consumerOf[requestId];
        require(consumer != address(0), "unknown request");
        delete consumerOf[requestId];
        IRandomnessConsumer(consumer).onRandomness(requestId, randomNumber);
    }
}
