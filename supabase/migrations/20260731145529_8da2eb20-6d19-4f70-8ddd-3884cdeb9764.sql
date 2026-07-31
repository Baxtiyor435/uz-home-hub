-- ============ ENUMS ============
create type public.app_role as enum ('user','agent','admin','super_admin');
create type public.deal_type as enum ('sale','rent');
create type public.listing_status as enum ('pending','approved','rejected','archived');
create type public.application_status as enum ('pending','approved','rejected');
create type public.property_kind as enum ('apartment','house','commercial','land');
create type public.payment_purpose as enum ('unlock','premium');
create type public.payment_status as enum ('pending','paid','failed','canceled');
create type public.booking_status as enum ('pending','confirmed','canceled','completed');

-- ============ UTIL ============
create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text unique,
  full_name text,
  avatar_url text,
  agency_name text,
  bio text,
  rating numeric(3,2) not null default 0,
  reviews_count integer not null default 0,
  deals_count integer not null default 0,
  is_verified_agent boolean not null default false,
  is_blocked boolean not null default false,
  premium_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant select on public.profiles to anon;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_public_read" on public.profiles for select using (true);
create policy "profiles_self_update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_self_insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();

-- ============ ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','super_admin'))
$$;

create or replace function public.is_agent(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('agent','admin','super_admin'))
$$;

create policy "user_roles_self_read" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.is_staff(auth.uid()));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone, full_name)
  values (new.id, new.phone, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'user')
  on conflict (user_id, role) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ AGENT APPLICATIONS ============
create table public.agent_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  agency_name text not null,
  phone text not null,
  experience_years integer not null default 0,
  message text,
  status public.application_status not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert on public.agent_applications to authenticated;
grant all on public.agent_applications to service_role;
alter table public.agent_applications enable row level security;
create policy "apps_self_read" on public.agent_applications for select to authenticated using (auth.uid() = user_id or public.is_staff(auth.uid()));
create policy "apps_self_insert" on public.agent_applications for insert to authenticated with check (auth.uid() = user_id);
create policy "apps_staff_update" on public.agent_applications for update to authenticated using (public.is_staff(auth.uid()));
create trigger agent_applications_updated_at before update on public.agent_applications for each row execute function public.update_updated_at_column();

-- ============ PROPERTIES ============
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null default '',
  deal_type public.deal_type not null,
  kind public.property_kind not null default 'apartment',
  price numeric(14,2) not null,
  currency text not null default 'UZS',
  region text not null,
  district text not null,
  address text not null,
  latitude double precision,
  longitude double precision,
  rooms integer not null default 1,
  area numeric(10,2) not null,
  floor integer,
  total_floors integer,
  images text[] not null default '{}',
  features text[] not null default '{}',
  status public.listing_status not null default 'pending',
  reject_reason text,
  views_count integer not null default 0,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index properties_deal_status_idx on public.properties (deal_type, status, created_at desc);
create index properties_owner_idx on public.properties (owner_id);
grant select, insert, update, delete on public.properties to authenticated;
grant select on public.properties to anon;
grant all on public.properties to service_role;
alter table public.properties enable row level security;
create policy "properties_public_read_approved" on public.properties for select using (status = 'approved');
create policy "properties_owner_read" on public.properties for select to authenticated using (auth.uid() = owner_id or public.is_staff(auth.uid()));
create policy "properties_owner_insert" on public.properties for insert to authenticated
  with check (auth.uid() = owner_id and (deal_type = 'rent' or public.is_agent(auth.uid())));
create policy "properties_owner_update" on public.properties for update to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "properties_staff_update" on public.properties for update to authenticated using (public.is_staff(auth.uid()));
create policy "properties_owner_delete" on public.properties for delete to authenticated using (auth.uid() = owner_id or public.is_staff(auth.uid()));
create trigger properties_updated_at before update on public.properties for each row execute function public.update_updated_at_column();

-- ============ FAVORITES ============
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, property_id)
);
grant select, insert, delete on public.favorites to authenticated;
grant all on public.favorites to service_role;
alter table public.favorites enable row level security;
create policy "favorites_own" on public.favorites for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============ REVIEWS ============
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (agent_id, author_id)
);
grant select, insert, update, delete on public.reviews to authenticated;
grant select on public.reviews to anon;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create policy "reviews_public_read" on public.reviews for select using (true);
create policy "reviews_author_write" on public.reviews for all to authenticated using (auth.uid() = author_id) with check (auth.uid() = author_id);

