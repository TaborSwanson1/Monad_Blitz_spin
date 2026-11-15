import type { BlockInfo } from '../client'
import { MONAD_EXPLORER } from '../client/liveBlocks'
import { fmtBlock, shortHash } from '../lib/format'

const SOURCE = {
  monad: { text: 'Monad testnet, live', cls: 'badge-pos' },
  local: { text: 'Local chain', cls: 'badge-primary' },
  sim: { text: 'Simulated blocks', cls: 'badge-warn' },
} as const

/** Live chain, newest on the left. Display only: no result ever comes from block data. */
export function BlockStream({ blocks }: { blocks: BlockInfo[] }) {
  const source = SOURCE[blocks[0]?.source ?? 'sim']
  return (
    <>
      {blocks.length > 0 && (
        <div className="stream-source">
          <span className={`badge ${source.cls}`}>
            <span className="dot" /> {source.text}
          </span>
        </div>
      )}
      <div className="stream" aria-label="Live blocks">
        {blocks.map((b, i) => {
          const fill = b.gasLimit > 0n ? Number((b.gasUsed * 1000n) / b.gasLimit) / 10 : 0
          const num = `#${fmtBlock(b.number)}`
          return (
            <div key={b.number.toString()} className={`block ${i === 0 ? 'is-new' : ''}`}>
              <div className="block-num">
                {b.source === 'monad' ? (
                  <a href={`${MONAD_EXPLORER}/block/${b.number}`} target="_blank" rel="noreferrer">
                    {num}
                  </a>
                ) : (
                  num
                )}
              </div>
              <div className="block-hash mono">{shortHash(b.hash)}</div>
              <div className="block-meta">
                <span>{b.txCount} tx</span>
                <span>{fill.toFixed(0)}% gas</span>
              </div>
              <div className="gasbar">
                <div style={{ width: `${fill}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
