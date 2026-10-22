# Unraid live hardware collector

Publishes an explicit allowlist of NAS telemetry into HARDWARE.SYS using a
separate website device token. Designed for the Unraid 7.4 API schema tested
during setup; unsupported schemas fail explicitly rather than publishing zeros.

## Public information and limitations

- CPU percent, RAM used/total, boot time, array state, aggregate array capacity,
  array DATA-drive status/temperature/I/O errors, and selected-interface RX/TX.
- Storage API kilobytes are converted using 1024; display uses TiB/GiB. RAM uses
  the API's `used` reading (not `total - available`); Linux cache accounting can
  make these differ. Network rates use counter differences and source timestamps,
  not the API's potentially zero `rxSec`/`txSec` fields.
- No raw API responses, hostnames, serials, addresses, share names, file paths,
  interface names, Docker/VM names, or raw SMART records leave the collector.
  Drives are sorted by local slot and published as Drive 1, Drive 2, etc.
- Boot time and live activity are intentionally public and can reveal usage
  patterns. Public telemetry is not anonymous activity. Do not run the collector
  if that disclosure is unacceptable.
- Only array DATA disks are queried/displayed here, not pool/cache/parity health.
  Status and I/O errors are **not** a full SMART health assessment. Sleeping or
  unavailable temperatures remain null; no disk spin-up command is issued.
- Network coverage depends on the chosen interface. Start with `br0` on the
  tested setup and verify during a known file transfer. Do not sum bridges,
  shims, Docker interfaces, and physical adapters: traffic overlaps. This is
  LAN interface throughput, not Internet bandwidth.
- Hardware model descriptions are deliberately **not auto-imported**. Add
  reviewed CPU, RAM, board, etc. under the matching machine name in Admin.
  The collector does not overwrite these rows or auto-name the device.

## Prerequisites

1. The `20261022010000_hardware_nas_pulse.sql` migration must have deployed
   successfully. The website's deployment workflow applies it.
2. Create an Unraid API key with only read permissions for the queried system,
   CPU/memory/network metrics, array, and disk fields. No admin/control grants.
3. Use a valid HTTPS certificate hostname. This installation successfully tested
   an existing `.ts.net` certificate hostname mapped directly to the LAN IP.
   DNS or active Tailscale connectivity is not needed with the host mapping below,
   but certificate renewal still depends on the service that provisions it.
   Never disable certificate verification or mount private TLS keys.
4. In website Admin -> Hardware -> Live agents, create a **separate device token**
   with an explicit safe public name such as `NAS`. Do not reuse the desktop
   token and do not leave the name blank. Save the token locally; it is shown once.
5. Get the site's public Supabase URL and publishable key from `supabase-config.js`.
   Use the public/publishable key, **never a service-role or secret key**.

The following commands run in the **Unraid Linux terminal**, not PowerShell.
No privileged mode, Docker socket, host networking, inbound ports, or API tunnel
is required. Check that the paths below are appropriate for your appdata share.

## Build

Download the repository's source using HTTPS, then build the image locally:

```bash
mkdir -p /mnt/user/appdata/shortbits-unraid/source
curl --fail --location \
  https://github.com/BitsofBitsofBitsofBits/shortbits.net/archive/refs/heads/main.tar.gz \
  --output /mnt/user/appdata/shortbits-unraid/source.tar.gz
```

Only continue if the download succeeded:

```bash
tar -xzf /mnt/user/appdata/shortbits-unraid/source.tar.gz \
  --strip-components=1 -C /mnt/user/appdata/shortbits-unraid/source
docker build --pull --tag shortbits-unraid:local \
  /mnt/user/appdata/shortbits-unraid/source/agents/unraid
```

The Docker build context excludes everything except the collector source; local
configuration and tokens are never copied into the image.

## Local secrets

```bash
mkdir -p /mnt/user/appdata/shortbits-unraid/config
cp /mnt/user/appdata/shortbits-unraid/source/agents/unraid/config.example.json \
  /mnt/user/appdata/shortbits-unraid/config/config.json
nano /mnt/user/appdata/shortbits-unraid/config/config.json
```

Replace all placeholders in that JSON file:

- `unraidUrl`: `https://YOUR_CERTIFICATE_HOSTNAME:444/graphql` (use the verified
  certificate hostname and your actual HTTPS port).
- `unraidApiKey`: your read-only API key.
- `networkInterface`: `br0`, or the single locally verified interface.
- `supabaseUrl`: your site's Supabase project HTTPS origin, no REST/function path.
- `supabaseKey`: its public publishable key.
- `deviceToken`: the NAS-only `sbhw_...` token issued by website Admin.