create or replace function public.recalc_agent_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare _agent uuid;
begin
  _agent := coalesce(new.agent_id, old.agent_id);
  update public.profiles p set
    rating = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r where r.agent_id = _agent), 0),
    reviews_count = (select count(*) from public.reviews r where r.agent_id = _agent)
  where p.id = _agent;
  return null;
end; $$;
create trigger reviews_recalc after insert or update or delete on public.reviews
for each row execute function public.recalc_agent_rating();

-- ============ BOOKINGS ============
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id uuid not null references auth.users(id) on delete cascade,
  scheduled_at timestamptz not null,
  note text,
  status public.booking_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.bookings to authenticated;
grant all on public.bookings to service_role;
alter table public.bookings enable row level security;
create policy "bookings_participants_read" on public.bookings for select to authenticated
  using (auth.uid() = user_id or auth.uid() = agent_id or public.is_staff(auth.uid()));
create policy "bookings_user_insert" on public.bookings for insert to authenticated with check (auth.uid() = user_id);
create policy "bookings_participants_update" on public.bookings for update to authenticated
  using (auth.uid() = user_id or auth.uid() = agent_id);
create trigger bookings_updated_at before update on public.bookings for each row execute function public.update_updated_at_column();

-- ============ CHAT ============
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id uuid not null references auth.users(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (property_id, user_id, agent_id)
);
grant select, insert, update on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
create policy "conversations_participants" on public.conversations for select to authenticated
  using (auth.uid() = user_id or auth.uid() = agent_id or public.is_staff(auth.uid()));
create policy "conversations_user_insert" on public.conversations for insert to authenticated
  with check (auth.uid() = user_id or auth.uid() = agent_id);
create policy "conversations_participants_update" on public.conversations for update to authenticated
  using (auth.uid() = user_id or auth.uid() = agent_id);

create or replace function public.is_conversation_member(_conversation_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversations c where c.id = _conversation_id and (c.user_id = _user_id or c.agent_id = _user_id))
$$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
grant select, insert, update on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create policy "messages_members_read" on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));
create policy "messages_members_insert" on public.messages for insert to authenticated
  with check (auth.uid() = sender_id and public.is_conversation_member(conversation_id, auth.uid()));
create policy "messages_members_update" on public.messages for update to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()));

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

-- ============ PAYMENTS / UNLOCKS ============
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose public.payment_purpose not null,
  property_id uuid references public.properties(id) on delete set null,
  amount numeric(14,2) not null,
  currency text not null default 'UZS',
  provider text not null default 'click',
  provider_transaction_id text,
  status public.payment_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "payments_self_read" on public.payments for select to authenticated
  using (auth.uid() = user_id or public.is_staff(auth.uid()));
create trigger payments_updated_at before update on public.payments for each row execute function public.update_updated_at_column();

create table public.property_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, property_id)
);
grant select on public.property_unlocks to authenticated;
grant all on public.property_unlocks to service_role;
alter table public.property_unlocks enable row level security;
create policy "unlocks_self_read" on public.property_unlocks for select to authenticated
  using (auth.uid() = user_id or public.is_staff(auth.uid()));

-- ============ NOTIFICATIONS ============
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "notifications_self_read" on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "notifications_self_update" on public.notifications for update to authenticated using (auth.uid() = user_id);
alter publication supabase_realtime add table public.notifications;

-- ============ SETTINGS / AUDIT ============
create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
grant select on public.platform_settings to authenticated, anon;
grant all on public.platform_settings to service_role;
alter table public.platform_settings enable row level security;
create policy "settings_public_read" on public.platform_settings for select using (true);

insert into public.platform_settings (key, value) values
  ('unlock_price', '{"amount": 11990, "currency": "UZS"}'::jsonb),
  ('premium_price', '{"amount": 11999, "currency": "UZS", "period_days": 30}'::jsonb);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create policy "audit_staff_read" on public.audit_logs for select to authenticated using (public.is_staff(auth.uid()));

-- ============ OTP ============
create table public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index otp_codes_phone_idx on public.otp_codes (phone, created_at desc);
grant all on public.otp_codes to service_role;
alter table public.otp_codes enable row level security;