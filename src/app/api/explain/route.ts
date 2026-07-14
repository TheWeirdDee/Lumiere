import { NextRequest, NextResponse } from 'next/server'
import { generateExplanation } from '@/lib/ai-explain'
import type { OddsShock } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const shock = (await request.json()) as OddsShock
    const explanation = await generateExplanation(shock)
    return NextResponse.json({ explanation })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
