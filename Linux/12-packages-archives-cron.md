# Part 15 — Package Management

## Debian/Ubuntu — `apt`

## `apt`
**Purpose:** High-level package management (install/remove/update) for Debian-family distros.
```bash
sudo apt update                       # refresh the package INDEX from repositories (does NOT install anything)
sudo apt upgrade                        # upgrade all installed packages to latest available versions
sudo apt install nginx                    # install a package
sudo apt install nginx=1.18.0-6ubuntu14     # install a SPECIFIC version
sudo apt remove nginx                         # remove package, keep config files
sudo apt purge nginx                            # remove package AND its config files
sudo apt autoremove                               # remove packages that were auto-installed as dependencies and are no longer needed
apt search nginx                                    # search available packages
apt show nginx                                        # detailed info about a package
apt list --installed                                    # list everything currently installed
apt list --upgradable                                     # what has updates available
```
**`update` vs `upgrade` — the #1 point of confusion for newcomers:** `update` refreshes the local index of *what's available*, it changes nothing installed; `upgrade` actually installs newer versions of already-installed packages, based on that index. You almost always run `update` immediately before `upgrade`.
**Risk:** 🟢 SAFE (`update`, `search`, `show`, `list`); 🟡 USE WITH CARE (`install`, `upgrade`, `remove` — can affect running services or break dependencies)

## `apt-cache`
**Purpose:** Query the local package cache/index without hitting the network — faster for repeated lookups, and works offline.
```bash
apt-cache search nginx
apt-cache policy nginx        # shows installed version vs. candidate version, and WHICH repo it'll come from — useful for pinning/version debugging
```
**Risk:** 🟢 SAFE

