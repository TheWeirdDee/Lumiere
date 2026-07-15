import React from 'react'

interface MarketIQScoreProps {
  score: number
  size?: 'sm' | 'lg'
}

function tierFor(score: number): { label: string; color: string } {
  if (score >= 300) return { label: 'Elite', color: 'text-[#f5c518]' }
  if (score >= 150) return { label: 'Expert', color: 'text-emerald-400' }
  if (score >= 50) return { label: 'Sharp', color: 'text-amber-400' }
  return { label: 'Rookie', color: 'text-gray-400' }
}

export default function MarketIQScore({ score, size = 'sm' }: MarketIQScoreProps) {
  const tier = tierFor(score)
  const numberClass = size === 'lg' ? 'text-4xl' : 'text-lg'

  return (
    <div className="flex items-baseline gap-2">
      <span className={`font-black font-mono ${numberClass} text-white`}>{score}</span>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${tier.color}`}>{tier.label}</span>
    </div>
  )
}
