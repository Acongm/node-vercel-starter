grant select, insert, update, delete on table public.chat_client_labels to anon;

drop policy if exists "server secret can manage chat client labels" on public.chat_client_labels;
create policy "server secret can manage chat client labels"
on public.chat_client_labels
for all
to anon
using (private.request_has_comments_secret())
with check (private.request_has_comments_secret());
