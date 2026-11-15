// End-to-end test of the BUILT wallet SDK (wallet/dist) against real contracts.
//   cd backend && npm run test:wallet
//
// Starts its own anvil on port 8546, deploys with script/Deploy.s.sol (MockRandomness),
// and drives the SDK through a scripted EIP-1193 wallet that behaves like MetaMask:
// starts on the wrong network, can refuse requests, switches accounts and chains.
// Note: the deploy rewrites deployments/31337.json; `npm run dev` regenerates it.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, createWalletClient, http, parseEther, numberToHex } from 'viem'
import { foundry } from 'viem/chains'
import { createWalletSession, discoverWallets, localAnvil, WalletError, blockCasinoAbi } from '../dist/index.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PORT = 8546
const RPC = `http://127.0.0.1:${PORT}`
const FOUNDRY = join(process.env.HOME, '.foundry', 'bin')
const env = { ...process.env, PATH: `${FOUNDRY}:${process.env.PATH}` }
const chain = { ...localAnvil, rpcUrls: { default: { http: [RPC] } } }

let anvil
let deployment
let accounts
const rpc = async (method, params = []) => {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  const j = await r.json()
  if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code, data: j.error.data })
  return j.result
}

/** A scripted wallet. Forwards to anvil (accounts are unlocked there) and fakes the wallet-only methods. */
function fakeWallet({ account, startChainId = 1 }) {
  const handlers = {}
  const w = {
    chainId: startChainId,
    knowsChain: new Set([1]),
    authorized: false,
    rejectNext: false,
    account,
    emit(ev, arg) {
      ;(handlers[ev] ?? []).forEach((h) => h(arg))
    },
    provider: {
      on: (ev, h) => ((handlers[ev] ??= []).push(h)),
      removeListener: (ev, h) => (handlers[ev] = (handlers[ev] ?? []).filter((x) => x !== h)),
      async request({ method, params }) {
        const rejectable = ['eth_requestAccounts', 'wallet_switchEthereumChain', 'wallet_addEthereumChain', 'eth_sendTransaction']
        if (w.rejectNext && rejectable.includes(method)) {
          w.rejectNext = false
          throw Object.assign(new Error('User rejected the request.'), { code: 4001 })
        }
        switch (method) {
          case 'eth_requestAccounts':
            w.popups = (w.popups ?? 0) + 1
            w.authorized = true
            return [w.account]
          case 'eth_accounts':
            return w.authorized ? [w.account] : []
          case 'eth_chainId':
            return numberToHex(w.chainId)
          case 'wallet_switchEthereumChain': {
            const id = Number(params[0].chainId)
            if (!w.knowsChain.has(id)) throw Object.assign(new Error('Unrecognized chain'), { code: 4902 })
            w.chainId = id
            w.emit('chainChanged', numberToHex(id))
            return null
          }
          case 'wallet_addEthereumChain':
            w.knowsChain.add(Number(params[0].chainId))
            w.addedChain = params[0]
            return null
          case 'eth_sendTransaction':
            if (w.chainId !== 31337) throw new Error('wallet is on the wrong chain')
            return rpc(method, params)
          default:
            return rpc(method, params)
        }
      },
    },
  }
  return w
}

const memoryStorage = () => {
  const m = new Map()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (e) => {
    assert.ok(e instanceof WalletError, `expected WalletError, got ${e?.constructor?.name}: ${e?.message}`)
    assert.equal(e.code, code, `expected ${code}, got ${e.code} (${e.revert ?? ''} ${e.message})`)
    return true
  })
}

