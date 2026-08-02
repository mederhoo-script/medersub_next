import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

async function user() {
  const store = await cookies();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => store.getAll(), setAll: () => undefined } });
  const { data: { user }, error } = await client.auth.getUser();
  return error ? null : user;
}

const expires = () => new Date(Date.now() + 5 * 60_000).toISOString();

export async function POST(request: Request) {
  try {
    const currentUser = await user();
    if (!currentUser) return jsonError('Unauthorized', 401);
    const { action, response } = await request.json();
    const origin = new URL(request.url).origin;
    const rpID = new URL(origin).hostname;
    const { data: credentials } = await supabaseAdmin.from('transaction_biometric_credentials').select('*').eq('user_id', currentUser.id);

    if (action === 'enroll-options') {
      const options = await generateRegistrationOptions({ rpName: 'MEDERSUB', rpID, userName: currentUser.email || currentUser.id, userID: new TextEncoder().encode(currentUser.id), attestationType: 'none', authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' }, excludeCredentials: (credentials || []).map((c) => ({ id: c.credential_id, transports: c.transports || [] })) });
      await supabaseAdmin.from('transaction_biometric_challenges').upsert({ user_id: currentUser.id, challenge: options.challenge, purpose: 'enroll', expires_at: expires() });
      return NextResponse.json(options);
    }
    if (action === 'purchase-options') {
      if (!credentials?.length) return jsonError('Set up fingerprint or Face ID in Account Settings first.', 400);
      const options = await generateAuthenticationOptions({ rpID, userVerification: 'required', allowCredentials: credentials.map((c) => ({ id: c.credential_id, transports: c.transports || [] })) });
      await supabaseAdmin.from('transaction_biometric_challenges').upsert({ user_id: currentUser.id, challenge: options.challenge, purpose: 'purchase', expires_at: expires() });
      return NextResponse.json(options);
    }
    const { data: challenge } = await supabaseAdmin.from('transaction_biometric_challenges').select('*').eq('user_id', currentUser.id).single();
    if (!challenge || new Date(challenge.expires_at) < new Date()) return jsonError('Biometric request expired. Try again.', 400);

    if (action === 'enroll-verify' && challenge.purpose === 'enroll') {
      const verified = await verifyRegistrationResponse({ response, expectedChallenge: challenge.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
      if (!verified.verified || !verified.registrationInfo) return jsonError('Biometric registration could not be verified.', 400);
      const c = verified.registrationInfo.credential;
      await supabaseAdmin.from('transaction_biometric_credentials').insert({ user_id: currentUser.id, credential_id: c.id, public_key: Buffer.from(c.publicKey).toString('base64'), counter: c.counter, transports: response.response.transports || [] });
      await supabaseAdmin.from('transaction_biometric_challenges').delete().eq('user_id', currentUser.id);
      return NextResponse.json({ success: true });
    }
    if (action === 'purchase-verify' && challenge.purpose === 'purchase') {
      const credential = credentials?.find((c) => c.credential_id === response.id);
      if (!credential) return jsonError('Unknown biometric credential.', 400);
      const verified = await verifyAuthenticationResponse({ response, expectedChallenge: challenge.challenge, expectedOrigin: origin, expectedRPID: rpID, credential: { id: credential.credential_id, publicKey: new Uint8Array(Buffer.from(credential.public_key, 'base64')), counter: Number(credential.counter), transports: credential.transports || [] }, requireUserVerification: true });
      if (!verified.verified) return jsonError('Biometric approval could not be verified.', 400);
      await supabaseAdmin.from('transaction_biometric_credentials').update({ counter: verified.authenticationInfo.newCounter }).eq('id', credential.id);
      const { data: approval, error } = await supabaseAdmin.from('transaction_biometric_approvals').insert({ user_id: currentUser.id, expires_at: expires() }).select('token').single();
      if (error || !approval) throw error || new Error('Could not create approval.');
      await supabaseAdmin.from('transaction_biometric_challenges').delete().eq('user_id', currentUser.id);
      return NextResponse.json({ token: approval.token });
    }
    return jsonError('Invalid biometric request.', 400);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'Biometric request failed.', 500);
  }
}
