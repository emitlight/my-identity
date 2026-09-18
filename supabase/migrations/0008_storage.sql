-- ============================================================
-- 0008 · 스토리지 — 증거 사진, 레퍼런스 이미지, 컬렉션 사진
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', false, 20971520,
  array['image/jpeg','image/png','image/webp','image/avif','image/heic','image/gif']
)
on conflict (id) do nothing;

-- 경로 규약: media/{user_id}/{domain}/{filename}
-- 첫 번째 폴더가 소유자 uuid 이므로 그것만으로 접근을 가른다.
drop policy if exists "own media read" on storage.objects;
create policy "own media read"
  on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own media insert" on storage.objects;
create policy "own media insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own media update" on storage.objects;
create policy "own media update"
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own media delete" on storage.objects;
create policy "own media delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
