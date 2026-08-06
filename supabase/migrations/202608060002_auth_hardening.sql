create unique index allowed_users_normalized_email_idx
  on public.allowed_users (organization_id, lower(email))
  where email is not null;

create index oauth_states_expiry_idx on public.oauth_states(expires_at);
create index plugin_auth_codes_expiry_idx on public.plugin_auth_codes(expires_at);

-- Atomically consume a one-time plugin code. Only the server secret role can call
-- this function because no execute grant is given to anon/authenticated roles.
create function public.consume_plugin_auth_code(p_code_hash text, p_now timestamptz)
returns table (allowed_user_id uuid)
language sql
security definer
set search_path = public
as $$
  update public.plugin_auth_codes
  set consumed_at = p_now
  where code_hash = p_code_hash
    and consumed_at is null
    and expires_at > p_now
  returning plugin_auth_codes.allowed_user_id;
$$;

revoke all on function public.consume_plugin_auth_code(text, timestamptz) from public, anon, authenticated;
grant execute on function public.consume_plugin_auth_code(text, timestamptz) to service_role;
