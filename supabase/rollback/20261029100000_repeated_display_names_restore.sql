-- Operator only, after explicit approval. Do not rename/delete anyone's data.
-- Restoring uniqueness may require a product decision once duplicate names
-- exist. Refuse that case rather than silently changing users' names.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
do $$
begin
  if exists (
    select 1 from public.profiles where username is not null
    group by lower(username) having count(*) > 1
  ) then
    raise exception 'duplicate_display_names_require_review_before_rollback';
  end if;
end;
$$;
create unique index profiles_username_unique on public.profiles
  using btree (lower(username)) where username is not null;
commit;
