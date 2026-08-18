-- Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  role text default 'USER',
  balance numeric default 0,
  bvn text,
  nin text,
  telegram_id text,
  telegram_username text,
  telegram_linked_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table profiles enable row level security;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

alter table profiles
  add constraint profiles_telegram_id_unique unique (telegram_id);

create table wallets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  balance numeric default 0 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index wallets_user_id_key on wallets (user_id);

alter table wallets enable row level security;

create policy "Users can view own wallet." on wallets
  for select using (auth.uid() = user_id);

-- Create a table for transactions
create table transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null, -- 'DEPOSIT', 'PURCHASE', 'REFUND'
  amount numeric not null,
  charged_amount numeric,
  service_type text,
  status text default 'PENDING',
  reference text,
  provider text,
  provider_ref text,
  meta jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table transactions enable row level security;

create policy "Users can view own transactions." on transactions
  for select using (auth.uid() = user_id);

-- Function to handle new user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  begin
    insert into public.profiles (
      id,
      email,
      full_name,
      role,
      telegram_id,
      telegram_username,
      telegram_linked_at
    )
    values (
      new.id,
      new.email,
      new.raw_user_meta_data->>'full_name',
      'USER',
      nullif(new.raw_user_meta_data->>'telegram_id', ''),
      nullif(new.raw_user_meta_data->>'telegram_username', ''),
      case
        when nullif(new.raw_user_meta_data->>'telegram_id', '') is not null
          then coalesce(new.created_at, timezone('utc'::text, now()))
        else null
      end
    )
    on conflict (id) do nothing;
  exception
    when others then
      raise warning 'handle_new_user: could not insert profile for id=%, email=% - %: %',
        new.id, new.email, SQLSTATE, SQLERRM;
  end;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.handle_new_profile()
returns trigger as $$
begin
  begin
    insert into public.wallets (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
  exception
    when others then
      raise warning 'handle_new_profile: could not insert wallet for id=% - %: %',
        new.id, SQLSTATE, SQLERRM;
  end;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile();

create table if not exists virtual_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  provider text not null,
  account_reference text not null unique,
  account_number text not null,
  account_name text not null,
  bank_name text not null,
  bank_code text,
  currency text not null default 'NGN',
  status text not null default 'active',
  raw_response jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, provider)
);

create unique index if not exists virtual_accounts_user_provider_unique on virtual_accounts (user_id, provider);
create index if not exists virtual_accounts_account_reference_idx on virtual_accounts (account_reference);

create or replace function public.get_auth_user_id_by_email(p_email text)
returns uuid
language plpgsql
security definer
set search_path = auth, pg_temp
as $$
begin
  if p_email is null or p_email = '' then
    return null;
  end if;

  return (select id from auth.users where email = p_email limit 1);
end;
$$;
