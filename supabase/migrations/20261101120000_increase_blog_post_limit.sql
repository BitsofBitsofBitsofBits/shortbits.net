alter table public.site_blog_posts
  drop constraint site_blog_posts_body_markdown_check,
  add constraint site_blog_posts_body_markdown_check
    check (char_length(body_markdown) between 1 and 200000);
