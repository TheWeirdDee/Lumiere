import 'server-only'
import { supabase as supabaseAdmin } from '@/lib/supabase'

export interface TelegramSessionIdentity {
  id: number
  firstName: string
  username?: string
}

export async function createTelegramSession(
  identity: TelegramSessionIdentity
): Promise<{ tokenHash: string }> {
  const email = `tg-${identity.id}@telegram.lumiere.internal`
  const metadata = {
    telegram_id: String(identity.id),
    telegram_username: identity.username ?? null,
    telegram_first_name: identity.firstName,
  }

  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: metadata,
  })
  const duplicate =
    createError?.code === 'email_exists' ||
    createError?.code === 'user_already_exists' ||
    createError?.message.toLowerCase().includes('already')
  if (createError && !duplicate) throw createError

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { data: metadata },
  })
  if (error || !data.properties?.hashed_token) {
    throw error ?? new Error('Failed to create Telegram session')
  }
  return { tokenHash: data.properties.hashed_token }
}
