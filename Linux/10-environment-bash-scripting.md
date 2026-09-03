# Part 11 — Environment Variables and Shell

## 11.1 Key built-in variables

| Variable | Meaning |
|---|---|
| `$PATH` | Directories searched for commands (Part 1) |
| `$HOME` | Current user's home directory |
| `$USER` | Current username |
| `$SHELL` | Path to the user's default login shell (not necessarily the shell currently running) |
| `$PWD` | Current working directory |
| `$OLDPWD` | Previous working directory (used by `cd -`) |
| `$?` | Exit code of the last command |
| `$!` | PID of the last backgrounded process |
| `$#` | Number of positional arguments passed to a script/function |
| `$@` | All positional arguments, as separate words |
| `$0` | Name of the script/shell itself |
| `$1`, `$2`... | Individual positional arguments |
| `$$` | PID of the current shell |

```bash
./deploy.sh prod v2.4.1
# inside deploy.sh: $0=./deploy.sh  $1=prod  $2=v2.4.1  $#=2  $@="prod v2.4.1"
```

**`$@` vs `$*`:** almost always want `"$@"` (quoted) — it preserves each argument as a separate word even if one contains spaces. `"$*"` collapses everything into a single string. This distinction matters a lot when forwarding arguments to another command inside a wrapper script.

## `export`, `env`, `printenv`, `set`, `unset`
```bash
export API_KEY="secret123"      # make a variable available to CHILD processes (not just this shell)
env                                # list all environment variables
printenv PATH                        # print one specific variable
NAME=value                             # shell variable only — NOT visible to child processes without export
set                                      # list ALL variables (shell + environment) and functions
unset API_KEY                              # remove a variable
```
**The `export` distinction, concretely:**
```bash
FOO=bar
bash -c 'echo $FOO'          # prints nothing — child shell never saw it
export FOO=bar
bash -c 'echo $FOO'            # prints "bar" — now inherited by child processes
```
This is exactly why a variable set at your interactive shell doesn't automatically appear inside a script you run, a cron job, or a systemd service — each is typically a fresh process tree that only inherits *exported* variables from its actual parent, which for cron/systemd is usually not your login shell at all.
**Risk:** 🟢 SAFE

## Shell startup files
| File | Loaded for |
|---|---|
| `/etc/profile`, `/etc/bash.bashrc` | System-wide, all users |
| `~/.bash_profile` or `~/.profile` | Login shells (e.g. a fresh SSH connection) |
| `~/.bashrc` | Interactive non-login shells (e.g. a new terminal tab within an existing session) |

**Login vs. interactive vs. non-interactive shells:**
- **Login shell**: created when you first log in (SSH connecting counts as this) — loads `.bash_profile`/`.profile`.
- **Interactive non-login shell**: a new shell you start from within an existing session — loads `.bashrc`.
- **Non-interactive shell**: running a script — loads **neither** by default, which is exactly why scripts can't "see" aliases or functions you've defined interactively, unless you explicitly source the file.

**Practical consequence:** if you add an environment variable to `~/.bashrc` but connect via `ssh host command` (non-interactive) or run it from cron, it won't be picked up — variables that need to be available broadly (to scripts, cron, systemd) generally belong in `/etc/environment`, a systemd unit's `Environment=`, or explicitly sourced at the top of the relevant script instead.

---

# Part 12 — Bash Scripting for DevOps

Bash scripting is how you turn manual troubleshooting/deployment steps into repeatable, reliable automation. This section builds from fundamentals to complete real-world scripts.

## 12.1 Fundamentals

### Variables
```bash
#!/usr/bin/env bash
NAME="production"                 # no spaces around =, or bash treats it as a command
echo "Environment: $NAME"
echo "Environment: ${NAME}"        # braces recommended when concatenating: "${NAME}_backup"
READONLY_VAR="fixed"; readonly READONLY_VAR   # prevent reassignment
```

### Strings and numbers
```bash
STR="hello"
echo "${#STR}"                # length: 5
echo "${STR^^}"                 # uppercase: HELLO  (bash 4+)
echo "${STR:1:3}"                 # substring from index 1, length 3: "ell"

NUM=5
RESULT=$((NUM * 2))                 # arithmetic expansion — ALWAYS use $(( )) for math, not string concat
echo "$RESULT"                        # 10
```

### Arrays
```bash
SERVERS=("web1" "web2" "web3")
echo "${SERVERS[0]}"              # web1
echo "${SERVERS[@]}"                # all elements
echo "${#SERVERS[@]}"                 # count: 3
for s in "${SERVERS[@]}"; do
    echo "Checking $s"
done
```

