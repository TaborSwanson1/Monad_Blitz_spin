import type { BlockInfo } from '../client'
import { fmtBlock, shortHash } from '../lib/format'

/** Live chain, newest on the left. Display only: no result ever comes from block data. */
export function BlockStream({ blocks }: { blocks: BlockInfo[] }) {
  return (
    <div className="stream" aria-label="Live blocks">
      {blocks.map((b, i) => {
        const fill = b.gasLimit > 0n ? Number((b.gasUsed * 1000n) / b.gasLimit) / 10 : 0
        return (
          <div key={b.number.toString()} className={`block ${i === 0 ? 'is-new' : ''}`}>
            <div className="block-num">#{fmtBlock(b.number)}</div>
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
  )
}
