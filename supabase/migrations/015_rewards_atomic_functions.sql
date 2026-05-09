create or replace function public.request_reward_withdrawal(
  p_user_id uuid,
  p_amount numeric,
  p_reward_uid text
)
returns table (new_balance_ngn numeric, withdrawal_id bigint)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance numeric;
  v_withdrawal_id bigint;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Invalid withdrawal amount';
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

  update public.profiles
  set reward_balance_ngn = v_balance - p_amount
  where id = p_user_id;

  insert into public.reward_withdrawals (user_id, amount_ngn, status)
  values (p_user_id, p_amount, 'pending')
  returning id into v_withdrawal_id;

  insert into public.reward_transactions (user_id, type, amount_ngn, meta)
  values (
    p_user_id,
    'withdraw_request',
    -p_amount,
    jsonb_build_object(
      'reward_uid', p_reward_uid,
      'withdrawal_id', v_withdrawal_id
    )
  );

  return query select v_balance - p_amount, v_withdrawal_id;
end;
$$;

create or replace function public.review_reward_withdrawal(
  p_withdrawal_id bigint,
  p_status text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_amount numeric;
  v_current_status text;
  v_balance numeric;
begin
  if p_status not in ('approved', 'rejected') then
    raise exception 'status must be approved or rejected';
  end if;

  select user_id, amount_ngn, status
    into v_user_id, v_amount, v_current_status
  from public.reward_withdrawals
  where id = p_withdrawal_id
  for update;

  if v_user_id is null then
    raise exception 'Withdrawal not found';
  end if;

  if v_current_status <> 'pending' then
    raise exception 'Withdrawal already reviewed';
  end if;

  update public.reward_withdrawals
  set
    status = p_status,
    reviewed_at = timezone('utc'::text, now()),
    review_note = p_note
  where id = p_withdrawal_id;

  if p_status = 'rejected' then
    select reward_balance_ngn
      into v_balance
    from public.profiles
    where id = v_user_id
    for update;

    if v_balance is null then
      raise exception 'Reward profile not found';
    end if;

    update public.profiles
    set reward_balance_ngn = v_balance + v_amount
    where id = v_user_id;

    insert into public.reward_transactions (user_id, type, amount_ngn, meta)
    values (
      v_user_id,
      'withdraw_refund',
      v_amount,
      jsonb_build_object(
        'withdrawal_id', p_withdrawal_id,
        'reason', coalesce(p_note, 'Admin rejected withdrawal')
      )
    );
  end if;
end;
$$;
