'use client'

import React, { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useRequireAuth } from '@/lib/use-auth'
import CodeBuilder from '@/components/CodeBuilder'

function BuildContent() {
  const { user, loading } = useRequireAuth()
  const searchParams = useSearchParams()
  const matchId = searchParams.get('matchId') || undefined
  const team = searchParams.get('team')

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808] text-gray-400">
        <div className="w-8 h-8 rounded-full border-2 border-[#f5c518]/25 border-t-[#f5c518] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] px-6 py-12">
      <div className="max-w-2xl mx-auto mb-2 flex items-center justify-between">
        <Link href="/watch" className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors">
          ← Back
        </Link>
        <h1 className="text-lg font-black font-display uppercase tracking-wider text-white">Build a code</h1>
        <span className="w-10" />
      </div>
      <p className="max-w-2xl mx-auto mb-6 text-center text-[11px] text-gray-500 leading-relaxed">
        Verifies the odds your platform is already offering — LUMIÈRE never places bets or holds money.
      </p>
      <CodeBuilder prefillMatchId={matchId} prefillTeam={team === 'home' || team === 'away' ? team : undefined} />
    </div>
  )
}

export default function BuildPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#080808] text-gray-400">
          <div className="w-8 h-8 rounded-full border-2 border-[#f5c518]/25 border-t-[#f5c518] animate-spin" />
        </div>
      }
    >
      <BuildContent />
    </Suspense>
  )
}
