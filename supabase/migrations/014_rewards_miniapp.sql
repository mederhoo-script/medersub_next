alter table public.profiles
  add column if not exists reward_uid text,
  add column if not exists reward_balance_ngn numeric not null default 0,
  add column if not exists reward_ads_watched integer not null default 0,
  add column if not exists reward_referred_by text,
  add column if not exists reward_referrals_count integer not null default 0,
  add column if not exists reward_referral_earnings_ngn numeric not null default 0;

create unique index if not exists profiles_reward_uid_unique
  on public.profiles (reward_uid)
  where reward_uid is not null;

create table if not exists public.reward_withdrawals (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount_ngn numeric not null check (amount_ngn > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamp with time zone not null default timezone('utc'::text, now()),
  reviewed_at timestamp with time zone,
  review_note text
);

create index if not exists reward_withdrawals_user_id_idx on public.reward_withdrawals(user_id);
create index if not exists reward_withdrawals_status_idx on public.reward_withdrawals(status);

create table if not exists public.reward_transactions (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (
    type in (
      'ad_reward',
      'ad_bonus',
      'referral_reward',
      'withdraw_request',
      'withdraw_refund',
      'admin_adjustment',
      'spend_on_vtu'
    )
  ),
  amount_ngn numeric not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists reward_transactions_user_id_idx on public.reward_transactions(user_id);
create index if not exists reward_transactions_created_at_idx on public.reward_transactions(created_at desc);

alter table public.reward_withdrawals enable row level security;
alter table public.reward_transactions enable row level security;

create policy "Users can view own reward withdrawals." on public.reward_withdrawals
  for select using (auth.uid() = user_id);

create policy "Users can view own reward transactions." on public.reward_transactions
  for select using (auth.uid() = user_id);
