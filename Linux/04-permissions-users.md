# Part 4 — Permissions and Ownership

## 4.1 The permission model

Every file/directory has an **owner** (a user) and a **group**, plus three permission sets: what the **owner**, the **group**, and **everyone else (other)** can do. Each set has three possible permissions:

| Permission | File meaning | Directory meaning |
|---|---|---|
| `r` (read, 4) | view file contents | list directory contents (`ls`) |
| `w` (write, 2) | modify file contents | create/delete/rename files inside it |
| `x` (execute, 1) | run as a program/script | enter the directory (`cd`) and access files inside by name |

**Critical, commonly-missed point:** to delete a file, you need **write permission on its parent directory**, not on the file itself. This is why a read-only file can still be deleted if the directory allows it, and why a writable file can be undeletable if the directory doesn't.

### Reading `ls -l` output

```text
-rwxr-xr-- 1 deploy www-data 1024 Aug 19 09:00 deploy.sh
```

```
-        rwx      r-x      r--
type   owner    group    other
```
- First character: `-` regular file, `d` directory, `l` symlink, `s` socket, `p` pipe, `b`/`c` block/character device.
- Then three groups of three: owner / group / other.

### Numeric (octal) permissions

Each `rwx` triplet maps to a digit 0-7 by adding: r=4, w=2, x=1.

| Digit | Meaning |
|---|---|
| 7 | rwx (read+write+execute) |
| 6 | rw- (read+write) |
| 5 | r-x (read+execute) |
| 4 | r-- (read only) |
| 0 | --- (nothing) |

**Common permission sets you'll actually use:**

| Numeric | Symbolic | Typical use |
|---|---|---|
| `600` | `rw-------` | Private files only the owner should read/write — **SSH private keys**, secrets, `.env` files |
| `644` | `rw-r--r--` | Standard readable file — configs, static web assets, most files |
| `700` | `rwx------` | Private directory — `~/.ssh`, directories holding secrets |
| `755` | `rwxr-xr-x` | Standard executable/directory — scripts, most directories, binaries |
| `775` | `rwxrwxr-x` | Group-writable directory — shared deployment directories where a group of users/services collaborate |
| `777` | `rwxrwxrwx` | Everyone can do anything — **almost never correct** |

### Why `chmod 777` is (almost) always wrong

`777` gives every user on the system — including a compromised service account, a container escape, or another tenant on a shared box — full read/write/execute. It's frequently used as a lazy fix for "permission denied" errors, but it:
- Removes any real access control, defeating the point of having users/groups at all.
- On a directory, lets *any* user delete or replace *any* file inside it, including ones they don't own.
- Is a common finding in security audits and a real attack vector (e.g., an attacker with any foothold can overwrite a `777` script that runs as root via cron).

**The correct fix is almost always** to identify the actual owner/group mismatch and correct *that* (`chown`/usermod into the right group) rather than opening permissions to everyone.

## `chmod`
**Purpose:** Change file/directory permissions.
```bash
chmod 600 ~/.ssh/id_rsa                  # numeric
chmod u+x deploy.sh                       # symbolic: add execute for owner (u)
chmod g+w /opt/app/shared                  # add write for group
chmod o-r secrets.env                       # remove read for others
chmod -R 755 /opt/app/scripts                # recursive
chmod +x deploy.sh                            # add execute for everyone (shortcut, equivalent to a+x)
```
**Symbolic syntax:** `[ugoa][+-=][rwx]` — `u`=user/owner, `g`=group, `o`=other, `a`=all; `+` add, `-` remove, `=` set exactly.
**Real-world example:** you clone a script from git and it's not executable:
```bash
chmod +x deploy.sh
./deploy.sh
```
**Common mistake:** `chmod -R 777 /some/dir` "to fix a permission error" without understanding *why* it was denied — this is the single most common permission anti-pattern in production. Diagnose the actual owner/group mismatch first (see troubleshooting flow below).
**Risk:** 🟡 USE WITH CARE, 🔴 DESTRUCTIVE with `-R` on the wrong path (can lock yourself out of a directory, e.g. `chmod -R 000`, or expose secrets with an overly permissive recursive grant)

