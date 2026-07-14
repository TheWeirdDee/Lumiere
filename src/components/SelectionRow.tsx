import React from 'react'
import type { Selection, SelectionType } from '@/types'
import EdgeBadge from './EdgeBadge'

const SELECTION_LABELS: Record<SelectionType, (home: string, away: string) => string> = {
  home_win: (home) => `${home} to win`,
  away_win: (_home, away) => `${away} to win`,
  draw: () => 'Draw',
  'over_2.5': () => 'Over 2.5 goals',
  'under_2.5': () => 'Under 2.5 goals',
  btts_yes: () => 'Both teams to score',
  btts_no: () => 'Both teams not to score',
}

type DisplayStatus = 'pending' | 'won' | 'lost' | 'void' | 'live'

interface SelectionRowProps {
  selection: Pick<Selection, 'matchId' | 'homeTeam' | 'awayTeam' | 'selectionType' | 'edge'>
  status?: DisplayStatus
  liveScore?: { home: number; away: number } | null
  onRemove?: () => void
}

const STATUS_META: Record<DisplayStatus, { icon: string; label: string; color: string }> = {
  won: { icon: '✅', label: 'Won', color: 'text-emerald-400' },
  lost: { icon: '❌', label: 'Lost', color: 'text-rose-400' },
  live: { icon: '🔴', label: 'Live', color: 'text-rose-400' },
  pending: { icon: '⏳', label: 'Pending', color: 'text-gray-400' },
  void: { icon: '⚪', label: 'Void', color: 'text-gray-500' },
}

export default function SelectionRow({ selection, status = 'pending', liveScore, onRemove }: SelectionRowProps) {
  const meta = STATUS_META[status]
  const label = SELECTION_LABELS[selection.selectionType](selection.homeTeam, selection.awayTeam)

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-white font-display truncate">{label}</div>
        <div className="text-[10px] text-gray-500 font-mono truncate">
          {selection.homeTeam} vs {selection.awayTeam}
        </div>
      </div>

      <EdgeBadge edge={selection.edge} size="sm" />

      <div className={`flex items-center gap-1 text-xs font-semibold whitespace-nowrap ${meta.color}`}>
        <span>{meta.icon}</span>
        <span>
          {meta.label}
          {status === 'live' && liveScore ? ` (${liveScore.home}-${liveScore.away})` : ''}
        </span>
      </div>

      {onRemove && (
        <button onClick={onRemove} className="text-gray-500 hover:text-rose-400 transition-colors text-sm" aria-label="Remove selection">
          ✕
        </button>
      )}
    </div>
  )
}
