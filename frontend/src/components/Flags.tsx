// A row of waving US flags along the bottom of the screen, for the Americana big win
// (with the eagle). Drawn by us: 13 stripes, a blue canton with 50 stars.
//
// The wave: the flag image is cut into thin vertical slices. Each slice bobs up and
// down a little later than the one before it, so a ripple runs from the pole to the
// fly end. A moving shade adds the folds, gusts tug the cloth every couple of seconds,
// and streaks of wind blow past. Behind the result card, so it never covers it. The
// flags stay up until the result popup closes.

const FW = 190
const FH = 100

function flagSvg(): string {
  const stripe = FH / 13
  let s = ''
  for (let i = 0; i < 13; i++) s += `<rect y="${(i * stripe).toFixed(3)}" width="${FW}" height="${stripe.toFixed(3)}" fill="${i % 2 ? '#ffffff' : '#b22234'}"/>`
  const cw = 76
  const ch = stripe * 7
  s += `<rect width="${cw}" height="${ch.toFixed(3)}" fill="#3c3b6e"/>`
  // 50 stars: 9 rows alternating 6 and 5.
  const star = (x: number, y: number, r: number) => {
    let p = ''
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5
      const rr = k % 2 ? r * 0.38 : r
      p += `${k ? 'L' : 'M'}${(x + Math.cos(a) * rr).toFixed(2)} ${(y + Math.sin(a) * rr).toFixed(2)}`
    }
    return `<path d="${p}Z" fill="#fff"/>`
  }
  for (let row = 0; row < 9; row++) {
    const six = row % 2 === 0
    const n = six ? 6 : 5
    for (let c = 0; c < n; c++) {
      const x = (six ? 6.3 : 12.6) + c * 12.6
      const y = 5.4 + row * 5.4
      s += star(x, y, 2.1)
    }
  }
  return `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FW} ${FH}" width="${FW}" height="${FH}">${s}</svg>`)}`
}

const FLAG = flagSvg()
const SLICES = 18

function Flag({ width, delay }: { width: number; delay: number }) {
  const height = (width * FH) / FW
  const slice = width / SLICES
  return (
    <div className="flag" style={{ '--rise-delay': `${delay}s` } as React.CSSProperties}>
      <div className="flag-pole" style={{ height: height * 2.1 }} />
      <div className="flag-cloth" style={{ width, height }}>
        {Array.from({ length: SLICES }, (_, i) => (
          <span
            key={i}
            className="flag-slice"
            style={
              {
                left: i * slice,
                width: slice + 0.6, // a hair of overlap so no seams show
                height,
                backgroundImage: `url("${FLAG}")`,
                backgroundSize: `${width}px ${height}px`,
                backgroundPosition: `${-i * slice}px 0`,
                // Bigger ripple toward the fly end, which isn't held by the pole.
                '--amp': `${(1.5 + (i / SLICES) * 5).toFixed(2)}px`,
                animationDelay: `${(-i * 0.07).toFixed(2)}s`,
              } as React.CSSProperties
            }
          />
        ))}
        <span className="flag-shade" />
      </div>
    </div>
  )
}

export function FlagRow() {
  // Sized to the screen: about 5 flags across, fewer and smaller on a phone.
  const vw = typeof window === 'undefined' ? 1200 : window.innerWidth
  const count = vw < 600 ? 3 : 5
  const width = Math.min(220, Math.max(110, vw / (count + 1.4)))
  return (
    <div className="flag-row" aria-hidden>
      <div className="wind">
        {Array.from({ length: 8 }, (_, i) => (
          <i key={i} style={{ '--n': i } as React.CSSProperties} />
        ))}
      </div>
      {Array.from({ length: count }, (_, i) => (
        <Flag key={i} width={width} delay={0.1 + Math.abs(i - (count - 1) / 2) * 0.12} />
      ))}
    </div>
  )
}
