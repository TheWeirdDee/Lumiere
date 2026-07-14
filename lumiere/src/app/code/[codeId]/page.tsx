'use client'

import React, { use, useEffect, useState } from 'react'
import Link from 'next/link'
import CodeCard from '@/components/CodeCard'
import type { Selection, SelectionStatus } from '@/types'

interface PageProps {
  params: Promise<{ codeId: string }>
}

interface CodeRow {
  lumiere_code: string
  creator_username: string
  platform: string
  platform_code: string | null
  overall_edge: number | null
  status: string
}

interface SelectionRow extends Selection {
  liveLabel?: SelectionStatus | 'live' | 'pending'
  liveScore?: { home: number; away: number } | null
}

const POLL_MS = 30_000

export default function CodePage({ params }: PageProps) {
  const { codeId } = use(params)
  const [code, setCode] = useState<CodeRow | null>(null)
  const [selections, setSelections] = useState<SelectionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch(`/api/codes/${codeId}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Code not found')
        if (cancelled) return
        setCode(data.code)
        setSelections(data.selections)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const interval = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [codeId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808] text-gray-400">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin" />
      </div>
    )
  }

  if (error || !code) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#080808] gap-4">
        <p className="text-rose-400 text-sm">{error || 'Code not found'}</p>
        <Link href="/" className="text-xs font-bold uppercase bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full transition-colors">
          Return home
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080808] px-6 py-12">
      <div className="max-w-2xl mx-auto mb-8">
        <Link href="/" className="text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors">
          ← LUMIÈRE
        </Link>
      </div>
      <div className="max-w-2xl mx-auto">
        <CodeCard
          lumiereCode={code.lumiere_code}
          creatorUsername={code.creator_username}
          platform={code.platform}
          platformCode={code.platform_code}
          overallEdge={code.overall_edge}
          status={code.status}
          selections={selections}
        />
      </div>
    </div>
  )
}
