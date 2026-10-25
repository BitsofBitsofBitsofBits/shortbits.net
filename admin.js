const loginView = document.querySelector("#login-view");
const inboxView = document.querySelector("#inbox-view");
const loginForm = document.querySelector("#login-form");
const loginSubmit = document.querySelector("#login-submit");
const loginStatus = document.querySelector("#login-status");
const inboxStatus = document.querySelector("#inbox-status");
const messageList = document.querySelector("#message-list");
const refreshButton = document.querySelector("#refresh-messages");
const guestbookAdminStatus = document.querySelector("#guestbook-admin-status");
const guestbookAdminList = document.querySelector("#guestbook-admin-list");
const refreshGuestbook = document.querySelector("#refresh-guestbook");
const arcadeAdminStatus = document.querySelector("#arcade-admin-status");
const arcadeAdminList = document.querySelector("#arcade-admin-list");
const refreshArcadeScores = document.querySelector("#refresh-arcade-scores");
const arcadeSettingsForm = document.querySelector("#arcade-settings-form");
const arcadeSettingsSubmit = document.querySelector("#arcade-settings-submit");
const arcadeLeaderboardEnabled = document.querySelector("#arcade-leaderboard-enabled");
const arcadeSubmissionsEnabled = document.querySelector("#arcade-submissions-enabled");
const logoutButton = document.querySelector("#logout-button");
const pronounProfileForm = document.querySelector("#pronoun-profile-form");
const pronounProfileSubmit = document.querySelector("#pronoun-profile-submit");
const pronounAdminStatus = document.querySelector("#pronoun-admin-status");
const playlistForm = document.querySelector("#playlist-form");
const playlistSubmit = document.querySelector("#playlist-submit");
const playlistAdminStatus = document.querySelector("#playlist-admin-status");
const playlistSlots = document.querySelector("#playlist-slots");
const playlistAdd = document.querySelector("#playlist-add");
const trackForm = document.querySelector("#track-form");
const trackSubmit = document.querySelector("#track-submit");
const trackAdminStatus = document.querySelector("#track-admin-status");
const trackSlots = document.querySelector("#track-slots");
const trackAdd = document.querySelector("#track-add");
const resumeForm = document.querySelector("#resume-form");
const resumeSubmit = document.querySelector("#resume-submit");
const resumeAdminStatus = document.querySelector("#resume-admin-status");
const resumeEntrySlots = document.querySelector("#resume-entry-slots");
const resumeEntryAdd = document.querySelector("#resume-entry-add");
const resumeEducationSlots = document.querySelector("#resume-education-slots");
const resumeEducationAdd = document.querySelector("#resume-education-add");
const resumeCertificationSlots = document.querySelector("#resume-certification-slots");
const resumeCertificationAdd = document.querySelector("#resume-certification-add");
const nowForm = document.querySelector("#now-form");
const nowSubmit = document.querySelector("#now-submit");
const nowAdminStatus = document.querySelector("#now-admin-status");
const changelogForm = document.querySelector("#changelog-form");
const changelogSubmit = document.querySelector("#changelog-submit");
const changelogAdminStatus = document.querySelector("#changelog-admin-status");
const changelogSlots = document.querySelector("#changelog-slots");
const changelogEntryAdd = document.querySelector("#changelog-entry-add");
const gamesForm = document.querySelector("#games-form");
const gamesSubmit = document.querySelector("#games-submit");
const gamesAdminStatus = document.querySelector("#games-admin-status");
const gamesSlots = document.querySelector("#games-slots");
const gamesEntryAdd = document.querySelector("#games-entry-add");
const creatorsForm = document.querySelector("#creators-form");
const creatorsSubmit = document.querySelector("#creators-submit");
const creatorsAdminStatus = document.querySelector("#creators-admin-status");
const creatorsSlots = document.querySelector("#creators-slots");
const creatorsEntryAdd = document.querySelector("#creators-entry-add");
const hardwareForm = document.querySelector("#hardware-form");
const hardwareSubmit = document.querySelector("#hardware-submit");
const hardwareAdminStatus = document.querySelector("#hardware-admin-status");
const hardwareSlots = document.querySelector("#hardware-slots");
const hardwareEntryAdd = document.querySelector("#hardware-entry-add");
const hardwareImportScript = document.querySelector("#hardware-import-script");
const hardwareImportCopy = document.querySelector("#hardware-import-copy");
const hardwareImportMachine = document.querySelector("#hardware-import-machine");
const hardwareImportMachineHint = document.querySelector("#hardware-import-machine-hint");
const hardwareImportJson = document.querySelector("#hardware-import-json");
const hardwareImportReplace = document.querySelector("#hardware-import-replace");
const hardwareImportApply = document.querySelector("#hardware-import-apply");
const hardwareDevices = document.querySelector("#hardware-devices");
const hardwareDeviceMachine = document.querySelector("#hardware-device-machine");
const hardwareDeviceCreate = document.querySelector("#hardware-device-create");
const hardwareDeviceTokenOutput = document.querySelector("#hardware-device-token-output");
const hardwareDeviceToken = document.querySelector("#hardware-device-token");
const hardwareDeviceTokenCopy = document.querySelector("#hardware-device-token-copy");
const hardwareAgentInstaller = document.querySelector("#hardware-agent-installer");
const hardwareAgentInstallerCopy = document.querySelector("#hardware-agent-installer-copy");
const hardwareAgentUninstall = document.querySelector("#hardware-agent-uninstall");
const hardwareDeviceStatus = document.querySelector("#hardware-device-status");
// Windows PowerShell 5.1 compatible; collects no serial numbers.
// Machine names use the system model, or the device name when the model is a
// placeholder or just the motherboard name (custom builds).
const hardwareMachineNameFunction = [
  "function Get-BitsMachineName {",
  "$cs = Get-CimInstance Win32_ComputerSystem",
  "$product = Get-CimInstance Win32_ComputerSystemProduct",
  "$board = Get-CimInstance Win32_BaseBoard | Select-Object -First 1",
  "$model = ([string]$cs.Model).Trim()",
  "if ([string]$cs.Manufacturer -match 'LENOVO' -and ([string]$product.Version).Trim()) { $model = ([string]$product.Version).Trim() }",
  String.raw`$generic = '^(System Product Name|System Name|System Version|To Be Filled By O\.?E\.?M\.?|Default string|Not Applicable|N/A|None|Undefined|Unknown|OEM|Standard PC.*|Virtual Machine|All Series|Type1ProductConfigId|INVALID|[0-9x\. ]*|MS-[0-9A-Z]{4})$'`,
  "if (-not $model -or $model -match $generic -or ($board -and $model -eq ([string]$board.Product).Trim())) { $model = [Environment]::MachineName }",
  "return $model.Substring(0, [math]::Min(60, $model.Length))",
  "}",
];
const hardwareScanFunction = [
  "function Get-BitsHardware {",
  "$rows = New-Object System.Collections.ArrayList",
  "function Add-Row($component, $name, $detail) {",
  "  $name = ([string]$name).Trim()",
  "  if ($name) { [void]$rows.Add([ordered]@{ component = $component; name = $name; detail = ([string]$detail).Trim() }) }",
  "}",
  "$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1",
  "if ($cpu) { Add-Row 'CPU' $cpu.Name ('{0} cores / {1} threads, {2:N2} GHz base' -f $cpu.NumberOfCores, $cpu.NumberOfLogicalProcessors, ($cpu.MaxClockSpeed / 1000)) }",
  "Get-CimInstance Win32_VideoController | Where-Object { $_.Name -notmatch 'Microsoft|Virtual|Remote|Parsec|Meta' } | ForEach-Object { Add-Row 'GPU' $_.Name ('Driver ' + $_.DriverVersion) }",
  "$mem = @(Get-CimInstance Win32_PhysicalMemory)",
  "if ($mem.Count) {",
  "  $total = [math]::Round((($mem | Measure-Object Capacity -Sum).Sum) / 1GB)",
  "  $stick = $mem[0]",
  "  $speed = $stick.ConfiguredClockSpeed",
  "  if (-not $speed) { $speed = $stick.Speed }",
  "  Add-Row 'RAM' ('{0} GB' -f $total) ('{0} x {1} GB @ {2} MT/s {3}' -f $mem.Count, [math]::Round($stick.Capacity / 1GB), $speed, $stick.Manufacturer)",
  "}",
  "$board = Get-CimInstance Win32_BaseBoard | Select-Object -First 1",
  "if ($board) { Add-Row 'MOTHERBOARD' ($board.Manufacturer + ' ' + $board.Product) '' }",
  "$disks = @(Get-PhysicalDisk)",
  "if ($disks.Count) {",
  "  foreach ($disk in $disks) {",
  "    $kind = @([string]$disk.MediaType, [string]$disk.BusType) | Where-Object { $_ -and $_ -ne 'Unspecified' }",
  "    Add-Row 'STORAGE' $disk.FriendlyName ((@(('{0} GB' -f [math]::Round($disk.Size / 1GB))) + $kind) -join ' / ')",
  "  }",
  "} else {",
  "  Get-CimInstance Win32_DiskDrive | ForEach-Object { Add-Row 'STORAGE' $_.Model ('{0} GB / {1}' -f [math]::Round($_.Size / 1GB), $_.InterfaceType) }",
  "}",
  "Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorID | ForEach-Object {",
  "  $label = ($_.UserFriendlyName | Where-Object { $_ -gt 0 } | ForEach-Object { [char]$_ }) -join ''",
  "  Add-Row 'DISPLAY' $label ''",
  "}",
  "$os = Get-CimInstance Win32_OperatingSystem",
  "$release = (Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion').DisplayVersion",
  "if ($os) { Add-Row 'OS' $os.Caption ((@($release, ('build ' + $os.BuildNumber)) | Where-Object { $_ }) -join ' / ') }",
  "return $rows.ToArray()",
  "}",
];
const hardwareStatusFunction = [
  "function Get-BitsStatus {",
  "$os = Get-CimInstance Win32_OperatingSystem",
  "$cpu = (Get-CimInstance Win32_PerfFormattedData_Counters_ProcessorInformation -Filter \"Name='_Total'\").PercentProcessorUtility",
  "if ($null -eq $cpu) { $cpu = (Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average }",
  "$gpu = $null",
  "$engines = @(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine)",
  "if ($engines.Count) {",
  "  # Per adapter and engine type, as Task Manager reports it.",
  "  $gpu = ($engines | Group-Object { [regex]::Match($_.Name, 'luid_\\w+?_phys').Value + [regex]::Match($_.Name, 'engtype_.*$').Value } | ForEach-Object { ($_.Group | Measure-Object UtilizationPercentage -Sum).Sum } | Measure-Object -Maximum).Maximum",
  "  $gpu = [math]::Min(100, [int]$gpu)",
  "}",
  "$status = [ordered]@{ booted_at = $os.LastBootUpTime.ToUniversalTime().ToString('o') }",
  "if ($null -ne $cpu) { $status.cpu_percent = [math]::Min(100, [int]$cpu) }",
  "if ($null -ne $gpu) { $status.gpu_percent = $gpu }",
  "$status.memory_total_mb = [int]($os.TotalVisibleMemorySize / 1024)",
  "$status.memory_used_mb = [int](($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) / 1024)",
  "return $status",
  "}",
];
const hardwareScanScript = [
  "& {",
  "$ErrorActionPreference = 'SilentlyContinue'",
  ...hardwareMachineNameFunction,
  ...hardwareScanFunction,
  "$report = [ordered]@{ machine = Get-BitsMachineName; components = @(Get-BitsHardware) }",
  "$json = ConvertTo-Json -InputObject $report -Depth 4",
  "$json | Set-Clipboard",
  "$json",
  "Write-Host ('Copied ' + $report.components.Count + ' hardware rows for ' + $report.machine + ' to the clipboard.') -ForegroundColor Green",
  "}",
].join("\n");
// Bash for Linux / Unraid; run as root for RAM details. Prints JSON only.
const hardwareLinuxScanScript = [
  "bash <<'BITS_SCAN'",
  "# BitsofBits hardware scan for Linux / Unraid. Prints JSON; uploads nothing and",
  "# collects no serial numbers or hostname.",
  "export LC_ALL=C",
  "row() { printf '%s\\t%s\\t%s\\n' \"$1\" \"${2//$'\\t'/ }\" \"${3//$'\\t'/ }\"; }",
  "blank() { case \"$1\" in ''|*'To be filled'*|*'Default string'*|*'Not Specified'*|*'System Product'*) return 0;; esac; return 1; }",
  "{",
  "  cpu=$(awk -F': ' '/^model name/ {print $2; exit}' /proc/cpuinfo)",
  "  [ -n \"$cpu\" ] || cpu=$(lscpu 2>/dev/null | awk -F': *' '/^Model name/ {print $2; exit}')",
  "  if [ -n \"$cpu\" ]; then",
  "    threads=$(grep -c '^processor' /proc/cpuinfo)",
  "    cores=$(lscpu -p=core,socket 2>/dev/null | grep -v '^#' | sort -u | wc -l)",
  "    sockets=$(lscpu -p=socket 2>/dev/null | grep -v '^#' | sort -u | wc -l)",
  "    mhz=$(lscpu 2>/dev/null | awk -F': *' '/^CPU max MHz/ {print $2; exit}')",
  "    detail=\"$cores cores / $threads threads\"",
  "    [ \"${cores:-0}\" -gt 0 ] || detail=\"$threads threads\"",
  "    [ -n \"$mhz\" ] && detail=\"$detail, $(awk -v m=\"$mhz\" 'BEGIN {printf \"%.2f GHz max\", m / 1000}')\"",
  "    [ \"${sockets:-1}\" -gt 1 ] && detail=\"$sockets sockets, $detail\"",
  "    row CPU \"$cpu\" \"$detail\"",
  "  fi",
  "",
  "  mem=\"\"",
  "  if [ \"$(id -u)\" = 0 ] && command -v dmidecode >/dev/null 2>&1; then",
  "    mem=$(dmidecode -t 17 2>/dev/null | awk '",
  "      function flush() {",
  "        if (size > 0) {",
  "          n++; total += size",
  "          if (n == 1) { fsize = size; ftype = type; fspeed = (cfg > 0 ? cfg : speed); fmfr = mfr }",
  "        }",
  "        size = 0; type = \"\"; speed = 0; cfg = 0; mfr = \"\"",
  "      }",
  "      /^Memory Device/ { flush(); next }",
  "      /^\\t[A-Za-z ]+: / {",
  "        key = $0; sub(/^\\t/, \"\", key); value = key",
  "        sub(/: .*/, \"\", key); sub(/^[^:]*: /, \"\", value)",
  "        if (key == \"Size\") {",
  "          if (value ~ / GB/) size = value + 0",
  "          else if (value ~ / MB/) size = (value + 0) / 1024",
  "          else if (value ~ / TB/) size = (value + 0) * 1024",
  "        } else if (key == \"Type\") type = value",
  "        else if (key == \"Speed\") speed = value + 0",
  "        else if (key ~ /^Configured (Memory|Clock) Speed$/) cfg = value + 0",
  "        else if (key == \"Manufacturer\") mfr = value",
  "      }",
  "      END {",
  "        flush()",
  "        if (n) {",
  "          detail = sprintf(\"%d x %g GB\", n, fsize)",
  "          if (ftype ~ /^[A-Za-z0-9]/ && (ftype ~ /Unknown|Other/) == 0) detail = detail \" \" ftype",
  "          if (fspeed > 0) detail = detail \" @ \" fspeed \" MT/s\"",
  "          if (fmfr ~ /[A-Za-z]/ && (fmfr ~ /Unknown|Not Specified/) == 0) detail = detail \" \" fmfr",
  "          printf \"%g GB\\t%s\\n\", total, detail",
  "        }",
  "      }')",
  "  fi",
  "  if [ -n \"$mem\" ]; then",
  "    row RAM \"${mem%%$'\\t'*}\" \"${mem#*$'\\t'}\"",
  "  else",
  "    row RAM \"$(awk '/^MemTotal/ {printf \"%d GB\", $2 / 1048576 + 0.5}' /proc/meminfo)\" \"\"",
  "  fi",
  "",
  "  vendor=$(cat /sys/class/dmi/id/board_vendor 2>/dev/null)",
  "  board=$(cat /sys/class/dmi/id/board_name 2>/dev/null)",
  "  blank \"$vendor\" && vendor=\"\"",
  "  blank \"$board\" || row MOTHERBOARD \"$vendor $board\" \"\"",
  "",
  "  # Link speeds by PCI address, for network cards.",
  "  links=\"\"",
  "  for dev in /sys/class/net/*/device; do",
  "    [ -e \"$dev\" ] || continue",
  "    iface=${dev%/device}",
  "    speed=$(cat \"$iface/speed\" 2>/dev/null)",
  "    links=\"$links$(basename \"$(readlink -f \"$dev\")\") ${speed:--1}\"$'\\n'",
  "  done",
  "  if command -v lspci >/dev/null 2>&1; then",
  "    lspci -Dmm 2>/dev/null | while IFS= read -r line; do",
  "      slot=${line%% *}",
  "      class=$(printf '%s' \"$line\" | awk -F'\"' '{print $2}')",
  "      case \"$class\" in",
  "        *VGA*|*3D*|*Display*) kind=GPU ;;",
  "        *Ethernet*|*Network*) kind=NETWORK ;;",
  "        *) continue ;;",
  "      esac",
  "      name=$(printf '%s' \"$line\" | awk -F'\"' '",
  "        function short(s, b) {",
  "          if (match(s, /\\[[^]]+\\]$/)) return substr(s, RSTART + 1, RLENGTH - 2)",
  "          return s",
  "        }",
  "        {",
  "          v = $4; d = $6",
  "          if (match(v, /\\[[^]]+\\]/)) v = substr(v, RSTART + 1, RLENGTH - 2)",
  "          sub(/,? (Corporation|Corp\\.|Inc\\.|Co\\., Ltd\\.|Technology.*|Semiconductor.*)$/, \"\", v)",
  "          d = short(d)",
  "          print (index(d, v) == 1 ? d : v \" \" d)",
  "        }')",
  "      detail=\"\"",
  "      if [ \"$kind\" = NETWORK ]; then",
  "        speed=$(printf '%s' \"$links\" | awk -v s=\"$slot\" '$1 == s {print $2; exit}')",
  "        if [ \"${speed:--1}\" -gt 0 ] 2>/dev/null; then",
  "          if [ \"$speed\" -ge 1000 ]; then detail=\"$((speed / 1000)) GbE link\"; else detail=\"$speed Mb/s link\"; fi",
  "        fi",
  "      fi",
  "      row \"$kind\" \"$name\" \"$detail\"",
  "    done",
  "  fi",
  "",
  "  lsblk -dbn -P -o NAME,TYPE,SIZE,ROTA,TRAN,MODEL 2>/dev/null | awk '",
  "    function hex(c) { return index(\"0123456789abcdef\", tolower(c)) - 1 }",
  "    function get(k,   s, out) {",
  "      if (match($0, \"(^| )\" k \"=\\\"([^\\\"\\\\\\\\]|\\\\\\\\.)*\\\"\") == 0) return \"\"",
  "      s = substr($0, RSTART, RLENGTH); sub(/^ /, \"\", s)",
  "      s = substr(s, length(k) + 3, length(s) - length(k) - 3)",
  "      out = \"\"",
  "      while (match(s, /\\\\x[0-9A-Fa-f][0-9A-Fa-f]/)) {",
  "        out = out substr(s, 1, RSTART - 1) sprintf(\"%c\", hex(substr(s, RSTART + 2, 1)) * 16 + hex(substr(s, RSTART + 3, 1)))",
  "        s = substr(s, RSTART + RLENGTH)",
  "      }",
  "      return out s",
  "    }",
  "    {",
  "      name = get(\"NAME\"); tran = get(\"TRAN\"); model = get(\"MODEL\")",
  "      if ((get(\"TYPE\") == \"disk\") == 0 || name ~ /^(loop|zram|ram|md|nbd|dm-)/) next",
  "      bytes = get(\"SIZE\") + 0",
  "      if (bytes <= 0) next",
  "      if (bytes >= 1e12) { size = sprintf(\"%.1f TB\", bytes / 1e12); sub(/\\.0 TB$/, \" TB\", size) }",
  "      else size = sprintf(\"%d GB\", bytes / 1e9 + 0.5)",
  "      if (tran == \"nvme\") kind = \"NVMe SSD\"",
  "      else if (tran == \"usb\") kind = \"USB\"",
  "      else if (get(\"ROTA\") == \"1\") kind = \"HDD / \" toupper(tran)",
  "      else kind = \"SSD / \" toupper(tran)",
  "      sub(/ \\/ $/, \"\", kind)",
  "      if (model == \"\") model = \"Disk\"",
  "      printf \"STORAGE\\t%s\\t%s / %s\\n\", model, size, kind",
  "    }'",
  "",
  "  kernel=\"Linux $(uname -r)\"",
  "  if [ -f /etc/unraid-version ]; then",
  "    row OS \"Unraid OS $(sed -n 's/^version=\"\\(.*\\)\"/\\1/p' /etc/unraid-version)\" \"$kernel\"",
  "  elif [ -f /etc/os-release ]; then",
  "    row OS \"$(. /etc/os-release; printf '%s' \"${PRETTY_NAME:-$NAME}\")\" \"$kernel\"",
  "  else",
  "    row OS \"$kernel\" \"\"",
  "  fi",
  "} | awk -F'\\t' '",
  "  function trim(s) { gsub(/[[:space:]]+/, \" \", s); sub(/^ /, \"\", s); sub(/ $/, \"\", s); return s }",
  "  function esc(s) { gsub(/[\\\\\"]/, \"\\\\\\\\&\", s); gsub(/[\\001-\\037]/, \"\", s); return s }",
  "  {",
  "    c = trim($1); n = trim($2); d = trim($3)",
  "    if (c == \"\" || n == \"\") next",
  "    # Multi-port network cards share one row; keep the port that has a link.",
  "    k = c SUBSEP n SUBSEP (c == \"NETWORK\" ? \"\" : d)",
  "    if ((k in count) == 0) { order[++m] = k; comp[k] = c; nm[k] = n; det[k] = d }",
  "    else if (det[k] == \"\") det[k] = d",
  "    count[k]++",
  "  }",
  "  END {",
  "    printf \"[\"",
  "    for (i = 1; i <= m; i++) {",
  "      k = order[i]; d = det[k]",
  "      if (count[k] > 1 && comp[k] == \"NETWORK\") d = count[k] \" ports\" (d == \"\" ? \"\" : \", \" d)",
  "      else if (count[k] > 1) d = count[k] \" x \" d",
  "      printf \"%s{\\\"component\\\":\\\"%s\\\",\\\"name\\\":\\\"%s\\\",\\\"detail\\\":\\\"%s\\\"}\", (i > 1 ? \",\" : \"\"), esc(comp[k]), esc(nm[k]), esc(trim(d))",
  "    }",
  "    print \"]\"",
  "    printf \"\\nScanned %d hardware rows. Copy the JSON line above into Admin.\\n\", m > \"/dev/stderr\"",
  "  }'",
  "BITS_SCAN",
].join("\n");
const hardwareAgentTaskName = "BitsHardwareAgent";
const hardwareAgentUninstallScript = [
  `Unregister-ScheduledTask -TaskName '${hardwareAgentTaskName}' -Confirm:$false -ErrorAction SilentlyContinue`,
  `Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*\\${hardwareAgentTaskName}\\agent.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`,
  `Remove-Item (Join-Path $env:LOCALAPPDATA '${hardwareAgentTaskName}') -Recurse -Force -ErrorAction SilentlyContinue`,
  "Write-Host 'Hardware agent removed.' -ForegroundColor Green",
].join("\n");

