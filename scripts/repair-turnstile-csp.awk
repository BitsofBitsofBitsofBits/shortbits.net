function fail(message) {
  print "ERROR: " message > "/dev/stderr"
  failed = 1
  exit 1
}

{
  lines[NR] = $0
  lower = tolower($0)
  if (lower ~ /^[ \t]*#/) next
  if (lower !~ /content-security-policy/) next
  if (++headers > 1) fail("Multiple CSP headers; operator must inspect the layout locally.")
  if (!match(lower, /content-security-policy[ \t]+"/)) {
    fail("Expected a single-line quoted CSP header; no candidate produced.")
  }
  prefix = substr($0, 1, RSTART + RLENGTH - 1)
  remainder = substr($0, RSTART + RLENGTH)
  closing = index(remainder, "\"")
  if (!closing) fail("CSP is not a complete single-line quoted value.")
  policy = substr(remainder, 1, closing - 1)
  suffix = substr(remainder, closing)
  if (policy ~ /\\/ || suffix !~ /^"[ \t]*(#.*)?$/) {
    fail("Unsupported quoted CSP layout; operator must inspect it locally.")
  }
  count = split(policy, directives, ";")
  scripts = frames = 0
  updated = ""
  for (i = 1; i <= count; i++) {
    directive = directives[i]
    trimmed = directive
    sub(/^[ \t]+/, "", trimmed)
    sub(/[ \t]+$/, "", trimmed)
    tokens = split(trimmed, sources, /[ \t]+/)
    name = tolower(sources[1])
    if (name == "script-src" || name == "frame-src") {
      if (name == "script-src") scripts++
      else frames++
      present = 0
      for (j = 2; j <= tokens; j++) {
        if (sources[j] == "'none'") fail("A target CSP directive is 'none'; explicit operator review required.")
        if (sources[j] == "https://challenges.cloudflare.com") present = 1
      }
      if (!present) {
        trailing = directive
        sub(/^.*[^ \t]/, "", trailing)
        sub(/[ \t]+$/, "", directive)
        directive = directive " https://challenges.cloudflare.com" trailing
      }
    }
    updated = updated directive (i < count ? ";" : "")
  }
  if (scripts != 1 || frames != 1) fail("Exactly one existing script-src and frame-src are required.")
  lines[NR] = prefix updated suffix
}

END {
  if (failed) exit 1
  if (headers != 1) fail("Exactly one CSP header is required.")
  for (line = 1; line <= NR; line++) print lines[line]
}