Do not paste this completed file into chat, a GitHub issue, or the repository.
Protect the folder and allow the container's non-root group to read it:

```bash
chown root:1000 /mnt/user/appdata/shortbits-unraid/config
chown root:1000 /mnt/user/appdata/shortbits-unraid/config/config.json
chmod 750 /mnt/user/appdata/shortbits-unraid/config
chmod 640 /mnt/user/appdata/shortbits-unraid/config/config.json
```

Edit as root when changing the file. Avoid broad recursive permission tools on
this folder; changing permissions can expose credentials or prevent startup.

## Check before publishing

Substitute your verified certificate hostname and NAS LAN IP for the host
mapping. This mapping is local container configuration, not public DNS:

```bash
docker run --rm --name shortbits-unraid-check \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --add-host YOUR_CERTIFICATE_HOSTNAME:YOUR_NAS_LAN_IP \
  --mount type=bind,src=/mnt/user/appdata/shortbits-unraid/config,dst=/config,readonly \
  shortbits-unraid:local --check
```

Expect `CHECK_OK` after two samples about five seconds apart. It verifies TLS,
Unraid API-key permissions, required fields, and advancing network timestamps.
It **does not call Supabase or publish anything**, and therefore does not
validate the website token or deployment. Raw readings and credentials are not
logged. If it fails, share only the fixed error code.

## Start publishing

Running this command starts publishing the allowlisted metrics publicly:

```bash
docker run -d --name shortbits-unraid --restart unless-stopped \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --log-driver json-file --log-opt max-size=1m --log-opt max-file=2 \
  --add-host YOUR_CERTIFICATE_HOSTNAME:YOUR_NAS_LAN_IP \
  --mount type=bind,src=/mnt/user/appdata/shortbits-unraid/config,dst=/config,readonly \
  shortbits-unraid:local
docker logs --tail 20 shortbits-unraid
```

Expect `REPORT_OK`. Open HARDWARE.SYS: your named NAS should show LIVE plus the
new metrics. Reports run every 15 seconds idle / 5 seconds while watched. Public
pages poll every 3 seconds; this is near-live monitoring, not instantaneous.
First network sample, restart, or counter reset shows "measuring".
Click the array status heading to collapse or expand storage, network, and drive
readings independently of the device card. This preference is remembered per
device in your browser; the array state or stale warning stays visible.

Verify RX/TX during a known file transfer. Verify sleeping temperatures stay
unavailable. Stop the container and confirm the display becomes OFFLINE with
NAS readings marked stale after about 60 seconds. Start it again afterward:

```bash
docker stop shortbits-unraid
docker start shortbits-unraid
```

## Troubleshooting / maintenance

- `UNRAID_CONNECTION_FAILED_CHECK_TLS_DNS_AND_CONNECTIVITY`: check the host
  mapping, LAN IP/port, certificate validity/chain, and current container CA
  bundle. This also covers timeouts. Never use insecure TLS flags.
- `UNRAID_GRAPHQL_ERROR_CHECK_SCHEMA_AND_READ_PERMISSIONS`: a required field
  is missing or the key lacks access; use the local Sandbox to investigate
  privately. HTTP 200 containing GraphQL errors is rejected.
- `NETWORK_TIMESTAMP_STALE_OR_CLOCK_INCORRECT`: check NAS time and API freshness.
  `NETWORK_TIMESTAMP_NOT_ADVANCING` means the API returned a cached sample.
  `NETWORK_INTERFACE_NOT_FOUND_OR_AMBIGUOUS` means the local selection is wrong.
- `SITE_HTTP_404` / `SITE_REPORT_REJECTED_CHECK_MIGRATION_AND_PAYLOAD`: verify
  the migration deployed and project URL/key are correct.
- `SITE_DEVICE_TOKEN_REVOKED`, HTTP 401/403: fix the local credential. The process
  exits; stop the container to avoid Docker restart attempts while configuring.
- Failed Unraid polling never sends a healthy heartbeat. Other errors back off
  up to 60 seconds. Existing public readings age out instead of silently becoming
  zeros. Expired certificates fail closed.
- To rotate keys, stop the container, edit the local JSON, then start it.
  Website tokens can be revoked/renamed in Admin; status follows renames.
- To update, repeat source download/build, then `docker stop shortbits-unraid`
  and `docker rm shortbits-unraid`. Re-run the start command with the same
  read-only configuration mount and host mapping.
- To uninstall, stop/remove only this container, revoke its website device token
  and Unraid API key, then remove the specific local secret file when no longer
  needed. Revoking the website device removes its live status; manually entered
  inventory remains separately editable.

## Development

No npm dependencies. Node 22+:

```bash
node --test agents/unraid/collector.test.mjs
```
