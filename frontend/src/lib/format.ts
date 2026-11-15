import { formatUnits, parseUnits } from 'viem'

export const toChips = (s: string) => parseUnits(s || '0', 18)

export function fmtChips(v: bigint, opts: { sign?: boolean } = {}): string {
  const n = Number(formatUnits(v, 18))
  const s = Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (!opts.sign) return n < 0 ? `−${s}` : s
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : '±0'
}

export const fmtBlock = (n: bigint) => n.toLocaleString()

export const shortHash = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`

export function fmtDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (x: number) => String(x).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export const errMsg = (e: unknown) => {
  if (e && typeof e === 'object' && 'shortMessage' in e) return String((e as { shortMessage: unknown }).shortMessage)
  return e instanceof Error ? e.message : String(e)
}
