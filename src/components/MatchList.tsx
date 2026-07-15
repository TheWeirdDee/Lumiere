// src/components/MatchList.tsx
'use client'

import React, { useState } from 'react'
import type { Fixture, GamePhase } from '../lib/txline/types'
import MatchCard from './MatchCard'

interface MatchListProps {
  matches: Fixture[]
}

type TabType = 'all' | 'live' | 'upcoming' | 'completed'

function isCompleted(phase: GamePhase): boolean {
  return phase === 'F' || phase === 'FET' || phase === 'FPE' || phase === 'C'
}

function isLiveNow(phase: GamePhase): boolean {
  return phase !== 'NS' && !isCompleted(phase) && phase !== 'P'
}

export default function MatchList({ matches }: MatchListProps) {
  const [activeTab, setActiveTab] = useState<TabType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDate, setSelectedDate] = useState('')

  // Extract unique kickoff dates for filtering
  const uniqueDates = Array.from(
    new Set(
      matches.map((m) =>
        new Date(m.kickoff).toLocaleDateString([], { month: 'short', day: 'numeric' })
      )
    )
  ).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  // Apply tab, search, and date filters
  const filteredMatches = matches.filter((m) => {
    // 1. Tab filter
    let tabMatch = true
    if (activeTab === 'live') tabMatch = isLiveNow(m.phase)
    else if (activeTab === 'upcoming') tabMatch = m.phase === 'NS' || m.phase === 'P'
    else if (activeTab === 'completed') tabMatch = isCompleted(m.phase)

    // 2. Search query filter
    const query = searchQuery.toLowerCase().trim()
    const searchMatch =
      query === '' ||
      m.homeTeam.toLowerCase().includes(query) ||
      m.awayTeam.toLowerCase().includes(query)

    // 3. Date filter
    const matchDateStr = new Date(m.kickoff).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    })
    const dateMatch = selectedDate === '' || matchDateStr === selectedDate

    return tabMatch && searchMatch && dateMatch
  })

  const tabs: { id: TabType; label: string }[] = [
    { id: 'all', label: 'All Matches' },
    { id: 'live', label: '🔴 Live' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'completed', label: 'Replay Archive' },
  ]

  return (
    <div className="space-y-6">
      {/* Filter and Search Controls panel */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center bg-white/[0.02] border border-white/5 rounded-2xl p-4">
        {/* Search Field */}
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search country or teams (e.g. France, Spain)..."
            className="w-full bg-[#0a0a0a] border border-white/10 text-white placeholder-gray-500 text-xs font-semibold uppercase tracking-wider rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#f5c518] transition-all duration-300"
          />
        </div>

        {/* Date Filter Dropdown */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 font-display">Date:</span>
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-[#0a0a0a] border border-white/10 text-white text-xs font-semibold uppercase tracking-wider rounded-xl px-4 py-3.5 focus:outline-none focus:border-[#f5c518] transition-all duration-300 w-full lg:w-44"
          >
            <option value="">All Dates</option>
            {uniqueDates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-white/10 overflow-x-auto pb-px gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border-b-2 whitespace-nowrap transition-all duration-300 ${
              activeTab === tab.id
                ? 'border-[#f5c518] text-[#f5c518] font-bold'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Grid of Match Cards */}
      {filteredMatches.length === 0 ? (
        <div className="text-center py-16 text-gray-500 italic text-sm glass-panel rounded-2xl border border-white/5">
          No matches found matching this criteria. Try clearing search query or date filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMatches.map((match) => (
            <MatchCard key={match.matchId} match={match} />
          ))}
        </div>
      )}
    </div>
  )
}