function getHardwareSyncEndpoint() {
  return `${window.SUPABASE_CONFIG.url.replace(/\/$/, "")}/functions/v1/hardware-sync`;
}

// The agent posts lightweight status pulses straight to PostgREST: every 3 seconds
// while someone has HARDWARE.SYS open, otherwise every 15 seconds. Full specs go
// through the hardware-sync Edge Function at start and every six hours. Its
// device token is stored DPAPI-encrypted for the current user.
function buildHardwareAgentScript() {
  const baseUrl = window.SUPABASE_CONFIG.url.replace(/\/$/, "");
  return [
    "$ErrorActionPreference = 'SilentlyContinue'",
    `$endpoint = '${getHardwareSyncEndpoint()}'`,
    `$pulseUri = '${baseUrl}/rest/v1/rpc/hardware_agent_pulse'`,
    `$apiKey = '${window.SUPABASE_CONFIG.anonKey}'`,
    "$dir = Split-Path -Parent $MyInvocation.MyCommand.Path",
    "$log = Join-Path $dir 'agent.log'",
    "$secure = Get-Content (Join-Path $dir 'token.dat') | ConvertTo-SecureString",
    "$token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))",
    "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12",
    ...hardwareMachineNameFunction,
    ...hardwareScanFunction,
    ...hardwareStatusFunction,
    "function Write-AgentLog($text) { Set-Content -Path $log -Value ((Get-Date).ToString('s') + ' ' + $text) }",
    "$nextSpecs = [datetime]::MinValue",
    "$watched = $false",
    "while ($true) {",
    "  $started = Get-Date",
    "  $status = Get-BitsStatus",
    "  try {",
    "    if ($started -ge $nextSpecs) {",
    "      $report = [ordered]@{ machine_name = Get-BitsMachineName; status = $status; components = @(Get-BitsHardware) }",
    "      $bytes = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $report -Depth 4 -Compress))",
    "      $result = Invoke-RestMethod -Method Post -Uri $endpoint -Headers @{ 'x-device-token' = $token } -ContentType 'application/json; charset=utf-8' -Body $bytes -TimeoutSec 30",
    "      if ($result.specs) { $nextSpecs = (Get-Date).AddHours(6) } else { $nextSpecs = (Get-Date).AddMinutes(6) }",
    "    } else {",
    "      $pulse = [ordered]@{ p_token = $token; p_status = $status }",
    "      $bytes = [Text.Encoding]::UTF8.GetBytes((ConvertTo-Json -InputObject $pulse -Depth 4 -Compress))",
    "      $result = Invoke-RestMethod -Method Post -Uri $pulseUri -Headers @{ apikey = $apiKey } -ContentType 'application/json; charset=utf-8' -Body $bytes -TimeoutSec 15",
    "      if ($result.error -eq 'invalid_token') { Write-AgentLog 'ERROR Device token was revoked.'; exit 1 }",
    "      $watched = [bool]$result.watched",
    "    }",
    "    Write-AgentLog ('OK ' + (ConvertTo-Json -InputObject $result -Compress))",
    "  } catch {",
    "    $code = 0",
    "    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }",
    "    Write-AgentLog ('ERROR ' + $code + ' ' + $_.Exception.Message)",
    "    if ($code -eq 401) { exit 1 }",
    "    $watched = $false",
    "  }",
    "  $interval = 15",
    "  if ($watched) { $interval = 3 }",
    "  $wait = $interval - ((Get-Date) - $started).TotalSeconds",
    "  Start-Sleep -Milliseconds ([int]([math]::Max(0.5, $wait) * 1000))",
    "}",
  ].join("\n");
}
function buildHardwareAgentInstaller() {
  return [
    "& {",
    "$ErrorActionPreference = 'Stop'",
    `$dir = Join-Path $env:LOCALAPPDATA '${hardwareAgentTaskName}'`,
    "$tokenFile = Join-Path $dir 'token.dat'",
    "$hasToken = Test-Path $tokenFile",
    "$prompt = 'Paste the device token from Admin'",
    "if ($hasToken) { $prompt += ' (or press Enter to keep the saved token)' }",
    "$secure = Read-Host -AsSecureString $prompt",
    "if ($secure.Length -eq 0 -and -not $hasToken) { throw 'No device token entered.' }",
    "New-Item -ItemType Directory -Force -Path $dir | Out-Null",
    "if ($secure.Length -gt 0) { $secure | ConvertFrom-SecureString | Set-Content -Path $tokenFile }",
    "$agent = @'",
    buildHardwareAgentScript(),
    "'@",
    "Set-Content -Path (Join-Path $dir 'agent.ps1') -Value $agent -Encoding UTF8",
    "$argument = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File \"' + (Join-Path $dir 'agent.ps1') + '\"'",
    // -WindowStyle Hidden is ignored when Windows Terminal is the default console,
    // so a headless conhost hosts the agent without ever creating a window.
    "if ([Environment]::OSVersion.Version.Build -ge 17763) {",
    "  $action = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\\conhost.exe') -Argument ('--headless powershell.exe ' + $argument)",
    "} else {",
    "  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argument",
    "}",
    "$trigger = New-ScheduledTaskTrigger -AtLogOn -User ($env:USERDOMAIN + '\\' + $env:USERNAME)",
    "$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)",
    `Register-ScheduledTask -TaskName '${hardwareAgentTaskName}' -Action $action -Trigger $trigger -Settings $settings -Description 'Reports hardware specs and live status to shortbits.net' -Force | Out-Null`,
    `Stop-ScheduledTask -TaskName '${hardwareAgentTaskName}'`,
    `Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*\\${hardwareAgentTaskName}\\agent.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    `Start-ScheduledTask -TaskName '${hardwareAgentTaskName}'`,
    "Write-Host ('Hardware agent installed. Status log: ' + (Join-Path $dir 'agent.log')) -ForegroundColor Green",
    "}",
  ].join("\n");
}

function createHardwareDeviceToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const base64 = btoa(String.fromCharCode(...bytes));
  return `sbhw_${base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function copyAdminText(text, fallbackField) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    fallbackField.select();
    document.execCommand("copy");
  }
}

function formatHardwareSeen(value) {
  if (!value) {
    return "never reported";
  }
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  const state = seconds < 180 ? "ONLINE" : "OFFLINE";
  if (seconds < 120) {
    return `${state} // seen ${seconds}s ago`;
  }
  return `${state} // last seen ${new Date(value).toLocaleString()}`;
}

async function loadHardwareDevices() {
  const { data, error } = await adminClient
    .from("site_hardware_devices")
    .select("id, machine, name_pending, created_at, last_seen_at, last_specs_at")
    .order("machine", { ascending: true });

  if (error) {
    console.error("Unable to load hardware agents:", error);
    setAdminStatus(hardwareDeviceStatus, `Hardware agents failed to load: ${error.message}`, "error");
    return false;
  }

  hardwareDevices.replaceChildren(...data.map((device) => {
    const item = document.createElement("li");
    const copy = document.createElement("span");
    const name = document.createElement("strong");
    const meta = document.createElement("small");
    const revoke = document.createElement("button");
    name.textContent = device.machine;
    meta.textContent = device.name_pending
      ? "Names itself on first sync"
      : formatHardwareSeen(device.last_seen_at);
    copy.append(name, meta);
    revoke.type = "button";
    revoke.className = "repeatable-entry-remove";
    revoke.textContent = "REVOKE";
    revoke.setAttribute("aria-label", `Revoke hardware agent token for ${device.machine}`);
    const rename = document.createElement("button");
    rename.type = "button";
    rename.textContent = "RENAME";
    rename.setAttribute("aria-label", `Rename ${device.machine}`);
    rename.addEventListener("click", async () => {
      const next = window.prompt(`Rename ${device.machine} to:`, device.machine)?.trim().slice(0, 60);
      if (!next || next === device.machine) {
        return;
      }
      const conflict = [...hardwareAgentMachines].find((machine) => (
        machine !== device.machine && normalizeHardwareMachine(machine) === normalizeHardwareMachine(next)
      ));
      if (conflict) {
        setAdminStatus(hardwareDeviceStatus, `${conflict} already has an agent. Pick another name.`, "error");
        return;
      }
      setAdminStatus(hardwareDeviceStatus, `Renaming ${device.machine}...`);
      const renameError = await renameHardwareMachine(device.machine, next, { device: true, rows: true });
      if (renameError) {
        setAdminStatus(hardwareDeviceStatus, `Rename failed: ${renameError.message}`, "error");
        return;
      }
      clearPublicContentCache();
      await loadHardwareDevices();
      await loadHardware();
      setAdminStatus(hardwareDeviceStatus, `${device.machine} renamed to ${next}. The agent keeps syncing under the new name.`, "success");
    });
    const actions = document.createElement("span");
    actions.className = "hardware-device-actions";
    actions.append(rename, revoke);
    revoke.addEventListener("click", async () => {
      if (!window.confirm(`Revoke the agent token for ${device.machine}? Its live status disappears and the agent stops syncing. Synced spec rows stay.`)) {
        return;
      }
      const { error: deleteError } = await adminClient
        .from("site_hardware_devices")
        .delete()
        .eq("id", device.id);
      if (deleteError) {
        setAdminStatus(hardwareDeviceStatus, `Revoke failed: ${deleteError.message}`, "error");
        return;
      }
      clearPublicContentCache();
      await loadHardwareDevices();
      setAdminStatus(hardwareDeviceStatus, `Token for ${device.machine} revoked.`, "success");
    });
    item.append(copy, actions);
    return item;
  }));
  hardwareDevices.hidden = data.length === 0;
  hardwareAgentMachines = new Set(data.map((device) => device.machine));
  refreshHardwareMachineCards();
  return true;
}

// Renames the agent's device row (which cascades to its live status) and/or the published rows.
async function renameHardwareMachine(from, to, { device = false, rows = false } = {}) {
  if (device) {
    const { error } = await adminClient
      .from("site_hardware_devices")
      .update({ machine: to, name_pending: false })
      .eq("machine", from);
    if (error) {
      return error.code === "23505" ? new Error(`${to} already has an agent.`) : error;
    }
  }
  if (rows) {
    const { error } = await adminClient
      .from("site_hardware")
      .update({ machine: to, updated_at: new Date().toISOString() })
      .eq("machine", from);
    if (error) {
      return error;
    }
  }
  return null;
}

function createHardwareDeviceSuffix() {
  return Array.from(crypto.getRandomValues(new Uint8Array(2)), (byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

async function createHardwareDevice() {
  const typed = hardwareDeviceMachine.value.trim().slice(0, 60);
  // Without a name, the agent names the device on its first report.
  const machine = typed || `New device ${createHardwareDeviceSuffix()}`;
  hardwareDeviceCreate.disabled = true;
  const token = createHardwareDeviceToken();
  const { error } = await adminClient
    .from("site_hardware_devices")
    .insert({ machine, name_pending: !typed, token_hash: await sha256Hex(token) });
  hardwareDeviceCreate.disabled = false;

  if (error) {
    const message = error.code === "23505"
      ? `${machine} already has an agent token. Revoke it first to issue a new one.`
      : `Token creation failed: ${error.message}`;
    setAdminStatus(hardwareDeviceStatus, message, "error");
    return;
  }
  hardwareDeviceMachine.value = "";
  hardwareDeviceToken.value = token;
  hardwareDeviceTokenOutput.hidden = false;
  hardwareDeviceToken.select();
  await loadHardwareDevices();
  setAdminStatus(
    hardwareDeviceStatus,
    typed
      ? `Token created for ${machine}. Copy it now, then run the installer on that machine.`
      : "Token created. Copy it now, then run the installer; the machine names itself on its first sync.",
    "success",
  );
}
const blogPostForm = document.querySelector("#blog-post-form");
const blogPostSave = document.querySelector("#blog-post-save");
const blogPostDelete = document.querySelector("#blog-post-delete");
const blogPostNew = document.querySelector("#blog-post-new");
const blogAdminStatus = document.querySelector("#blog-admin-status");
const blogAdminList = document.querySelector("#blog-admin-list");
const blogPostMarkdown = document.querySelector("#blog-post-markdown");
const blogMarkdownPreview = document.querySelector("#blog-markdown-preview");
const blogFormatBlock = document.querySelector("#blog-format-block");
const blogFormatColor = document.querySelector("#blog-format-color");
const blogFormatFont = document.querySelector("#blog-format-font");
const blogFormatSize = document.querySelector("#blog-format-size");
const blogImageUrl = document.querySelector("#blog-image-url");
const blogImageUpload = document.querySelector("#blog-image-upload");
const blogImageDialog = document.querySelector("#blog-image-dialog");
const blogImageForm = document.querySelector("#blog-image-form");
const shortLinkCreateForm = document.querySelector("#short-link-create-form");
const shortLinkCreate = document.querySelector("#short-link-create");
const shortLinkGenerate = document.querySelector("#short-link-generate");
const shortLinksRefresh = document.querySelector("#short-links-refresh");
const shortLinksAdminStatus = document.querySelector("#short-links-admin-status");
const shortLinksList = document.querySelector("#short-links-list");
const spotifyPlaylistUrlPattern =
  /^https:\/\/open\.spotify\.com\/playlist\/[A-Za-z0-9]+(?:\?.*)?$/;
const spotifyTrackUrlPattern =
  /^https:\/\/open\.spotify\.com\/track\/[A-Za-z0-9]+(?:\?.*)?$/;
const httpsUrlPattern = /^https:\/\/\S+$/;
const shortLinkSlugPattern = /^[a-z0-9][a-z0-9_-]{2,63}$/;
const blogSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const pronounProfileFields = [
  "display_name",
  "subject_pronoun",
  "object_pronoun",
  "possessive_determiner",
  "possessive_pronoun",
  "reflexive_pronoun",
  "honorifics",
  "gendered_terms",
  "compliments",
  "relationship_terms",
];
const resumeProfileFields = [
  "headline",
  "summary",
  "availability",
  "location",
  "resume_url",
];
const nowFields = [
  "headline",
  "summary",
  "building",
  "learning",
  "playing",
  "reading",
];
const repeatableEditors = {
  playlists: {
    table: "spotify_featured_playlists",
    container: playlistSlots,
    addButton: playlistAdd,
    status: playlistAdminStatus,
    itemName: "playlist",
    fields: [
      { key: "title", label: "TITLE", maxLength: 100 },
      { key: "spotify_url", label: "SPOTIFY URL", type: "url" },
    ],
  },
  tracks: {
    table: "spotify_featured_tracks",
    container: trackSlots,
    addButton: trackAdd,
    status: trackAdminStatus,
    itemName: "song",
    fields: [
      { key: "title", label: "TITLE", maxLength: 100 },
      { key: "artist", label: "ARTIST", maxLength: 100 },
      { key: "spotify_url", label: "SPOTIFY URL", type: "url" },
    ],
  },
  resume: {
    table: "site_resume_entries",
    container: resumeEntrySlots,
    addButton: resumeEntryAdd,
    status: resumeAdminStatus,
    itemName: "experience",
    fields: [
      { key: "role", label: "ROLE", maxLength: 120 },
      { key: "organization", label: "ORGANIZATION", maxLength: 120 },
      { key: "period", label: "PERIOD", maxLength: 100 },
      { key: "summary", label: "SUMMARY", maxLength: 1000, multiline: true },
      { key: "technologies", label: "TECHNOLOGIES", maxLength: 300 },
    ],
  },
  education: {
    table: "site_resume_education",
    container: resumeEducationSlots,
    addButton: resumeEducationAdd,
    status: resumeAdminStatus,
    itemName: "education",
    selectFields: "position, school, credential, period, details, enabled",
    fields: [
      { key: "school", label: "SCHOOL", maxLength: 120 },
      { key: "credential", label: "DEGREE / CREDENTIAL", maxLength: 160 },
      { key: "period", label: "PERIOD", maxLength: 100 },
      { key: "details", label: "DETAILS (OPTIONAL)", maxLength: 600, multiline: true },
    ],
  },
  certifications: {
    table: "site_resume_certifications",
    container: resumeCertificationSlots,
    addButton: resumeCertificationAdd,
    status: resumeAdminStatus,
    itemName: "certification",
    selectFields: "position, name, issuer, issued, credential_id, credential_url, enabled",
    fields: [
      { key: "name", label: "CERTIFICATION", maxLength: 160 },
      { key: "issuer", label: "ISSUER", maxLength: 120 },
      { key: "issued", label: "ISSUED (E.G. JAN 2023)", maxLength: 100 },
      { key: "credential_id", label: "CREDENTIAL ID (OPTIONAL)", maxLength: 100 },
      { key: "credential_url", label: "VERIFY URL (OPTIONAL)", type: "url" },
    ],
  },
  changelog: {
    table: "site_changelog",
    container: changelogSlots,
    addButton: changelogEntryAdd,
    status: changelogAdminStatus,
    itemName: "change",
    fields: [
      { key: "entry_date", label: "DATE", type: "date" },
      { key: "title", label: "TITLE", maxLength: 120 },
      { key: "summary", label: "SUMMARY", maxLength: 800, multiline: true },
    ],
  },
  games: {
    table: "site_favorite_games",
    container: gamesSlots,
    addButton: gamesEntryAdd,
    status: gamesAdminStatus,
    itemName: "game",
    fields: [
      { key: "title", label: "TITLE", maxLength: 120 },
      { key: "platform", label: "PAGE LABEL", maxLength: 80 },
      { key: "store_url", label: "STORE / OFFICIAL URL", type: "url", maxLength: 500 },
      { key: "note", label: "NOTE", maxLength: 500, multiline: true },
    ],
  },
  creators: {
    table: "site_creators",
    container: creatorsSlots,
    addButton: creatorsEntryAdd,
    status: creatorsAdminStatus,
    itemName: "creator",
    fields: [
      { key: "title", label: "CREATOR NAME", maxLength: 120 },
      { key: "platform", label: "PLATFORM (E.G. YOUTUBE, TWITCH)", maxLength: 80 },
      { key: "channel_url", label: "CHANNEL / PROFILE URL (HTTPS)", type: "url", maxLength: 500 },
      { key: "youtube_channel_id", label: "YOUTUBE CHANNEL ID (OPTIONAL, UC...)", maxLength: 24 },
      { key: "note", label: "NOTE (OPTIONAL)", maxLength: 500, multiline: true },
      { key: "sort_order", label: "DISPLAY ORDER (LOWER NUMBERS FIRST)", type: "number", defaultValue: "0" },
    ],
  },
  hardware: {
    table: "site_hardware",
    container: hardwareSlots,
    addButton: hardwareEntryAdd,
    status: hardwareAdminStatus,
    itemName: "hardware item",
    // Rendered by the machine-grouped hardware editor instead of generic cards.
    custom: true,
    fields: [
      { key: "machine", label: "MACHINE (E.G. DESKTOP)", maxLength: 60 },
      { key: "component", label: "COMPONENT (E.G. CPU)", maxLength: 40 },
      { key: "name", label: "NAME", maxLength: 160 },
      { key: "detail", label: "DETAIL (OPTIONAL)", maxLength: 300, multiline: true },
    ],
  },
};

Object.values(repeatableEditors).forEach((editor) => {
  editor.deletedPositions = new Set();
  editor.maxPosition = 0;
});

let temporaryEntryId = 0;
let pendingBlogImagePath = "";

function createAdminField(labelText, name, options = {}) {
  const label = document.createElement("label");
  const labelCopy = document.createElement("span");
  const field = options.multiline
    ? document.createElement("textarea")
    : document.createElement("input");
  labelCopy.textContent = labelText;
  field.name = name;
  if (options.type) {
    field.type = options.type;
  }
  if (options.maxLength) {
    field.maxLength = options.maxLength;
  }
  if (options.fieldKey) {
    field.dataset.entryField = options.fieldKey;
  }
  field.value = options.value ?? "";
  label.append(labelCopy, field);
  return label;
}

function createAdminCheckbox(labelText, name, options = {}) {
  const label = document.createElement("label");
  const checkbox = document.createElement("input");
  const copy = document.createElement("span");
  label.className = "admin-checkbox";
  checkbox.type = "checkbox";
  checkbox.name = name;
  checkbox.checked = options.checked === true;
  if (options.fieldKey) {
    checkbox.dataset.entryField = options.fieldKey;
  }
  copy.textContent = labelText;
  label.append(checkbox, copy);
  return label;
}

function createRepeatableEntry(editor, entry = {}) {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  const entryKey = entry.position
    ? `position-${entry.position}`
    : `new-${temporaryEntryId += 1}`;
  fieldset.dataset.entryKey = entryKey;
  if (entry.position) {
    fieldset.dataset.position = String(entry.position);
  }
  legend.textContent = entry.position ? `ENTRY ${entry.position}` : "NEW ENTRY";
  if (entry.source_key) {
    legend.textContent += " // AGENT";
  }
  fieldset.append(legend);
  editor.fields.forEach((field) => {
    fieldset.append(createAdminField(
      field.label,
      `${editor.itemName}_${entryKey}_${field.key}`,
      {
        ...field,
        fieldKey: field.key,
        value: entry[field.key] ?? field.defaultValue,
      },
    ));
  });
  if (editor === repeatableEditors.creators) {
    const lookup = document.createElement("button");
    const lookupStatus = document.createElement("p");
    lookup.type = "button";
    lookup.className = "creator-channel-lookup";
    lookup.textContent = "LOOK UP YOUTUBE CHANNEL";
    lookupStatus.className = "form-status";
    lookupStatus.setAttribute("role", "status");
    lookupStatus.setAttribute("aria-live", "polite");
    lookup.addEventListener("click", async () => {
      const channel = fieldset.querySelector('[data-entry-field="channel_url"]');
      const id = fieldset.querySelector('[data-entry-field="youtube_channel_id"]');
      const originalUrl = channel.value;
      const originalId = id.value;
      lookup.disabled = true;
      setAdminStatus(lookupStatus, "Looking up YouTube channel...");
      try {
        const { data, error } = await adminClient.functions.invoke("creator-videos", {
          body: { channelUrl: channel.value.trim() || id.value.trim() },
        });
        if (error) throw error;
        if (!data || !/^UC[A-Za-z0-9_-]{22}$/.test(data.channelId)) {
          throw new Error("YouTube did not return a valid channel ID.");
        }
        if (channel.value !== originalUrl || id.value !== originalId) {
          setAdminStatus(lookupStatus, "Channel fields changed during lookup. Run the lookup again.", "warning");
          return;
        }
        id.value = data.channelId;
        channel.value = `https://www.youtube.com/channel/${data.channelId}`;
        const platform = fieldset.querySelector('[data-entry-field="platform"]');
        if (!platform.value.trim()) platform.value = "YouTube";
        setAdminStatus(lookupStatus, "YouTube channel ID filled in. Save creators to publish uploads and the channel photo.", "success");
      } catch (error) {
        console.error("Unable to look up YouTube channel:", error);
        setAdminStatus(lookupStatus, `Channel lookup failed: ${error.message} Check the channel URL or @handle, or enter the UC... ID manually.`, "error");
      } finally {
        lookup.disabled = false;
      }
    });
    fieldset.append(lookup, lookupStatus);
  }
  fieldset.append(createAdminCheckbox(
    "ENABLED",
    `${editor.itemName}_${entryKey}_enabled`,
    { checked: entry.enabled, fieldKey: "enabled" },
  ));

  const actions = document.createElement("div");
  const removeButton = document.createElement("button");
  actions.className = "repeatable-entry-actions";
  removeButton.type = "button";
  removeButton.className = "repeatable-entry-remove";
  removeButton.textContent = "REMOVE";
  removeButton.setAttribute(
    "aria-label",
    `Remove ${editor.itemName} ${entry.position ?? "entry"}`,
  );
  removeButton.addEventListener("click", () => {
    if (entry.position) {
      editor.deletedPositions.add(entry.position);
    }
    fieldset.remove();
    setAdminStatus(
      editor.status,
      `${editor.itemName[0].toUpperCase()}${editor.itemName.slice(1)} removed. Save to persist this change.`,
    );
  });
  actions.append(removeButton);
  fieldset.append(actions);
  return fieldset;
}

function renderRepeatableEntries(editor, entries) {
  editor.container.replaceChildren();
  editor.deletedPositions.clear();
  editor.maxPosition = entries.reduce(
    (maximum, entry) => Math.max(maximum, entry.position),
    0,
  );
  entries.forEach((entry) => {
    editor.container.append(createRepeatableEntry(editor, entry));
  });
}

function collectRepeatableEntries(editor) {
  return Array.from(editor.container.querySelectorAll("fieldset")).map(
    (fieldset) => {
      const entry = {
        position: fieldset.dataset.position
          ? Number(fieldset.dataset.position)
          : null,
      };
      editor.fields.forEach((field) => {
        entry[field.key] = fieldset
          .querySelector(`[data-entry-field="${field.key}"]`)
          .value
          .trim();
      });
      entry.enabled = fieldset
        .querySelector('[data-entry-field="enabled"]')
        .checked;
      return entry;
    },
  );
}

async function syncRepeatableEntries(editor, entries, updatedAt) {
  let nextPosition = editor.maxPosition;
  const changes = entries.map((entry) => {
    const values = Object.fromEntries(
      editor.fields.map((field) => [
        field.key,
        field.type === "number" ? Number(entry[field.key]) : entry[field.key] || null,
      ]),
    );
    const payload = {
      ...values,
      enabled: entry.enabled,
      updated_at: updatedAt,
    };
    if (entry.position) {
      return adminClient
        .from(editor.table)
        .update(payload)
        .eq("position", entry.position);
    }
    nextPosition += 1;
    return adminClient
      .from(editor.table)
      .insert({ position: nextPosition, ...payload });
  });
  editor.deletedPositions.forEach((position) => {
    changes.push(
      adminClient
        .from(editor.table)
        .delete()
        .eq("position", position),
    );
  });
  const results = await Promise.all(changes);
  return results.find((result) => result.error) ?? null;
}

Object.values(repeatableEditors).forEach((editor) => {
  if (editor.custom) {
    return;
  }
  editor.addButton.addEventListener("click", () => {
    const entry = createRepeatableEntry(editor);
    editor.container.append(entry);
    entry.querySelector("input, textarea")?.focus();
    setAdminStatus(
      editor.status,
      `New ${editor.itemName} added. Complete it, then save.`,
    );
  });
});

function setAdminStatus(element, message, state = "") {
  element.textContent = message;
  element.dataset.state = state;
}

function clearPublicContentCache() {
  localStorage.removeItem("bits-public-content-v1");
  localStorage.removeItem("bits-public-content-v2");
  localStorage.removeItem("bits-public-content-v3");
  localStorage.removeItem("bits-public-content-v4");
  localStorage.removeItem("bits-public-content-v5");
  localStorage.removeItem("bits-public-content-v6");
  localStorage.removeItem("bits-public-content-v7");
}

async function setMessageRead(message, read) {
  const { error } = await adminClient
    .from("messages")
    .update({ read })
    .eq("id", message.id);

  if (error) {
    console.error("Unable to update message:", error);
    setAdminStatus(inboxStatus, `Update failed: ${error.message}`, "error");
    return false;
  }

  return true;
}

async function deleteMessage(message) {
  if (!window.confirm(`Delete the message from ${message.name}?`)) {
    return false;
  }

  const { error } = await adminClient
    .from("messages")
    .delete()
    .eq("id", message.id);

  if (error) {
    console.error("Unable to delete message:", error);
    setAdminStatus(inboxStatus, `Delete failed: ${error.message}`, "error");
    return false;
  }

  return true;
}

function openMessagePanel(message) {
  const shell = window.BITS_ADMIN_SHELL;
  if (!shell) {
    return;
  }

  const content = document.createElement("div");
  const meta = document.createElement("dl");
  const body = document.createElement("p");
  const addMeta = (label, value) => {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = label;
    if (value instanceof Node) {
      detail.append(value);
    } else {
      detail.textContent = value;
    }
    row.append(term, detail);
    meta.append(row);
  };

  content.className = "ac-message-detail";
  meta.className = "ac-detail-list";
  addMeta("From", message.name);
  if (message.email) {
    const email = document.createElement("a");
    email.href = `mailto:${message.email}`;
    email.textContent = message.email;
    addMeta("Email", email);
  }
  addMeta("Received", new Date(message.created_at).toLocaleString());
  body.className = "ac-message-body";
  body.textContent = message.message;
  content.append(meta, body);

  const actions = [];
  if (message.email) {
    const reply = document.createElement("a");
    reply.className = "ac-button ac-primary";
    reply.href = `mailto:${message.email}?subject=${encodeURIComponent("Re: your message on shortbits.net")}`;
    reply.textContent = "Reply";
    actions.push(reply);
  }

  const unreadButton = document.createElement("button");
  unreadButton.type = "button";
  unreadButton.className = "ac-secondary";
  unreadButton.textContent = "Mark as unread";
  unreadButton.addEventListener("click", async () => {
    if (await setMessageRead(message, false)) {
      shell.closePanel();
      await loadMessages();
    }
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "ac-danger";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", async () => {
    if (await deleteMessage(message)) {
      shell.closePanel();
      await loadMessages();
    }
  });
  actions.push(unreadButton, deleteButton);

  shell.openPanel({
    title: message.name || "Message",
    content,
    actions,
    size: "medium",
  });

  if (!message.read) {
    setMessageRead(message, true).then((updated) => {
      if (updated) {
        message.read = true;
        loadMessages();
      }
    });
  }
}

function createMessageElement(message) {
  const article = document.createElement("article");
  article.className = `message-card${message.read ? "" : " is-unread"}`;

  const header = document.createElement("header");
  const identity = document.createElement("div");
  const name = document.createElement("h3");
  const timestamp = document.createElement("time");
  const body = document.createElement("p");
  const actions = document.createElement("div");

  name.textContent = message.name;
  timestamp.dateTime = message.created_at;
  timestamp.textContent = new Date(message.created_at).toLocaleString();
  body.className = "message-preview";
  body.textContent = message.message;
  identity.append(name, timestamp);

  if (message.email) {
    const email = document.createElement("a");
    email.href = `mailto:${message.email}`;
    email.textContent = message.email;
    identity.append(email);
  }

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.textContent = "Open";
  openButton.setAttribute("aria-label", `Open message from ${message.name}`);
  openButton.addEventListener("click", () => openMessagePanel(message));

  const readButton = document.createElement("button");
  readButton.type = "button";
  readButton.textContent = message.read ? "Mark as unread" : "Mark as read";
  readButton.addEventListener("click", async () => {
    if (await setMessageRead(message, !message.read)) {
      await loadMessages();
    }
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", async () => {
    if (await deleteMessage(message)) {
      await loadMessages();
    }
  });

  article.addEventListener("click", (event) => {
    if (event.target.closest("button, a")) {
      return;
    }
    openMessagePanel(message);
  });

  actions.className = "message-actions";
  actions.append(openButton, readButton, deleteButton);
  header.append(identity, actions);
  article.append(header, body);
  return article;
}
async function loadMessages() {
  setAdminStatus(inboxStatus, "Fetching encrypted packets...");

  const { data, error } = await adminClient
    .from("messages")
    .select("id, name, email, message, created_at, read")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Unable to load messages:", error);
    setAdminStatus(inboxStatus, `Inbox failed to load: ${error.message}`, "error");
    return;
  }

  messageList.replaceChildren();
  const unreadCount = data.filter((message) => !message.read).length;
  messageList.dataset.unread = String(unreadCount);
  window.dispatchEvent(new CustomEvent("admin:inbox-updated", { detail: { total: data.length, unread: unreadCount } }));

  if (data.length === 0) {
    setAdminStatus(inboxStatus, "No packets received yet.");
    return;
  }

  data.forEach((message) => {
    messageList.append(createMessageElement(message));
  });
  setAdminStatus(inboxStatus, `${data.length} packet${data.length === 1 ? "" : "s"} loaded.`, "success");
}

function createGuestbookAdminEntry(entry) {
  const article = document.createElement("article");
  const header = document.createElement("header");
  const identity = document.createElement("div");
  const name = document.createElement("h3");
  const timestamp = document.createElement("time");
  const message = document.createElement("p");
  const actions = document.createElement("div");
  const deleteButton = document.createElement("button");

  article.className = "message-card";
  name.textContent = entry.name;
  timestamp.dateTime = entry.created_at;
  timestamp.textContent = new Date(entry.created_at).toLocaleString();
  message.textContent = entry.message;
  deleteButton.type = "button";
  deleteButton.textContent = "DELETE";
  deleteButton.addEventListener("click", async () => {
    if (!window.confirm(`Delete the public Guestbook entry from ${entry.name}?`)) {
      return;
    }
    const { error } = await adminClient
      .from("site_guestbook")
      .delete()
      .eq("id", entry.id);
    if (error) {
      console.error("Unable to delete Guestbook entry:", error);
      setAdminStatus(
        guestbookAdminStatus,
        `Guestbook deletion failed: ${error.message}`,
        "error",
      );
      return;
    }
    await loadAdminGuestbook();
  });

  identity.append(name, timestamp);
  actions.className = "message-actions";
  actions.append(deleteButton);
  header.append(identity, actions);
  article.append(header, message);
  return article;
}

async function loadAdminGuestbook() {
  setAdminStatus(guestbookAdminStatus, "Loading public signatures...");
  const { data, error } = await adminClient
    .from("site_guestbook")
    .select("id, name, message, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Unable to load Guestbook entries:", error);
    setAdminStatus(
      guestbookAdminStatus,
      `Guestbook failed to load: ${error.message}`,
      "error",
    );
    return;
  }

  guestbookAdminList.replaceChildren(...data.map(createGuestbookAdminEntry));
  setAdminStatus(
    guestbookAdminStatus,
    data.length
      ? `${data.length} public signature${data.length === 1 ? "" : "s"} loaded.`
      : "No public Guestbook signatures.",
    "success",
  );
}

function createArcadeAdminEntry(entry) {
  const article = document.createElement("article");
  const header = document.createElement("header");
  const identity = document.createElement("div");
  const name = document.createElement("h3");
  const timestamp = document.createElement("time");
  const score = document.createElement("p");
  const actions = document.createElement("div");
  const deleteButton = document.createElement("button");

  article.className = "message-card";
  name.textContent = `${entry.player_name} // ${entry.game.toUpperCase()}`;
  timestamp.dateTime = entry.created_at;
  timestamp.textContent = new Date(entry.created_at).toLocaleString();
  score.textContent = `${entry.score.toLocaleString()} POINTS // ${entry.detail}`;
  deleteButton.type = "button";
  deleteButton.textContent = "DELETE";
  deleteButton.addEventListener("click", async () => {
    if (!window.confirm(`Delete ${entry.player_name}'s ${entry.game} score?`)) {
      return;
    }
    const { error } = await adminClient
      .from("arcade_scores")
      .delete()
      .eq("id", entry.id);
    if (error) {
      console.error("Unable to delete Arcade score:", error);
      setAdminStatus(
        arcadeAdminStatus,
        `Arcade score deletion failed: ${error.message}`,
        "error",
      );
      return;
    }
    await loadAdminArcadeScores();
  });

  identity.append(name, timestamp);
  actions.className = "message-actions";
  actions.append(deleteButton);
  header.append(identity, actions);
  article.append(header, score);
  return article;
}

async function loadAdminArcade() {
  setAdminStatus(arcadeAdminStatus, "Loading Arcade controls...");
  const [settingsResult, scoresResult] = await Promise.all([
    adminClient
      .from("arcade_settings")
      .select("leaderboard_enabled, score_submissions_enabled")
      .eq("id", "global")
      .single(),
    adminClient
      .from("arcade_scores")
      .select("id, game, player_name, score, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (settingsResult.error || scoresResult.error) {
    const error = settingsResult.error || scoresResult.error;
    console.error("Unable to load Arcade controls:", error);
    setAdminStatus(
      arcadeAdminStatus,
      `Arcade controls failed to load: ${error.message}`,
      "error",
    );
    return false;
  }

  arcadeLeaderboardEnabled.checked = settingsResult.data.leaderboard_enabled;
  arcadeSubmissionsEnabled.checked = settingsResult.data.score_submissions_enabled;
  arcadeAdminList.replaceChildren(
    ...scoresResult.data.map(createArcadeAdminEntry),
  );
  setAdminStatus(
    arcadeAdminStatus,
    scoresResult.data.length
      ? `${scoresResult.data.length} public score${scoresResult.data.length === 1 ? "" : "s"} loaded.`
      : "No public Arcade scores.",
    "success",
  );
  return true;
}

async function loadAdminArcadeScores() {
  return loadAdminArcade();
}

async function loadPronounProfile() {
  setAdminStatus(pronounAdminStatus, "Loading identity reference...");
  const { data, error } = await adminClient
    .from("pronoun_profiles")
    .select(pronounProfileFields.join(", "))
    .eq("id", "primary")
    .single();

  if (error) {
    console.error("Unable to load pronoun profile:", error);
    setAdminStatus(
      pronounAdminStatus,
      `Pronoun profile failed to load: ${error.message}`,
      "error",
    );
    return;
  }

  pronounProfileFields.forEach((field) => {
    pronounProfileForm.elements[field].value = data[field];
  });
  setAdminStatus(pronounAdminStatus, "Identity reference loaded.", "success");
}

async function loadFeaturedPlaylists() {
  setAdminStatus(playlistAdminStatus, "Loading curated playlist slots...");
  const { data, error } = await adminClient
    .from("spotify_featured_playlists")
    .select("position, title, spotify_url, enabled")
    .order("position", { ascending: true });

  if (error) {
    console.error("Unable to load featured playlists:", error);
    setAdminStatus(
      playlistAdminStatus,
      `Featured playlists failed to load: ${error.message}`,
      "error",
    );
    return false;
  }

  renderRepeatableEntries(repeatableEditors.playlists, data);
  setAdminStatus(
    playlistAdminStatus,
    `${data.length} curated playlist entr${data.length === 1 ? "y" : "ies"} loaded.`,
    "success",
  );
  return true;
}

async function loadFeaturedTracks() {
  setAdminStatus(trackAdminStatus, "Loading curated song slots...");
  const { data, error } = await adminClient
    .from("spotify_featured_tracks")
    .select("position, title, artist, spotify_url, enabled")
    .order("position", { ascending: true });

  if (error) {
    console.error("Unable to load featured songs:", error);
    setAdminStatus(
      trackAdminStatus,
      `Featured songs failed to load: ${error.message}`,
      "error",
    );
    return false;
  }

  renderRepeatableEntries(repeatableEditors.tracks, data);
  setAdminStatus(
    trackAdminStatus,
    `${data.length} curated song entr${data.length === 1 ? "y" : "ies"} loaded.`,
    "success",
  );
  return true;
}

async function loadResumeContent() {
  setAdminStatus(resumeAdminStatus, "Loading résumé data...");
  const [profileResult, entriesResult] = await Promise.all([
    adminClient
      .from("site_resume_profile")
      .select(`${resumeProfileFields.join(", ")}, enabled`)
      .eq("id", "primary")
      .single(),
    adminClient
      .from("site_resume_entries")
      .select("position, role, organization, period, summary, technologies, enabled")
      .order("position", { ascending: true }),
  ]);

  if (profileResult.error || entriesResult.error) {
    const error = profileResult.error || entriesResult.error;
    console.error("Unable to load résumé content:", error);
    setAdminStatus(
      resumeAdminStatus,
      `Résumé data failed to load: ${error.message}`,
      "error",
    );
    return false;
  }

  resumeProfileFields.forEach((field) => {
    resumeForm.elements[field].value = profileResult.data[field] ?? "";
  });
  resumeForm.elements.enabled.checked = profileResult.data.enabled === true;

  renderRepeatableEntries(repeatableEditors.resume, entriesResult.data);

  const unavailableSections = [];
  for (const editorKey of ["education", "certifications"]) {
    const editor = repeatableEditors[editorKey];
    const result = await adminClient
      .from(editor.table)
      .select(editor.selectFields)
      .order("position", { ascending: true });
    editor.unavailable = Boolean(result.error);
    editor.addButton.disabled = editor.unavailable;
    if (result.error) {
      console.error(`Unable to load ${editorKey}:`, result.error);
      renderRepeatableEntries(editor, []);
      unavailableSections.push(editorKey);
    } else {
      renderRepeatableEntries(editor, result.data);
    }
  }
  if (unavailableSections.length) {
    setAdminStatus(
      resumeAdminStatus,
      `Résumé data loaded, but ${unavailableSections.join(" and ")} ${unavailableSections.length > 1 ? "are" : "is"} unavailable until the database migration is applied.`,
      "error",
    );
    return true;
  }
  setAdminStatus(resumeAdminStatus, "Résumé data loaded.", "success");
  return true;
}

async function loadNowContent() {
  setAdminStatus(nowAdminStatus, "Loading NOW.TXT...");
  const { data, error } = await adminClient
    .from("site_now")
    .select(`${nowFields.join(", ")}, enabled`)
    .eq("id", "primary")
    .single();

  if (error) {
    console.error("Unable to load NOW.TXT:", error);
    setAdminStatus(nowAdminStatus, `NOW.TXT failed to load: ${error.message}`, "error");
    return;
  }

  nowFields.forEach((field) => {
    nowForm.elements[field].value = data[field] ?? "";
  });
  nowForm.elements.enabled.checked = data.enabled === true;
  setAdminStatus(nowAdminStatus, "NOW.TXT loaded.", "success");
}

async function loadChangelogContent() {
  setAdminStatus(changelogAdminStatus, "Loading changelog slots...");
  const { data, error } = await adminClient
    .from("site_changelog")
    .select("position, entry_date, title, summary, enabled")
    .order("position", { ascending: true });

  if (error) {
    console.error("Unable to load changelog:", error);
    setAdminStatus(
      changelogAdminStatus,
      `Changelog failed to load: ${error.message}`,
      "error",
    );
    return false;
  }

  renderRepeatableEntries(repeatableEditors.changelog, data);
  setAdminStatus(
    changelogAdminStatus,
    `${data.length} changelog entr${data.length === 1 ? "y" : "ies"} loaded.`,
    "success",
  );
  return true;
}

async function loadFavoriteGames() {
  setAdminStatus(gamesAdminStatus, "Loading favorite games...");
  const { data, error } = await adminClient
    .from("site_favorite_games")
    .select("position, title, platform, store_url, note, enabled")
    .order("position", { ascending: true });

  if (error) {
    console.error("Unable to load favorite games:", error);
    setAdminStatus(
      gamesAdminStatus,
      `Favorite games failed to load: ${error.message}`,
      "error",
    );
    return false;
  }

  renderRepeatableEntries(repeatableEditors.games, data);
  setAdminStatus(
    gamesAdminStatus,
    `${data.length} favorite game entr${data.length === 1 ? "y" : "ies"} loaded.`,
    "success",
  );
  return true;
}

async function loadCreators() {
  setAdminStatus(creatorsAdminStatus, "Loading creators...");
  const { data, error } = await adminClient
    .from("site_creators")
    .select("position, title, platform, channel_url, youtube_channel_id, note, sort_order, enabled")
    .order("sort_order", { ascending: true })
    .order("position", { ascending: true });
  creatorsSubmit.disabled = Boolean(error);
  if (error) {
    console.error("Unable to load creators:", error);
    setAdminStatus(creatorsAdminStatus, `Creators failed to load: ${error.message}`, "error");
    return false;
  }
  renderRepeatableEntries(repeatableEditors.creators, data);
  setAdminStatus(creatorsAdminStatus, `${data.length} creator(s) loaded.`, "success");
  return true;
}

async function loadHardware() {
  setAdminStatus(hardwareAdminStatus, "Loading hardware...");
  const results = await Promise.all([
    adminClient
    .from("site_hardware")
    .select("position, machine, component, name, detail, enabled, source_key")
    .order("position", { ascending: true }),
    adminClient.from("site_hardware_machine_order").select("machine, position"),
    adminClient.from("site_hardware_devices").select("machine"),
  ]);
  const { data } = results[0];
  const error = results.find((result) => result.error)?.error;

  if (error) {
    console.error("Unable to load hardware:", error);
    setAdminStatus(
      hardwareAdminStatus,
      `Hardware failed to load: ${error.message}`,
      "error",
    );
    return false;
  }

  hardwareAgentMachines = new Set(results[2].data.map(({ machine }) => machine));
  renderHardwareEditor(data, results[1].data, results[2].data);
  setAdminStatus(
    hardwareAdminStatus,
    `${data.length} hardware entr${data.length === 1 ? "y" : "ies"} loaded.`,
    "success",
  );
  return true;
}

function parseHardwareScan(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    // Terminal copies often include the prompt or the script's closing message.
    const starts = [text.indexOf("{"), text.indexOf("[")].filter((index) => index >= 0);
    const start = Math.min(...starts);
    const end = text.lastIndexOf(text[start] === "{" ? "}" : "]");
    if (!starts.length || end <= start) {
      throw error;
    }
    parsed = JSON.parse(text.slice(start, end + 1));
  }
  const items = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.components) ? parsed.components : [parsed];
  const machine = !Array.isArray(parsed) && typeof parsed?.machine === "string"
    ? parsed.machine.trim().slice(0, 60)
    : "";
  const components = items
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      component: String(item.component ?? "").trim().slice(0, 40),
      name: String(item.name ?? "").trim().slice(0, 160),
      detail: String(item.detail ?? "").trim().slice(0, 300),
    }))
    .filter((item) => item.component && item.name);
  return { machine, components };
}

