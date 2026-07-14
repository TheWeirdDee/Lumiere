'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { getSupabaseBrowser } from './supabase-browser'

interface AuthState {
  user: User | null
  loading: boolean
}

/** Current Supabase Auth session; live-updates on sign-in/out. */
export function useAuthUser(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // A misconfigured/missing Supabase env var must never take down pages
    // that don't strictly require auth (?demo=true has to survive this) —
    // treat construction failure as "no session" rather than crashing.
    let supabase
    try {
      supabase = getSupabaseBrowser()
    } catch (err) {
      console.error('Supabase client unavailable:', err)
      setLoading(false)
      return
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setUser(data.session?.user ?? null)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load session:', err)
        setLoading(false)
      })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return { user, loading }
}

/** Guards a client page: redirects to /auth once the session check resolves and finds no user. */
export function useRequireAuth(): AuthState {
  const { user, loading } = useAuthUser()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth')
    }
  }, [loading, user, router])

  return { user, loading }
}
