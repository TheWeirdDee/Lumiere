// LUMIÈRE mark — a champion's cup whose stem and base form the letter L.
// The bowl holds a ball silhouette; gold gradient throughout.
import React from 'react'

export function LogoMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id="lum-gold" x1="10" y1="4" x2="38" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffe27a" />
          <stop offset="0.45" stopColor="#f5c518" />
          <stop offset="1" stopColor="#c99510" />
        </linearGradient>
      </defs>

      {/* Handles */}
      <path
        d="M10 9C4.5 9 3.5 17 10.5 18.5M28 9C33.5 9 34.5 17 27.5 18.5"
        stroke="url(#lum-gold)"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />

      {/* Bowl */}
      <path
        d="M9 5.5h20c0 8.8-3.6 15-10 16.4C12.6 20.5 9 14.3 9 5.5Z"
        fill="url(#lum-gold)"
      />

      {/* Ball resting in the bowl */}
      <circle cx="19" cy="11.5" r="3.4" fill="#0b0b0b" />
      <path
        d="M19 9.1l2.1 1.5-.8 2.4h-2.6l-.8-2.4L19 9.1Z"
        fill="url(#lum-gold)"
        opacity="0.9"
      />

      {/* Stem — the L's vertical */}
      <rect x="16.4" y="21" width="5.2" height="17" rx="2" fill="url(#lum-gold)" />

      {/* Base — the L's foot, sweeping right */}
      <rect x="16.4" y="35.6" width="23.6" height="5.4" rx="2.6" fill="url(#lum-gold)" />
    </svg>
  )
}

export function LogoWordmark({ size = 26, textClassName = 'text-lg' }: { size?: number; textClassName?: string }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className={`font-display font-bold tracking-[0.25em] text-white ${textClassName}`}>LUMIÈRE</span>
    </span>
  )
}