// Fill the machine name from a pasted scan unless the admin typed their own.
function syncHardwareImportMachine() {
  let machine = "";
  try {
    machine = parseHardwareScan(hardwareImportJson.value).machine;
  } catch {
    machine = "";
  }
  if (machine && (!hardwareImportMachine.value.trim() || hardwareImportMachine.dataset.autofilled === "true")) {
    hardwareImportMachine.value = machine;
    hardwareImportMachine.dataset.autofilled = "true";
  }
  const name = hardwareImportMachine.value.trim();
  hardwareImportMachineHint.textContent = name && findHardwareMachineCard(name)
    ? `${name} already exists. Importing updates that machine; change the name to add a separate one.`
    : "";
}

let hardwareAgentMachines = new Set();
let hardwareMachineId = 0;

function normalizeHardwareMachine(value) {
  return String(value ?? "").trim().toLowerCase();
}

function getHardwareMachineCards() {
  return Array.from(hardwareSlots.querySelectorAll(".hw-machine"));
}

function findHardwareMachineCard(name) {
  const key = normalizeHardwareMachine(name);
  return getHardwareMachineCards().find((card) => (
    normalizeHardwareMachine(card.querySelector("[data-hw-machine-name]").value) === key
  ));
}

function updateHardwareMachineNames() {
  const list = document.querySelector("#hardware-machine-names");
  if (!list) {
    return;
  }
  const names = new Set(getHardwareMachineCards()
    .map((card) => card.querySelector("[data-hw-machine-name]").value.trim())
    .filter(Boolean));
  hardwareAgentMachines.forEach((name) => names.add(name));
  list.replaceChildren(...[...names].sort().map((name) => {
    const option = document.createElement("option");
    option.value = name;
    return option;
  }));
}

