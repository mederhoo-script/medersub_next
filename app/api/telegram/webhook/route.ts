import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import crypto from 'crypto'

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
    const signature = req.headers.get('x-telegram-bot-api-secret-header')

    // Verify request is from Telegram
    if (!verifyTelegramRequest(body, signature)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const update = JSON.parse(body)

    // Handle /start command with link_<code>
    if (update.message?.text?.startsWith('/start link_')) {
      const code = update.message.text.replace('/start link_', '')
      const telegramId = String(update.message.from.id)
      const telegramUsername = update.message.from.username || null
      const firstName = update.message.from.first_name
      const lastName = update.message.from.last_name

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

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Telegram webhook error:', err)
    return NextResponse.json({ ok: true }) // Always return 200 to avoid retries
  }
}
