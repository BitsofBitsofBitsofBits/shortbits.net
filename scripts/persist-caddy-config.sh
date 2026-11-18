#!/bin/sh
set -eu

original=$1
candidate=$2
startup=$3

caddy validate --config "$candidate" --adapter caddyfile
if ! cmp -s "$original" "$startup"; then
  echo 'Caddy startup configuration changed during deployment; refusing to overwrite it.' >&2
  exit 1
fi

backup=$(mktemp "${TMPDIR:-/tmp}/Caddyfile.pre-deploy.XXXXXX")
cp "$original" "$backup"
printf 'Caddy configuration recovery backup: %s\n' "$backup"

restore_startup() {
  if cmp -s "$backup" "$startup"; then return; fi
  if ! cp "$backup" "$startup" || ! cmp -s "$backup" "$startup"; then
    printf 'CRITICAL: Could not restore Caddy startup configuration. Recovery backup: %s\n' "$backup" >&2
    return 1
  fi
}

if ! cp "$candidate" "$startup"; then
  echo 'Cannot persist Caddy startup configuration; refusing a runtime-only reload. A privileged operator must repair deployment write access.' >&2
  restore_startup
  exit 1
fi
if ! cmp -s "$candidate" "$startup"; then
  echo 'Saved Caddy startup configuration does not match the validated candidate; refusing reload.' >&2
  restore_startup
  exit 1
fi
if ! caddy reload --config "$startup" --adapter caddyfile; then
  echo 'Caddy reload failed; restoring the saved startup configuration.' >&2
  restore_startup
  if ! caddy reload --config "$startup" --adapter caddyfile; then
    printf 'CRITICAL: Caddy rollback reload failed. Recovery backup: %s\n' "$backup" >&2
  fi
  exit 1
fi
if ! cmp -s "$candidate" "$startup"; then
  echo 'Caddy startup configuration changed during reload; manual inspection is required.' >&2
  exit 1
fi
echo 'Caddy reloaded from the verified persistent startup configuration.'
rm -f "$original" "$candidate"