function updateHardwareMachineCard(card) {
  const rows = card.querySelectorAll(".hw-row");
  const nameInput = card.querySelector("[data-hw-machine-name]");
  const name = nameInput.value.trim() || "Untitled machine";
  const original = card.dataset.originalName ?? "";
  const linked = hardwareAgentMachines.has(original || nameInput.value.trim());
  card.querySelector(".hw-machine-count").textContent =
    `${rows.length} component${rows.length === 1 ? "" : "s"}`;
  card.querySelector(".hw-machine-empty").hidden = rows.length > 0;
  card.querySelector(".hw-machine-agent").hidden = !linked;
  nameInput.title = linked
    ? "Linked to a live agent. Renaming here also renames the agent when you save."
    : "";
  card.querySelector(".hw-machine-rename").setAttribute("aria-label", `Rename ${name}`);
  card.querySelector(".hw-machine-toggle").setAttribute("aria-label", `Show or hide ${name} components`);
  card.querySelector(".hw-machine-add").setAttribute("aria-label", `Add a component to ${name}`);
  card.querySelector(".hw-machine-remove").setAttribute("aria-label", `Remove ${name} and all its components`);
  card.querySelector(".hw-machine-up").setAttribute("aria-label", `Move ${name} up`);
  card.querySelector(".hw-machine-down").setAttribute("aria-label", `Move ${name} down`);
  rows.forEach((row) => {
    const component = row.querySelector('[data-entry-field="component"]').value.trim() || "component";
    row.querySelector(".hw-row-remove").setAttribute("aria-label", `Remove ${component} from ${name}`);
  });
}

