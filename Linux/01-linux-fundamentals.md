# Part 1 — Linux Fundamentals

## 1.1 What Linux actually is

Linux is a **kernel** — the core program that talks to hardware, manages memory, schedules processes, and handles filesystems. What people call "Linux" (Ubuntu, Amazon Linux, CentOS) is really a **distribution**: the kernel plus a package manager, init system, and userland tools bundled together.

**Why this matters for DevOps:** when you SSH into an EC2 instance, you're not really choosing "Linux" — you're choosing a distribution, and that choice determines your package manager (`apt` vs `dnf`/`yum`), default user (`ubuntu` vs `ec2-user`), file layout conventions, and init system behavior. Every production incident eventually touches one of these.

### Distributions you'll meet in AWS

| Distro | Family | Package manager | Default AMI user | Notes |
|---|---|---|---|---|
| Ubuntu | Debian | `apt` | `ubuntu` | Most common for general workloads, huge community |
| Amazon Linux 2023 | RHEL-like | `dnf` | `ec2-user` | AWS's own distro, tuned for EC2, good AWS CLI/SDK integration |
| Amazon Linux 2 | RHEL-like | `yum` | `ec2-user` | Older, still widely deployed, `yum` still works (aliases to dnf on some systems) |
| RHEL / Rocky / Alma | RHEL | `dnf`/`yum` | `ec2-user` / `rocky` | Enterprise, long support lifecycles |
| Debian | Debian | `apt` | `admin` | Similar to Ubuntu but more conservative package versions |

### Kernel vs. Shell vs. Terminal vs. Bash — the confusion cleared up

