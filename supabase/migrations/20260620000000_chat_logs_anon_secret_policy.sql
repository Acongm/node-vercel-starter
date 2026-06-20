grant select, insert, update, delete on table public.chat_logs to anon;

drop policy if exists "server secret can manage chat logs" on public.chat_logs;
create policy "server secret can manage chat logs"
on public.chat_logs
for all
to anon
using (private.request_has_comments_secret())
with check (private.request_has_comments_secret());
