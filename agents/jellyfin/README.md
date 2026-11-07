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

For Docker/Unraid, use the [host setup below](#unraid--docker-host-setup) to create
the protected mounted file and token instead of steps 3 and 6's PowerShell
commands. The field definitions and backend secret names are the same.

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

## Unraid / Docker host setup

These are preparation instructions, not an installation or release already
performed. Run them only after approving installation on the chosen host.
**Starting the collector without `--check` publishes watching status through
the public backend, even while the website's display flag is false.** Backend
deployment, private secret configuration, and starting public reporting each
need authorization; the flag is a display switch, not an access-control boundary.

The commands below run in the **Unraid Linux terminal**, not PowerShell. They
use `/mnt/user/appdata/shortbits-jellyfin` for a fresh installation. On another
Docker host, substitute an appropriate protected absolute directory. If that
directory, its config file, or a container named `shortbits-jellyfin` already
exists, stop and review it rather than overwriting or replacing an installation.

### Obtain approved source and build locally

The release coordinator must first publish the approved source revision.
Unpublished review commits cannot be downloaded from GitHub, and the existing
production branch may not contain this collector yet. Use the full **published,
approved commit SHA** supplied for installation, not a moving `main` download.

```bash
APPROVED_SOURCE_SHA=REPLACE_WITH_APPROVED_PUBLISHED_40_CHARACTER_SHA
mkdir -p /mnt/user/appdata/shortbits-jellyfin/source
curl --fail --location --proto '=https' --proto-redir '=https' \
  "https://github.com/BitsofBitsofBitsofBits/shortbits.net/archive/${APPROVED_SOURCE_SHA}.tar.gz" \
  --output /mnt/user/appdata/shortbits-jellyfin/source.tar.gz
```

Only continue if that download succeeds. Extract into the new source directory
and build with the collector directory as the context:

```bash
tar -xzf /mnt/user/appdata/shortbits-jellyfin/source.tar.gz \
  --strip-components=1 -C /mnt/user/appdata/shortbits-jellyfin/source
docker build --pull --tag shortbits-jellyfin:local \
  /mnt/user/appdata/shortbits-jellyfin/source/agents/jellyfin
```

The image includes only `collector.mjs`, not local config or secrets. A local
image build is not proof of Jellyfin connectivity or deployed ingestion.

### Create protected configuration without printing tokens

Unraid's root terminal can create a directory readable by the image's non-root
user/group 1000. Do not use broad recursive permission changes or store this
file in a public share:

```bash
install -d -m 750 -o 0 -g 1000 /mnt/user/appdata/shortbits-jellyfin/config
```

Use the already-built image for one-time initialization; no host Node install
is needed. Only this initialization mount is writable. The command generates
the token directly into a new protected file, prints no secrets, and refuses
to overwrite an existing `config.json`:

```bash
docker run --rm --user 0:1000 --network none --read-only --cap-drop ALL \
  --security-opt no-new-privileges --entrypoint node \
  --mount type=bind,src=/mnt/user/appdata/shortbits-jellyfin/config,dst=/config \
  --mount type=bind,src=/mnt/user/appdata/shortbits-jellyfin/source/agents/jellyfin/config.example.json,dst=/template/config.example.json,readonly \
  shortbits-jellyfin:local -e 'const fs=require("node:fs"),crypto=require("node:crypto");const config=JSON.parse(fs.readFileSync("/template/config.example.json","utf8"));config.deviceToken="sbjf_"+crypto.randomBytes(32).toString("hex");fs.writeFileSync("/config/config.json",JSON.stringify(config,null,2),{flag:"wx",mode:0o640});fs.chmodSync("/config/config.json",0o640);'
```

Open the file privately with the host's editor, for example:

```bash
nano /mnt/user/appdata/shortbits-jellyfin/config/config.json
```

Fill the values described in **Private configuration** above. Leave the
generated `deviceToken` in place. Use the Jellyfin LAN address/certificate
hostname or an existing private Docker-network name reachable from this
container. **Do not use `localhost`: it refers to the collector itself.**
Copy the site's public Supabase URL/key from the downloaded
`shared/scripts/supabase-config.js`; these are public values, not secrets.

Do not put Jellyfin credentials or the collector token in Unraid
environment-variable fields, `docker -e`, command
arguments, screenshots, chat, or source control. The protected bind-mounted
file is the secret-entry mechanism; `SHORTBITS_CONFIG`, if used, contains only
its path. Protect backups of this directory too.

### Check private connectivity without publishing

This uses the image's normal non-root user and a read-only config mount:

```bash
docker run --rm --read-only --cap-drop ALL --security-opt no-new-privileges \
  --mount type=bind,src=/mnt/user/appdata/shortbits-jellyfin/config,dst=/config,readonly \
  shortbits-jellyfin:local --check
```

Expect `CHECK_OK` with your own account playing a known video. This does not
contact Supabase, publish anything, or prove backend authentication. Privately
confirm the account ID belongs to you; passing `--check` cannot identify the
human owner for you.

If the default bridge cannot reach Jellyfin, review existing private Docker
network routing/DNS and Unraid host-access restrictions. If an appropriate
existing private network is approved, use `--network YOUR_EXISTING_PRIVATE_NETWORK`
consistently for both checking and running. A valid certificate hostname may
need an approved `--add-host CERTIFICATE_HOSTNAME:LAN_IP` mapping. Do not add
public ports, privileged mode, host networking, or insecure TLS flags to bypass
a failed check.

### Start only after backend and public-reporting approval

Required backend prerequisites are:

- The approved migration `20261107090000_jellyfin_presence.sql` and
  `jellyfin-presence` Edge Function have deployed successfully.
- Private `JELLYFIN_USER_ID` and `JELLYFIN_INGEST_TOKEN` match the protected
  collector file. Enter them in Supabase Dashboard secrets fields only after
  approving this configuration change; keep optional matching GitHub Supabase
  environment secrets consistent. Jellyfin's API key and LAN address remain
  local only.
- The site's normal Supabase service credentials are available to the function;
  the collector uses only the public publishable/anon key.
- Public reporting is authorized. Missing configuration should return HTTP 503,
  not another account's activity. Keep the website flag off until reporting and
  real owner-only behavior are verified.

After those prerequisites and a successful local check, the authorized
persistent container can be started:

```bash
docker run -d --name shortbits-jellyfin --restart unless-stopped \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --log-driver json-file --log-opt max-size=1m --log-opt max-file=2 \
  --mount type=bind,src=/mnt/user/appdata/shortbits-jellyfin/config,dst=/config,readonly \
  shortbits-jellyfin:local
docker logs --tail 20 shortbits-jellyfin
```

Expect fixed codes and `REPORT_OK`. Keep any network/host mapping identical to
the successful check. Do not rerun this command against an existing container.

For Unraid's **Add Container** interface, the equivalent settings are:

| Field | Value |
| --- | --- |
| Name | `shortbits-jellyfin` |
| Repository | The locally built `shortbits-jellyfin:local` |
| Network | Bridge, or the approved existing private network used for `--check` |
| Privileged | Off |
| Path mapping | Protected host config directory to `/config`, **Read Only** |
| Extra parameters | `--read-only --cap-drop ALL --security-opt no-new-privileges --log-driver json-file --log-opt max-size=1m --log-opt max-file=2` |
| Ports / devices / Docker socket | None |
| Secret environment variables | None |
| Autostart | Enable only after authorized reporting and verification |

Do not create both a terminal-started container and a second GUI-managed one.
The configuration is a mounted file, not baked into the image. Building,
installing and running on the real host remain unverified until performed.

### Real owner-only verification

Perform these observations only after public reporting is authorized. Check the
public `jellyfin-presence` endpoint directly first while the website flag is off;
then enable the flag through a separately approved site update.
The endpoint is
`https://YOUR_PROJECT.supabase.co/functions/v1/jellyfin-presence`, using the
configured public Supabase project URL, not the Jellyfin LAN URL.

| Observation | Required result |
| --- | --- |
| Your account plays A while another account plays newer B | Only A appears; no other user/device/server identifiers |
| Your account pauses A while the other account keeps playing B | A is paused, its position stops advancing; B never substitutes |
| Your account stops while another account continues B | Idle, with no title from B |
| Two of your sessions are active | Playing beats paused, then newest owner check-in; foreign sessions are ignored |
| Collector stops | Within about 90 seconds plus refresh allowance, status expires and title/episode details clear |
| Collector resumes | Current owner status recovers |
| Jellyfin becomes unreachable during a separately approved outage test | Unavailable with no media, then recovery when reachable |

With approval to stop/restart this installed collector, use only its named
container:

```bash
docker stop shortbits-jellyfin
docker start shortbits-jellyfin
```

Observe expiry before restarting; allow up to two minutes for refresh/timer
effects. Do not alter live secrets, disable another user's account, or disrupt
Jellyfin networking to test failures without separate approval. Missing IDs,
foreign reports, token rotation and malformed data already have automated
coverage; the live observations above are still required before claiming
owner-only sharing works on your server.

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
