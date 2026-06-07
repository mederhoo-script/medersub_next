alter table public.reward_withdrawals
  add column if not exists earn_amount numeric,
  add column if not exists account_number text,
  add column if not exists account_name text,
  add column if not exists bank_name text;

create or replace function public.request_reward_withdrawal(
  p_user_id uuid,
  p_earn_amount numeric,
  p_payout_amount_ngn numeric,
  p_reward_uid text,
  p_account_number text,
  p_account_name text,
  p_bank_name text
)
returns table (new_balance_ngn numeric, withdrawal_id bigint, payout_amount_ngn numeric)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance numeric;
  v_withdrawal_id bigint;
begin
  if p_earn_amount is null or p_earn_amount <= 0 then
    raise exception 'Withdrawal amount must be a positive number';
  end if;

  if p_payout_amount_ngn is null or p_payout_amount_ngn <= 0 then
    raise exception 'Payout amount must be a positive number';
  end if;

  if coalesce(trim(p_account_number), '') = '' or coalesce(trim(p_account_name), '') = '' or coalesce(trim(p_bank_name), '') = '' then
    raise exception 'Account details are required';
  end if;

  if trim(p_account_number) !~ '^[0-9]{6,20}$' then
    raise exception 'Account number must be 6-20 digits';
  end if;

  select reward_balance_ngn
    into v_balance
  from public.profiles
  where id = p_user_id
  for update;

  if v_balance is null then
    raise exception 'Reward profile not found';
  end if;

  if v_balance < p_earn_amount then
    raise exception 'Insufficient reward balance';
  end if;

  update public.profiles
  set reward_balance_ngn = v_balance - p_earn_amount
  where id = p_user_id;

  insert into public.reward_withdrawals (user_id, amount_ngn, earn_amount, account_number, account_name, bank_name, status)
  values (p_user_id, p_payout_amount_ngn, p_earn_amount, trim(p_account_number), trim(p_account_name), trim(p_bank_name), 'pending')
  returning id into v_withdrawal_id;

  insert into public.reward_transactions (user_id, type, amount_ngn, meta)
  values (
    p_user_id,
    'withdraw_request',
    -p_earn_amount,
    jsonb_build_object(
      'reward_uid', p_reward_uid,
      'withdrawal_id', v_withdrawal_id,
      'earn_amount', p_earn_amount,
      'payout_amount_ngn', p_payout_amount_ngn,
      'bank_name', trim(p_bank_name),
      'account_name', trim(p_account_name)
    )
  );

  return query select v_balance - p_earn_amount, v_withdrawal_id, p_payout_amount_ngn;
end;
$$;