## `dpkg`
**Purpose:** The low-level package tool `apt` is actually built on — installs/queries individual `.deb` files directly, without dependency resolution or repository awareness.
```bash
sudo dpkg -i package.deb          # install a downloaded .deb file directly
dpkg -l | grep nginx                 # list installed packages matching a pattern
dpkg -L nginx                          # list every FILE a package installed — useful for finding config paths
dpkg -S /etc/nginx/nginx.conf            # reverse lookup: which package owns this file
```
**When to use `dpkg` vs `apt`:** use `apt` for anything from a repository (it resolves dependencies automatically); drop to `dpkg -i` only for a standalone `.deb` you downloaded directly, then run `sudo apt -f install` immediately after if it complains about missing dependencies (which `dpkg` alone can't resolve).
**Risk:** 🟡 USE WITH CARE

---

## RHEL/CentOS/Amazon Linux/Fedora — `dnf` / `yum`

## `dnf`
**Purpose:** Modern high-level package manager for RHEL-family distros (Amazon Linux 2023, RHEL 8+, Fedora, Rocky, Alma) — the successor to `yum`, same conceptual role as `apt`.
```bash
sudo dnf check-update             # like `apt update`, list what has updates (doesn't install)
sudo dnf update                     # update all packages (like `apt upgrade`)
sudo dnf install nginx                # install
sudo dnf remove nginx                   # remove
dnf search nginx                          # search
dnf info nginx                              # package details
dnf list installed                            # list installed packages
sudo dnf autoremove                             # clean up orphaned dependencies
```
**Risk:** 🟢 SAFE (query commands); 🟡 USE WITH CARE (install/update/remove)

## `yum`
**Purpose:** The predecessor to `dnf` — same command surface/syntax for almost everything, still the primary tool on Amazon Linux 2. On Amazon Linux 2023 and RHEL 8+, `yum` is typically a symlink/alias to `dnf`.
```bash
sudo yum install nginx
sudo yum update
sudo yum remove nginx
```
**Amazon Linux note:** **Amazon Linux 2** uses `yum` as primary; **Amazon Linux 2023** uses `dnf` as primary (with `yum` aliased for compatibility). Check `/etc/os-release` if unsure which generation you're on.
**Risk:** same as `dnf`

## `rpm`
**Purpose:** Low-level package tool underlying `yum`/`dnf` — the RHEL-family equivalent of `dpkg`.
```bash
sudo rpm -ivh package.rpm         # install a standalone .rpm file (-i install, -v verbose, -h hash progress)
rpm -qa | grep nginx                 # query all installed packages matching a pattern
rpm -ql nginx                          # list files installed by a package
rpm -qf /etc/nginx/nginx.conf            # reverse lookup: which package owns this file
```
**Risk:** 🟡 USE WITH CARE

## Repositories and version checking
```bash
# Ubuntu/Debian
cat /etc/apt/sources.list
ls /etc/apt/sources.list.d/

# Amazon Linux / RHEL
dnf repolist
cat /etc/yum.repos.d/*.repo
```
**Checking the OS/distro itself:**
```bash
cat /etc/os-release       # works on virtually every modern distro — the reliable way to identify what you're on
```

---

# Part 16 — Compression and Archives

## `tar`
**Purpose:** Bundle multiple files/directories into a single archive (optionally compressed) — the standard format for backups and deployment artifacts.
```bash
tar -czf archive.tar.gz /opt/app/data          # -c create, -z gzip, -f filename
tar -xzf archive.tar.gz                           # -x extract
tar -xzf archive.tar.gz -C /opt/restore              # -C: extract INTO a specific directory
tar -tzf archive.tar.gz                                # -t: list contents WITHOUT extracting (always check first on an unfamiliar archive)
tar -czf archive.tar.gz -C /opt/app data                 # -C before the path being added: store relative paths (Part 12 backup script pattern)
tar --exclude='*.log' -czf archive.tar.gz /opt/app           # exclude a pattern
```
**Flag mnemonics:** `c`=create, `x`=extract, `t`=list(test), `z`=gzip, `j`=bzip2, `J`=xz, `f`=filename (always last in the flag cluster since it takes the following argument), `v`=verbose.
**Common mistake:** extracting an untrusted/unfamiliar archive without checking contents first — `tar -tzf` shows what's inside without writing anything, protecting against a "tar bomb" (an archive that dumps hundreds of files into your current directory instead of one contained folder).
**Risk:** 🟢 SAFE (create, list); 🟡 USE WITH CARE (extract — can overwrite existing files)

## `gzip` / `gunzip`
**Purpose:** Compress/decompress a single file (not an archive format itself — that's what `tar` is for; `gzip` alone doesn't bundle multiple files).
```bash
gzip app.log                # compresses IN PLACE, produces app.log.gz, removes original
gunzip app.log.gz              # decompresses in place
gzip -k app.log                  # -k: keep the original file too
zcat app.log.gz                    # view compressed content without fully decompressing to disk
```
**Risk:** 🟢 SAFE

## `zip` / `unzip`
**Purpose:** The cross-platform archive+compression format (unlike tar+gzip, `zip` bundles AND compresses in one format, and is natively readable on Windows/macOS without extra tools) — common when the artifact needs to be handed to non-Linux users, or for AWS Lambda deployment packages.
```bash
zip -r archive.zip /opt/app/dist        # -r: recursive
unzip archive.zip
unzip -l archive.zip                       # list contents without extracting
unzip archive.zip -d /opt/restore            # extract to a specific directory
```
**Risk:** 🟢 SAFE (create, list); 🟡 USE WITH CARE (extract)

## `xz` / `bzip2`
**Purpose:** Alternative compression algorithms — both compress tighter than `gzip` (smaller output) at the cost of more CPU time to compress.
```bash
tar -cJf archive.tar.xz /opt/app/data      # xz: best compression ratio, slowest
tar -cjf archive.tar.bz2 /opt/app/data       # bzip2: middle ground
```
**When to choose which:** `gzip` (`.tar.gz`) for the everyday default — fast, universally supported, good-enough ratio; `xz` (`.tar.xz`) when archive size matters more than CPU/time (e.g. long-term cold storage, bandwidth-constrained transfer); `bzip2` is less commonly chosen for new workflows today since `xz` generally beats it on ratio.
**Risk:** 🟢 SAFE

## Backup and deployment examples
```bash
# Timestamped compressed backup
tar -czf "backup-$(date +%Y%m%d-%H%M%S).tar.gz" -C /opt/app data

# Deployment artifact, excluding dev-only files
tar --exclude='node_modules' --exclude='.git' -czf release.tar.gz -C /opt/app/build .

# Transfer and extract in one pipeline (no intermediate file on either end)
tar -czf - -C /opt/app data | ssh user@backup-host "cat > /backups/data-$(date +%F).tar.gz"
```

---

# Part 20 — Cron and Scheduled Jobs

## `crontab`
**Purpose:** Schedule recurring commands per-user.
```bash
crontab -l              # list current user's cron jobs
crontab -e                # edit current user's cron jobs (opens $EDITOR)
crontab -u deploy -l         # list ANOTHER user's crontab (root only)
sudo crontab -e                # edit root's crontab
```

### Cron syntax
```
* * * * * command_to_run
│ │ │ │ │
│ │ │ │ └── day of week (0-6, Sunday=0, or names: sun,mon...)
│ │ │ └──── month (1-12)
│ │ └────── day of month (1-31)
│ └──────── hour (0-23)
└────────── minute (0-59)
```
```bash
0 2 * * *        /opt/scripts/backup.sh                  # every day at 2:00 AM
*/15 * * * *      /opt/scripts/health-check.sh             # every 15 minutes
0 0 * * 0          /opt/scripts/weekly-report.sh             # every Sunday at midnight
0 9-17 * * 1-5       /opt/scripts/hourly-check.sh              # every hour, 9am-5pm, weekdays only
```
| Symbol | Meaning |
|---|---|
| `*` | every value |
| `*/N` | every N units |
| `A-B` | range |
| `A,B,C` | specific list |

**Critical production practices for cron jobs:**
```bash
0 2 * * * /usr/bin/flock -n /tmp/backup.lock /opt/scripts/backup.sh >> /var/log/backup.log 2>&1
```
- **Always use absolute paths** to both the interpreter/script and inside the script itself (Part 1/11 — cron's `PATH` is minimal).
- **Always redirect output** (`>> logfile 2>&1`) — cron emails output to the local mail spool by default, which usually nobody reads; capture it to a real log instead.
- **`flock`** (shown above) prevents overlapping runs if a job sometimes takes longer than its interval — without it, a slow backup can pile up multiple concurrent instances.
- Environment variables available in cron are minimal and different from your login shell — set anything the script needs explicitly at the top of the crontab (`PATH=...`, `MAILTO=...`) or inside the script itself.
**Risk:** 🟡 USE WITH CARE (silent failures are the #1 real-world cron problem — always verify logging/alerting is actually wired up)

## System-wide cron
```text
/etc/crontab                  # system crontab, has an extra "user" field
/etc/cron.d/                    # drop-in files, same format as /etc/crontab, preferred for package-installed jobs
/etc/cron.daily/, /etc/cron.hourly/, /etc/cron.weekly/   # run-parts directories — drop an executable script in, no crontab syntax needed
```

## `at`
**Purpose:** Schedule a **one-time** future command (vs. cron's recurring schedule).
```bash
echo "systemctl restart myapp" | at 02:00
at now + 30 minutes
atq              # list pending at jobs
atrm <job_id>       # cancel one
```
**When to use `at` vs `cron`:** `at` for a genuine one-off ("restart this service tonight at 2am, just this once"); `cron` for anything recurring.
**Risk:** 🟡 USE WITH CARE

## systemd timers (the modern cron alternative)
**Purpose:** systemd's native scheduling mechanism — increasingly preferred over cron on systemd-based distros because it integrates with journal logging, dependency ordering, and `Restart=`/resource-limit features that cron jobs don't get.
```ini
# /etc/systemd/system/backup.service
[Unit]
Description=Nightly backup

[Service]
Type=oneshot
ExecStart=/opt/scripts/backup.sh
```
```ini
# /etc/systemd/system/backup.timer
[Unit]
Description=Run backup nightly

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true

[Install]
WantedBy=timers.target
```
```bash
sudo systemctl enable --now backup.timer
systemctl list-timers                     # see all scheduled timers and their next run time
journalctl -u backup.service                # logs go through the normal journal, unlike plain cron
```
**`Persistent=true`** is a meaningful advantage over cron: if the machine was off/rebooting at the scheduled time, the timer fires as soon as the system is back up, instead of silently skipping that run entirely (cron's default behavior).
**When to still use cron:** simple one-off personal scripts, or environments/teams standardized on cron already — systemd timers require more setup (two files instead of one line) for simple cases.
**Risk:** 🟡 USE WITH CARE
