alter table public.site_message_catalog
  add column author text,
  add constraint site_message_catalog_author_check check (
    author is null or (
      category = 'messages'
      and char_length(btrim(author)) between 1 and 200
    )
  );
