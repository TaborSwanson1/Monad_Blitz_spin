import { BaseError, ContractFunctionRevertedError, InsufficientFundsError, UserRejectedRequestError } from 'viem'

export type WalletErrorCode =
  | 'NO_WALLET' // nothing installed, or not connected yet
  | 'USER_REJECTED' // the player said no in their wallet
  | 'WRONG_NETWORK' // wallet is on another chain and refused to switch
  | 'INSUFFICIENT_GAS' // not enough MON for gas or the VRF fee
  | 'FAUCET_COOLDOWN' // chips faucet used in the last 24 h
  | 'BETTING_CLOSED' // the round's lock block has passed
  | 'BAD_BET' // unknown game, bad choice, or amount outside min/max
  | 'NOT_ENOUGH_CHIPS' // chip balance or allowance too low
  | 'NOT_SETTLED' // claim before the round has its random seed
  | 'ALREADY_DONE' // bet already claimed or refunded, or settlement already requested
  | 'NOT_REFUNDABLE' // refund before the settle timeout, or round settled
  | 'NOT_LOCKED' // settlement requested before betting closed
  | 'NO_BETS' // settlement requested for a round nobody bet on
  | 'UNKNOWN'

const MESSAGES: Record<WalletErrorCode, string> = {
  NO_WALLET: 'Connect a wallet first.',
  USER_REJECTED: 'Request cancelled in your wallet.',
  WRONG_NETWORK: 'Switch your wallet to Monad Testnet to play.',
  INSUFFICIENT_GAS: 'Not enough MON for gas. Get testnet MON from the faucet.',
  FAUCET_COOLDOWN: 'Free chips are available once a day. Try again later.',
  BETTING_CLOSED: 'Betting is closed for this round. Your bet was not placed.',
  BAD_BET: 'That bet is not allowed. Check the game, choice and amount.',
  NOT_ENOUGH_CHIPS: 'Not enough chips. Use the free chips faucet.',
  NOT_SETTLED: 'This round has no result yet.',
  ALREADY_DONE: 'Already done.',
  NOT_REFUNDABLE: 'This bet cannot be refunded yet.',
  NOT_LOCKED: 'Betting is still open for this round.',
  NO_BETS: 'Nobody bet on this round.',
  UNKNOWN: 'Something went wrong.',
}

/** Contract custom errors (BlockCasino, ChipToken) → codes. */
const REVERTS: Record<string, WalletErrorCode> = {
  BettingClosed: 'BETTING_CLOSED',
  UnknownGame: 'BAD_BET',
  BadChoice: 'BAD_BET',
  BadAmount: 'BAD_BET',
  InsufficientBalance: 'NOT_ENOUGH_CHIPS',
  InsufficientAllowance: 'NOT_ENOUGH_CHIPS',
  FaucetCooldown: 'FAUCET_COOLDOWN',
  NotSettled: 'NOT_SETTLED',
  BetClosed: 'ALREADY_DONE',
  AlreadyRequested: 'ALREADY_DONE',
  NotRefundable: 'NOT_REFUNDABLE',
  NotLocked: 'NOT_LOCKED',
  NoBets: 'NO_BETS',
  InsufficientFee: 'INSUFFICIENT_GAS',
  TooLate: 'NOT_REFUNDABLE',
}

/** Every error the SDK throws. `code` is for logic, `message` is safe to show players. */
export class WalletError extends Error {
  readonly code: WalletErrorCode
  /** Contract error name, if a contract reverted (for example "FaucetCooldown"). */
  readonly revert?: string
  /** Contract error arguments, for example [availableAt] for FaucetCooldown. */
  readonly args?: readonly unknown[]
  readonly cause?: unknown

  constructor(code: WalletErrorCode, opts: { message?: string; revert?: string; args?: readonly unknown[]; cause?: unknown } = {}) {
    super(opts.message ?? MESSAGES[code])
    this.name = 'WalletError'
    this.code = code
    this.revert = opts.revert
    this.args = opts.args
    this.cause = opts.cause
  }
}

/** Turns anything a wallet, viem or a contract throws into a WalletError. */
export function toWalletError(e: unknown): WalletError {
  if (e instanceof WalletError) return e
  const raw = e as { code?: number; message?: string }
  if (raw?.code === 4001) return new WalletError('USER_REJECTED', { cause: e })
  if (e instanceof BaseError) {
    if (e.walk((x) => x instanceof UserRejectedRequestError)) return new WalletError('USER_REJECTED', { cause: e })
    if (e.walk((x) => x instanceof InsufficientFundsError)) return new WalletError('INSUFFICIENT_GAS', { cause: e })
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | null
    const name = revert?.data?.errorName
    if (name) {
      const code = REVERTS[name] ?? 'UNKNOWN'
      return new WalletError(code, {
        revert: name,
        args: revert.data?.args,
        cause: e,
        message: code === 'UNKNOWN' ? `Contract error: ${name}` : undefined,
      })
    }
    if (/insufficient funds/i.test(e.message)) return new WalletError('INSUFFICIENT_GAS', { cause: e })
    if (/user (rejected|denied)/i.test(e.message)) return new WalletError('USER_REJECTED', { cause: e })
  }
  return new WalletError('UNKNOWN', { cause: e, message: raw?.message?.split('\n')[0] || MESSAGES.UNKNOWN })
}
