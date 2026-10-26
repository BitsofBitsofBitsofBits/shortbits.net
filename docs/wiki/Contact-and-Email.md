# Contact and email

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

Both contact forms use the same Edge Function. After a message is saved, it
sends an owner notification and, when the visitor supplies an email address,
a confirmation through Resend. The owner notification uses the visitor's
address as Reply-To; confirmations use the owner's inbox as Reply-To.
Confirmations contain no visitor-supplied name, links, or message content.
The existing honeypot, Turnstile, and rate limits apply before storage or email.

To enable sending:

1. Add `shortbits.net` in the Resend dashboard and publish its required DNS
   records. Wait for domain verification. `contact@shortbits.net` does not need
   a paid mailbox; replies go to the configured owner inbox instead. Do not
   enable inbound mail or replace root MX records just to send notifications.
2. Create a Resend API key with sending access for that domain.
3. Add these secrets in Supabase's Edge Function settings (never in browser
   configuration or committed files), or set all three as GitHub **Supabase**
   environment secrets for the deployment workflow to sync:
   - `RESEND_API_KEY`: your Resend sending key
   - `CONTACT_EMAIL_FROM`: `shortbits.net <contact@shortbits.net>`
   - `CONTACT_EMAIL_TO`: `CalebKMasters@outlook.com`
4. Deploy `contact-message` and the updated site. Test once with a visitor
   address and once without, then check the inboxes and Resend delivery logs.

Resend's free transactional plan currently allows 100 emails/day and
3,000/month. A submission with a visitor email uses two sends; one without
uses one. Existing submission limits do not guarantee staying below that
daily quota.

Email requests have an eight-second timeout and run independently after
storage succeeds. The response distinguishes provider acceptance, failures,
and missing configuration. If sending fails, the form confirms the message
was saved, warns that email is unavailable, and tells visitors not to resend.
Failures and accepted Resend message IDs are logged in the Edge Function.
Provider acceptance is not proof of inbox delivery; consult Resend for
bounces or delivery events. There is no automatic retry queue: saved messages
remain available in Admin for manual follow-up even during an email outage.
The legacy direct-insert fallback cannot send email and reports it unavailable.

Run the mocked contact/storage/email tests with
`node --test supabase/functions/contact-message/contact.test.mjs` on Node 22.13+
or later. The tests use Node's built-in TypeScript stripping; no real emails
are sent.
