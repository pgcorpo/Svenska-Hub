-- Allow authenticated users to edit/delete shared vocabulary (matches insert policy scope)
drop policy if exists "Authenticated users can update vocabulary" on public.vocabulary;
create policy "Authenticated users can update vocabulary"
  on public.vocabulary for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete vocabulary" on public.vocabulary;
create policy "Authenticated users can delete vocabulary"
  on public.vocabulary for delete
  to authenticated
  using (true);
