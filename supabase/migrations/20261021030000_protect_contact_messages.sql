-- Contact messages now go through the contact-message Edge Function, which checks
-- Turnstile, the honeypot, link counts, and rate limits before inserting with the service role.
create table public.contact_rate_limits (
  id bigint generated always as identity primary key,
  visitor_hash text not null check (char_length(visitor_hash) = 64),
  created_at timestamptz not null default now()
);

create index contact_rate_limits_visitor_created_idx
on public.contact_rate_limits (visitor_hash, created_at);

create index contact_rate_limits_created_idx
on public.contact_rate_limits (created_at);

alter table public.contact_rate_limits enable row level security;
revoke all on table public.contact_rate_limits from anon, authenticated;

-- Bots can no longer write to the inbox directly with the public key.
revoke insert on table public.messages from anon;

alter table public.messages
  add constraint messages_name_length check (char_length(name) between 1 and 100) not valid,
  add constraint messages_message_length check (char_length(message) between 1 and 2000) not valid,
  add constraint messages_email_length check (email is null or char_length(email) <= 320) not valid;
