import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import {
  createMarketCall,
  getUserMarketCalls,
  resolveDueMarketCallsFromSnapshots,
} from '@/lib/market-calls-server'
import type { MarketCallChoice } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function authenticatedUser() {
  const client = await getSupabaseServer()
  const {
    data: { user },
  } = await client.auth.getUser()
  return user
}

export async function GET(request: NextRequest) {
  const user = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await resolveDueMarketCallsFromSnapshots()
    const calls = await getUserMarketCalls(user.id, {
      matchId: request.nextUrl.searchParams.get('matchId') || undefined,
      shockId: request.nextUrl.searchParams.get('shockId') || undefined,
    })
    return NextResponse.json({ calls }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Failed to load market calls:', error)
    return NextResponse.json({ error: 'Could not load market calls' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { shockId?: unknown; choice?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const choice = body.choice as MarketCallChoice
  if (typeof body.shockId !== 'string' || (choice !== 'follow' && choice !== 'fade')) {
    return NextResponse.json({ error: 'shockId and a valid choice are required' }, { status: 400 })
  }

  try {
    const call = await createMarketCall(user.id, body.shockId, choice)
    return NextResponse.json({ call }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save market call'
    const status = message.includes('closed') ? 409 : message.includes('not found') ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