### Conditionals
```bash
if [ "$ENV" == "prod" ]; then
    echo "production deploy"
elif [ "$ENV" == "staging" ]; then
    echo "staging deploy"
else
    echo "unknown environment"
fi

# [[ ]] (bash-specific, preferred over [ ]) — supports pattern matching, no word-splitting surprises
if [[ "$FILE" == *.log ]]; then
    echo "log file"
fi

# File tests — extremely common in DevOps scripts
if [ -f "$FILE" ]; then echo "regular file exists"; fi
if [ -d "$DIR" ]; then echo "directory exists"; fi
if [ -x "$SCRIPT" ]; then echo "is executable"; fi
if [ -z "$VAR" ]; then echo "VAR is empty/unset"; fi
if [ -n "$VAR" ]; then echo "VAR is set and non-empty"; fi
```
**`[ ]` vs `[[ ]]`:** `[ ]` is the POSIX-portable test command (works in any `/bin/sh`); `[[ ]]` is a bash keyword with safer behavior (no word-splitting on unquoted variables, supports `&&`/`||`/pattern matching directly inside). For scripts explicitly targeting bash (`#!/usr/bin/env bash`), prefer `[[ ]]`.

### `case`
```bash
case "$ENV" in
    prod)
        echo "deploying to production"
        ;;
    staging|stage)
        echo "deploying to staging"
        ;;
    *)
        echo "unknown environment: $ENV"
        exit 1
        ;;
esac
```

### Loops
```bash
for i in 1 2 3; do echo "$i"; done
for i in {1..5}; do echo "$i"; done
for file in /var/log/*.log; do echo "$file"; done

i=0
while [ $i -lt 5 ]; do
    echo "$i"
    i=$((i+1))
done

until ping -c1 example.com &>/dev/null; do
    echo "waiting for network..."
    sleep 2
done
```

### Functions
```bash
check_service() {
    local service_name="$1"        # `local` scopes the variable to the function — always use it
    if systemctl is-active --quiet "$service_name"; then
        echo "$service_name is running"
        return 0
    else
        echo "$service_name is NOT running"
        return 1
    fi
}

check_service nginx
```

### Arguments, `read`, `shift`, `getopts`
```bash
# positional args
./script.sh prod v2.4.1
ENV="$1"
VERSION="$2"

# interactive input
read -p "Continue? (y/n) " ANSWER

# shift — process args one at a time, useful for variable-length arg lists
while [ "$#" -gt 0 ]; do
    echo "Processing: $1"
    shift
done

# getopts — proper flag parsing (-e prod -v 2.4.1)
while getopts "e:v:h" opt; do
    case $opt in
        e) ENV="$OPTARG" ;;
        v) VERSION="$OPTARG" ;;
        h) echo "Usage: $0 -e <env> -v <version>"; exit 0 ;;
        *) echo "Invalid option"; exit 1 ;;
    esac
done
```

### Command substitution and error handling
```bash
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if ! OUTPUT=$(some_command 2>&1); then
    echo "Command failed: $OUTPUT" >&2
    exit 1
fi
```

## 12.2 The three lines every production script should start with

