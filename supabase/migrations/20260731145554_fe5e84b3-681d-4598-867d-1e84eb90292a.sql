revoke execute on function public.update_updated_at_column() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.recalc_agent_rating() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.is_staff(uuid) from public, anon;
revoke execute on function public.is_agent(uuid) from public, anon;
revoke execute on function public.is_conversation_member(uuid, uuid) from public, anon;