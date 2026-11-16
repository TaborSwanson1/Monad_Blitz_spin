import { parseAbi } from 'viem'

// Hand-written from backend/contracts. Keep in sync if the contracts change.

export const casinoAbi = parseAbi([
  'function genesisBlock() view returns (uint256)',
  'function roundLength() view returns (uint256)',
  'function bettingWindow() view returns (uint256)',
  'function minBet() view returns (uint256)',
  'function maxBet() view returns (uint256)',
  'function randomness() view returns (address)',
  'function rounds(uint256) view returns (uint8 status, uint64 requestId, bytes32 seed, uint256 totalStaked)',
  'function placeBet(uint8 gameId, uint8 choice, uint256 amount) returns (uint256 roundId, uint256 betIndex)',
  'function requestSettlement(uint256 roundId) payable',
  'function claim(uint256 roundId, uint256 betIndex)',
  'function gameCount() view returns (uint256)',
])

// PROPOSED, not on the contract yet (frontend/INTEGRATION.md, Crash on-chain). Only called when
// the contract answers crashClimbBlocks(), so the current deploy never sees these.
export const crashAbi = parseAbi([
  'function crashClimbBlocks() view returns (uint256)',
  'function cashOut(uint256 roundId, uint256 betIndex)',
  'event CashedOut(uint256 indexed roundId, uint256 indexed betIndex, address indexed player, uint256 k, uint256 multX100)',
])

export const chipAbi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function faucet()',
])

export const randomnessAbi = parseAbi(['function fee() view returns (uint256)'])
