# Part 13 — Services and systemd

## 13.1 What systemd is, practically

systemd is PID 1 on virtually every modern distribution (Ubuntu, Amazon Linux 2/2023, RHEL family) — it's the init system: the first process the kernel starts, responsible for bringing up all other services, managing their lifecycle, dependencies, restart policy, and logging.

**Units** are the objects systemd manages — most commonly `.service` (a daemon/process), but also `.timer` (scheduled jobs, the modern cron alternative), `.mount`, `.socket`, `.target` (a grouping/milestone, like `multi-user.target`, roughly equivalent to an old-style runlevel).

## `systemctl`
**Purpose:** Control and inspect systemd units — the primary command you'll run against services all day.
```bash
systemctl status nginx              # current state, recent log lines, main PID
systemctl start nginx                 # start now (doesn't persist across reboot by itself)
systemctl stop nginx                    # stop now
systemctl restart nginx                   # stop then start
systemctl reload nginx                      # ask the service to reload config WITHOUT dropping connections (if supported)
systemctl enable nginx                        # start automatically on future boots
systemctl disable nginx                         # don't start automatically on boot
systemctl enable --now nginx                      # enable AND start in one command — common combo
systemctl is-active nginx                            # just the state, script-friendly (returns exit code too)
systemctl is-enabled nginx                             # is it set to start on boot?
systemctl list-units --type=service --state=running      # see everything currently running
systemctl daemon-reload                                    # reload systemd's unit definitions after editing a unit file
```
**Example output (`systemctl status`):**
```text
● nginx.service - A high performance web server
     Loaded: loaded (/lib/systemd/system/nginx.service; enabled; vendor preset: enabled)
     Active: active (running) since Wed 2026-08-19 08:00:12 UTC; 1h 41min ago
   Main PID: 1523 (nginx)
      Tasks: 5 (limit: 4683)
     Memory: 12.4M
        CPU: 891ms
     CGroup: /system.slice/nginx.service
             ├─1523 nginx: master process
             └─1524 nginx: worker process
```
**`enable` vs `start` — the distinction that trips people up constantly:**
| | Affects now? | Affects future reboots? |
|---|---|---|
| `start` | Yes | No |
| `enable` | No | Yes |
| `enable --now` | Yes | Yes |
A service can be **running but not enabled** (works now, won't survive a reboot — a common post-manual-troubleshooting gotcha) or **enabled but not running** (will start on next boot, but isn't active right now, e.g. right after a crash before the restart policy kicks in).
**Risk:** 🟡 USE WITH CARE (`stop`/`restart` cause real downtime for that service)

## `journalctl`
**Purpose:** Query the systemd journal — the centralized structured log store that (on systemd-based distros) most services log into by default, instead of separate flat files.
```bash
journalctl -u nginx                    # all logs for one unit
journalctl -u nginx -f                   # follow live, like tail -f
journalctl -u nginx --since "1 hour ago"   # time-bounded
journalctl -u nginx --since "2026-08-19 09:00" --until "2026-08-19 10:00"
journalctl -p err                            # only priority "error" or worse, across ALL units
journalctl -k                                  # kernel messages only (equivalent to old `dmesg`)
journalctl -b                                    # logs since the current boot only
journalctl -b -1                                   # logs from the PREVIOUS boot — critical after an unexpected reboot
journalctl --disk-usage                              # how much space the journal itself is consuming
sudo journalctl --vacuum-time=7d                       # trim the journal to keep only the last 7 days
sudo journalctl --vacuum-size=500M                       # or cap total journal size
```
**Real-world example — "why did the service crash 20 minutes ago":**
```bash
journalctl -u myapp --since "20 minutes ago" -p warning
```
**Risk:** 🟢 SAFE for reading; 🟡 USE WITH CARE for `--vacuum-*` (deletes old log history)

## `systemd-analyze`
**Purpose:** Boot performance analysis — which units are slowing down startup.
```bash
systemd-analyze                    # total boot time breakdown (kernel vs userspace)
systemd-analyze blame                # units sorted by how long each took to start, slowest first
systemd-analyze critical-chain         # the actual dependency chain that determined total boot time
```
**Risk:** 🟢 SAFE

## `loginctl`
**Purpose:** Manage/inspect logged-in user sessions (systemd-logind).
```bash
loginctl list-sessions
loginctl show-session <id>
```
**Risk:** 🟢 SAFE

## Service lifecycle and restart policies

Inside a unit file's `[Service]` section:
```ini
Restart=on-failure          # restart automatically if it exits with a non-zero code (also: always, on-abnormal, no)
RestartSec=5                  # wait 5s before restarting
StartLimitBurst=5               # give up after 5 restart attempts...
StartLimitIntervalSec=60          # ...within a 60-second window (prevents infinite crash-restart-loop churn)
```
This is why a crashing service sometimes "self-heals" (you see it flapping in `journalctl`, then stabilizing) and sometimes ends up fully `failed` — it hit the start-limit and systemd gave up, requiring a manual `systemctl reset-failed` + `systemctl start` after the underlying issue is fixed.

