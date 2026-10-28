alter table public.site_message_catalog
  drop constraint site_message_catalog_category_check;
alter table public.site_message_catalog
  add constraint site_message_catalog_category_check check (category in (
    'messages', 'activities', 'shutdownMessages', 'bootMessages', 'initialBootSteps',
    'playingDeadMessages', 'glitchMessages', 'notificationMessages',
    'monitor.cpu', 'monitor.gpu', 'monitor.network', 'monitor.ram', 'monitor.storage', 'monitor.thermal'
  ));

-- Each entry keeps its title and body together; the first newline separates them.
with messages as (
  select ordinality, text
  from jsonb_array_elements_text($notifications$[
    "Notification dismissed\nBITS OS noticed. No action is required. Yet.",
    "Reminder about your dismissed reminder\nThis notification is much more important because it is newer.",
    "Final notification (2 of 7)\nPlease stop proving that the dismiss button works.",
    "Dismissal appeal received\nYour request has been forwarded to the notification you just dismissed.",
    "Task failed successfully\nThe notification was closed. A replacement has been dispatched.",
    "We have been trying to reach you\nAbout your desktop's extended notification warranty.",
    "Achievement unlocked: click again\nYour reward is another notification.",
    "This could have been an email\nUnfortunately, the email also became a notification.",
    "Notification recycling enabled\nThank you for keeping this popup out of the landfill.",
    "You are now on mute\nNot me. You. I am still talking.",
    "One more thing\nThere will be one more thing after this one more thing.",
    "Your feedback matters\nWe interpreted that click as a request for more popups.",
    "Background process promoted\nThis notification has decided to become a foreground problem.",
    "Snooze button on vacation\nPlease enjoy this complimentary awake button.",
    "Dismissal speedrun detected\nThe world record is still held by someone with notifications disabled."
  ]$notifications$::jsonb) with ordinality as entry(text, ordinality)
)
insert into public.site_message_catalog (position, profile, category, text, enabled)
select (select coalesce(max(position), 0) from public.site_message_catalog) + ordinality,
  'standard', 'notificationMessages', text, true
from messages;
