-- Create a table for public profiles
create table profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  role text default 'USER',
  balance numeric default 0,
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

-- Create a table for transactions
create table transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null, -- 'DEPOSIT', 'PURCHASE', 'REFUND'
  amount numeric not null,
  service_type text,
  status text default 'PENDING',
  reference text,
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
  insert into public.profiles (id, email, full_name, role, balance)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'USER', 0);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
