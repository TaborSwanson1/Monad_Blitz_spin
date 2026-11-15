// JavaScript copy of contracts/lib/SeedLib.sol. Same inputs, same outputs, bit for bit.
//
// Use it from scripts (keeper, simulations) or copy it into the frontend.
// test/SeedVectors.t.sol checks it against the Solidity version, using vectors
// that scripts/seed-vectors.mjs writes from this file. If you change either
// file, run `npm run vectors && forge test`.
//
// Seeds are 0x-prefixed 32-byte hex strings. Big numbers are bigint.

import { encodeAbiParameters, keccak256 } from 'viem'

const BPS = 10_000n
const TWO_52 = 2n ** 52n

// ------------------------------------------------------------ derivation

/** keccak256(abi.encode(bytes32 roundSeed, uint8 gameId)) */
export const gameSeed = (roundSeed, gameId) =>
  keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint8' }], [roundSeed, gameId]))

/** The i-th independent 256-bit number from a seed: uint256(keccak256(abi.encode(seed, i))) */
export const draw = (seed, index) =>
  BigInt(keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [seed, BigInt(index)])))

// ------------------------------------------------------------ distributions

/** A number in [0, n). */
export const uniform = (seed, index, n) => draw(seed, index) % BigInt(n)

/** True with probability bps / 10_000. */
export const chance = (seed, index, bps) => uniform(seed, index, BPS) < BigInt(bps)

/** Index k with probability weights[k] / sum(weights). */
export function weighted(seed, index, weights) {
  const w = weights.map(BigInt)
  const total = w.reduce((a, b) => a + b, 0n)
  if (total === 0n) throw new Error('NoWeight')
  let r = uniform(seed, index, total)
  for (let k = 0; k < w.length; k++) {
    if (r < w[k]) return k
    r -= w[k]
  }
  throw new Error('NoWeight')
}

/** Fair coin from the seed's main number. true = up / heads. */
export const coin = (seed) => (BigInt(seed) & 1n) === 1n

// ------------------------------------------------------------ game curves

/** Crash point in hundredths (237 = 2.37x). Same as frontend/src/lib/crash.ts. */
export function crashX100(seed) {
  const r = BigInt(seed) % TWO_52
  const x = (98n * TWO_52) / (TWO_52 - r)
  return x < 100n ? 100n : x
}
