'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRequireAuth } from '@/lib/use-auth'
import Leaderboard, { type LeaderboardEntry } from '@/components/Leaderboard'

const POLL_MS = 30_000

export default function LeaderboardPage() {
  const { user, loading } = useRequireAuth()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = () => {
      fetch('/api/leaderboard')
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) setEntries(d.entries || [])
        })
        .catch(() => undefined)
    }
    load()
    const interval = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [user])

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808] text-gray-400">
        <div className="w-8 h-8 rounded-full border-2 border-[#f5c518]/25 border-t-[#f5c518] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] px-6 py-12">
      <div className="max-w-xl mx-auto mb-8 flex items-center justify-between">
        <Link href="/watch" className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors">
          ← Back
        </Link>
        <h1 className="text-lg font-black font-display uppercase tracking-wider text-white">Market IQ Leaderboard</h1>
        <span className="w-10" />
      </div>
      <div className="max-w-xl mx-auto">
        <Leaderboard entries={entries} />
      </div>
    </div>
  )
}
