insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-images',
  'blog-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can read blog images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'blog-images');

create policy "Authenticated users can upload blog images"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'blog-images');

create policy "Authenticated users can update blog images"
on storage.objects
for update
to authenticated
using (bucket_id = 'blog-images')
with check (bucket_id = 'blog-images');

create policy "Authenticated users can delete blog images"
on storage.objects
for delete
to authenticated
using (bucket_id = 'blog-images');
