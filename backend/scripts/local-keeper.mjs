#!/usr/bin/env node
// LOCAL ONLY. Plays the part of Pyth on anvil so rounds settle by themselves:
//   1. once a round with bets passes its lock block, calls requestSettlement (mock fee is 0)
//   2. answers the MockRandomness request with a random number from this machine
// On Monad testnet, real Pyth Entropy does step 2. Step 1 is a player click or a future keeper.
// Started by `npm run dev`. Refuses to run on any chain except anvil (31337).

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { createPublicClient, createWalletClient, http, toHex } from 'viem'
import { foundry } from 'viem/chains'
import { loadAbis } from './export.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RPC = 'http://127.0.0.1:8545'
const STATUS = ['none', 'requested', 'settled', 'expired']

const dep = JSON.parse(readFileSync(join(ROOT, 'exports', 'local', 'deployment.json'), 'utf8'))
const abis = loadAbis()
const pub = createPublicClient({ chain: foundry, transport: http(RPC) })
if ((await pub.getChainId()) !== 31337) throw new Error('local-keeper only runs against anvil (chain 31337)')

const [keeper] = await pub.request({ method: 'eth_accounts' }) // anvil's unlocked dev account, no key needed
const wallet = createWalletClient({ chain: foundry, transport: http(RPC), account: keeper })

const casino = { address: dep.contracts.blockCasino, abi: abis.blockCasinoAbi }
const mock = { address: dep.contracts.randomness, abi: abis.mockRandomnessAbi }
const genesis = BigInt(dep.genesisBlock)
const RL = BigInt(dep.roundLength)
const BW = BigInt(dep.bettingWindow)
const TIMEOUT = BigInt(dep.settleTimeout)
const busy = new Set()

const time = () => new Date().toLocaleTimeString()
console.log(`[keeper] watching casino ${casino.address} (rounds ${RL} blocks, betting ${BW}). Ctrl+C to stop.`)

async function tick() {
  const head = await pub.getBlockNumber()
  if (head < genesis) return
  const current = (head - genesis) / RL
  for (let r = current > 5n ? current - 5n : 0n; r <= current; r++) {
    const lock = genesis + r * RL + BW
    if (head < lock || busy.has(r)) continue
    const [status, requestId] = await pub.readContract({ ...casino, functionName: 'rounds', args: [r] })
    const s = STATUS[status]
    busy.add(r)
    try {
      if (s === 'none' && head <= lock + TIMEOUT) {
        const bets = await pub.readContract({ ...casino, functionName: 'betCount', args: [r] })
        if (bets > 0n) {
          const hash = await wallet.writeContract({ ...casino, functionName: 'requestSettlement', args: [r], value: 0n })
          await pub.waitForTransactionReceipt({ hash })
          console.log(`[keeper ${time()}] round ${r}: ${bets} bet(s), requested randomness`)
        }
      } else if (s === 'requested') {
        const seed = toHex(randomBytes(32))
        const hash = await wallet.writeContract({ ...mock, functionName: 'fulfill', args: [requestId, seed] })
        await pub.waitForTransactionReceipt({ hash })
        console.log(`[keeper ${time()}] round ${r}: settled with seed ${seed.slice(0, 12)}…`)
      }
    } catch (e) {
      // A player may have requested settlement first. That's fine; try again next tick.
      if (!/AlreadyRequested|unknown request/.test(e.message)) console.log(`[keeper] round ${r}: ${e.shortMessage || e.message}`)
    } finally {
      busy.delete(r)
    }
  }
}

for (;;) {
  await tick().catch((e) => console.log(`[keeper] ${e.shortMessage || e.message}`))
  await new Promise((res) => setTimeout(res, 500))
}
