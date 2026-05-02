import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

function generateTelegramUserEmail(telegramId: string): string {
  return `telegram_${telegramId}@medersub.local`
}

function generateSecurePassword(): string {
  return crypto.randomBytes(16).toString('hex')
}

async function sendTelegramMessage(chatId: number, text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  })
}

// Verify Telegram bot request signature
function verifyTelegramRequest(body: string, signature: string | null): boolean {
  if (!signature) return false

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return false

  const secret = crypto.createHash('sha256').update(botToken).digest()
  const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex')

  return hmac === signature
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-telegram-bot-api-secret-token') || req.headers.get('x-telegram-bot-api-secret-header')

    // Verify request is from Telegram
    if (!verifyTelegramRequest(body, signature)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const update = JSON.parse(body)

    const text = update.message?.text || ''
    const telegramId = String(update.message?.from?.id || '')
    const telegramUsername = update.message?.from?.username || null
    const firstName = update.message?.from?.first_name || ''
    const lastName = update.message?.from?.last_name || ''
    const chatId = update.message?.chat?.id

    // Handle /start command with link_<code>
    if (text.startsWith('/start link_')) {
      const code = text.replace('/start link_', '')

      // Look up the linking code
      const { data: linkData, error: linkError } = await supabaseAdmin
        .from('telegram_links')
        .select('user_id, expires_at')
        .eq('code', code)
        .single()

      if (linkError || !linkData) {
        return NextResponse.json({ ok: true }) // Silent fail
      }

      // Check if code expired
      if (new Date(linkData.expires_at) < new Date()) {
        // Delete expired code
        await supabaseAdmin.from('telegram_links').delete().eq('code', code)
        return NextResponse.json({ ok: true })
      }

      // Link telegram to user
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          telegram_id: telegramId,
          telegram_username: telegramUsername,
          telegram_linked_at: new Date().toISOString(),
        })
        .eq('id', linkData.user_id)

      if (!updateError) {
        // Delete the used code
        await supabaseAdmin.from('telegram_links').delete().eq('code', code)

        // Send confirmation message to user (optional)
        // You can send a message back via Telegram API if you want
      }
    }

    // Handle /start command with login_<code>
    if (text.startsWith('/start login_') && chatId && telegramId) {
      const code = text.replace('/start login_', '')
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
      const tempPassword = generateSecurePassword()

      // Find existing Telegram-linked profile, if any
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('telegram_id', telegramId)
        .single()

      let userId = existingProfile?.id || null

      if (!userId) {
        const email = generateTelegramUserEmail(telegramId)
        const fullName = `${firstName} ${lastName}`.trim() || telegramUsername || `User ${telegramId}`

        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            telegram_id: telegramId,
            telegram_username: telegramUsername,
          },
        })

        if (createError || !authData.user) {
          return NextResponse.json({ ok: true })
        }

        userId = authData.user.id

        await supabaseAdmin
          .from('profiles')
          .update({
            telegram_id: telegramId,
            telegram_username: telegramUsername,
            telegram_linked_at: new Date().toISOString(),
          })
          .eq('id', userId)
      }

      const loginCode = crypto.randomBytes(12).toString('hex')

      try {
        if ((supabaseAdmin.auth.admin as any)?.updateUserById) {
          await (supabaseAdmin.auth.admin as any).updateUserById(userId, { password: tempPassword })
        }
      } catch (err) {
        console.warn('Failed to set login password', err)
      }

      const { error: codeError } = await supabaseAdmin
        .from('telegram_login_codes')
        .insert({ code: loginCode, user_id: userId, temporary_password: tempPassword })

      if (!codeError) {
        const loginUrl = `${appUrl}/api/auth/telegram/callback?login_code=${encodeURIComponent(loginCode)}`
        await sendTelegramMessage(chatId, `Tap to continue logging in: ${loginUrl}`)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Telegram webhook error:', err)
    return NextResponse.json({ ok: true }) // Always return 200 to avoid retries
  }
}
