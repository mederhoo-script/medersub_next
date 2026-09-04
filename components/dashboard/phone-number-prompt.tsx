'use client';

import { FormEvent, useEffect, useState } from 'react';
import { MessageCircle, Phone, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function PhoneNumberPrompt() {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const checkPhoneNumber = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', user.id)
        .single();

      if (active && !profileError && !data?.phone) setOpen(true);
    };

    void checkPhoneNumber();
    return () => { active = false; };
  }, []);

  const savePhoneNumber = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedPhone = phone.trim();
    if (normalizedPhone.length < 7) {
      setError('Enter a valid phone or WhatsApp number.');
      return;
    }

    setSaving(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Your session has expired. Please sign in again.');
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ phone: normalizedPhone })
      .eq('id', user.id);

    if (updateError) {
      setError(updateError.message);
    } else {
      setOpen(false);
    }
    setSaving(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="phone-prompt-title">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 px-6 pb-8 pt-7 text-white">
          <button type="button" onClick={() => setOpen(false)} className="absolute right-4 top-4 rounded-full p-2 text-white/80 hover:bg-white/15 hover:text-white" aria-label="Cancel">
            <X className="h-5 w-5" />
          </button>
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <MessageCircle className="h-7 w-7" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-100">Keep your account connected</p>
          <h2 id="phone-prompt-title" className="mt-2 text-2xl font-bold">Please add your phone/WhatsApp number</h2>
          <p className="mt-2 max-w-xs text-sm leading-6 text-blue-50">Use a number where we can reach you about your account and transactions.</p>
        </div>

        <form onSubmit={savePhoneNumber} className="space-y-5 p-6">
          <label className="block text-sm font-semibold text-slate-700" htmlFor="profile-phone">Phone or WhatsApp number</label>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100">
            <Phone className="h-5 w-5 text-blue-600" />
            <input id="profile-phone" type="tel" inputMode="tel" autoFocus required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="080 1234 5678" className="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400" />
          </div>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-60">{saving ? 'Saving...' : 'Add number'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
