import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { supabase } from '@/lib/supabase'

const DESTINATIONS: Record<string, string | undefined> = {
  sportybet: process.env.SPORTYBET_AFFILIATE_URL,
  bet9ja: process.env.BET9JA_AFFILIATE_URL,
  '1xbet': process.env.XBET_AFFILIATE_URL,
  '247bet': process.env.BET247_AFFILIATE_URL,
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ platform: string }>
}

export async function GET(request: NextRequest, context: RouteParams) {
  const { platform } = await context.params
  const template = DESTINATIONS[platform]
  if (!template) {
    return NextResponse.json({ error: 'This affiliate destination is not activated yet' }, { status: 503 })
  }

  const codeValue = request.nextUrl.searchParams.get('bookingCode') || ''
  const lumiereCode = request.nextUrl.searchParams.get('lumiereCode') || ''
  let destination: URL
  try {
    destination = new URL(template.replaceAll('{code}', encodeURIComponent(codeValue)))
    if (destination.protocol !== 'https:') throw new Error('HTTPS required')
  } catch {
    return NextResponse.json({ error: 'Affiliate destination is misconfigured' }, { status: 500 })
  }

  const auth = await getSupabaseServer()
  const { data: { user } } = await auth.auth.getUser()
  const { data: code } = lumiereCode
    ? await supabase.from('lumiere_codes').select('id').eq('lumiere_code', lumiereCode).maybeSingle()
    : { data: null }
  const { error } = await supabase.from('lumiere_affiliate_clicks').insert({
    code_id: code?.id || null,
    user_id: user?.id || null,
    platform,
    destination_host: destination.host,
  })
  if (error) console.error('Could not record affiliate click:', error)

  return NextResponse.redirect(destination, 307)
}
