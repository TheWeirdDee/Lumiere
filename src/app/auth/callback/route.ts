import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { supabase as supabaseAdmin } from '@/lib/supabase'

/**
 * OAuth code-exchange handler for any Supabase-native provider (Google,
 * GitHub, etc). Telegram login does not redirect through here — it has no
 * native Supabase provider and is bridged instead in /api/auth/telegram —
 * but this route is real and functional for any native provider added later.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.redirect(new URL('/auth?error=missing_code', request.url))
  }

  let response = NextResponse.redirect(new URL('/auth/username', request.url))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.session) {
    return NextResponse.redirect(new URL('/auth?error=exchange_failed', request.url))
  }

  const { data: existing } = await supabaseAdmin
    .from('lumiere_users')
    .select('username')
    .eq('id', data.session.user.id)
    .maybeSingle()

  const destination = existing?.username ? '/watch' : '/auth/username'
  response.headers.set('Location', new URL(destination, request.url).toString())
  return response
}
