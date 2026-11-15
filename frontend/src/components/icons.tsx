// Small stroke icons, drawn for this project. 16px, inherit the text color.

import type { ReactNode } from 'react'

function Icon({ children, size = 16 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

export const IconClock = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
)

export const IconTrend = () => (
  <Icon>
    <path d="M3 17l6-6 4 4 8-8" />
    <path d="M15 7h6v6" />
  </Icon>
)

export const IconCoins = () => (
  <Icon>
    <ellipse cx="9" cy="7" rx="6" ry="3" />
    <path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" />
    <path d="M9 18c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.4-1.8-2.5-4.3-2.9" />
  </Icon>
)

export const IconLayers = () => (
  <Icon>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </Icon>
)

export const IconShield = () => (
  <Icon>
    <path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3z" />
    <path d="M9 12l2 2 4-4" />
  </Icon>
)

export const IconCube = () => (
  <Icon>
    <path d="M12 2l9 5v10l-9 5-9-5V7l9-5z" />
    <path d="M3 7l9 5 9-5M12 12v10" />
  </Icon>
)

export const IconTarget = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </Icon>
)

export const IconList = () => (
  <Icon>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </Icon>
)

export const IconTimer = () => (
  <Icon>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4M9 2h6" />
  </Icon>
)

export const IconArrowUp = () => (
  <Icon size={12}>
    <path d="M7 17L17 7M9 7h8v8" />
  </Icon>
)

export const IconArrowDown = () => (
  <Icon size={12}>
    <path d="M7 7l10 10M17 9v8H9" />
  </Icon>
)

export const BrandMark = () => (
  <svg className="brand-mark" width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" />
    <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity="0.55" />
    <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.55" />
    <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" opacity="0.25" />
  </svg>
)

export const IconUpDown = () => (
  <Icon>
    <path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4" />
  </Icon>
)

export const IconHash = () => (
  <Icon>
    <path d="M5 9h14M5 15h14M10 4L8 20M16 4l-2 16" />
  </Icon>
)

export const IconFlag = () => (
  <Icon>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </Icon>
)

export const IconUsers = () => (
  <Icon>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.4 3.4-5.5 6.5-5.5s5.7 2.1 6.5 5.5" />
    <path d="M16 4.6a3.5 3.5 0 010 6.8M18.5 14.8c1.6.9 2.7 2.7 3 5.2" />
  </Icon>
)

export const IconSliders = () => (
  <Icon>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Icon>
)