function refreshHardwareMachineCards() {
  const cards = getHardwareMachineCards();
  cards.forEach((card, index) => {
    updateHardwareMachineCard(card);
    card.querySelector(".hw-machine-up").disabled = index === 0;
    card.querySelector(".hw-machine-down").disabled = index === cards.length - 1;
  });
  updateHardwareMachineNames();
}

function createHardwareRowField(key, label, value, options = {}) {
  const wrap = document.createElement("label");
  const caption = document.createElement("span");
  const input = document.createElement("input");
  wrap.className = `hw-cell hw-cell-${key}`;
  caption.textContent = label;
  input.dataset.entryField = key;
  input.value = value ?? "";
  input.maxLength = options.maxLength;
  if (options.list) {
    input.setAttribute("list", options.list);
  }
  if (options.placeholder && !options.existing) {
    input.placeholder = options.placeholder;
  }
  wrap.append(caption, input);
  return wrap;
}

function createHardwareRow(entry = {}) {
  const row = document.createElement("li");
  row.className = "hw-row";
  if (entry.position) {
    row.dataset.position = String(entry.position);
  }
  const existing = Boolean(entry.position);
  row.append(
    createHardwareRowField("component", "Component", entry.component, {
      maxLength: 40, list: "hardware-component-types", placeholder: "CPU", existing,
    }),
    createHardwareRowField("name", "Name", entry.name, {
      maxLength: 160, placeholder: "AMD Ryzen 7 7800X3D", existing,
    }),
    createHardwareRowField("detail", "Detail (optional)", entry.detail, {
      maxLength: 300, placeholder: "8 cores / 16 threads", existing,
    }),
  );

  const shown = document.createElement("label");
  const checkbox = document.createElement("input");
  const shownCopy = document.createElement("span");
  shown.className = "hw-cell hw-cell-enabled admin-checkbox";
  checkbox.type = "checkbox";
  checkbox.dataset.entryField = "enabled";
  checkbox.checked = entry.position ? entry.enabled === true : entry.enabled !== false;
  shownCopy.textContent = "Shown";
  shown.append(checkbox, shownCopy);
  const syncShown = () => row.classList.toggle("is-hidden", !checkbox.checked);
  checkbox.addEventListener("change", syncShown);
  syncShown();

  const tools = document.createElement("div");
  tools.className = "hw-row-tools";
  if (entry.source_key) {
    const badge = document.createElement("span");
    badge.className = "hw-badge";
    badge.textContent = "Agent";
    badge.title = "Synced by the live agent. Deleted rows come back on the next sync; untick Shown to hide it instead.";
    tools.append(badge);
  }
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "hw-row-remove repeatable-entry-remove";
  remove.textContent = "Remove";
  remove.addEventListener("click", () => {
    const card = row.closest(".hw-machine");
    const next = row.nextElementSibling ?? row.previousElementSibling;
    if (entry.position) {
      repeatableEditors.hardware.deletedPositions.add(entry.position);
    }
    row.remove();
    updateHardwareMachineCard(card);
    (next?.querySelector("input") ?? card.querySelector(".hw-machine-add")).focus();
    setAdminStatus(hardwareAdminStatus, "Component removed. Save to publish this change.");
  });
  tools.append(remove);
  row.append(shown, tools);
  row.addEventListener("input", () => updateHardwareMachineCard(row.closest(".hw-machine")));
  return row;
}

function addHardwareRow(card, entry = {}) {
  const row = createHardwareRow(entry);
  card.querySelector(".hw-rows").append(row);
  setHardwareMachineExpanded(card, true);
  updateHardwareMachineCard(card);
  return row;
}

function setHardwareMachineExpanded(card, expanded) {
  card.querySelector(".hw-machine-toggle").setAttribute("aria-expanded", String(expanded));
  card.querySelector(".hw-machine-body").hidden = !expanded;
}

function createHardwareMachineCard(name = "") {
  const card = document.createElement("section");
  const id = `hw-machine-${hardwareMachineId += 1}`;
  card.className = "hw-machine";

  const header = document.createElement("div");
  header.className = "hw-machine-header";
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "hw-machine-toggle";
  toggle.setAttribute("aria-controls", `${id}-body`);
  toggle.addEventListener("click", () => {
    setHardwareMachineExpanded(card, toggle.getAttribute("aria-expanded") !== "true");
  });

  const nameLabel = document.createElement("label");
  const nameCaption = document.createElement("span");
  const nameInput = document.createElement("input");
  nameLabel.className = "hw-machine-name";
  nameCaption.className = "ac-visually-hidden";
  nameCaption.textContent = "Machine name";
  nameInput.dataset.hwMachineName = "";
  nameInput.maxLength = 60;
  nameInput.placeholder = "Machine name (e.g. Desktop)";
  nameInput.value = name;
  nameInput.addEventListener("input", () => {
    updateHardwareMachineCard(card);
    updateHardwareMachineNames();
  });
  nameLabel.append(nameCaption, nameInput);

  const meta = document.createElement("span");
  meta.className = "hw-machine-meta";
  const count = document.createElement("span");
  count.className = "hw-machine-count";
  const agent = document.createElement("span");
  agent.className = "hw-badge hw-machine-agent";
  agent.textContent = "Live agent";
  agent.hidden = true;
  meta.append(count, agent);

  const actions = document.createElement("div");
  actions.className = "hw-machine-actions";
  const add = document.createElement("button");
  add.type = "button";
  add.className = "hw-machine-add";
  add.textContent = "+ Add component";
  add.addEventListener("click", () => {
    addHardwareRow(card).querySelector("input").focus();
    setAdminStatus(hardwareAdminStatus, "Component added. Fill it in, then save.");
  });
  const rename = document.createElement("button");
  rename.type = "button";
  rename.className = "hw-machine-rename";
  rename.textContent = "Rename";
  rename.addEventListener("click", () => {
    nameInput.focus();
    nameInput.select();
    setAdminStatus(hardwareAdminStatus, "Type the new machine name, then save.");
  });
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "hw-machine-remove repeatable-entry-remove";
  remove.textContent = "Remove machine";
  remove.addEventListener("click", () => {
    const label = nameInput.value.trim() || "this machine";
    const rows = card.querySelectorAll(".hw-row");
    const agentNote = hardwareAgentMachines.has(card.dataset.originalName || nameInput.value.trim())
      ? " It has a live agent, so synced parts come back on the next sync unless you revoke its token."
      : "";
    if (rows.length && !window.confirm(`Remove ${label} and its ${rows.length} component${rows.length === 1 ? "" : "s"}?${agentNote}`)) {
      return;
    }
    rows.forEach((row) => {
      if (row.dataset.position) {
        repeatableEditors.hardware.deletedPositions.add(Number(row.dataset.position));
      }
    });
    card.remove();
    refreshHardwareMachineCards();
    hardwareEntryAdd.focus();
    setAdminStatus(hardwareAdminStatus, `${label} removed. Save to publish this change.`);
  });
  const moveButtons = ["up", "down"].map((direction) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `hw-machine-${direction}`;
    button.textContent = direction === "up" ? "Move up" : "Move down";
    button.addEventListener("click", () => {
      const sibling = direction === "up" ? card.previousElementSibling : card.nextElementSibling;
      if (!sibling) {
        return;
      }
      if (direction === "up") {
        hardwareSlots.insertBefore(card, sibling);
      } else {
        hardwareSlots.insertBefore(sibling, card);
      }
      refreshHardwareMachineCards();
      (button.disabled ? card.querySelector(`.hw-machine-${direction === "up" ? "down" : "up"}`) : button).focus();
      setAdminStatus(hardwareAdminStatus, "Machine order changed. Save to publish this order.");
    });
    return button;
  });
  actions.append(...moveButtons, add, rename, remove);
  header.append(toggle, nameLabel, meta, actions);

  const body = document.createElement("div");
  body.className = "hw-machine-body";
  body.id = `${id}-body`;
  const list = document.createElement("ul");
  list.className = "hw-rows";
  list.setAttribute("aria-label", "Components");
  const empty = document.createElement("p");
  empty.className = "hw-machine-empty";
  empty.textContent = "No components yet. Add one, or import a scan for this machine.";
  body.append(list, empty);

  card.append(header, body);
  setHardwareMachineExpanded(card, true);
  updateHardwareMachineCard(card);
  return card;
}

function renderHardwareEditor(entries, order = [], devices = []) {
  const editor = repeatableEditors.hardware;
  editor.deletedPositions.clear();
  editor.maxPosition = entries.reduce((maximum, entry) => Math.max(maximum, entry.position), 0);
  hardwareSlots.replaceChildren();
  const cards = new Map();
  entries.forEach((entry) => {
    const key = normalizeHardwareMachine(entry.machine);
    if (!cards.has(key)) {
      const card = createHardwareMachineCard(entry.machine ?? "");
      card.dataset.originalName = entry.machine ?? "";
      cards.set(key, card);
      hardwareSlots.append(card);
    }
    cards.get(key).querySelector(".hw-rows").append(createHardwareRow(entry));
  });
  devices.forEach(({ machine }) => {
    const key = normalizeHardwareMachine(machine);
    if (!cards.has(key)) {
      const card = createHardwareMachineCard(machine);
      card.dataset.originalName = machine;
      cards.set(key, card);
      hardwareSlots.append(card);
    }
  });
  const positions = new Map(order.map(({ machine, position }) => [machine, position]));
  hardwareSlots.append(...getHardwareMachineCards().sort((a, b) => (
    (positions.get(a.dataset.originalName) ?? Infinity) - (positions.get(b.dataset.originalName) ?? Infinity)
  )));
  refreshHardwareMachineCards();
}

function collectHardwareEntries() {
  return getHardwareMachineCards().flatMap((card) => {
    const machine = card.querySelector("[data-hw-machine-name]").value.trim();
    return Array.from(card.querySelectorAll(".hw-row"), (row) => {
      const value = (key) => row.querySelector(`[data-entry-field="${key}"]`).value.trim();
      return {
        position: row.dataset.position ? Number(row.dataset.position) : null,
        machine,
        component: value("component"),
        name: value("name"),
        detail: value("detail"),
        enabled: row.querySelector('[data-entry-field="enabled"]').checked,
      };
    });
  });
}

function validateHardwareEditor() {
  const seen = new Set();
  for (const card of getHardwareMachineCards()) {
    const nameInput = card.querySelector("[data-hw-machine-name]");
    const key = normalizeHardwareMachine(nameInput.value);
    if (!card.querySelector(".hw-row") && !hardwareAgentMachines.has(card.dataset.originalName)) {
      continue;
    }
    if (!key) {
      return { message: "Every machine with components needs a name.", field: nameInput };
    }
    if (seen.has(key)) {
      return { message: `Two machines are named "${nameInput.value.trim()}". Rename one or move its components.`, field: nameInput };
    }
    seen.add(key);
    const original = card.dataset.originalName ?? "";
    if (hardwareAgentMachines.has(original) && nameInput.value.trim() !== original) {
      const conflict = [...hardwareAgentMachines].find((machine) => (
        machine !== original && normalizeHardwareMachine(machine) === key
      ));
      if (conflict) {
        return { message: `${conflict} already has its own live agent. Pick another name for ${original}.`, field: nameInput };
      }
    }
    for (const row of card.querySelectorAll(".hw-row")) {
      if (!row.querySelector('[data-entry-field="enabled"]').checked) {
        continue;
      }
      const missing = ["component", "name"]
        .map((field) => row.querySelector(`[data-entry-field="${field}"]`))
        .find((input) => !input.value.trim());
      if (missing) {
        setHardwareMachineExpanded(card, true);
        return { message: `Every shown component on ${nameInput.value.trim()} needs a component type and a name.`, field: missing };
      }
    }
  }
  return null;
}

