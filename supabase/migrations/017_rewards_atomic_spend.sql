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
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid spend amount';
  end if;

  select reward_balance_ngn
    into v_balance
  from public.profiles
  where id = p_user_id
  for update;

  if v_balance is null then
    raise exception 'Reward profile not found';
  end if;

  if v_balance < p_amount then
    raise exception 'Insufficient reward balance';
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
