import { NextRequest, NextResponse } from 'next/server'
import { resolveDueMarketCallsFromSnapshots } from '@/lib/market-calls-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const marketCallsResolved = await resolveDueMarketCallsFromSnapshots()
    return NextResponse.json({ ok: true, marketCallsResolved })
  } catch (error) {
    console.error('Resolver cron failed:', error)
    return NextResponse.json({ error: 'Resolver failed' }, { status: 500 })
  }
}