## `chown`
**Purpose:** Change file/directory owner (and optionally group).
```bash
chown deploy app.log                    # change owner only
chown deploy:www-data app.log             # change owner AND group
chown -R deploy:deploy /opt/app             # recursive — common after extracting a tarball as root
```
**Real-world example:** you `sudo`-extracted a deployment tarball, so every file is owned by `root`, but the app runs as `deploy`:
```bash
sudo chown -R deploy:deploy /opt/app/current
```
**Risk:** 🟡 USE WITH CARE, 🔴 with `-R` on the wrong path — only root or the current owner can chown (an unprivileged user can't give away files they don't own, by design)

## `chgrp`
**Purpose:** Change group ownership only (subset of what `chown user:group` can do).
```bash
chgrp www-data /var/www/app
```
**Risk:** 🟡 USE WITH CARE

## `umask`
**Purpose:** The default permission *mask* applied to newly created files/directories — it subtracts from the maximum (666 for files, 777 for directories).
```bash
umask          # show current mask, commonly 022
umask 027        # set for this session — new files: 640, new dirs: 750
```
**How it works:** default max is `666` (files never get execute by default) / `777` (dirs). Umask `022` subtracts write from group and other: `666 - 022 = 644` for new files, `777 - 022 = 755` for new dirs. A stricter `umask 027` gives files `640` and dirs `750` — no access at all for "other," used on servers holding sensitive data.
**Where it's set:** `/etc/profile`, `~/.bashrc`, or per-service in systemd unit files (`UMask=`).
**Risk:** 🟢 SAFE (affects future files only, not existing ones)

## `id`, `whoami`, `groups`
```bash
whoami            # ubuntu
id                 # uid=1000(ubuntu) gid=1000(ubuntu) groups=1000(ubuntu),4(adm),27(sudo),999(docker)
groups deploy       # which groups a specific user belongs to
```
**Why `id` matters more than `whoami`:** group membership (especially `sudo`/`wheel`, `docker`, `adm`) is *why* you can or can't run certain commands — `id` shows the full picture, `whoami` only tells you the username.
**Risk:** 🟢 SAFE

## `passwd`
**Purpose:** Change a user's password.
```bash
passwd              # change your own password
sudo passwd deploy    # set/reset another user's password (root only)
sudo passwd -l deploy   # LOCK an account (disable password login) without deleting it
```
**Production note:** most cloud servers disable password SSH auth entirely (key-only), so `passwd` is mostly relevant for `su`/console access or local service accounts, not day-to-day SSH.
**Risk:** 🟡 USE WITH CARE

## `su`
**Purpose:** Switch to another user (or root), starting a new shell as them.
```bash
su - deploy       # switch to deploy, with their full login environment (the `-` matters — loads their profile/env)
su root             # switch to root, prompts for root's password
```
**`su` vs `sudo`:** `su` requires knowing the *target* user's password and gives you a full persistent shell as them; `sudo` uses *your own* password (or none, if configured) to run a single command (or `sudo -i`/`sudo su -` for a full root shell) with an audit trail in `/var/log/auth.log`. **`sudo` is preferred in production** because every elevated action is individually logged and attributable to a real person.
**Risk:** 🟡 USE WITH CARE

## `sudo`
**Purpose:** Run a single command with another user's privileges (root by default), governed by `/etc/sudoers` (edit only via `visudo`, never directly — it validates syntax before saving, preventing you from locking out all sudo access with a typo).
```bash
sudo systemctl restart nginx
sudo -u postgres psql              # run as a specific non-root user
sudo -i                              # full root login shell
sudo -l                                # list what commands you're permitted to run
```
**Risk:** 🟡 USE WITH CARE — everything you run is at full privilege; think before hitting Enter on anything with `-r`, `-f`, or a pipe to `sh`.

---

## Practical DevOps permission scenarios

**SSH keys:** private key must be `600` (or `400`), owned by the user, inside a `700` `~/.ssh` directory — SSH itself refuses to use a private key with looser permissions ("UNPROTECTED PRIVATE KEY FILE" error) as a built-in security guard.
```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub
chmod 600 ~/.ssh/authorized_keys
```

**Application deploy directories:** app runs as a dedicated non-root user (e.g. `deploy` or the app name), owns its own directories, and the deploy user is added to the group of any shared resource (e.g. `www-data` for files Nginx also needs to read).
```bash
sudo chown -R deploy:deploy /opt/app
sudo chmod -R 750 /opt/app
```