function addHardwareMachine() {
  const card = createHardwareMachineCard("");
  hardwareSlots.append(card);
  addHardwareRow(card);
  refreshHardwareMachineCards();
  card.querySelector("[data-hw-machine-name]").focus();
  setAdminStatus(hardwareAdminStatus, "Machine added. Name it, list its components, then save.");
}

function importHardwareScan() {
  const editor = repeatableEditors.hardware;
  let scan;
  try {
    scan = parseHardwareScan(hardwareImportJson.value);
  } catch {
    setAdminStatus(
      hardwareAdminStatus,
      "That doesn't look like scan output. Paste the JSON the scan script printed or copied.",
      "error",
    );
    return;
  }
  const items = scan.components;
  if (items.length === 0) {
    setAdminStatus(hardwareAdminStatus, "The scan result has no components.", "error");
    return;
  }
  const machine = (hardwareImportMachine.value.trim() || scan.machine).slice(0, 60);
  if (!machine) {
    setAdminStatus(hardwareAdminStatus, "Name the machine before importing.", "error");
    hardwareImportMachine.focus();
    return;
  }

  let card = findHardwareMachineCard(machine);
  if (!card) {
    card = createHardwareMachineCard(machine);
    hardwareSlots.append(card);
  }
  let replaced = 0;
  if (hardwareImportReplace.checked) {
    card.querySelectorAll(".hw-row").forEach((row) => {
      if (row.dataset.position) {
        editor.deletedPositions.add(Number(row.dataset.position));
      }
      row.remove();
      replaced += 1;
    });
  }
  items.forEach((item) => addHardwareRow(card, { ...item, enabled: true }));
  refreshHardwareMachineCards();
  hardwareImportJson.value = "";
  hardwareImportMachine.value = "";
  hardwareImportMachine.dataset.autofilled = "false";
  hardwareImportMachineHint.textContent = "";
  card.scrollIntoView({ block: "nearest" });
  setAdminStatus(
    hardwareAdminStatus,
    `Imported ${items.length} component${items.length === 1 ? "" : "s"} for ${machine}${replaced ? `, replacing ${replaced}` : ""}. Review, then save to publish.`,
    "success",
  );
}

function generateShortLinkSlug(length = 7) {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return [...values]
    .map((value) => alphabet[value % alphabet.length])
    .join("");
}

function formatShortLinkDate(value) {
  if (!value) {
    return "NEVER";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "INVALID DATE"
    : date.toLocaleString();
}

function toDateTimeLocalValue(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function getShortLinkUrl(slug) {
  return `${window.location.origin}/go/${encodeURIComponent(slug)}`;
}

function createShortBitModeSelect(selectedMode) {
  const select = document.createElement("select");
  const modes = [
    ["redirect", "REDIRECT // CHANGE ADDRESS"],
    ["embed", "EMBED // KEEP SHORTBIT ADDRESS"],
    ["landing", "LANDING PAGE // KEEP SHORTBIT ADDRESS"],
  ];
  select.name = "display_mode";
  modes.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === selectedMode;
    select.append(option);
  });
  return select;
}

function getShortBitModeError(displayMode, destinationUrl) {
  if (!["redirect", "embed", "landing"].includes(displayMode)) {
    return "Select a valid ShortBit display mode.";
  }
  if (displayMode === "embed" && !window.BITS_SHORTBITS.getEmbed(destinationUrl)) {
    return "Embed mode supports YouTube, Vimeo, and Spotify URLs only.";
  }
  return null;
}

function createShortLinkEditor(link) {
  const form = document.createElement("form");
  const heading = document.createElement("div");
  const title = document.createElement("strong");
  const shortUrl = document.createElement("a");
  const destinationLabel = document.createElement("label");
  const destinationCopy = document.createElement("span");
  const destination = document.createElement("input");
  const titleLabel = document.createElement("label");
  const titleCopy = document.createElement("span");
  const titleInput = document.createElement("input");
  const modeLabel = document.createElement("label");
  const modeCopy = document.createElement("span");
  const mode = createShortBitModeSelect(link.display_mode);
  const descriptionLabel = document.createElement("label");
  const descriptionCopy = document.createElement("span");
  const description = document.createElement("textarea");
  const expiresLabel = document.createElement("label");
  const expiresCopy = document.createElement("span");
  const expires = document.createElement("input");
  const enabledLabel = document.createElement("label");
  const enabled = document.createElement("input");
  const enabledCopy = document.createElement("span");
  const metrics = document.createElement("p");
  const actions = document.createElement("div");
  const copy = document.createElement("button");
  const save = document.createElement("button");
  const remove = document.createElement("button");

  form.className = "short-link-admin-entry";
  form.dataset.shortLinkSlug = link.slug;
  heading.className = "short-link-admin-heading";
  title.textContent = link.title || link.slug;
  shortUrl.href = getShortLinkUrl(link.slug);
  shortUrl.target = "_blank";
  shortUrl.rel = "noreferrer";
  shortUrl.textContent = `/go/${link.slug} ↗`;
  heading.append(title, shortUrl);

  destinationCopy.textContent = "DESTINATION URL";
  destination.name = "destination_url";
  destination.type = "url";
  destination.maxLength = 2000;
  destination.required = true;
  destination.value = link.destination_url;
  destinationLabel.append(destinationCopy, destination);

  titleCopy.textContent = "PUBLIC TITLE";
  titleInput.name = "title";
  titleInput.maxLength = 120;
  titleInput.value = link.title ?? "";
  titleLabel.append(titleCopy, titleInput);

  modeCopy.textContent = "MODE";
  modeLabel.append(modeCopy, mode);

  descriptionCopy.textContent = "PUBLIC DESCRIPTION";
  description.name = "description";
  description.maxLength = 500;
  description.value = link.description ?? "";
  descriptionLabel.append(descriptionCopy, description);

  expiresCopy.textContent = "EXPIRES AT";
  expires.name = "expires_at";
  expires.type = "datetime-local";
  expires.value = toDateTimeLocalValue(link.expires_at);
  expiresLabel.append(expiresCopy, expires);

  enabledLabel.className = "admin-checkbox";
  enabled.name = "enabled";
  enabled.type = "checkbox";
  enabled.checked = link.enabled;
  enabledCopy.textContent = "ENABLED";
  enabledLabel.append(enabled, enabledCopy);

  metrics.className = "short-link-admin-metrics";
  metrics.textContent = [
    `CLICKS: ${link.click_count}`,
    `LAST USED: ${formatShortLinkDate(link.last_clicked_at)}`,
    `CREATED: ${formatShortLinkDate(link.created_at)}`,
  ].join(" // ");

  actions.className = "repeatable-entry-actions";
  copy.type = "button";
  copy.dataset.shortLinkAction = "copy";
  copy.textContent = "COPY";
  save.type = "submit";
  save.textContent = "SAVE";
  remove.type = "button";
  remove.dataset.shortLinkAction = "delete";
  remove.textContent = "DELETE";
  actions.append(copy, save, remove);

  form.append(
    heading,
    destinationLabel,
    titleLabel,
    modeLabel,
    descriptionLabel,
    expiresLabel,
    enabledLabel,
    metrics,
    actions,
  );
  return form;
}

