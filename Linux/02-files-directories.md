# Part 2 — Files and Directories

## `touch`
**Purpose:** Create an empty file, or update an existing file's modification timestamp without changing content.
**Example:** `touch app.log` (create), `touch -d "2 hours ago" file.txt` (backdate).
**DevOps use:** creating placeholder files, forcing a file's mtime forward to trigger a watcher/rsync re-sync.
**Risk:** 🟢 SAFE

## `mkdir`
**Purpose:** Create directories.
```bash
mkdir releases
mkdir -p /opt/app/releases/2026-08-19/logs   # -p: create all intermediate dirs, no error if exists
```
**Common mistake:** forgetting `-p` when creating nested paths — fails with "No such file or directory" on the first missing parent.
**Risk:** 🟢 SAFE

## `cp`
**Purpose:** Copy files/directories.
```bash
cp app.conf app.conf.bak
cp -r /opt/app/current /opt/app/backup-$(date +%F)   # -r: recursive, required for directories
cp -a source/ dest/                                    # -a (archive): preserves permissions, timestamps, symlinks — best for backups
```
**Useful options:**
| Option | Meaning |
|---|---|
| `-r` | recursive (directories) |
| `-a` | archive mode: preserves attrs, recursive, no dereference of symlinks |
| `-v` | verbose, prints each file copied |
| `-n` | no-clobber, never overwrite existing files |
| `-p` | preserve mode/ownership/timestamps (subset of `-a`) |
**Common mistake:** `cp source dest` where `dest` is a directory that doesn't exist yet — silently copies to a file *named* `dest` instead of creating that directory with the content inside. Always verify the destination exists first, or use `-r` with trailing slash intent clear.
**Risk:** 🟡 USE WITH CARE (can silently overwrite files without `-n` or `-i`)

## `mv`
**Purpose:** Move or rename files/directories (same operation in Linux).
```bash
mv app.conf.new app.conf     # atomic-ish rename (same filesystem = truly atomic, used for safe config swaps)
mv /opt/app/releases/2026-08-19 /opt/app/current
```
**DevOps insight:** `mv` on the *same filesystem* is an atomic rename at the OS level — this is the standard trick for zero-downtime deploys ("build in a temp dir, then `mv` into place") because there's no moment where the target path is half-written.
**Risk:** 🟡 USE WITH CARE (overwrites destination silently without `-i`/`-n`)

## `rm`
**Purpose:** Delete files/directories.
```bash
rm old.log
rm -r old_release/           # recursive, required for non-empty dirs
rm -rf /opt/app/tmp/*        # recursive + force (no confirmation, ignores nonexistent files)
```
**Why `rm -rf` is dangerous:** no undo, no trash bin, no confirmation. `rm -rf /` used to be catastrophic (modern `rm` refuses this specific case by default), but `rm -rf $DIR/*` where `$DIR` is an **unset/empty variable** expands to `rm -rf /*` — this remains one of the most common real-world production disasters, usually caused by a script bug.
```bash
# THE classic disaster pattern:
rm -rf "$BUILD_DIR"/*      # if $BUILD_DIR is unset or empty, this becomes rm -rf /*
```
**Safer alternative:** always quote variables, always validate they're non-empty before a destructive op, and use `set -u` in scripts (Part 12) so unset variables cause an immediate script failure instead of silently expanding to nothing.
```bash
: "${BUILD_DIR:?BUILD_DIR must be set}"
rm -rf "${BUILD_DIR:?}"/*
```
**Risk:** 🔴 DESTRUCTIVE — no confirmation, no recovery without backups/snapshots.

## `rmdir`
**Purpose:** Remove an *empty* directory only — a safer, narrower alternative to `rm -r` when you specifically want to fail if the directory isn't empty (sanity check before cleanup scripts proceed).
**Risk:** 🟢 SAFE (refuses to act on non-empty dirs)

## `ln` — hard and symbolic links
**Purpose:** Create links between files.
```bash
ln target.txt hardlink.txt         # hard link: same inode, same data, both names independent
ln -s /opt/app/releases/2026-08-19 /opt/app/current   # symlink: pointer to a path
```
**Hard link vs. symlink:**
| | Hard link | Symlink |
|---|---|---|
| Points to | inode (actual data) | a path (string) |
| Crosses filesystems? | No | Yes |
| Can link a directory? | No (usually) | Yes |
| Breaks if target deleted? | No — data persists until all hard links removed | Yes — becomes a "dangling" link |
| Common DevOps use | Rare | **Everywhere**: release symlink flips (`current` -> `releases/<version>`), config compatibility shims |
**The "symlink swap" deploy pattern:**
```bash
ln -sfn /opt/app/releases/2026-08-19 /opt/app/current
```
`-f` forces overwrite of the existing symlink, `-n` treats an existing symlink target as a file (not following it) — without `-n`, if `current` already points somewhere, you'd create the new link *inside* the old target directory instead of replacing it. This is a very common real bug.
**Risk:** 🟡 USE WITH CARE

## `file`
**Purpose:** Identify a file's actual type by inspecting content (not trusting the extension).
**Example:** `file app.tar.gz` → `gzip compressed data`; `file mystery_binary` → `ELF 64-bit LSB executable, x86-64`.
**When to use it:** a file has no/wrong extension, or you're unsure if a "backup.sql" is actually plain text or compressed.
**Risk:** 🟢 SAFE