before(async () => {
  anvil = spawn(join(FOUNDRY, 'anvil'), ['--port', String(PORT), '--silent'], { stdio: 'ignore' })
  for (let i = 0; i < 50; i++) {
    try {
      await rpc('eth_chainId')
      break
    } catch {
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  accounts = await rpc('eth_accounts')
  execFileSync(
    'forge',
    ['script', 'script/Deploy.s.sol', '--rpc-url', RPC, '--broadcast', '--unlocked', '--sender', accounts[0], '--silent'],
    { cwd: ROOT, env: { ...env, ROUND_LENGTH: '20', BETTING_WINDOW: '12', SETTLE_TIMEOUT: '300' }, stdio: 'ignore' },
  )
  const dep = JSON.parse(readFileSync(join(ROOT, 'deployments', '31337.json'), 'utf8'))
  deployment = { chainId: 31337, rpc: RPC, contracts: { blockCasino: dep.blockCasino, chipToken: dep.chipToken }, randomness: dep.randomness }
})

after(() => anvil?.kill())

test('discovery finds EIP-6963 wallets and falls back to window.ethereum', async () => {
  const w = fakeWallet({ account: accounts[1] })
  const target = new EventTarget()
  target.addEventListener('eip6963:requestProvider', () => {
    const ev = new Event('eip6963:announceProvider')
    ev.detail = { info: { uuid: 'u1', name: 'Test Wallet', icon: 'data:,', rdns: 'test.wallet' }, provider: w.provider }
    target.dispatchEvent(ev)
  })
  const found = await discoverWallets(50, target)
  assert.equal(found.length, 1)
  assert.equal(found[0].info.rdns, 'test.wallet')

  const legacy = new EventTarget()
  legacy.ethereum = w.provider
  const viaLegacy = await discoverWallets(400, legacy)
  assert.equal(viaLegacy[0]?.info.name, 'Browser wallet')
})

test('full player flow: connect, switch network, chips, bet, settle, claim', async () => {
  const w = fakeWallet({ account: accounts[1] })
  const wallet = { info: { uuid: 'u1', name: 'Test Wallet', icon: '', rdns: 'test.wallet' }, provider: w.provider }
  const storage = memoryStorage()
  const s = createWalletSession({ deployment, storage, chain })
  const seen = []
  s.subscribe((st) => seen.push(st.status))

  // Refused popup: back to disconnected.
  w.rejectNext = true
  await expectCode(s.connect(wallet), 'USER_REJECTED')
  assert.equal(s.getState().status, 'disconnected')

  // Wallet starts on chain 1 and doesn't know 31337: SDK adds the chain, then switches.
  const st = await s.connect(wallet)
  assert.equal(st.status, 'connected')
  assert.equal(st.address.toLowerCase(), accounts[1].toLowerCase())
  assert.equal(w.chainId, 31337)
  assert.equal(Number(w.addedChain.chainId), 31337)
  assert.ok(seen.includes('connecting') && seen.includes('wrong-network') && seen.at(-1) === 'connected')

  // Chips.
  let bal = await s.balances()
  assert.equal(bal.chips, 0n)
  assert.ok(bal.mon > 0n)
  assert.equal(await s.faucetAvailableAt(), 0n)
  await s.getChips()
  bal = await s.balances()
  assert.equal(bal.chips, parseEther('1000'))
  await expectCode(s.getChips(), 'FAUCET_COOLDOWN')
  assert.ok((await s.faucetAvailableAt()) > 0n)

  // Make sure we're early in a round's betting window.
  const cfg = await s.config()
  const pub = createPublicClient({ chain: foundry, transport: http(RPC) })
  const head = async () => pub.getBlockNumber()
  const roundOf = (b) => (b - cfg.genesisBlock) / cfg.roundLength
  const lockOf = (r) => cfg.genesisBlock + r * cfg.roundLength + cfg.bettingWindow
  let h = await head()
  if (h - (cfg.genesisBlock + roundOf(h) * cfg.roundLength) > 4n) {
    await rpc('anvil_mine', [numberToHex(cfg.genesisBlock + (roundOf(h) + 1n) * cfg.roundLength - h)])
  }

  // Bad bet: High / Low has 2 outcomes.
  await expectCode(s.placeBet(0, 5, parseEther('10')), 'BAD_BET')

  // Bet (approves first: allowance is 0).
  const amount = parseEther('10')
  const bet = await s.placeBet(0, 1, amount)
  assert.ok((await s.balances()).allowance > amount)
  const mine = await s.myBets(bet.roundId)
  assert.equal(mine.length, 1)
  assert.equal(mine[0].amount, amount)
  assert.equal(mine[0].choice, 1)

  // Too early to settle, then betting closes.
  await expectCode(s.requestSettlement(bet.roundId), 'NOT_LOCKED')
  h = await head()
  await rpc('anvil_mine', [numberToHex(lockOf(bet.roundId) - h)])
  // The next placeBet lands in the same round only if we're still in it; mine to just after lock.
  assert.equal(roundOf(await head()), bet.roundId)
  await expectCode(s.placeBet(0, 1, amount), 'BETTING_CLOSED')
  await expectCode(s.claim(bet.roundId, bet.betIndex), 'NOT_SETTLED')

  // Settle: player requests (mock fee is 0), "Pyth" answers.
  await s.requestSettlement(bet.roundId)
  await expectCode(s.requestSettlement(bet.roundId), 'ALREADY_DONE')
  const [, requestId] = await pub.readContract({ address: deployment.contracts.blockCasino, abi: blockCasinoAbi, functionName: 'rounds', args: [bet.roundId] })
  const keeper = createWalletClient({ chain: foundry, transport: http(RPC), account: accounts[0] })
  const mockAbi = [{ type: 'function', name: 'fulfill', stateMutability: 'nonpayable', inputs: [{ type: 'uint64' }, { type: 'bytes32' }], outputs: [] }]
  await pub.waitForTransactionReceipt({
    hash: await keeper.writeContract({ address: deployment.randomness, abi: mockAbi, functionName: 'fulfill', args: [requestId, `0x${'ab'.repeat(32)}`] }),
  })
  const round = await s.round(bet.roundId)
  assert.equal(round.status, 'settled')

  // Claim: payout matches the contract's own result.
  const [, winning] = await pub.readContract({ address: deployment.contracts.blockCasino, abi: blockCasinoAbi, functionName: 'gameResult', args: [bet.roundId, 0] })
  const before = (await s.balances()).chips
  const c = await s.claim(bet.roundId, bet.betIndex)
  const expectWin = winning === 1
  assert.equal(c.won, expectWin)
  assert.equal(c.payout, expectWin ? (amount * 19_600n) / 10_000n : 0n)
  assert.equal((await s.balances()).chips - before, c.payout)
  await expectCode(s.claim(bet.roundId, bet.betIndex), 'ALREADY_DONE')

  // Silent reconnect in a new session (page reload), same storage: no popup.
  const reloaded = createWalletSession({ deployment, storage, chain })
  assert.equal(await reloaded.reconnect([wallet]), true)
  assert.equal(reloaded.getState().status, 'connected')
  assert.equal(await reloaded.reconnect([]), false)
})

test('reacts to wallet events: account switch, wrong network, disconnect', async () => {
  const w = fakeWallet({ account: accounts[2], startChainId: 31337 })
  w.knowsChain.add(31337)
  const wallet = { info: { uuid: 'u2', name: 'Test Wallet', icon: '', rdns: 'test.wallet2' }, provider: w.provider }
  const storage = memoryStorage()
  const s = createWalletSession({ deployment, storage, chain })
  await s.connect(wallet)
  assert.equal(s.getState().status, 'connected')

  w.emit('accountsChanged', [accounts[3]])
  assert.equal(s.getState().address.toLowerCase(), accounts[3].toLowerCase())

  w.chainId = 1
  w.emit('chainChanged', '0x1')
  assert.equal(s.getState().status, 'wrong-network')
  await expectCode(s.getChips(), 'WRONG_NETWORK')
  w.rejectNext = true
  await expectCode(s.switchNetwork(), 'USER_REJECTED')
  await s.switchNetwork()
  assert.equal(s.getState().status, 'connected')

  // Reads work without a wallet.
  assert.ok((await s.config()).roundLength > 0n)

  w.emit('accountsChanged', [])
  assert.equal(s.getState().status, 'disconnected')
  await expectCode(s.getChips(), 'NO_WALLET')

  await s.connect(wallet)
  s.disconnect()
  assert.equal(s.getState().status, 'disconnected')
  assert.equal(storage.getItem('block-casino:wallet'), null)
  assert.equal(await s.reconnect([wallet]), false)
})

test('connectWallet(): the one call, every path', async () => {
  const mk = (rdns, account) => {
    const w = fakeWallet({ account })
    return { w, d: { info: { uuid: rdns, name: rdns, icon: '', rdns }, provider: w.provider } }
  }
  const a = mk('wallet.a', accounts[4])
  const b = mk('wallet.b', accounts[5])
  const storage = memoryStorage()

  // Nothing installed (and no window in Node): NO_WALLET with an install hint.
  const empty = createWalletSession({ deployment, storage: memoryStorage(), chain })
  await expectCode(empty.connectWallet(), 'NO_WALLET')
  await expectCode(empty.connectWallet({ wallets: [] }), 'NO_WALLET')

  // Several wallets, no preference, no picker: CHOOSE_WALLET carries the list.
  const s = createWalletSession({ deployment, storage, chain })
  await assert.rejects(s.connectWallet({ wallets: [a.d, b.d] }), (e) => e.code === 'CHOOSE_WALLET' && e.wallets.length === 2)

  // Picker returns null: treated as the player cancelling.
  await expectCode(s.connectWallet({ wallets: [a.d, b.d], pick: () => null }), 'USER_REJECTED')

  // Picker chooses b: connects, adds and switches the chain, one popup.
  let st = await s.connectWallet({ wallets: [a.d, b.d], pick: async (ws) => ws[1] })
  assert.equal(st.status, 'connected')
  assert.equal(st.wallet.rdns, 'wallet.b')
  assert.equal(b.w.chainId, 31337)
  assert.equal(b.w.popups, 1)

  // Already connected: returns at once, no popup.
  st = await s.connectWallet({ wallets: [a.d, b.d] })
  assert.equal(st.status, 'connected')
  assert.equal(b.w.popups, 1)

  // Player switches network in the wallet: connectWallet switches back.
  b.w.chainId = 1
  b.w.emit('chainChanged', '0x1')
  assert.equal(s.getState().status, 'wrong-network')
  st = await s.connectWallet()
  assert.equal(st.status, 'connected')
  assert.equal(b.w.chainId, 31337)

  // Page reload: new session, same storage. Silent reconnect to b, no popup, no picker.
  const reloaded = createWalletSession({ deployment, storage, chain })
  st = await reloaded.connectWallet({ wallets: [a.d, b.d], pick: () => assert.fail('picker should not open') })
  assert.equal(st.wallet.rdns, 'wallet.b')
  assert.equal(b.w.popups, 1)

  // prefer wins over last-used.
  const fresh = createWalletSession({ deployment, storage: memoryStorage(), chain })
  st = await fresh.connectWallet({ wallets: [a.d, b.d], prefer: 'wallet.a' })
  assert.equal(st.wallet.rdns, 'wallet.a')

  // Exactly one wallet installed: no picker needed.
  const single = createWalletSession({ deployment, storage: memoryStorage(), chain })
  const c = mk('wallet.c', accounts[6])
  st = await single.connectWallet({ wallets: [c.d] })
  assert.equal(st.status, 'connected')
  assert.equal(c.w.popups, 1)
})
