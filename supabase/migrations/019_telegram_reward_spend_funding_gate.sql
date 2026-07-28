create or replace function public.spend_reward_on_vtu(
  p_user_id uuid,
  p_amount numeric,
  p_meta jsonb default '{}'::jsonb
)
returns numeric
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance numeric;
  v_new_balance numeric;
  v_is_telegram_user boolean;
  v_total_wallet_funding numeric;
  v_total_reward_spent numeric;
  v_unlocked_reward_spend numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid spend amount';
  end if;

  select reward_balance_ngn, telegram_id is not null
    into v_balance, v_is_telegram_user
  from public.profiles
  where id = p_user_id
  for update;

  if v_balance is null then
    raise exception 'Reward profile not found';
  end if;

  if v_balance < p_amount then
    raise exception 'Insufficient reward balance';
  end if;

  if v_is_telegram_user then
    select coalesce(sum(charged_amount), 0)
      into v_total_wallet_funding
    from public.transactions
    where user_id = p_user_id
      and type = 'deposit'
      and status = 'success';

    select coalesce(sum(-amount_ngn), 0)
      into v_total_reward_spent
    from public.reward_transactions
    where user_id = p_user_id
      and type = 'spend_on_vtu'
      and amount_ngn < 0;

    v_unlocked_reward_spend := floor(v_total_wallet_funding / 500) * 300;

    if (v_total_reward_spent + p_amount) > v_unlocked_reward_spend then
      raise exception 'Reward spend limit reached. Fund main wallet with at least ₦500 to unlock each additional ₦300 reward spend.';
    end if;
  end if;

  v_new_balance := v_balance - p_amount;

  update public.profiles
  set reward_balance_ngn = v_new_balance
  where id = p_user_id;

  insert into public.reward_transactions (user_id, type, amount_ngn, meta)
  values (
    p_user_id,
    'spend_on_vtu',
    -p_amount,
    coalesce(p_meta, '{}'::jsonb)
  );

  return v_new_balance;
end;
$$;
