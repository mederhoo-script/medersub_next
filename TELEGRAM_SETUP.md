# Telegram Integration Guide

## Overview
This implementation adds Telegram login and account linking to Medersub. Users can:
- **Link Telegram** to an existing logged-in account
- **Login with Telegram** (if already linked, creates session)
- **Unlink Telegram** from their profile

## Quick Setup

### 1. Create a Telegram Bot
1. Open Telegram and chat with [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow the instructions
3. Copy the **Bot Token** (e.g., `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
4. Send `/mybots` → select your bot → **Bot Settings** → **Domain** → set a domain (e.g., `medersub.com`)

### 2. Add Environment Variables

Add to `.env.local`:

```env
# Server-side only (never expose to client)
TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN_HERE

# Optional: Used by the widget popup
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=your_bot_username
```

### 3. Update Database Schema

Run the migration to add Telegram columns to the `profiles` table:

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS telegram_id text;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS telegram_username text;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS telegram_linked_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_profiles_telegram_id ON profiles(telegram_id);
```

Or use Supabase CLI:
```bash
supabase db push
```

This will run `supabase/migrations/004_add_telegram_fields.sql` automatically.

### 4. Deploy and Test

1. **Dev server**: `npm run dev`
2. Visit login page (`/login`) or register page (`/register`)
3. Click the Telegram button
4. A popup opens with Telegram Web Login Widget
5. Authorize your Telegram account
6. Server verifies the payload and links the account
7. You're redirected back to the app

## How It Works

### File Structure
```
app/
  (auth)/
    login/page.tsx           # Login page with Telegram button
    register/page.tsx        # Register page with Telegram button
  api/auth/telegram/
    verify/route.ts          # Verifies Telegram payload & links account
    unlink/route.ts          # Unlinks Telegram from profile
  dashboard/profile/page.tsx # Profile page with link/unlink UI
components/auth/
  telegram-button.tsx        # Reusable Telegram button component
public/
  telegram-login.html        # Popup that loads Telegram widget
supabase/migrations/
  004_add_telegram_fields.sql # DB schema migration
```

### Flow Diagram

#### Link Telegram (Logged-in User)
```
User clicks "Link Telegram"
    ↓
Popup opens /telegram-login.html
    ↓
User authorizes in Telegram
    ↓
Popup sends payload via postMessage
    ↓
TelegramButton posts to /api/auth/telegram/verify
    ↓
Server verifies HMAC signature
    ↓
Server checks auth_date (replay protection)
    ↓
Server links telegram_id to logged-in user's profile
    ↓
Page reloads → Shows "Linked @username"
```

#### Unlink Telegram
```
User clicks "Unlink"
    ↓
POST /api/auth/telegram/unlink
    ↓
Server clears telegram_* fields from profile
    ↓
Page reloads → Shows "Link Telegram" button again
```

### Security Considerations

1. **HMAC Verification**: Server verifies Telegram's `hash` using the bot token
2. **Replay Protection**: Checks `auth_date` is within 5 minutes
3. **Server-only Token**: `TELEGRAM_BOT_TOKEN` never exposed to client
4. **Session Validation**: Links to authenticated user's profile
5. **Index on telegram_id**: Enables fast lookups during login

## API Endpoints

### POST /api/auth/telegram/verify
**Request** (from client after Telegram authorization):
```json
{
  "payload": {
    "id": 123456789,
    "first_name": "John",
    "username": "johndoe",
    "photo_url": "...",
    "auth_date": 1234567890,
    "hash": "abcd1234..."
  }
}
```

**Response** (Success - user logged in):
```json
{
  "ok": true,
  "profile": {
    "id": "user-uuid",
    "telegram_id": "123456789",
    "telegram_username": "johndoe",
    "telegram_linked_at": "2026-05-02T10:00:00Z"
  }
}
```

**Response** (Not logged in - future feature):
```json
{
  "ok": false,
  "action": "not_logged_in",
  "candidate": {
    "telegram_id": "123456789",
    "telegram_username": "johndoe"
  }
}
```

### POST /api/auth/telegram/unlink
**Requires**: Authenticated session

**Response** (Success):
```json
{
  "ok": true,
  "profile": {
    "id": "user-uuid",
    "telegram_id": null,
    "telegram_username": null,
    "telegram_linked_at": null
  }
}
```

## Component: TelegramButton

```tsx
import TelegramButton from '@/components/auth/telegram-button'

// In login page
<TelegramButton />

// In register page
<TelegramButton label="Sign up with Telegram" />

// In profile page (linking)
<TelegramButton label="Link Telegram" />
```

Props:
- `botUsername?: string` - Bot username (optional, falls back to env var)
- `label?: string` - Button label (default: "Continue with Telegram")

## Mini App Login (Auto-login inside Telegram)

When a user opens the app as a **Telegram Mini App** (via a bot or direct link), it automatically authenticates them without showing the login form.

### How it works
```
User opens app inside Telegram Mini App
    ↓
Login page detects window.Telegram.WebApp.initData (useSyncExternalStore)
    ↓
Shows loading spinner — no email/password form shown
    ↓
TelegramMiniAppLogin component POSTs initData to POST /api/tg-auth
    ↓
Server verifies HMAC signature (TELEGRAM_BOT_TOKEN)
    ↓
Checks auth_date freshness (max 24 h)
    ↓
Looks up profiles by telegram_id
    ↓
  Found → existing user → create session
  Not found → createUser() → upsert profile row → create session
    ↓
Returns { ok: true, access_token, refresh_token }
    ↓
Client calls supabase.auth.setSession() → redirect to /dashboard
```

### File structure (Mini App additions)
```
app/
  (auth)/
    login/page.tsx              # Detects Telegram context, renders MiniApp path or normal form
  api/tg-auth/route.ts          # Verifies initData, find/create user, return session tokens
components/auth/
  telegram-miniapp-login.tsx    # Behaviour-only component — POSTs initData, sets session
supabase/migrations/
  009_get_auth_user_id_by_email.sql  # RPC for orphaned-auth-record recovery
  010_telegram_id_unique.sql         # UNIQUE constraint on profiles.telegram_id
```

### Environment variables
```env
TELEGRAM_BOT_TOKEN=your-bot-token        # required
TELEGRAM_EMAIL_DOMAIN=medersub.local     # optional — domain for synthetic Telegram emails
```

## Troubleshooting

### "Telegram widget not loading"
- Ensure `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` is set correctly (without @)
- Check browser console for CORS or script loading errors
- Verify bot domain matches your deployment URL

### "Verification failed"
- Check `TELEGRAM_BOT_TOKEN` is correct (copy from BotFather)
- Ensure server has access to `TELEGRAM_BOT_TOKEN` env var
- Check request `auth_date` is within 5 minutes of server time

### "Profile not updating"
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set (used by API route)
- Check Supabase RLS policies allow admin writes to `profiles`
- Check DB migration ran successfully (`telegram_id` column exists)

### "Popup not communicating"
- Ensure popup uses same origin as parent window
- Check postMessage implementation in `public/telegram-login.html`
- Verify TelegramButton's message listener is attached

## Testing Checklist

- [ ] Login page shows Telegram button
- [ ] Register page shows Telegram button
- [ ] Profile page shows "Link Telegram" when not linked
- [ ] Clicking button opens popup
- [ ] Authorizing in Telegram works
- [ ] Profile updates with telegram_id
- [ ] Profile shows "Unlink" button after linking
- [ ] Unlink clears telegram fields
- [ ] DB index on telegram_id created
- [ ] No console errors or warnings

## Notes

- Currently supports "link-only" mode (must be logged in to link)
- Telegram-first signup requires creating Supabase user via admin client (future feature)
- Bot token is never exposed to client (server-only)
- All requests include HMAC verification per Telegram's security spec