**Log files:** typically owned by the service user or `syslog`/`root`, group-readable by `adm` so admins can read logs without full root:
```bash
ls -l /var/log/syslog
# -rw-r----- 1 syslog adm ...
```

**Docker volumes / bind mounts:** a very common real bug — a container running as UID 1000 writes files that appear owned by "whatever UID 1000 maps to" on the host, which may not match any real host user, causing "permission denied" for host-side tooling. Fix by matching UIDs between host and container (`--user $(id -u):$(id -g)`) or adjusting ownership post-write.

**Config files with secrets:** `600`, owned by the service account only — never group- or world-readable.
```bash
chmod 600 /opt/app/.env
```

---

# Part 5 — Users and Groups

## Key files

| File | Contains |
|---|---|
| `/etc/passwd` | User accounts: username, UID, GID, home dir, login shell (passwords are NOT stored here anymore) |
| `/etc/shadow` | Actual (hashed) passwords and password aging policy — readable by root only |
| `/etc/group` | Group definitions and membership |
| `/etc/sudoers` | Who can run what via `sudo` — edit only with `visudo` |

```bash
cat /etc/passwd | head -3
```
```text
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
ubuntu:x:1000:1000:Ubuntu:/home/ubuntu:/bin/bash
```
Fields: `username:x(placeholder):UID:GID:comment:home_dir:login_shell`. A shell of `/usr/sbin/nologin` or `/bin/false` means "this account can't get an interactive shell" — standard for service accounts (e.g. `www-data`, `postgres`) that should never be logged into directly.

## `useradd` / `adduser`
**Purpose:** Create a new user.
```bash
sudo useradd -m -s /bin/bash -G sudo deploy    # -m: create home dir, -s: shell, -G: supplementary groups
sudo adduser deploy                              # Debian/Ubuntu-friendly interactive wrapper around useradd
```
**Amazon Linux note:** `useradd` is the low-level command everywhere; `adduser` as an interactive wrapper is a Debian/Ubuntu convenience script and is **not present by default on RHEL-family/Amazon Linux** — use `useradd` directly there.
**Risk:** 🟡 USE WITH CARE

## `usermod`
**Purpose:** Modify an existing user.
```bash
sudo usermod -aG docker deploy         # -aG: APPEND to supplementary group (critical: -G alone REPLACES all groups)
sudo usermod -s /bin/bash deploy         # change login shell
sudo usermod -L deploy                     # lock the account
```
**Common mistake:** `usermod -G docker deploy` (without `-a`) — this *replaces* all of the user's supplementary groups with just `docker`, silently removing them from `sudo`, `adm`, etc. Always use `-aG` to append.
**Risk:** 🟡 USE WITH CARE

## `userdel`
**Purpose:** Delete a user.
```bash
sudo userdel deploy            # removes the user account only
sudo userdel -r deploy           # -r: also remove their home directory and mail spool
```
**Risk:** 🔴 DESTRUCTIVE with `-r` (deletes their home directory permanently)

## `groupadd` / `groupmod` / `groupdel`
```bash
sudo groupadd deployers
sudo groupmod -n developers deployers    # rename a group
sudo groupdel deployers                    # delete a group (fails if it's still any user's primary group)
```
**Risk:** 🟡 USE WITH CARE

## `getent`
**Purpose:** Query user/group/host databases through the system's configured lookup mechanism (files, LDAP, etc.) — more reliable than grepping `/etc/passwd` directly, especially where identity is centrally managed.
```bash
getent passwd deploy
getent group docker
getent hosts example.com
```
**Risk:** 🟢 SAFE

## Secure administration practices
- Never share a login among multiple humans — one account per person, `sudo` for elevation, so actions are individually auditable.
- Disable direct root SSH login (`PermitRootLogin no` in `sshd_config`) — force `sudo` through a named account.
- Use groups to grant capability (`docker`, `sudo`, `adm`) rather than editing `/etc/sudoers` per-user for one-off grants.
- Lock (`usermod -L` / `passwd -l`) rather than immediately delete accounts for departing team members initially, in case of pending audits/handover; delete later per policy.
- Review `/etc/sudoers` and `sudo -l` periodically — sudo drift ("temporary" broad grants that never get revoked) is a common audit finding.
