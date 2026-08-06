alter table public.allowed_users
  add column password_hash text,
  add column must_change_password boolean not null default false,
  add column failed_login_count integer not null default 0 check (failed_login_count >= 0),
  add column locked_until timestamptz;

create unique index allowed_users_password_email_idx
  on public.allowed_users (lower(email))
  where password_hash is not null and email is not null;
