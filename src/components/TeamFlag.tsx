// Circular SVG country flags (hatscripts/circle-flags, MIT) — World Cup teams
// are national sides, so flags are the "club crests" of this product.
// Served from /public/flags: some mobile webviews (notably Telegram's in-app
// browser) block third-party CDN requests, which left every flag blank.
'use client'

import React, { useState } from 'react'

const TEAM_CODES: Record<string, string> = {
  Algeria: 'dz',
  Argentina: 'ar',
  Australia: 'au',
  Austria: 'at',
  Belgium: 'be',
  'Bosnia & Herzegovina': 'ba',
  Brazil: 'br',
  Cameroon: 'cm',
  Canada: 'ca',
  'Cape Verde': 'cv',
  Chile: 'cl',
  Colombia: 'co',
  'Congo DR': 'cd',
  'Costa Rica': 'cr',
  Croatia: 'hr',
  Denmark: 'dk',
  Ecuador: 'ec',
  Egypt: 'eg',
  England: 'gb-eng',
  France: 'fr',
  Germany: 'de',
  Ghana: 'gh',
  Iran: 'ir',
  Italy: 'it',
  'Ivory Coast': 'ci',
  Japan: 'jp',
  Mali: 'ml',
  Mexico: 'mx',
  Morocco: 'ma',
  Netherlands: 'nl',
  'New Zealand': 'nz',
  Nigeria: 'ng',
  Norway: 'no',
  Panama: 'pa',
  Paraguay: 'py',
  Peru: 'pe',
  Poland: 'pl',
  Portugal: 'pt',
  Qatar: 'qa',
  'Saudi Arabia': 'sa',
  Scotland: 'gb-sct',
  Senegal: 'sn',
  Serbia: 'rs',
  'South Africa': 'za',
  'South Korea': 'kr',
  Spain: 'es',
  Sweden: 'se',
  Switzerland: 'ch',
  Tunisia: 'tn',
  Turkey: 'tr',
  Ukraine: 'ua',
  Uruguay: 'uy',
  USA: 'us',
  Wales: 'gb-wls',
}

interface TeamFlagProps {
  team: string
  size?: number
  className?: string
}

export default function TeamFlag({ team, size = 28, className = '' }: TeamFlagProps) {
  const code = TEAM_CODES[team]
  // 0 = local /public/flags, 1 = CDN fallback, 2 = initials
  const [sourceIndex, setSourceIndex] = useState(0)

  if (!code || sourceIndex >= 2) {
    // Unknown side (e.g. "Winner SF1") or no image source worked: initials.
    const initials = team
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-white/10 border border-white/15 font-mono font-bold text-gray-300 shrink-0 ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.34 }}
        aria-label={team}
      >
        {initials}
      </span>
    )
  }

  const src = sourceIndex === 0 ? `/flags/${code}.svg` : `https://hatscripts.github.io/circle-flags/flags/${code}.svg`

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${team} flag`}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setSourceIndex((index) => index + 1)}
      className={`rounded-full shrink-0 ring-1 ring-white/15 ${className}`}
    />
  )
}
