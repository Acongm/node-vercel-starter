\set ON_ERROR_STOP on

-- Model the verified live historical state: comments exists with the expected
-- columns/defaults/RLS-era shape, but the two baseline length CHECK constraints
-- are missing. Existing rows satisfy the intended rules.
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  author text not null default 'Anonymous',
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.comments (author, content) values
  ('Anonymous', 'valid existing historical row'),
  (repeat('A', 80), repeat('B', 2000));
