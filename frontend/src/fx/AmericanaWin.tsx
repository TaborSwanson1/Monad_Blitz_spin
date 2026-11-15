import { Eagle } from '../components/Eagle'
import { Fireworks } from '../components/Fireworks'
import { FlagRow } from '../components/Flags'
import { Marquee } from './Marquee'

// The whole High / Low win show, for ANY real net win (never for a payout below the
// stake). All of it is drawn in code by us:
//  - rockets in red, white and blue, in salvos, with Monad tokens bursting out of the
//    result popup and bouncing around until it closes   (Fireworks)
//  - the mascot eagle: out below the result, back over the sign, trailing tokens (Eagle)
//  - the sign above the result: red and white on a blue plaque, chasing bulbs,
//    spotlights sweeping across it                       (Marquee)
//  - a row of flags rising on poles along the bottom, waving in the wind (FlagRow)
// `intensity` (0 to 1) is the size of the real win. It sets how many rockets and tokens.
// With motion off every piece shows a still version.

export function AmericanaWin({ intensity }: { intensity: number }) {
  return (
    <>
      <Fireworks intensity={intensity} />
      <FlagRow />
      <Marquee tone="plaque" anchor="above-card" spotlights className="underclass">
        <span className="uc-small">Escaping the</span>
        <span className="uc-big">Permanent Underclass</span>
      </Marquee>
      <Eagle />
    </>
  )
}