## Creating a basic custom systemd service

```ini
# /etc/systemd/system/myapp.service
[Unit]
Description=My Application
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/app/current
ExecStart=/usr/bin/node /opt/app/current/server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=-/opt/app/current/.env

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload         # required after creating/editing any unit file
sudo systemctl enable --now myapp
sudo systemctl status myapp
```
**Key directives:** `After=network.target` (ordering, not a hard dependency — use `Requires=` for a hard dependency); `Type=simple` (the default — the process itself IS the main service process; use `Type=forking` for old-style daemons that fork and exit the parent); `Restart=on-failure` + `RestartSec` (the self-healing policy above); `EnvironmentFile=-/path` (the leading `-` means "don't error if this file is missing" — useful for optional env overrides); `WantedBy=multi-user.target` (what makes `enable` actually wire it into the normal boot sequence).

---

# Part 14 — Logs and Journal Management

## 14.1 Where logs live

| Location | Contents |
|---|---|
| `/var/log/syslog` (Debian/Ubuntu) or `/var/log/messages` (RHEL/Amazon Linux) | General system log |
| `/var/log/auth.log` (Debian/Ubuntu) or `/var/log/secure` (RHEL/Amazon Linux) | Authentication/sudo events — first place to check for SSH/login incidents |
| `/var/log/kern.log` | Kernel messages |
| `/var/log/<appname>/` | Most applications log to their own subdirectory here |
| systemd journal (`journalctl`) | Structured, centralized log for anything using systemd's logging — increasingly the primary source on modern distros, sometimes *instead of* separate flat files |

**Amazon Linux note:** the RHEL-family naming (`/var/log/messages`, `/var/log/secure`) differs from Debian/Ubuntu (`/var/log/syslog`, `/var/log/auth.log`) — same purpose, different filenames; muscle memory built on one will initially trip you up on the other.

## Investigating logs — practical workflow

```bash
# 1. Something's wrong right now — watch live
sudo journalctl -f
tail -F /var/log/app/app.log

# 2. Narrow to the relevant service/time window
journalctl -u myapp --since "10 minutes ago"

# 3. Filter to severity
journalctl -u myapp -p err --since today

# 4. Cross-reference with system-level events (OOM kills, disk issues) at the same timestamp
journalctl --since "09:14:00" --until "09:15:00"

# 5. For flat-file logs, the grep/awk pipelines from Part 3 apply directly
grep "09:14" /var/log/app/app.log | grep ERROR
```

## `zgrep`
**Purpose:** `grep`, but transparently searches inside gzip-compressed files — essential because rotated old logs are usually `.gz`.
```bash
zgrep "ERROR" /var/log/app/app.log.3.gz
zgrep "ERROR" /var/log/app/*.gz            # search across all compressed rotations at once
```
**Risk:** 🟢 SAFE

## `logrotate`
**Purpose:** Automatically rotate, compress, and eventually delete log files on a schedule/size trigger — prevents any single log from growing unbounded and filling the disk (Part 7/8's "disk full" scenario).
```bash
cat /etc/logrotate.d/myapp
```
```text
/var/log/myapp/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 deploy deploy
    sharedscripts
    postrotate
        systemctl reload myapp > /dev/null 2>&1 || true
    endscript
}
```
**Key directives:**
| Directive | Meaning |
|---|---|
| `daily` / `weekly` / `size 100M` | rotation trigger |
| `rotate 14` | keep 14 rotated copies before deleting the oldest |
| `compress` | gzip old rotations |
| `delaycompress` | don't compress the MOST recently rotated file yet (gives a still-open file handle time to finish, avoiding the deleted-file issue from Part 8) |
| `missingok` | don't error if the log doesn't exist |
| `notifempty` | don't rotate an empty file |
| `create 0640 user group` | recreate the log file fresh after rotation, with these perms/owner |
| `postrotate ... endscript` | run a command after rotating — **critically**, this is where you tell the application to reopen its log file (reload/HUP), directly solving the "deleted but still open" disk-space leak from Part 8 |
```bash
sudo logrotate -d /etc/logrotate.d/myapp     # -d: dry run, shows what WOULD happen
sudo logrotate -f /etc/logrotate.d/myapp       # -f: force rotation now, for testing
```
**Common mistake:** forgetting the `postrotate` reload hook — the application keeps writing to the old (now-renamed/deleted) file handle forever, and rotation stops helping at all until the app is restarted.
**Risk:** 🟢 SAFE (dry run); 🟡 USE WITH CARE (forced rotation, and errors in the postrotate script can leave services in a bad reload state)
