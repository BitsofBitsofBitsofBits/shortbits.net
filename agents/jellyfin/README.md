# Private Jellyfin watching collector

Jellyfin remains inside your private network. This standalone Node 22 collector
reads its Sessions API locally and publishes only your configured account's
current watching status through authenticated outbound HTTPS to Supabase.
No inbound ports, public Jellyfin address, Docker socket or network tunnel is needed.

## Exactly what is shared

Only the **primary session UserId** matching your configured immutable Jellyfin
user ID is eligible. Usernames, remote-control permissions and `AdditionalUsers`
are not ownership checks. Other users' sessions are discarded before transmission,
even when multiple users are watching at once. If your account has multiple
eligible sessions, playing beats paused, then the latest playback check-in wins.
Audio-only activity is not included.

The allowlist is title, optional series/season/episode, position, duration and
playing/paused state. The owner ID accompanies the authenticated report so the
receiving service can check the same configured ID; it is never in the public
response. No raw sessions, other users, server addresses, credentials, device
names, item IDs, media paths, artwork or playback links are published.

Only reports with a playback check-in less than 90 seconds old are active.
Old/missing check-ins produce expired status rather than reviving a session
because somebody browsed the server. Paused clients that stop reporting will
therefore expire too. The collector checks every 15 seconds; public pages check
every 30 seconds and expire their snapshots locally after 90 seconds.
If Jellyfin cannot be checked, the collector sends an explicit unavailable
report with no media. If the collector cannot publish or stops, the previous
report expires. Expiry hides media; the single stored record is overwritten by
the next report, not automatically deleted, and no history is accumulated.

## Private configuration

1. Create a dedicated Jellyfin API key privately in its Dashboard. Jellyfin API
   keys can access server-wide data; keep this key on the collector only.
   The collector performs GET requests, never playback/control commands.
2. Obtain your immutable account ID privately from the authenticated Jellyfin
   user-management view/API. Do not use a username. The collector verifies
   `Users/<id>` and rejects a mismatched or disabled account before reading sessions.
3. Copy `config.example.json` to `config.json` in this directory. The real file is
   gitignored and excluded from the Docker build. Restrict its permissions to
   the account running the collector. Never upload it or paste it into chat.
4. Fill `jellyfinUrl` with the private LAN base URL, including any reverse-proxy
   prefix; `jellyfinApiKey` and `jellyfinUserId` with the private values.
   Prefer HTTPS with a valid certificate. HTTP is supported for a trusted
   private LAN only; it sends the API key unencrypted on that LAN. Do not expose
   it to the Internet and never disable TLS verification.
5. Use the public project URL and publishable/anon key from
   `shared/scripts/supabase-config.js`. Never use a service-role or secret key
   in the collector.
6. Generate a separate collector token without printing it. From the repository
   root in PowerShell, after creating the local config file:

   ```powershell
   node -e "const fs=require('node:fs'),crypto=require('node:crypto'),p=process.argv[1],c=JSON.parse(fs.readFileSync(p));c.deviceToken='sbjf_'+crypto.randomBytes(32).toString('hex');fs.writeFileSync(p,JSON.stringify(c,null,2));" .\agents\jellyfin\config.json
   ```

   Privately set the same `deviceToken` as Supabase secret `JELLYFIN_INGEST_TOKEN`
   and the same account ID as `JELLYFIN_USER_ID` in the Supabase Dashboard.
   Optional matching GitHub **Supabase environment** secrets are synced on
   deployment; when absent, the workflow preserves existing Supabase values.
   The Jellyfin API key and private server URL never belong in Supabase or GitHub.

The new migration and `jellyfin-presence` function must be deployed before
publication works. GET requests use the private backend to read only the configured
account's singleton; anonymous clients cannot read its table or database routines
directly. POST reports require the token and exactly the configured account ID.
Missing/invalid configuration fails closed on both reads and writes.

## Check and run

Use Node 22.19 or later. In PowerShell from the repository root:

```powershell
$env:SHORTBITS_CONFIG = (Resolve-Path .\agents\jellyfin\config.json).Path
node .\agents\jellyfin\collector.mjs --check
```

`CHECK_OK` verifies local account/session access without contacting Supabase or
publishing anything. Check once while your account plays a known video; confirm
other users' playback never appears when you enable the website feature.

Running without `--check` starts public reporting:

```powershell
node .\agents\jellyfin\collector.mjs
```

Logs contain only fixed diagnostic codes and `REPORT_OK`, not titles, addresses,
user IDs, tokens or raw records. `REPORT_OK` confirms that the report was accepted,
not that something is playing. Stop the process to stop updates.

An optional Docker image follows the existing Unraid collector's non-root,
read-only pattern. Build with this directory as the context. Mount the protected
configuration directory read-only at `/config`; allow the container's non-root
user to read it. No privileged mode, host networking or inbound port is needed:

```bash
docker build --tag shortbits-jellyfin:local agents/jellyfin
docker run --rm --read-only --cap-drop ALL --security-opt no-new-privileges \
  --mount type=bind,src=/YOUR_PRIVATE_CONFIG_DIRECTORY,dst=/config,readonly \
  shortbits-jellyfin:local --check
```

Use the same mount/hardening to run persistently, with a restart policy and
bounded logs as in the Unraid collector. A real installation and local-network
check are still required; building the image does not verify your Jellyfin server.

## Enable, verify and revoke

After separately approved deployment and successful reporting, set the public
`jellyfinPresenceEnabled` flag in `shared/scripts/site-config.js` to `true`.
It defaults to false: no Jellyfin requests/card are added until explicitly enabled.
There are no credentials or account IDs in this flag.
Online's existing arrows include active Jellyfin watching; `/nowplaying/`
adds a simultaneous Jellyfin card. It shows update age, not an invented session
length. Verify play, pause, stop, collector outage and expiry with your own
server, including another user playing concurrently.

Rotate `JELLYFIN_INGEST_TOKEN` and the local token to revoke an old collector.
Change both immutable IDs together when changing accounts; older reports cannot
be read for the new ID. To disable further public reads, remove the backend
user/token configuration or clear its singleton, then disable the public flag.
Already-open pages clear their snapshot on the next refresh or expiry.
Only stopping the collector leaves the last report visible until its expiry.
Do not send secrets or raw error responses for troubleshooting; share only a
fixed code such as `CONFIG_OWNER_USER_ID_REQUIRED`, `JELLYFIN_HTTP_401`,
`JELLYFIN_OWNER_ACCOUNT_INVALID_OR_DISABLED`, or `SITE_HTTP_401`.
