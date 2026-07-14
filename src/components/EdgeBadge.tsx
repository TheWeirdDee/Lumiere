import React from 'react'
import { formatEdge, edgeLabel } from '@/lib/edge-calculator'

interface EdgeBadgeProps {
  edge: number | null
  size?: 'sm' | 'md'
}

export default function EdgeBadge({ edge, size = 'md' }: EdgeBadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-[9px] px-2 py-0.5' : 'text-xs px-3 py-1'

  if (edge === null) {
    return (
      <span className={`rounded-full font-bold uppercase tracking-wider bg-white/5 text-gray-500 border border-white/10 ${sizeClasses}`}>
        Edge unscored
      </span>
    )
  }

  const label = edgeLabel(edge)
  const colorClasses =
    label === 'strong'
      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
      : label === 'marginal'
        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
        : 'bg-rose-500/15 text-rose-400 border-rose-500/30'

  return (
    <span className={`rounded-full font-bold uppercase tracking-wider border ${colorClasses} ${sizeClasses}`}>
      {formatEdge(edge)} edge
    </span>
  )
}