```bash
#!/usr/bin/env bash
set -e            # exit immediately if ANY command fails (non-zero exit) — no silent continuation past errors
set -u              # treat unset variables as an error instead of silently expanding to empty string
set -o pipefail       # a pipeline's exit code reflects the FIRST failing command, not just the last
```
**Why each matters:**
- Without `set -e`, a script barrels forward after a failed step (e.g. a failed `cd` followed by operations on the wrong directory) — a classic cause of the `rm -rf` disaster from Part 2.
- Without `set -u`, a typo'd variable name (`$TARGE_DIR` instead of `$TARGET_DIR`) silently becomes an empty string instead of erroring — devastating combined with `rm -rf "$DIR"/*`.
- Without `pipefail`, `cmd_that_fails | grep something` reports success (grep's exit code) even though the first command in the pipe actually failed.
**Combined shorthand:** `set -euo pipefail` — write this at the top of essentially every non-trivial ops script.

## 12.3 Practical scripts, explained line by line

### Script 1 — Disk usage alert
```bash
#!/usr/bin/env bash
set -euo pipefail

THRESHOLD=80
MOUNT="/"

USAGE=$(df --output=pcent "$MOUNT" | tail -1 | tr -d ' %')   # get just the percentage number

if [ "$USAGE" -ge "$THRESHOLD" ]; then
    echo "WARNING: Disk usage on $MOUNT is ${USAGE}% (threshold: ${THRESHOLD}%)"
    exit 1
fi

echo "OK: Disk usage on $MOUNT is ${USAGE}%"
exit 0
```
**Line by line:** `df --output=pcent` prints just the percentage column; `tail -1` drops the header row; `tr -d ' %'` strips the `%` sign and any whitespace so we get a plain integer for numeric comparison. Exit code 1 on breach makes this directly usable as a monitoring check (Nagios/cron-with-alerting style: non-zero exit = alert).

### Script 2 — Process checker
```bash
#!/usr/bin/env bash
set -euo pipefail

PROCESS_NAME="${1:?Usage: $0 <process_name>}"   # ${var:?msg} — error out with msg if $1 wasn't provided

if pgrep -x "$PROCESS_NAME" > /dev/null; then
    echo "$PROCESS_NAME is running (PID: $(pgrep -x "$PROCESS_NAME" | head -1))"
    exit 0
else
    echo "$PROCESS_NAME is NOT running"
    exit 1
fi
```
**Line by line:** `${1:?message}` is a built-in guard — if `$1` is unset/empty, bash prints the message and exits immediately, before `set -u` would otherwise trigger a less friendly error. `pgrep -x` matches the exact process name only (avoids partial-name false positives).

### Script 3 — Service health checker (systemd + HTTP)
```bash
#!/usr/bin/env bash
set -euo pipefail

SERVICE="nginx"
HEALTH_URL="http://localhost/health"

if ! systemctl is-active --quiet "$SERVICE"; then
    echo "FAIL: $SERVICE is not active, attempting restart..."
    sudo systemctl restart "$SERVICE"
    sleep 3
fi

STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || echo "000")

if [ "$STATUS_CODE" -eq 200 ]; then
    echo "OK: $SERVICE healthy (HTTP $STATUS_CODE)"
    exit 0
else
    echo "FAIL: $SERVICE returned HTTP $STATUS_CODE"
    exit 1
fi
```
**Line by line:** first checks the systemd-level state, attempts a self-heal restart if down; then independently checks the *application* layer via an actual HTTP request, because a service can be "active" at the systemd level while the app itself is unresponsive (e.g. hung, deadlocked). `|| echo "000"` ensures `curl` failing to connect at all doesn't crash the script under `set -e` — it substitutes a clearly-invalid status code instead.

### Script 4 — Log analyzer (error rate over the last N minutes)
```bash
#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="${1:-/var/log/app/app.log}"
MINUTES="${2:-10}"

SINCE=$(date -d "-${MINUTES} minutes" '+%Y-%m-%d %H:%M')

echo "Errors in $LOG_FILE since $SINCE:"
awk -v since="$SINCE" '$0 >= since' "$LOG_FILE" | grep -c "ERROR" || echo 0

echo "Top error messages:"
awk -v since="$SINCE" '$0 >= since' "$LOG_FILE" | grep "ERROR" | \
    sed -E 's/[0-9]+/N/g' | sort | uniq -c | sort -rn | head -5
```
**Line by line:** `${1:-default}` supplies a default log path if none given (vs. `${1:?}` above, which *requires* it — use `:-` when a sensible default exists, `:?` when it doesn't). `date -d "-N minutes"` computes a comparison timestamp; assumes log lines are timestamp-prefixed and sortable as strings, a common log format. The `sed -E 's/[0-9]+/N/g'` normalizes variable numbers (IDs, ports) out of error messages so genuinely repeated error *patterns* group together in the count, instead of every instance looking unique because of an embedded ID.

### Script 5 — Backup script
```bash
#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="/opt/app/data"
BACKUP_DIR="/opt/backups"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/backup-${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "Backing up $SRC_DIR to $BACKUP_FILE..."
tar -czf "$BACKUP_FILE" -C "$(dirname "$SRC_DIR")" "$(basename "$SRC_DIR")"

echo "Removing backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "backup-*.tar.gz" -mtime "+${RETENTION_DAYS}" -print -delete

echo "Backup complete: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
```
**Line by line:** `tar -C <parent> <dirname>` (rather than giving `tar` the full source path directly) stores relative paths inside the archive, so restoring doesn't force an exact absolute-path layout on the restore target. The `find ... -print -delete` pattern intentionally prints what it's about to delete for the log/audit trail before removing it.

### Script 6 — Deployment script (symlink-swap pattern)
```bash
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/app"
RELEASES_DIR="${APP_DIR}/releases"
CURRENT_LINK="${APP_DIR}/current"
VERSION="${1:?Usage: $0 <version>}"
RELEASE_DIR="${RELEASES_DIR}/${VERSION}"
KEEP_RELEASES=5

if [ ! -d "$RELEASE_DIR" ]; then
    echo "ERROR: release directory $RELEASE_DIR does not exist. Extract the build there first."
    exit 1
fi

echo "Deploying version $VERSION..."
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"      # atomic-ish symlink swap — see Part 2

echo "Restarting application..."
sudo systemctl restart myapp

sleep 2
if ! systemctl is-active --quiet myapp; then
    echo "ERROR: myapp failed to start after deploy. Rolling back is your next manual step."
    exit 1
fi

echo "Cleaning up old releases (keeping last $KEEP_RELEASES)..."
cd "$RELEASES_DIR"
ls -1t | tail -n "+$((KEEP_RELEASES + 1))" | xargs -r rm -rf --

echo "Deploy of $VERSION complete."
```
**Line by line:** validates the release exists before touching anything live; swaps the `current` symlink (the moment users actually see the new version); restarts and immediately verifies health, failing loudly rather than assuming success; then prunes old releases keeping only the most recent N, using `ls -1t | tail -n "+N"` (everything AFTER the Nth-newest) piped into `xargs -r rm -rf --` (`-r`: don't run rm at all if the list is empty; `--`: guard against a release directory name that happens to start with `-` being misread as a flag).

### Script 7 — EC2 health-check script
```bash
#!/usr/bin/env bash
set -euo pipefail

echo "=== EC2 Instance Health Check ==="
echo "Instance ID: $(curl -s http://169.254.169.254/latest/meta-data/instance-id)"
echo "Instance type: $(curl -s http://169.254.169.254/latest/meta-data/instance-type)"

echo "--- Disk ---"
df -h / | tail -1 | awk '{print "Root usage: " $5}'

echo "--- Memory ---"
free -h | awk '/Mem:/ {print "Used: " $3 " / " $2}'

echo "--- Load ---"
uptime | awk -F'load average:' '{print $2}'

echo "--- Key services ---"
for svc in nginx myapp; do
    if systemctl is-active --quiet "$svc"; then
        echo "$svc: OK"
    else
        echo "$svc: DOWN"
    fi
done
```
**Line by line:** the `169.254.169.254` address is the **EC2 Instance Metadata Service (IMDS)** — a link-local address reachable only from inside the instance itself, giving it access to its own metadata without any AWS credentials. (Note: modern default is IMDSv2, which requires a token-fetch step first — this example uses the simpler IMDSv1-style call for brevity; production scripts should use IMDSv2's token flow if the instance enforces it.)

### Script 8 — Website/API health checker (multi-endpoint, with retries)
```bash
#!/usr/bin/env bash
set -uo pipefail    # note: NOT set -e here — we want to check every endpoint even if one fails

ENDPOINTS=(
    "https://example.com/health"
    "https://api.example.com/health"
    "https://admin.example.com/health"
)
MAX_RETRIES=3
FAILED=0

for url in "${ENDPOINTS[@]}"; do
    ATTEMPT=1
    SUCCESS=0
    while [ "$ATTEMPT" -le "$MAX_RETRIES" ]; do
        STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "000")
        if [ "$STATUS" -eq 200 ]; then
            echo "OK: $url ($STATUS)"
            SUCCESS=1
            break
        fi
        echo "Attempt $ATTEMPT failed for $url (HTTP $STATUS), retrying..."
        ATTEMPT=$((ATTEMPT + 1))
        sleep 2
    done
    if [ "$SUCCESS" -eq 0 ]; then
        echo "FAIL: $url did not respond with 200 after $MAX_RETRIES attempts"
        FAILED=1
    fi
done

exit $FAILED
```
**Line by line:** deliberately omits `set -e` because the whole point is to keep checking every endpoint even after one fails — `set -e` would abort the loop on the first non-200. Retry logic with a short sleep absorbs transient blips without immediately declaring an outage; the final exit code aggregates across all endpoints for easy use in monitoring/cron with alerting.

## 12.4 Common mistakes summary

- Unquoted variables (`rm -rf $DIR` instead of `"$DIR"`) — breaks on spaces, dangerous on empty values.
- Comparing numbers with `==` inside `[ ]` (string comparison) instead of `-eq` — works by accident sometimes, fails unpredictably on others.
- Forgetting `local` inside functions — variables leak into global scope and can collide.
- Assuming your interactive `$PATH`/aliases exist inside a script or cron job (Part 11).
- Using `$(cat file)` when `mapfile`/`read` would be more efficient and preserve structure for multi-line processing.
- Not checking `$?` (or better, using `set -e`) after a critical step, letting a script march forward after a real failure.
