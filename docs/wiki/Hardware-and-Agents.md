# Hardware and agents

[Wiki home](https://github.com/BitsofBitsofBitsofBits/shortbits.net/wiki) | [Source repository](https://github.com/BitsofBitsofBitsofBits/shortbits.net)

- An Admin-managed `HARDWARE.SYS` window listing real machine specs grouped
  by machine. Admin edits each machine as its own card with a component list
  (add, remove, show or hide parts; rename or remove the whole machine).
  Admin's **Import from a PC** subsection provides a read-only PowerShell
  scan script (CPU, GPU, RAM, motherboard, storage, displays, OS; no serial
  numbers) that copies JSON to the clipboard for pasting back into the editor
  before saving. The scan names the machine from its system model, falling
  back to the Windows device name when the model is a generic placeholder or
  just the motherboard (custom builds), so imports don't overwrite another
  machine; the name is pre-filled and can be changed before or after import. Machines are collapsible, and the
  collapsed state is remembered per browser. Public cards pack into gaps below
  shorter lists and reflow when resized, collapsed, or updated with live readings.
  Admin's **Move up / Move down**
  controls and **Save hardware** persist the public device order, including
  live devices without component rows; new unordered devices appear afterward.

- Optional live hardware agents: Admin's **Live agents** subsection issues a
  per-machine device token (only its SHA-256 hash is stored, revocable at any
  time) and a PowerShell installer. The installer saves the token
  DPAPI-encrypted under `%LOCALAPPDATA%\BitsHardwareAgent` and registers a
  per-user logon task that needs no admin rights and runs in a headless console, so no PowerShell window stays open. The agent posts CPU, GPU,
  and RAM load plus boot time as lightweight pulses to the
  `hardware_agent_pulse` RPC (token hashed server-side, at most one pulse per
  2 seconds): every 3 seconds while anyone has HARDWARE.SYS open (viewers
  call the throttled `hardware_watch` RPC), otherwise every 15 seconds. Specs
  are re-synced at start and every six hours through the `hardware-sync` Edge
  Function (`x-device-token` header; at most one report per 20 seconds and one
  spec sync per five minutes per device). Synced
  rows are matched by component and name, so unticking a row in Admin keeps it
  hidden, and manually entered rows are kept. HARDWARE.SYS polls
  `site_hardware_status` every 3 seconds while open and visible, ticks uptime
  every second, and shows a machine as LIVE when it reported within the last
  minute. Hardware jokes (including seasonal variants) rotate as agent chatter
  beneath online agents' live stats; offline agents do not show chatter.
  System Monitor shows desktop status and fictional process statuses, not
  simulated hardware readings. Re-running the installer upgrades the agent and can keep the saved
  token. Leaving the token's machine name blank creates a pending device that
  the agent names on its first spec sync (same model / device-name rule,
  through the service-role-only hardware_agent_claim_name RPC, which reuses
  a matching scanned machine and suffixes clashes with other agents). Agent
  machines can be renamed from **Live agents** or the editor; the device row,
  its live status, and its rows move together and the agent keeps syncing

- Linux / Unraid machines (e.g. a NAS) use **Import from a PC** with the
  `LINUX / UNRAID (BASH)` platform: a one-shot bash scan (run as root for RAM
  module details) that prints CPU, RAM, motherboard, GPUs, network cards with
  link speed, storage grouped by identical drive, and OS as one JSON line. It
  uploads nothing and has no live agent; paste the JSON into Admin and save

## Unraid NAS live monitoring

The optional [Unraid Docker collector](https://github.com/BitsofBitsofBitsofBits/shortbits.net/blob/main/agents/unraid/README.md) sends filtered
CPU/RAM/uptime, array capacity/state, DATA-drive readings, and selected-interface
network rates into HARDWARE.SYS. It uses a separate existing Admin-issued device
token and a local read-only Unraid API key, with verified outbound HTTPS and no
public NAS endpoint. Credentials and raw identifying API fields stay local.
Reviewed hardware model descriptions can be added manually in Admin. Public
uptime/activity remains inferable; read the privacy and coverage limitations
before enabling it. The Docker setup includes a no-publish compatibility check.

Collector tests: `node --test agents/unraid/collector.test.mjs`. CI additionally
tests the NAS migration against PostgreSQL and builds the non-root Docker image.
