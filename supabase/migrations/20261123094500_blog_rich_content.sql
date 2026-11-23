alter table public.site_blog_posts
  add column body_rich jsonb;

alter table public.site_blog_posts
  drop constraint site_blog_posts_body_markdown_check,
  add constraint site_blog_posts_body_markdown_check
    check (char_length(body_markdown) <= 200000
      and (char_length(body_markdown) >= 1 or body_rich is not null)),
  add constraint site_blog_posts_body_rich_check
    check (body_rich is null or coalesce((
      jsonb_typeof(body_rich) = 'object'
      and body_rich->'version' = '1'::jsonb
      and jsonb_typeof(body_rich->'doc') = 'object'
      and body_rich->'doc'->>'type' = 'doc'
      and jsonb_typeof(body_rich->'doc'->'content') = 'array'
      and octet_length(body_rich::text) <= 1000000
    ), false));

comment on column public.site_blog_posts.body_rich is
  'Versioned visual article document. Null retains the original Markdown reader. Original body_markdown is not converted or overwritten by migration.';
