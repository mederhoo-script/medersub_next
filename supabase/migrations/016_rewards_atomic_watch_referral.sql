create or replace function public.apply_reward_referral(
  p_user_id uuid,
  p_referred_by text,
  p_source_uid text,
  p_referral_bonus numeric
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_referred_by text;
  v_user_reward_uid text;
  v_referrer_id uuid;
begin
  if p_referred_by is null or p_referred_by = '' then
    return false;
  end if;

  select reward_referred_by, reward_uid
    into v_existing_referred_by, v_user_reward_uid
  from public.profiles
  where id = p_user_id
  for update;

  if v_user_reward_uid is null then
    return false;
  end if;

  if v_existing_referred_by is not null then
    return false;
  end if;

  if p_referred_by = v_user_reward_uid then
    return false;
  end if;

  select id
    into v_referrer_id
  from public.profiles
  where reward_uid = p_referred_by
  for update;

  if v_referrer_id is null then
    return false;
  end if;

  update public.profiles
  set reward_referred_by = p_referred_by
  where id = p_user_id;

  update public.profiles
  set
    reward_balance_ngn = reward_balance_ngn + p_referral_bonus,
    reward_referrals_count = reward_referrals_count + 1,
    reward_referral_earnings_ngn = reward_referral_earnings_ngn + p_referral_bonus
  where id = v_referrer_id;

  insert into public.reward_transactions (user_id, type, amount_ngn, meta)
  values (
    v_referrer_id,
    'referral_reward',
    p_referral_bonus,
    jsonb_build_object(
      'source_uid', p_source_uid,
      'reward_uid', p_referred_by
    )
  );

  return true;
end;
$$;

create or replace function public.claim_reward_watch(
  p_user_id uuid,
  p_reward_uid text
)
returns table (
  earned_ngn numeric,
  new_balance_ngn numeric,
  ads_watched integer,
  bonus_ngn numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ads_watched integer;
  v_balance numeric;
  v_base_reward_amount numeric := 10;
  v_bonus_every_n_ads integer := 5;
  v_bonus_amount numeric := 5;
  v_bonus_reward numeric := 0;
  v_total_reward numeric := 0;
begin
  select reward_ads_watched, reward_balance_ngn
    into v_ads_watched, v_balance
  from public.profiles
  where id = p_user_id
  for update;

  if v_ads_watched is null then
    raise exception 'Reward profile not found';
  end if;

  v_ads_watched := v_ads_watched + 1;
  if mod(v_ads_watched, v_bonus_every_n_ads) = 0 then
    v_bonus_reward := v_bonus_amount;
  end if;

  v_total_reward := v_base_reward_amount + v_bonus_reward;
  v_balance := v_balance + v_total_reward;

  update public.profiles
  set
    reward_ads_watched = v_ads_watched,
    reward_balance_ngn = v_balance
  where id = p_user_id;

  insert into public.reward_transactions (user_id, type, amount_ngn, meta)
  values (
    p_user_id,
    'ad_reward',
    v_base_reward_amount,
    jsonb_build_object('reward_uid', p_reward_uid)
  );

  if v_bonus_reward > 0 then
    insert into public.reward_transactions (user_id, type, amount_ngn, meta)
    values (
      p_user_id,
      'ad_bonus',
      v_bonus_reward,
      jsonb_build_object(
        'reward_uid', p_reward_uid,
        'rule', 'every_5_ads'
      )
    );
  end if;

  return query select v_total_reward, v_balance, v_ads_watched, v_bonus_reward;
end;
$$;