- **Kernel**: the core OS engine (process scheduling, memory, drivers). You never talk to it directly.
- **Shell**: a program that reads commands you type and asks the kernel to execute them (e.g., `bash`, `zsh`, `sh`, `fish`).
- **Terminal**: the window/interface you type into (a terminal emulator, or in SSH's case, a pseudo-terminal (`pty`) allocated over the network).
- **Bash** ("Bourne Again SHell"): the most common shell on Linux, and the default on almost every server you'll SSH into. Assume Bash unless told otherwise.
- **Zsh**: a more feature-rich shell (better completion, plugins via Oh My Zsh) — the macOS default since Catalina, and common on developer workstations, but **rarely the default on servers**. You'll mostly write scripts for Bash even if your local shell is Zsh.

**Practical rule:** write your automation scripts assuming `/bin/bash` (or explicitly `#!/usr/bin/env bash`) will run them on the server, regardless of what shell you personally use to connect.

## 1.2 The Filesystem Hierarchy Standard (FHS)

Linux has one unified tree rooted at `/` — no drive letters. Every device, disk, and mount lives somewhere under `/`.

| Path | Purpose | DevOps relevance |
|---|---|---|
| `/` | Root of everything | |
| `/bin`, `/usr/bin` | Essential user binaries | Where your commands live (`/bin` often symlinked into `/usr/bin` now) |
| `/sbin`, `/usr/sbin` | System admin binaries | `iptables`, `fdisk`, etc. |
| `/etc` | System-wide configuration | `/etc/nginx`, `/etc/systemd`, `/etc/passwd`, `/etc/ssh/sshd_config` — you'll live here |
| `/var` | Variable data | `/var/log` (logs), `/var/lib` (app state, e.g. `/var/lib/docker`), `/var/www` |
| `/home` | User home directories | `/home/ubuntu`, `/home/deploy` |
| `/root` | Root user's home | Only root can `cd` here |
| `/tmp` | Temporary files | Often cleared on reboot; watch it fill up on long-lived instances |
| `/opt` | Optional/third-party software | Where many vendor apps and agents install (`/opt/aws`, `/opt/datadog`) |
| `/dev` | Device files | `/dev/sda`, `/dev/nvme0n1` (EBS volumes on Nitro instances) |
| `/proc` | Virtual filesystem exposing kernel/process info | `/proc/cpuinfo`, `/proc/<pid>/status` — not real files, generated live |
| `/sys` | Virtual filesystem exposing kernel/device state | Hardware and driver tuning |
| `/mnt`, `/media` | Manual/removable mount points | Where you'd mount an extra EBS volume |
| `/usr` | User-installed software and data (despite the name, not "user files") | Bulk of installed software lives under `/usr/share`, `/usr/lib` |
| `/boot` | Kernel and bootloader files | Rarely touched directly |

### Absolute vs. relative paths

- **Absolute path**: starts with `/`, unambiguous from anywhere — `/var/log/nginx/access.log`.
- **Relative path**: relative to your current directory — `../log/access.log`, `./deploy.sh`.

**Rule of thumb for scripts/cron:** always use absolute paths. A cron job or systemd service doesn't have "your" current directory, and relative paths are the #1 cause of "works when I run it manually, fails in cron."

Special path shortcuts: `.` (current dir), `..` (parent dir), `~` (home directory of current user), `~otheruser` (their home directory), `-` (previous directory, works with `cd -`).

## 1.3 Users, root, and privilege

- Every process runs as a **user** (a UID). **root** (UID 0) can do anything — bypass all permission checks.
- On servers you almost never log in *as* root directly (and shouldn't — it's disabled for SSH in secure configs). You log in as a regular user and use `sudo` to run specific commands with elevated privilege, with an audit trail.
- `whoami` tells you who you are right now; `id` gives the full picture (UID, GID, groups).

## 1.4 Environment variables and PATH

Environment variables are named values available to every process in your shell session. They configure behavior of programs without hardcoding it.

```bash
echo $HOME        # /home/ubuntu
echo $USER        # ubuntu
echo $PATH        # /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/bin
```

**`$PATH`** is the most operationally important one: a colon-separated list of directories the shell searches, in order, when you type a bare command name. If `myscript` isn't in a directory listed in `$PATH`, `myscript` fails with "command not found" — you must run `./myscript` instead.

**Common production gotcha:** a cron job or systemd service often runs with a much smaller `PATH` than your interactive shell. A script that works fine when you run it manually can fail silently in cron because `docker`, `aws`, or `node` aren't on cron's `PATH`. Fix by using absolute paths to binaries in scripts, or explicitly setting `PATH` at the top of the script/crontab.

```bash
# Bad in a cron-run script — relies on interactive PATH
docker ps

# Good — absolute path, works regardless of caller's environment
/usr/bin/docker ps
```

## 1.5 stdin, stdout, stderr, and exit codes

Every process has three standard I/O streams, referenced by file descriptor number:

| Stream | FD | Purpose |
|---|---|---|
| stdin | 0 | Input into the program |
| stdout | 1 | Normal output |
| stderr | 2 | Error/diagnostic output (separate from stdout on purpose) |

This separation is why you can do `command > output.log` and still see errors on your terminal — errors go to stderr, not stdout, unless you explicitly redirect them too (`2>&1`, covered in depth in `19` / Part 19 material inside `10-environment-bash-scripting.md`).

**Exit codes**: every command returns a numeric exit code when it finishes. `0` = success, any non-zero = failure (the specific number often has command-specific meaning). This is the backbone of scripting logic and CI/CD pipelines.

```bash
grep "ERROR" app.log
echo $?         # 0 if a match was found, 1 if not, 2 if the file doesn't exist
```

`$?` always holds the exit code of the **most recently run** command — check it immediately, before running anything else.

## 1.6 Pipes, redirection, and command chaining (quick preview)

You'll use these constantly; the deep dive is in `10-environment-bash-scripting.md`, but the basics:

```bash
command1 | command2      # pipe: stdout of command1 becomes stdin of command2
command > file            # redirect stdout to file (overwrite)
command >> file           # redirect stdout to file (append)
command1 && command2      # run command2 only if command1 succeeded (exit code 0)
command1 || command2      # run command2 only if command1 failed
command1 ; command2       # run both regardless of success/failure
```

## 1.7 Wildcards, quoting, and command substitution

**Globbing (wildcards)** — expanded by the *shell*, not the command itself:

```bash
ls *.log            # anything ending in .log
ls app-?.log         # single-char wildcard: app-1.log, app-2.log, not app-10.log
ls [abc]*.conf       # files starting with a, b, or c
```

**Quoting** matters constantly in production scripts:

- `"double quotes"` — variables and command substitution still expand inside.
- `'single quotes'` — nothing expands, completely literal. Use this for anything with `$`, backticks, or special characters you want preserved (e.g. passwords, regex).
- No quotes — the shell applies word-splitting and glob expansion, which is almost always wrong for variables that might contain spaces.

```bash
FILE="my report.txt"
cat $FILE      # BROKEN: expands to `cat my report.txt` -> two arguments, error
cat "$FILE"    # CORRECT: one argument
```

**Command substitution** — capture a command's output into a variable or another command:

```bash
NOW=$(date +%F)
echo "Backup taken on $NOW"
COUNT=$(grep -c "ERROR" app.log)
```
Always prefer `$(...)` over the older backtick syntax `` `...` `` — it's clearer and nests properly.

## 1.8 Aliases, history, tab completion

```bash
alias ll='ls -alF'          # define a shortcut for this session
alias ll='ls -alF' >> ~/.bashrc   # make it permanent
history                     # list recent commands
!123                        # re-run history item #123
!!                          # re-run last command (common: `sudo !!` after forgetting sudo)
Ctrl+R                      # reverse-search command history interactively
```

**Tab completion** is not optional — press `Tab` (twice if needed) to complete filenames, commands, and (with the right completion package) subcommand flags. On a server missing `bash-completion`, install it (`apt install bash-completion` / `dnf install bash-completion`) — it dramatically reduces typos in high-pressure situations.

## 1.9 Getting help without leaving the terminal

## `man`
**Purpose:** Full manual page for a command — the authoritative reference, always installed, always accurate for that system's version.
**Syntax:** `man <command>`
**Example:** `man tar`
**Navigation inside man:** `/pattern` to search, `n`/`N` for next/previous match, `q` to quit, `Space` to page down.
**When to use it:** whenever you need the exact flag syntax for the *specific* version installed on that box — man pages don't lie about version differences the way blog posts do.
**Risk:** 🟢 SAFE

## `--help`
**Purpose:** Quick usage summary, faster than `man` for a refresher.
**Example:** `tar --help`, `curl --help`
**When to use it:** you know the command, just forgot one flag.
**Risk:** 🟢 SAFE

## `apropos`
**Purpose:** Search man page descriptions by keyword when you don't remember the command name.
**Example:** `apropos "list directory"`
**Risk:** 🟢 SAFE

## `which`, `whereis`, `type`
**Purpose:** Find out exactly what will run when you type a command name — critical when multiple versions exist (e.g. system Python vs. a virtualenv).
```bash
which python3        # /usr/bin/python3 — first match in $PATH
whereis python3       # all known locations: binary, man page, source
type ll               # shows if it's an alias, function, builtin, or binary — most informative of the three
```
**When to use it:** debugging "why is the wrong version running" — a classic in Node/Python version-manager setups.
**Risk:** 🟢 SAFE

## Foundational navigation commands

## `pwd`
**Purpose:** Print current working directory (full absolute path).
**Example:** `pwd` → `/home/ubuntu/app`
**Risk:** 🟢 SAFE

## `ls`
**Purpose:** List directory contents.
**Real-world example:** `ls -lah /var/log` — long format (`-l`), all files including hidden (`-a`), human-readable sizes (`-h`).
**Example output:**
```text
-rw-r----- 1 syslog adm   3.2M Aug 19 09:14 syslog
-rw-r----- 1 root   adm    812K Aug 19 08:00 syslog.1
```
**Useful options:**
| Option | Meaning |
|---|---|
| `-l` | long format: permissions, owner, group, size, date |
| `-a` | include hidden files (dotfiles) |
| `-h` | human-readable sizes (with `-l`) |
| `-t` | sort by modification time, newest first |
| `-S` | sort by size, largest first |
| `-r` | reverse sort order |
| `-R` | recursive listing |
**Common combo:** `ls -lt | head` — most recently modified files first, top 10. Great for "what just got written/deployed here."
**Risk:** 🟢 SAFE

## `cd`
**Purpose:** Change directory.
```bash
cd /var/log       # absolute
cd ../nginx        # relative
cd ~               # home
cd -                # previous directory (toggle)
```
**Risk:** 🟢 SAFE

## `tree`
**Purpose:** Visual, indented directory tree (not installed by default on most minimal server images).
**Example:** `tree -L 2 /etc/nginx` — limit depth to 2 levels.
**When to use it:** quickly understanding an unfamiliar project or config layout.
**Risk:** 🟢 SAFE

## `clear`
**Purpose:** Clear the terminal screen (`Ctrl+L` does the same without typing).
**Risk:** 🟢 SAFE

## `echo` / `printf`
**Purpose:** Print text/variables to stdout.
```bash
echo "Deploy started at $(date)"
printf "%-10s %5d\n" "errors" 42     # printf gives you real format control; echo doesn't
```
**When to use `printf` over `echo`:** whenever you need aligned columns, no trailing newline (`printf` doesn't add one by default), or portable behavior across shells — `echo` flag behavior (`-e`, `-n`) varies by shell/system.
**Risk:** 🟢 SAFE
