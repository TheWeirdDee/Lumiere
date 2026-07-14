import { NextResponse } from 'next/server'
import { getFixtures } from '@/lib/txline/snapshots'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const fixtures = await getFixtures()
    return NextResponse.json({ fixtures })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