## `stat`
**Purpose:** Detailed metadata about a file — permissions, owner, size, and all three timestamps.
```bash
stat app.conf
```
```text
  File: app.conf
  Size: 1024      Blocks: 8     IO Block: 4096   regular file
Access: (0644/-rw-r--r--)  Uid: (1000/ubuntu)   Gid: (1000/ubuntu)
Access: 2026-08-19 09:00:12
Modify: 2026-08-18 22:14:03
Change: 2026-08-18 22:14:03
```
**Three timestamps, often confused:**
- **Access (atime):** last time content was read.
- **Modify (mtime):** last time content changed. This is what `ls -lt` sorts by.
- **Change (ctime):** last time *metadata* changed (permissions, owner) — NOT "creation time." Linux traditionally has no true creation-time field (some modern filesystems like ext4/xfs do store a `Birth` time, shown separately if available).
**Risk:** 🟢 SAFE

## `find`
**Purpose:** Search the filesystem by name, type, size, age, permissions — far more powerful than `locate` because it's live and supports actions.
**Syntax:** `find <path> [conditions] [action]`
```bash
find /var/log -name "*.log"                    # by name
find /var/log -type f -size +100M               # regular files over 100MB
find /opt/app -type f -mtime -1                 # modified in the last 1 day
find /tmp -type f -mtime +30 -delete             # files older than 30 days — DELETE them
find / -perm -4000 2>/dev/null                   # find SUID binaries (security audit)
find /var/log -name "*.log" -exec gzip {} \;     # run gzip on each match
```
**Useful options/tests:**
| Flag | Meaning |
|---|---|
| `-name "pattern"` | filename match (case-sensitive), `-iname` for case-insensitive |
| `-type f` / `-type d` / `-type l` | file / directory / symlink |
| `-size +100M` / `-100k` | larger than / smaller than |
| `-mtime -1` / `+30` | modified within last N days / more than N days ago |
| `-mmin -60` | modified within last 60 minutes (finer-grained than `-mtime`) |
| `-user`, `-group` | owned by a specific user/group |
| `-perm` | specific permission bits |
| `-delete` | delete matches (use with extreme care) |
| `-exec cmd {} \;` | run a command per match |
| `-exec cmd {} +` | run a command once with all matches batched (faster, like `xargs`) |
**Real-world example:** "find the 10 largest files anywhere under `/var`":
```bash
find /var -type f -exec du -h {} \; 2>/dev/null | sort -rh | head -10
```
**Common mistake:** `find /tmp -name "*.log" -delete` without `-type f` — will also try to match/delete directories named `*.log`, and `-delete` requires `find` to also be able to descend, so ordering and flags matter. Always test with `-print` before swapping to `-delete`:
```bash
find /tmp -type f -mtime +30 -name "*.log" -print   # DRY RUN first
find /tmp -type f -mtime +30 -name "*.log" -delete   # then actually delete
```
**Risk:** 🟢 SAFE by default, 🔴 DESTRUCTIVE with `-delete` or `-exec rm`

## `locate`
**Purpose:** Fast filename search using a prebuilt index database (`mlocate`/`plocate`) instead of walking the live filesystem like `find`.
```bash
locate nginx.conf
sudo updatedb     # refresh the index — locate is only as fresh as the last updatedb run
```
**When to use it vs. `find`:** `locate` is much faster for "where is this file anywhere on disk" but can be **stale** (files created since the last index update won't show) and isn't installed by default on minimal server/container images. `find` is always accurate but slower on large trees. In production incident response, prefer `find` — you need current truth, not a cached index.
**Risk:** 🟢 SAFE

## `du` — disk usage (by directory/file)
**Purpose:** Show how much disk space files/directories are actually consuming.
```bash
du -sh /var/log                 # -s: summary total, -h: human-readable
du -h --max-depth=1 /var | sort -rh    # per-subdirectory breakdown, largest first — THE disk-full triage command
```
**Example output:**
```text
2.1G    /var/log
850M    /var/lib
120M    /var/cache
```
**Risk:** 🟢 SAFE

## `df` — disk usage (by filesystem/mount)
**Purpose:** Show free/used space per mounted filesystem.
```bash
df -h                 # human readable
df -hT                # also show filesystem type
df -i                 # inode usage instead of block usage — see Part 8 for why this matters
```
**Example output:**
```text
Filesystem      Size  Used Avail Use% Mounted on
/dev/nvme0n1p1   20G   18G  1.1G  95% /
```
**`du` vs `df` — the classic confusion:** `df` reports what the *filesystem* thinks is used (including space held by deleted-but-still-open files); `du` reports what's *reachable by walking directories*. If they disagree wildly, see Part 8 (`07-storage.md`) — usually a deleted file is still held open by a running process.
**Risk:** 🟢 SAFE

## `basename` / `dirname`
**Purpose:** Split a path into filename vs. directory portion — used constantly inside scripts.
```bash
basename /opt/app/releases/2026-08-19/app.log     # app.log
basename /opt/app/releases/2026-08-19/app.log .log  # app  (strip suffix too)
dirname  /opt/app/releases/2026-08-19/app.log      # /opt/app/releases/2026-08-19
```
**Real-world example (in a script):**
```bash
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"   # absolute directory the running script lives in
```
**Risk:** 🟢 SAFE

## Hidden files & recursive operations — quick notes
- Any filename starting with `.` is "hidden" from plain `ls` (not a permission, just a display convention) — see them with `ls -a`. Config files like `.bashrc`, `.ssh/`, `.env` all rely on this.
- "Recursive" (`-r`/`-R`) means "apply to this directory and everything inside it, indefinitely deep." Combined with destructive commands (`rm -rf`, `chmod -R`, `chown -R`) this is where the biggest blast-radius mistakes happen — always verify the target path before adding `-r`/`-R` to a destructive command, especially when a variable builds the path.
