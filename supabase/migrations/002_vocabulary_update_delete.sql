-- Allow authenticated users to edit/delete shared vocabulary (matches insert policy scope)
create policy "Authenticated users can update vocabulary"
  on public.vocabulary for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete vocabulary"
  on public.vocabulary for delete
  to authenticated
  using (true);
