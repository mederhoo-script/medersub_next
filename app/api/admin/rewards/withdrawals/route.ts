import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const withdrawalId = Number(body?.withdrawalId)
    const status = String(body?.status || '').toLowerCase()
    const note = body?.note ? String(body.note) : null

    if (!Number.isFinite(withdrawalId)) {
      return NextResponse.json({ ok: false, error: 'Invalid withdrawalId' }, { status: 400 })
    }

    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ ok: false, error: 'status must be approved or rejected' }, { status: 400 })
    }

    const { error: reviewError } = await supabaseAdmin.rpc('review_reward_withdrawal', {
      p_withdrawal_id: withdrawalId,
      p_status: status,
      p_note: note,
    })

    if (reviewError) {
      const msg = reviewError.message.toLowerCase()
      if (msg.includes('not found')) {
        return NextResponse.json({ ok: false, error: 'Withdrawal not found' }, { status: 404 })
      }
      if (msg.includes('already reviewed') || msg.includes('approved or rejected')) {
        return NextResponse.json({ ok: false, error: reviewError.message }, { status: 400 })
      }
      throw new Error(reviewError.message)
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update withdrawal'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