function slugifyBlogTitle(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function toDatetimeLocal(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function updateBlogMarkdown(value, selectionStart, selectionEnd = selectionStart) {
  blogPostMarkdown.value = value;
  blogPostMarkdown.focus();
  blogPostMarkdown.setSelectionRange(selectionStart, selectionEnd);
  blogPostMarkdown.dispatchEvent(new Event("input", { bubbles: true }));
}

function wrapBlogSelection(before, after = before, placeholder = "text") {
  const start = blogPostMarkdown.selectionStart;
  const end = blogPostMarkdown.selectionEnd;
  const selected = blogPostMarkdown.value.slice(start, end) || placeholder;
  const replacement = `${before}${selected}${after}`;
  const value = `${blogPostMarkdown.value.slice(0, start)}${replacement}${blogPostMarkdown.value.slice(end)}`;
  const selectionStart = start + before.length;
  updateBlogMarkdown(value, selectionStart, selectionStart + selected.length);
}

function prefixBlogLines(prefix) {
  const value = blogPostMarkdown.value;
  const selectionStart = value.lastIndexOf("\n", blogPostMarkdown.selectionStart - 1) + 1;
  const nextNewline = value.indexOf("\n", blogPostMarkdown.selectionEnd);
  const selectionEnd = nextNewline === -1 ? value.length : nextNewline;
  const selected = value.slice(selectionStart, selectionEnd) || "List item";
  const lines = selected.split("\n");
  const replacement = lines.map((line, index) => (
    typeof prefix === "function" ? prefix(line, index) : `${prefix}${line}`
  )).join("\n");
  const nextValue = `${value.slice(0, selectionStart)}${replacement}${value.slice(selectionEnd)}`;
  updateBlogMarkdown(nextValue, selectionStart, selectionStart + replacement.length);
}

function insertBlogBlock(content) {
  const start = blogPostMarkdown.selectionStart;
  const before = blogPostMarkdown.value.slice(0, start);
  const after = blogPostMarkdown.value.slice(blogPostMarkdown.selectionEnd);
  const leadingBreak = before && !before.endsWith("\n\n") ? (before.endsWith("\n") ? "\n" : "\n\n") : "";
  const trailingBreak = after && !after.startsWith("\n\n") ? (after.startsWith("\n") ? "\n" : "\n\n") : "";
  const insertion = `${leadingBreak}${content}${trailingBreak}`;
  updateBlogMarkdown(
    `${before}${insertion}${after}`,
    before.length + leadingBreak.length,
    before.length + leadingBreak.length + content.length,
  );
}

function applyBlogFormat(format) {
  const formats = {
    bold: () => wrapBlogSelection("**", "**"),
    italic: () => wrapBlogSelection("*", "*"),
    underline: () => wrapBlogSelection("++", "++"),
    strike: () => wrapBlogSelection("~~", "~~"),
    highlight: () => wrapBlogSelection("==", "=="),
    "inline-code": () => wrapBlogSelection("`", "`", "code"),
    "bullet-list": () => prefixBlogLines("- "),
    "number-list": () => prefixBlogLines((line, index) => `${index + 1}. ${line}`),
    "task-list": () => prefixBlogLines("- [ ] "),
    table: () => insertBlogBlock("| COLUMN 1 | COLUMN 2 |\n| --- | --- |\n| VALUE | VALUE |"),
    link: () => {
      const url = window.prompt("Enter an HTTPS URL:");
      if (!url) {
        return;
      }
      try {
        const parsed = new URL(url);
        if (!["https:", "http:"].includes(parsed.protocol)) {
          throw new Error("Unsupported protocol.");
        }
      } catch {
        setAdminStatus(blogAdminStatus, "Link must use HTTP or HTTPS.", "error");
        return;
      }
      wrapBlogSelection("[", `](${url})`, "link text");
    },
  };
  formats[format]?.();
}

function applyBlogBlockFormat(format) {
  const formats = {
    "heading-2": () => prefixBlogLines("## "),
    "heading-3": () => prefixBlogLines("### "),
    quote: () => prefixBlogLines("> "),
    "code-block": () => wrapBlogSelection("```\n", "\n```", "code"),
  };
  formats[format]?.();
}

function openBlogImageDialog(url = "") {
  blogImageForm.reset();
  blogImageForm.elements.url.value = url;
  blogImageDialog.showModal();
  (url ? blogImageForm.elements.alt : blogImageForm.elements.url).focus();
}

function insertBlogImage(url, alt, caption) {
  const safeAlt = alt.replace(/[\[\]\r\n]/g, " ").trim();
  const safeCaption = caption.replace(/["\r\n]/g, "'").trim();
  const markdown = `![${safeAlt}](${url}${safeCaption ? ` "${safeCaption}"` : ""})`;
  insertBlogBlock(markdown);
}

async function uploadBlogImage(file) {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowedTypes.has(file.type)) {
    setAdminStatus(blogAdminStatus, "Images must be JPEG, PNG, WebP, or GIF.", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    setAdminStatus(blogAdminStatus, "Images must be 5 MB or smaller.", "error");
    return;
  }
  const extension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  }[file.type];
  const date = new Date();
  const path = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    `${crypto.randomUUID()}.${extension}`,
  ].join("/");
  blogImageUpload.disabled = true;
  blogImageUpload.textContent = "UPLOADING...";
  setAdminStatus(blogAdminStatus, "Uploading blog image...");
  const { error } = await adminClient.storage
    .from("blog-images")
    .upload(path, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });
  blogImageUpload.disabled = false;
  blogImageUpload.textContent = "UPLOAD IMAGE";
  if (error) {
    console.error("Unable to upload blog image:", error);
    setAdminStatus(blogAdminStatus, `Image upload failed: ${error.message}`, "error");
    return;
  }
  const { data } = adminClient.storage.from("blog-images").getPublicUrl(path);
  pendingBlogImagePath = path;
  setAdminStatus(blogAdminStatus, "Image uploaded. Add accessible alt text.", "success");
  openBlogImageDialog(data.publicUrl);
}

async function discardPendingBlogImage() {
  if (!pendingBlogImagePath) {
    return;
  }
  const path = pendingBlogImagePath;
  pendingBlogImagePath = "";
  const { error } = await adminClient.storage.from("blog-images").remove([path]);
  if (error) {
    console.error("Unable to discard unused blog image:", error);
    setAdminStatus(
      blogAdminStatus,
      `Unused image cleanup failed: ${error.message}`,
      "error",
    );
  }
}

function renderBlogPreview() {
  const markdown = blogPostMarkdown.value;
  if (!markdown.trim()) {
    const empty = document.createElement("p");
    empty.textContent = "Your rendered post will appear here.";
    blogMarkdownPreview.replaceChildren(empty);
    return;
  }
  blogMarkdownPreview.replaceChildren(
    window.BITS_MARKDOWN.render(markdown, { headingOffset: 3 }),
  );
}

function resetBlogEditor() {
  blogPostForm.reset();
  blogPostForm.elements.id.value = "";
  blogPostDelete.disabled = true;
  renderBlogPreview();
  setAdminStatus(blogAdminStatus, "Ready for a new post.");
  blogPostForm.elements.title.focus();
}

function selectBlogPost(post) {
  blogPostForm.elements.id.value = post.id;
  blogPostForm.elements.title.value = post.title;
  blogPostForm.elements.slug.value = post.slug;
  blogPostForm.elements.excerpt.value = post.excerpt;
  blogPostForm.elements.body_markdown.value = post.body_markdown;
  blogPostForm.elements.published.checked = post.published;
  blogPostForm.elements.published_at.value = toDatetimeLocal(post.published_at);
  blogPostDelete.disabled = false;
  renderBlogPreview();
  setAdminStatus(
    blogAdminStatus,
    `${post.published ? "Published" : "Draft"} post loaded.`,
    "success",
  );
}

function createBlogPostButton(post) {
  const button = document.createElement("button");
  const title = document.createElement("strong");
  const metadata = document.createElement("span");
  button.type = "button";
  button.className = "blog-admin-post-button";
  title.textContent = post.title;
  metadata.textContent = [
    post.published ? "PUBLISHED" : "DRAFT",
    post.published_at
      ? new Date(post.published_at).toLocaleDateString()
      : "NO DATE",
  ].join(" // ");
  button.append(title, metadata);
  button.addEventListener("click", () => selectBlogPost(post));
  return button;
}

let blogPostsLoadSequence = 0;
async function loadBlogPosts(preferredId = "") {
  const request = ++blogPostsLoadSequence;
  setAdminStatus(blogAdminStatus, "Loading blog posts...");
  window.BITS_PUBLISHING_UI.clear("Loading saved posts before comparing deployment status...");
  const data = [];
  for (;;) {
    const { data: page, error } = await adminClient
      .from("site_blog_posts")
      .select("id, slug, title, excerpt, body_markdown, published, published_at, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .order("id")
      .range(data.length, data.length + 499);
    if (request !== blogPostsLoadSequence) return false;
    if (error) {
      console.error("Unable to load blog posts:", error);
      setAdminStatus(blogAdminStatus, `Blog posts failed to load: ${error.message}`, "error");
      window.BITS_PUBLISHING_UI.clear(`Cannot compare deployment status: blog posts failed to load. ${error.message}`, "error", true);
      return false;
    }
    data.push(...page);
    if (page.length < 500) break;
  }
  void window.BITS_PUBLISHING_UI.update(data);

  blogAdminList.replaceChildren(...data.map(createBlogPostButton));
  if (data.length === 0) {
    const empty = document.createElement("p");
    empty.className = "content-window-empty";
    empty.textContent = "No blog posts have been created.";
    blogAdminList.append(empty);
  }
  const preferredPost = data.find((post) => post.id === preferredId);
  if (preferredPost) {
    selectBlogPost(preferredPost);
  } else {
    setAdminStatus(
      blogAdminStatus,
      `${data.length} post${data.length === 1 ? "" : "s"} loaded.`,
      "success",
    );
  }
  return true;
}

async function loadShortLinks() {
  setAdminStatus(shortLinksAdminStatus, "Loading ShortBits...");
  const { data, error } = await adminClient
    .from("site_short_links")
    .select(
      "slug, title, description, destination_url, display_mode, enabled, expires_at, click_count, last_clicked_at, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load ShortBits:", error);
    setAdminStatus(
      shortLinksAdminStatus,
      `ShortBits failed to load: ${error.message}`,
      "error",
    );
    return false;
  }

  shortLinksList.replaceChildren(...data.map(createShortLinkEditor));
  if (data.length === 0) {
    const empty = document.createElement("p");
    empty.className = "content-window-empty";
    empty.textContent = "No ShortBits have been generated.";
    shortLinksList.append(empty);
  }
  setAdminStatus(
    shortLinksAdminStatus,
    `${data.length} ShortBit${data.length === 1 ? "" : "s"} loaded.`,
    "success",
  );
  return true;
}

function updateAdminGreeting() {
  const hour = new Date().getHours();
  document.querySelector("#admin-greeting").textContent = hour < 5
    ? "Burning the midnight oil"
    : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

async function showInbox() {
  loginView.hidden = true;
  inboxView.hidden = false;
  updateAdminGreeting();
  await Promise.all([
    loadMessages(),
    loadAdminGuestbook(),
    loadAdminArcade(),
    loadPronounProfile(),
    loadFeaturedPlaylists(),
    loadFeaturedTracks(),
    loadResumeContent(),
    loadNowContent(),
    loadChangelogContent(),
    loadFavoriteGames(),
    loadCreators(),
    loadHardware(),
    loadHardwareDevices(),
    loadBlogPosts(),
    loadShortLinks(),
  ]);
  window.dispatchEvent(new CustomEvent("admin:authenticated"));
}

function showLogin() {
  blogPostsLoadSequence += 1;
  window.BITS_PUBLISHING_UI.clear();
  inboxView.hidden = true;
  loginView.hidden = false;
  loginForm.reset();
  hardwareDeviceToken.value = "";
  hardwareDeviceTokenOutput.hidden = true;
}

let adminClient;

try {
  adminClient = window.createSiteSupabaseClient();
} catch (error) {
  console.error(error);
  loginSubmit.disabled = true;
  setAdminStatus(
    loginStatus,
    "Supabase is not configured. Update supabase-config.js first.",
    "error",
  );
}

if (adminClient) {
  document.querySelector("#blog-deployment-refresh").addEventListener("click", () => loadBlogPosts());
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    loginSubmit.disabled = true;
    setAdminStatus(loginStatus, "Verifying credentials...");

    const { error } = await adminClient.auth.signInWithPassword({
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    });

    loginSubmit.disabled = false;

    if (error) {
      console.error("Authentication failed:", error);
      setAdminStatus(loginStatus, `Authentication failed: ${error.message}`, "error");
      return;
    }

    await showInbox();
  });

  refreshButton.addEventListener("click", loadMessages);
  refreshGuestbook.addEventListener("click", loadAdminGuestbook);
  refreshArcadeScores.addEventListener("click", loadAdminArcadeScores);
  blogPostMarkdown.addEventListener("input", renderBlogPreview);
  document.querySelectorAll("[data-blog-format]").forEach((button) => {
    button.addEventListener("click", () => applyBlogFormat(button.dataset.blogFormat));
  });
  blogFormatBlock.addEventListener("change", () => {
    applyBlogBlockFormat(blogFormatBlock.value);
    blogFormatBlock.value = "";
  });
  blogFormatColor.addEventListener("change", () => {
    if (blogFormatColor.value) {
      wrapBlogSelection(
        `{{color:${blogFormatColor.value}|`,
        "}}",
      );
      blogFormatColor.value = "";
    }
  });
  blogFormatFont.addEventListener("change", () => {
    if (blogFormatFont.value) {
      wrapBlogSelection(
        `{{font:${blogFormatFont.value}|`,
        "}}",
      );
      blogFormatFont.value = "";
    }
  });
  blogFormatSize.addEventListener("change", () => {
    if (blogFormatSize.value) {
      wrapBlogSelection(
        `{{size:${blogFormatSize.value}|`,
        "}}",
      );
      blogFormatSize.value = "";
    }
  });
  blogImageUrl.addEventListener("click", () => openBlogImageDialog());
  blogImageUpload.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/gif";
    input.addEventListener("change", () => {
      const [file] = input.files;
      if (file) {
        uploadBlogImage(file);
      }
    }, { once: true });
    input.click();
  });
  blogImageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(blogImageForm);
    const url = String(formData.get("url") ?? "").trim();
    const alt = String(formData.get("alt") ?? "").trim();
    const caption = String(formData.get("caption") ?? "").trim();
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        throw new Error("Image URLs must use HTTPS.");
      }
    } catch {
      setAdminStatus(blogAdminStatus, "Image URL must be a valid HTTPS address.", "error");
      return;
    }
    if (!alt) {
      setAdminStatus(blogAdminStatus, "Image alt text is required.", "error");
      return;
    }
    insertBlogImage(url, alt, caption);
    pendingBlogImagePath = "";
    blogImageDialog.close();
    setAdminStatus(blogAdminStatus, "Image inserted into the post.", "success");
  });
  document.querySelector("[data-blog-image-cancel]").addEventListener("click", () => {
    blogImageDialog.close();
  });
  blogImageDialog.addEventListener("close", discardPendingBlogImage);
  blogPostForm.elements.title.addEventListener("input", () => {
    if (!blogPostForm.elements.id.value) {
      blogPostForm.elements.slug.value = slugifyBlogTitle(
        blogPostForm.elements.title.value,
      );
    }
  });
  blogPostNew.addEventListener("click", resetBlogEditor);
  blogPostForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(blogPostForm);
    const id = String(formData.get("id") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
    const excerpt = String(formData.get("excerpt") ?? "").trim();
    const bodyMarkdown = String(formData.get("body_markdown") ?? "").trim();
    const published = formData.has("published");
    const publishedAtInput = String(formData.get("published_at") ?? "").trim();

    if (!blogSlugPattern.test(slug) || slug.length < 3 || slug.length > 100) {
      setAdminStatus(
        blogAdminStatus,
        "Slug must be 3-100 lowercase letters or numbers separated by hyphens.",
        "error",
      );
      return;
    }
    if (!title || !excerpt || !bodyMarkdown) {
      setAdminStatus(
        blogAdminStatus,
        "Title, excerpt, and Markdown body are required.",
        "error",
      );
      return;
    }

    let publishedAt = null;
    if (publishedAtInput) {
      const parsedDate = new Date(publishedAtInput);
      if (Number.isNaN(parsedDate.getTime())) {
        setAdminStatus(blogAdminStatus, "Publish date is invalid.", "error");
        return;
      }
      publishedAt = parsedDate.toISOString();
    } else if (published) {
      publishedAt = new Date().toISOString();
    }

    const payload = {
      title,
      slug,
      excerpt,
      body_markdown: bodyMarkdown,
      published,
      published_at: publishedAt,
      updated_at: new Date().toISOString(),
    };
    blogPostSave.disabled = true;
    blogPostSave.textContent = "> SAVING...";
    setAdminStatus(blogAdminStatus, "Writing blog post...");
    const query = id
      ? adminClient.from("site_blog_posts").update(payload).eq("id", id)
      : adminClient.from("site_blog_posts").insert(payload);
    const { data, error } = await query.select("id").single();
    blogPostSave.disabled = false;
    blogPostSave.textContent = "> SAVE_POST";

    if (error) {
      console.error("Unable to save blog post:", error);
      const message = error.code === "23505"
        ? "Another post already uses that slug."
        : `Blog post save failed: ${error.message}`;
      setAdminStatus(blogAdminStatus, message, "error");
      return;
    }
    await loadBlogPosts(data.id);
    setAdminStatus(
      blogAdminStatus,
      published ? "Post published." : "Draft saved.",
      "success",
    );
  });
  blogPostDelete.addEventListener("click", async () => {
    const id = blogPostForm.elements.id.value;
    const title = blogPostForm.elements.title.value.trim();
    if (!id || !window.confirm(`Delete "${title}" permanently?`)) {
      return;
    }
    blogPostDelete.disabled = true;
    setAdminStatus(blogAdminStatus, "Deleting blog post...");
    const { error } = await adminClient
      .from("site_blog_posts")
      .delete()
      .eq("id", id);
    if (error) {
      console.error("Unable to delete blog post:", error);
      blogPostDelete.disabled = false;
      setAdminStatus(
        blogAdminStatus,
        `Blog post deletion failed: ${error.message}`,
        "error",
      );
      return;
    }
    resetBlogEditor();
    await loadBlogPosts();
    setAdminStatus(blogAdminStatus, "Post deleted.", "success");
  });
  arcadeSettingsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    arcadeSettingsSubmit.disabled = true;
    arcadeSettingsSubmit.textContent = "> SAVING...";
    setAdminStatus(arcadeAdminStatus, "Writing Arcade settings...");
    const { error } = await adminClient
      .from("arcade_settings")
      .update({
        leaderboard_enabled: arcadeLeaderboardEnabled.checked,
        score_submissions_enabled: arcadeSubmissionsEnabled.checked,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "global");
    arcadeSettingsSubmit.disabled = false;
    arcadeSettingsSubmit.textContent = "> SAVE_ARCADE_SETTINGS";
    if (error) {
      console.error("Unable to save Arcade settings:", error);
      setAdminStatus(
        arcadeAdminStatus,
        `Arcade settings update failed: ${error.message}`,
        "error",
      );
      return;
    }
    setAdminStatus(arcadeAdminStatus, "Arcade settings updated.", "success");
  });
  shortLinksRefresh.addEventListener("click", loadShortLinks);
  shortLinkGenerate.addEventListener("click", () => {
    shortLinkCreateForm.elements.slug.value = generateShortLinkSlug();
    shortLinkCreateForm.elements.slug.focus();
  });
  shortLinkCreateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(shortLinkCreateForm);
    const destinationUrl = String(formData.get("destination_url") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const displayMode = String(formData.get("display_mode") ?? "");
    const slugInput = String(formData.get("slug") ?? "").trim().toLowerCase();
    const slug = slugInput || generateShortLinkSlug();
    const expiresInput = String(formData.get("expires_at") ?? "").trim();

    if (!shortLinkSlugPattern.test(slug)) {
      setAdminStatus(
        shortLinksAdminStatus,
        "Alias must be 3-64 lowercase letters, numbers, hyphens, or underscores.",
        "error",
      );
      return;
    }
    if (!httpsUrlPattern.test(destinationUrl)) {
      setAdminStatus(
        shortLinksAdminStatus,
        "Destination must be a valid HTTPS URL.",
        "error",
      );
      return;
    }
    const modeError = getShortBitModeError(displayMode, destinationUrl);
    if (modeError) {
      setAdminStatus(shortLinksAdminStatus, modeError, "error");
      return;
    }

    shortLinkCreate.disabled = true;
    shortLinkCreate.textContent = "> CREATING...";
    const { error } = await adminClient.from("site_short_links").insert({
      slug,
      title: title || null,
      description: description || null,
      destination_url: destinationUrl,
      display_mode: displayMode,
      expires_at: expiresInput ? new Date(expiresInput).toISOString() : null,
      enabled: true,
    });
    shortLinkCreate.disabled = false;
    shortLinkCreate.textContent = "> CREATE_SHORTBIT";

    if (error) {
      console.error("Unable to create ShortBit:", error);
      setAdminStatus(
        shortLinksAdminStatus,
        error.code === "23505"
          ? `The alias "${slug}" is already in use.`
          : `ShortBit creation failed: ${error.message}`,
        "error",
      );
      return;
    }

    shortLinkCreateForm.reset();
    await loadShortLinks();
    setAdminStatus(
      shortLinksAdminStatus,
      `Created ${getShortLinkUrl(slug)}`,
      "success",
    );
  });
  shortLinksList.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target.closest("[data-short-link-slug]");
    if (!form) {
      return;
    }
    const formData = new FormData(form);
    const destinationUrl =
      String(formData.get("destination_url") ?? "").trim();
    const expiresInput = String(formData.get("expires_at") ?? "").trim();
    const displayMode = String(formData.get("display_mode") ?? "");
    if (!httpsUrlPattern.test(destinationUrl)) {
      setAdminStatus(
        shortLinksAdminStatus,
        "Destination must be a valid HTTPS URL.",
        "error",
      );
      return;
    }
    const modeError = getShortBitModeError(displayMode, destinationUrl);
    if (modeError) {
      setAdminStatus(shortLinksAdminStatus, modeError, "error");
      return;
    }

    const { error } = await adminClient
      .from("site_short_links")
      .update({
        title: String(formData.get("title") ?? "").trim() || null,
        description:
          String(formData.get("description") ?? "").trim() || null,
        destination_url: destinationUrl,
        display_mode: displayMode,
        expires_at: expiresInput ? new Date(expiresInput).toISOString() : null,
        enabled: formData.get("enabled") === "on",
      })
      .eq("slug", form.dataset.shortLinkSlug);

    if (error) {
      console.error("Unable to update ShortBit:", error);
      setAdminStatus(
        shortLinksAdminStatus,
        `ShortBit update failed: ${error.message}`,
        "error",
      );
      return;
    }
    await loadShortLinks();
    setAdminStatus(shortLinksAdminStatus, "ShortBit updated.", "success");
  });
  shortLinksList.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-short-link-action]");
    const form = button?.closest("[data-short-link-slug]");
    if (!button || !form) {
      return;
    }
    const slug = form.dataset.shortLinkSlug;
    if (button.dataset.shortLinkAction === "copy") {
      try {
        await navigator.clipboard.writeText(getShortLinkUrl(slug));
        setAdminStatus(shortLinksAdminStatus, `Copied /go/${slug}.`, "success");
      } catch (error) {
        console.error("Unable to copy ShortBit:", error);
        setAdminStatus(
          shortLinksAdminStatus,
          `Copy failed: ${error.message}`,
          "error",
        );
      }
      return;
    }
    if (
      button.dataset.shortLinkAction === "delete"
      && window.confirm(`Permanently delete /go/${slug}?`)
    ) {
      const { error } = await adminClient
        .from("site_short_links")
        .delete()
        .eq("slug", slug);
      if (error) {
        console.error("Unable to delete ShortBit:", error);
        setAdminStatus(
          shortLinksAdminStatus,
          `ShortBit deletion failed: ${error.message}`,
          "error",
        );
        return;
      }
      await loadShortLinks();
      setAdminStatus(shortLinksAdminStatus, `Deleted /go/${slug}.`, "success");
    }
  });
  pronounProfileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(pronounProfileForm);
    const profile = Object.fromEntries(
      pronounProfileFields.map((field) => [
        field,
        String(formData.get(field) ?? "").trim(),
      ]),
    );

    if (pronounProfileFields.some((field) => !profile[field])) {
      setAdminStatus(pronounAdminStatus, "Every profile field is required.", "error");
      return;
    }

    pronounProfileSubmit.disabled = true;
    pronounProfileSubmit.textContent = "> SAVING...";
    setAdminStatus(pronounAdminStatus, "Writing identity reference...");

    const { error } = await adminClient
      .from("pronoun_profiles")
      .update({ ...profile, updated_at: new Date().toISOString() })
      .eq("id", "primary");

    pronounProfileSubmit.disabled = false;
    pronounProfileSubmit.textContent = "> SAVE_PROFILE";

    if (error) {
      console.error("Unable to save pronoun profile:", error);
      setAdminStatus(
        pronounAdminStatus,
        `Pronoun profile update failed: ${error.message}`,
        "error",
      );
      return;
    }

    setAdminStatus(pronounAdminStatus, "Identity reference updated.", "success");
  });

  playlistForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const playlists = collectRepeatableEntries(repeatableEditors.playlists);
    const invalidPlaylist = playlists.find((playlist) => (
      (
        playlist.enabled
        && (!playlist.title || !playlist.spotify_url)
      )
      || (
        playlist.spotify_url
        && !spotifyPlaylistUrlPattern.test(playlist.spotify_url)
      )
    ));
    if (invalidPlaylist) {
      setAdminStatus(
        playlistAdminStatus,
        "Every enabled playlist needs a title and valid Spotify playlist URL.",
        "error",
      );
      return;
    }

    playlistSubmit.disabled = true;
    playlistSubmit.textContent = "> SAVING...";
    setAdminStatus(playlistAdminStatus, "Writing curated playlist entries...");

    const failedUpdate = await syncRepeatableEntries(
      repeatableEditors.playlists,
      playlists,
      new Date().toISOString(),
    );

    playlistSubmit.disabled = false;
    playlistSubmit.textContent = "> SAVE_PLAYLISTS";

    if (failedUpdate) {
      console.error("Unable to save featured playlists:", failedUpdate.error);
      setAdminStatus(
        playlistAdminStatus,
        `Featured playlist update failed: ${failedUpdate.error.message}`,
        "error",
      );
      return;
    }

    if (!await loadFeaturedPlaylists()) {
      return;
    }
    setAdminStatus(playlistAdminStatus, "Curated playlists updated.", "success");
  });

  trackForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const tracks = collectRepeatableEntries(repeatableEditors.tracks);
    const invalidTrack = tracks.find((track) => (
      (
        track.enabled
        && (!track.title || !track.artist || !track.spotify_url)
      )
      || (
        track.spotify_url
        && !spotifyTrackUrlPattern.test(track.spotify_url)
      )
    ));
    if (invalidTrack) {
      setAdminStatus(
        trackAdminStatus,
        "Every enabled song needs a title, artist, and valid Spotify track URL.",
        "error",
      );
      return;
    }

    trackSubmit.disabled = true;
    trackSubmit.textContent = "> SAVING...";
    setAdminStatus(trackAdminStatus, "Writing curated song entries...");

    const failedUpdate = await syncRepeatableEntries(
      repeatableEditors.tracks,
      tracks,
      new Date().toISOString(),
    );

    trackSubmit.disabled = false;
    trackSubmit.textContent = "> SAVE_SONGS";

    if (failedUpdate) {
      console.error("Unable to save featured songs:", failedUpdate.error);
      setAdminStatus(
        trackAdminStatus,
        `Featured song update failed: ${failedUpdate.error.message}`,
        "error",
      );
      return;
    }

    if (!await loadFeaturedTracks()) {
      return;
    }
    setAdminStatus(trackAdminStatus, "Curated songs updated.", "success");
  });

  resumeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(resumeForm);
    const profile = Object.fromEntries(
      resumeProfileFields.map((field) => [
        field,
        String(formData.get(field) ?? "").trim(),
      ]),
    );
    profile.enabled = formData.has("enabled");
    const entries = collectRepeatableEntries(repeatableEditors.resume);
    const educationEntries = collectRepeatableEntries(repeatableEditors.education);
    const invalidEntry = entries.find((entry) => (
      entry.enabled
      && (!entry.role || !entry.organization || !entry.period || !entry.summary)
    ));
    const invalidEducation = educationEntries.find((entry) => (
      entry.enabled && (!entry.school || !entry.credential || !entry.period)
    ));
    const certificationEntries = collectRepeatableEntries(repeatableEditors.certifications);
    const invalidCertification = certificationEntries.find((entry) => (
      entry.enabled && (!entry.name || !entry.issuer || !entry.issued)
    ));
    const invalidCertificationUrl = certificationEntries.find((entry) => (
      entry.credential_url && !httpsUrlPattern.test(entry.credential_url)
    ));

    if (profile.enabled && (!profile.headline || !profile.summary)) {
      setAdminStatus(
        resumeAdminStatus,
        "A published résumé needs a headline and summary.",
        "error",
      );
      return;
    }
    if (profile.resume_url && !httpsUrlPattern.test(profile.resume_url)) {
      setAdminStatus(resumeAdminStatus, "Résumé URL must use HTTPS.", "error");
      return;
    }
    if (invalidEntry) {
      setAdminStatus(
        resumeAdminStatus,
        "Every enabled résumé entry needs a role, organization, period, and summary.",
        "error",
      );
      return;
    }
    if (invalidEducation) {
      setAdminStatus(
        resumeAdminStatus,
        "Every enabled education entry needs a school, credential, and period.",
        "error",
      );
      return;
    }
    if (invalidCertification) {
      setAdminStatus(
        resumeAdminStatus,
        "Every enabled certification needs a name, issuer, and issued date.",
        "error",
      );
      return;
    }
    if (invalidCertificationUrl) {
      setAdminStatus(resumeAdminStatus, "Certification verify URLs must use HTTPS.", "error");
      return;
    }

    resumeSubmit.disabled = true;
    resumeSubmit.textContent = "> SAVING...";
    setAdminStatus(resumeAdminStatus, "Writing résumé data...");
    const updatedAt = new Date().toISOString();
    const results = await Promise.all([
      adminClient
        .from("site_resume_profile")
        .update({
          headline: profile.headline || null,
          summary: profile.summary || null,
          availability: profile.availability || null,
          location: profile.location || null,
          resume_url: profile.resume_url || null,
          enabled: profile.enabled,
          updated_at: updatedAt,
        })
        .eq("id", "primary"),
      syncRepeatableEntries(repeatableEditors.resume, entries, updatedAt),
      repeatableEditors.education.unavailable
        ? null
        : syncRepeatableEntries(repeatableEditors.education, educationEntries, updatedAt),
      repeatableEditors.certifications.unavailable
        ? null
        : syncRepeatableEntries(
          repeatableEditors.certifications,
          certificationEntries,
          updatedAt,
        ),
    ]);
    const failedUpdate = results.find((result) => result?.error);
    resumeSubmit.disabled = false;
    resumeSubmit.textContent = "> SAVE_RESUME";

    if (failedUpdate) {
      console.error("Unable to save résumé data:", failedUpdate.error);
      setAdminStatus(
        resumeAdminStatus,
        `Résumé update failed: ${failedUpdate.error.message}`,
        "error",
      );
      return;
    }
    if (!await loadResumeContent()) {
      return;
    }
    clearPublicContentCache();
    setAdminStatus(resumeAdminStatus, "Résumé data updated.", "success");
  });

  nowForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(nowForm);
    const nowContent = Object.fromEntries(
      nowFields.map((field) => [
        field,
        String(formData.get(field) ?? "").trim(),
      ]),
    );
    nowContent.enabled = formData.has("enabled");

    if (nowContent.enabled && (!nowContent.headline || !nowContent.summary)) {
      setAdminStatus(
        nowAdminStatus,
        "A published NOW.TXT needs a headline and summary.",
        "error",
      );
      return;
    }

    nowSubmit.disabled = true;
    nowSubmit.textContent = "> SAVING...";
    setAdminStatus(nowAdminStatus, "Writing NOW.TXT...");
    const { error } = await adminClient
      .from("site_now")
      .update({
        ...Object.fromEntries(
          nowFields.map((field) => [field, nowContent[field] || null]),
        ),
        enabled: nowContent.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", "primary");
    nowSubmit.disabled = false;
    nowSubmit.textContent = "> SAVE_NOW";

    if (error) {
      console.error("Unable to save NOW.TXT:", error);
      setAdminStatus(nowAdminStatus, `NOW.TXT update failed: ${error.message}`, "error");
      return;
    }
    clearPublicContentCache();
    setAdminStatus(nowAdminStatus, "NOW.TXT updated.", "success");
  });

  changelogForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const entries = collectRepeatableEntries(repeatableEditors.changelog);
    const invalidEntry = entries.find((entry) => (
      entry.enabled && (!entry.entry_date || !entry.title || !entry.summary)
    ));
    if (invalidEntry) {
      setAdminStatus(
        changelogAdminStatus,
        "Every enabled changelog entry needs a date, title, and summary.",
        "error",
      );
      return;
    }

    changelogSubmit.disabled = true;
    changelogSubmit.textContent = "> SAVING...";
    setAdminStatus(changelogAdminStatus, "Writing changelog entries...");
    const updatedAt = new Date().toISOString();
    const failedUpdate = await syncRepeatableEntries(
      repeatableEditors.changelog,
      entries,
      updatedAt,
    );
    changelogSubmit.disabled = false;
    changelogSubmit.textContent = "> SAVE_CHANGELOG";

    if (failedUpdate) {
      console.error("Unable to save changelog:", failedUpdate.error);
      setAdminStatus(
        changelogAdminStatus,
        `Changelog update failed: ${failedUpdate.error.message}`,
        "error",
      );
      return;
    }
    if (!await loadChangelogContent()) {
      return;
    }
    clearPublicContentCache();
    setAdminStatus(changelogAdminStatus, "Changelog updated.", "success");
  });

  gamesForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const entries = collectRepeatableEntries(repeatableEditors.games);
    const invalidEntry = entries.find((entry) => (
      (
        entry.enabled
        && (!entry.title || !entry.platform || !entry.store_url)
      )
      || (
        entry.store_url
        && !httpsUrlPattern.test(entry.store_url)
      )
    ));
    if (invalidEntry) {
      setAdminStatus(
        gamesAdminStatus,
        "Every enabled game needs a title, page label, and HTTPS store or official URL.",
        "error",
      );
      return;
    }

    gamesSubmit.disabled = true;
    gamesSubmit.textContent = "> SAVING...";
    setAdminStatus(gamesAdminStatus, "Writing favorite games...");
    const failedUpdate = await syncRepeatableEntries(
      repeatableEditors.games,
      entries,
      new Date().toISOString(),
    );
    gamesSubmit.disabled = false;
    gamesSubmit.textContent = "> SAVE_GAMES";

    if (failedUpdate) {
      console.error("Unable to save favorite games:", failedUpdate.error);
      setAdminStatus(
        gamesAdminStatus,
        `Favorite games update failed: ${failedUpdate.error.message}`,
        "error",
      );
      return;
    }
    if (!await loadFavoriteGames()) {
      return;
    }
    clearPublicContentCache();
    setAdminStatus(gamesAdminStatus, "Favorite games updated.", "success");
  });

  creatorsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const entries = collectRepeatableEntries(repeatableEditors.creators);
    const invalid = entries.some((entry) => {
      if (entry.enabled && (!entry.title || !entry.platform || !entry.channel_url)) return true;
      if (!/^\d+$/.test(entry.sort_order) || Number(entry.sort_order) > 2147483647) return true;
      if (entry.youtube_channel_id && !/^UC[A-Za-z0-9_-]{22}$/.test(entry.youtube_channel_id)) return true;
      if (entry.channel_url) {
        try {
          const url = new URL(entry.channel_url);
          return url.protocol !== "https:" || Boolean(url.username || url.password);
        } catch {
          return true;
        }
      }
      return false;
    });
    if (invalid) {
      setAdminStatus(creatorsAdminStatus,
        "Enabled creators need a name, platform, and HTTPS URL without credentials. Display order must be a non-negative integer. YouTube IDs must be UC followed by 22 letters, numbers, underscores, or hyphens.",
        "error");
      return;
    }
    creatorsSubmit.disabled = true;
    creatorsSubmit.textContent = "> SAVING...";
    setAdminStatus(creatorsAdminStatus, "Saving creators...");
    try {
      const failedUpdate = await syncRepeatableEntries(
        repeatableEditors.creators, entries, new Date().toISOString(),
      );
      if (failedUpdate) throw new Error(failedUpdate.error.message);
      if (await loadCreators()) {
        setAdminStatus(creatorsAdminStatus, "Creators updated. Public lists refresh within five minutes; latest uploads can be cached for ten minutes.", "success");
      }
    } catch (error) {
      console.error("Unable to save creators:", error);
      setAdminStatus(creatorsAdminStatus, `Creator update failed: ${error.message}`, "error");
      creatorsSubmit.disabled = false;
    } finally {
      creatorsSubmit.textContent = "> SAVE_CREATORS";
    }
  });

  const hardwareImportPlatform = document.querySelector("#hardware-import-platform");
  const getHardwareScanScript = () => (
    hardwareImportPlatform.value === "linux" ? hardwareLinuxScanScript : hardwareScanScript
  );
  const showHardwareScanScript = () => {
    const linux = hardwareImportPlatform.value === "linux";
    hardwareImportScript.value = getHardwareScanScript();
    hardwareImportScript.setAttribute(
      "aria-label",
      linux ? "Bash hardware scan script for Linux and Unraid" : "PowerShell hardware scan script",
    );
    if (linux && hardwareImportMachine.value === "Desktop") {
      hardwareImportMachine.value = "NAS";
    }
  };
  showHardwareScanScript();
  hardwareImportPlatform.addEventListener("change", showHardwareScanScript);
  hardwareImportCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(getHardwareScanScript());
    } catch {
      hardwareImportScript.select();
      document.execCommand("copy");
    }
    setAdminStatus(
      hardwareAdminStatus,
      hardwareImportPlatform.value === "linux"
        ? "Scan script copied. Paste it into a terminal on the machine, then copy the JSON line it prints."
        : "Scan script copied. Paste it into PowerShell on the machine.",
      "success",
    );
  });
  hardwareImportApply.addEventListener("click", importHardwareScan);
  hardwareImportJson.addEventListener("input", syncHardwareImportMachine);
  hardwareImportMachine.addEventListener("input", () => {
    hardwareImportMachine.dataset.autofilled = "false";
    syncHardwareImportMachine();
  });
  hardwareEntryAdd.addEventListener("click", addHardwareMachine);

  hardwareAgentInstaller.value = buildHardwareAgentInstaller();
  hardwareAgentUninstall.value = hardwareAgentUninstallScript;
  hardwareDeviceCreate.addEventListener("click", createHardwareDevice);
  hardwareDeviceTokenCopy.addEventListener("click", async () => {
    await copyAdminText(hardwareDeviceToken.value, hardwareDeviceToken);
    setAdminStatus(hardwareDeviceStatus, "Device token copied.", "success");
  });
  hardwareAgentInstallerCopy.addEventListener("click", async () => {
    await copyAdminText(hardwareAgentInstaller.value, hardwareAgentInstaller);
    setAdminStatus(
      hardwareDeviceStatus,
      "Installer copied. Paste it into PowerShell on the machine, then paste the token when prompted.",
      "success",
    );
  });

  hardwareForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const invalid = validateHardwareEditor();
    if (invalid) {
      setAdminStatus(hardwareAdminStatus, invalid.message, "error");
      invalid.field.focus();
      return;
    }
    const entries = collectHardwareEntries();
    const machineOrder = getHardwareMachineCards()
      .map((card) => card.querySelector("[data-hw-machine-name]").value.trim())
      .filter(Boolean)
      .map((machine, index) => ({ machine, position: index + 1 }));
    const agentRenames = getHardwareMachineCards()
      .map((card) => ({
        from: card.dataset.originalName ?? "",
        to: card.querySelector("[data-hw-machine-name]").value.trim(),
      }))
      .filter(({ from, to }) => hardwareAgentMachines.has(from) && to && to !== from);

    hardwareSubmit.disabled = true;
    hardwareSubmit.textContent = "> SAVING...";
    setAdminStatus(hardwareAdminStatus, "Writing hardware...");
    // Rename agent devices first so their next sync lands on the new name.
    for (const { from, to } of agentRenames) {
      const renameError = await renameHardwareMachine(from, to, { device: true });
      if (renameError) {
        hardwareSubmit.disabled = false;
        hardwareSubmit.textContent = "> SAVE_HARDWARE";
        setAdminStatus(hardwareAdminStatus, `Renaming ${from} failed: ${renameError.message}`, "error");
        return;
      }
    }
    const failedUpdate = await syncRepeatableEntries(
      repeatableEditors.hardware,
      entries,
      new Date().toISOString(),
    );
    hardwareSubmit.disabled = false;
    hardwareSubmit.textContent = "> SAVE_HARDWARE";
    if (agentRenames.length) {
      await loadHardwareDevices();
    }

    if (failedUpdate) {
      console.error("Unable to save hardware:", failedUpdate.error);
      setAdminStatus(
        hardwareAdminStatus,
        `Hardware update failed: ${failedUpdate.error.message}`,
        "error",
      );
      return;
    }
    if (machineOrder.length) {
      const { error } = await adminClient.from("site_hardware_machine_order")
        .upsert(machineOrder, { onConflict: "machine" });
      if (error) {
        console.error("Unable to save machine order:", error);
        clearPublicContentCache();
        setAdminStatus(hardwareAdminStatus, `Components saved, but machine order failed: ${error.message}. Retry saving.`, "error");
        return;
      }
    }
    if (!await loadHardware()) {
      return;
    }
    clearPublicContentCache();
    setAdminStatus(hardwareAdminStatus, "Hardware updated.", "success");
  });

  logoutButton.addEventListener("click", async () => {
    const { error } = await adminClient.auth.signOut();

    if (error) {
      console.error("Unable to log out:", error);
      setAdminStatus(inboxStatus, `Logout failed: ${error.message}`, "error");
      return;
    }

    showLogin();
    window.dispatchEvent(new CustomEvent("admin:logged-out"));
  });

  adminClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("Unable to restore session:", error);
      setAdminStatus(loginStatus, `Session check failed: ${error.message}`, "error");
      return;
    }

    if (data.session) {
      showInbox();
    }
  });
}
