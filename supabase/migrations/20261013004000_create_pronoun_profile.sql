create table public.pronoun_profiles (
  id text primary key check (id = 'primary'),
  display_name text not null check (char_length(display_name) between 1 and 80),
  subject_pronoun text not null check (char_length(subject_pronoun) between 1 and 30),
  object_pronoun text not null check (char_length(object_pronoun) between 1 and 30),
  possessive_determiner text not null check (char_length(possessive_determiner) between 1 and 30),
  possessive_pronoun text not null check (char_length(possessive_pronoun) between 1 and 30),
  reflexive_pronoun text not null check (char_length(reflexive_pronoun) between 1 and 30),
  honorifics text not null check (char_length(honorifics) between 1 and 200),
  gendered_terms text not null check (char_length(gendered_terms) between 1 and 500),
  compliments text not null check (char_length(compliments) between 1 and 500),
  relationship_terms text not null check (char_length(relationship_terms) between 1 and 500),
  updated_at timestamptz not null default now()
);

insert into public.pronoun_profiles (
  id,
  display_name,
  subject_pronoun,
  object_pronoun,
  possessive_determiner,
  possessive_pronoun,
  reflexive_pronoun,
  honorifics,
  gendered_terms,
  compliments,
  relationship_terms
) values (
  'primary',
  'Caleb K Masters',
  'they',
  'them',
  'their',
  'theirs',
  'themself',
  'Ask me',
  'Ask me',
  'Ask me',
  'Ask me'
);

alter table public.pronoun_profiles enable row level security;

create policy "Public can read pronoun profile"
on public.pronoun_profiles
for select
to anon, authenticated
using (true);

create policy "Authenticated users can update pronoun profile"
on public.pronoun_profiles
for update
to authenticated
using (id = 'primary')
with check (id = 'primary');

revoke all on table public.pronoun_profiles from anon, authenticated;
grant select on table public.pronoun_profiles to anon, authenticated;
grant update on table public.pronoun_profiles to authenticated;
