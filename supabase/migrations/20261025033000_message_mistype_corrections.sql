alter table public.site_message_catalog
  add column corrected_text text,
  add constraint site_message_catalog_correction_check check (
    corrected_text is null or (
      category = 'messages'
      and char_length(btrim(corrected_text)) between 1 and 2000
      and corrected_text <> text
    )
  );
