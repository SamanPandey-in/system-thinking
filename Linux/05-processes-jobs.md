# Part 6 — Processes and Job Management

## 6.1 Core concepts

- **Process**: a running instance of a program, identified by a **PID** (process ID). Every process has a **PPID** (parent process ID) — the process that spawned it.
- **Daemon**: a background process with no controlling terminal, typically started at boot by systemd (e.g. `sshd`, `nginx`, `cron`).
- **Foreground vs background**: a foreground process holds your terminal (you can't type another command until it exits); a background process runs without blocking your shell.
- **Process states** (seen in `ps`/`top`):

| State | Meaning |
|---|---|
| `R` | Running or runnable (on the CPU or waiting for it) |
| `S` | Sleeping, waiting on an event (most idle processes) |
| `D` | Uninterruptible sleep — usually waiting on disk I/O; **can't even be killed with SIGKILL** while in this state |
| `Z` | Zombie — process has exited but its parent hasn't reaped its exit status yet |
| `T` | Stopped (e.g. via `Ctrl+Z` or `SIGSTOP`) |

## 6.2 Signals

A **signal** is a limited form of inter-process communication — a small async notification sent to a process, which can handle it, ignore it, or die, depending on the signal and the process's own signal handlers.

| Signal | Number | Meaning | Can be caught/ignored? |
|---|---|---|---|
| `SIGHUP` | 1 | Hangup — traditionally "terminal disconnected"; many daemons repurpose it as "reload your config" | Yes |
| `SIGINT` | 2 | Interrupt — sent by `Ctrl+C` | Yes |
| `SIGKILL` | 9 | Force kill — **cannot be caught, blocked, or ignored**; the kernel just removes the process | No |
| `SIGTERM` | 15 | Polite request to terminate — the **default** signal `kill` sends; well-behaved programs catch this to clean up (close files, flush buffers, finish in-flight requests) before exiting | Yes |
| `SIGSTOP` | 19 | Pause the process (cannot be caught) | No |
| `SIGCONT` | 18 | Resume a stopped process | Yes |

**The golden rule of killing processes:** always try `SIGTERM` (the default, `kill <pid>`) first and give the process a few seconds to shut down cleanly. Only escalate to `SIGKILL` (`kill -9 <pid>`) if it's genuinely hung and ignoring `SIGTERM` — `SIGKILL` gives the process zero chance to close database connections, flush writes, or clean up temp files, which can corrupt data or leave orphaned resources.

## `ps`
**Purpose:** Point-in-time snapshot of running processes.
**Real-world example:** `ps aux` — the standard "show me everything" invocation.
```bash
ps aux | grep nginx
```
```text
root      1523  0.0  0.3  55432  6120 ?        Ss   08:00   0:00 nginx: master process
www-data  1524  0.0  0.2  55876  4900 ?        S    08:00   0:01 nginx: worker process
```
**Useful options:**
| Option | Meaning |
|---|---|
| `a` | processes for all users |
| `u` | user-oriented format (shows %CPU, %MEM, etc.) |
| `x` | include processes without a controlling terminal (daemons) |
| `-ef` | full-format listing (System V style, equivalent-ish info to `aux`) |
| `--sort=-%cpu` | sort output, e.g. `ps aux --sort=-%cpu \| head` for top CPU consumers |
| `-o pid,ppid,cmd` | custom columns |
**Column meanings (in `ps aux`):** `USER`, `PID`, `%CPU`, `%MEM`, `VSZ` (virtual size), `RSS` (resident/actual memory), `TTY`, `STAT` (process state, see above), `START`, `TIME` (accumulated CPU time), `COMMAND`.
**Common combo — find and inspect a specific process:**
```bash
ps aux | grep -i node | grep -v grep     # the `grep -v grep` avoids matching the grep command itself
```
**Risk:** 🟢 SAFE

## `top` / `htop`
**Purpose:** Live, continuously refreshing process view.
```bash
top
htop        # nicer UI, color, mouse support, scrollable — install if not present (apt/dnf install htop)
```
**Inside `top`:** `P` sort by CPU, `M` sort by memory, `k` kill a PID (prompts), `1` toggle per-core CPU breakdown, `q` quit.
**Key fields:** load average (top-right), `%CPU`, `%MEM`, `TIME+`. See Part 7 for deep interpretation of load average and CPU breakdown.
**When to prefer `htop`:** interactive troubleshooting sessions — easier to read, sortable by clicking, tree view of parent/child processes (`t` in htop). Prefer plain `top` when scripting/automating or when `htop` isn't installed and you don't want to add packages during an incident.
**Risk:** 🟢 SAFE

## `pgrep` / `pkill`
**Purpose:** Find/kill processes by name pattern instead of manually looking up PIDs.
```bash
pgrep nginx                  # list matching PIDs
pgrep -a nginx                 # also show the full command line
pkill nginx                     # send SIGTERM to all matching processes
pkill -9 nginx                    # SIGKILL all matching — dangerous, kills master + all workers at once
pkill -f "python worker.py"         # -f: match against full command line, not just process name
```
**Common mistake:** `pkill python` matching far more processes than intended (any process with "python" anywhere in its name) — use `-f` with a specific enough pattern, or prefer `pgrep` first to review the match list before killing.
**Risk:** 🟡 USE WITH CARE, 🔴 with `-9` or an overly broad pattern

## `kill`
**Purpose:** Send a signal to a specific PID.
```bash
kill 1523              # SIGTERM (default) — polite shutdown request
kill -HUP 1523           # SIGHUP — many daemons reload config on this instead of restarting
kill -9 1523                # SIGKILL — force, last resort
kill -l                       # list all signal names/numbers
```
**Risk:** 🟡 USE WITH CARE, 🔴 with `-9`

## `killall`
**Purpose:** Like `pkill` but matches on exact process name (not a regex pattern) across all matching processes.
```bash
killall nginx
```
**`pkill` vs `killall`:** `pkill` supports pattern/regex matching and `-f` for full command-line match; `killall` requires an exact process name match. Prefer `pkill -f` for precision when multiple similarly-named things are running (e.g. several Node apps).
**Risk:** 🟡 USE WITH CARE

## `jobs`, `bg`, `fg`
**Purpose:** Manage jobs within your *current shell session*.
```bash
long_task.sh              # runs in foreground, blocks your terminal
# Ctrl+Z                   suspends it (SIGSTOP), returns control to you
jobs                        # list suspended/background jobs in this shell
bg %1                        # resume job 1 in the BACKGROUND
fg %1                          # bring job 1 back to the FOREGROUND
```
**Important limitation:** jobs managed this way die when your SSH session disconnects (they receive `SIGHUP`) — this is exactly what `nohup`/`disown`/`tmux` solve.
**Risk:** 🟢 SAFE

## `nohup`
**Purpose:** Run a command immune to `SIGHUP`, so it survives your terminal/SSH session disconnecting.
```bash
nohup ./long_deploy.sh > deploy.log 2>&1 &
```
`nohup` alone redirects output to `nohup.out` by default if you don't redirect it yourself — always explicitly redirect (as above) so you control where the log goes.
**When to prefer `tmux`/`screen` instead:** `nohup` is fine for a fire-and-forget background task, but if you need to reattach and watch progress interactively later, use `tmux` (Part 14) instead — much better experience.
**Risk:** 🟢 SAFE

## `disown`
**Purpose:** Remove a job from your shell's job table so it's no longer tied to the shell (won't receive `SIGHUP` on exit), without needing to have started it with `nohup`.
```bash
long_task.sh &
disown           # detach the most recent background job from this shell
```
**`nohup` vs `disown`:** `nohup` is set up *before* running the command; `disown` is applied *after* you've already backgrounded it and decide you want it to survive logout too.
**Risk:** 🟢 SAFE

## `nice` / `renice`
**Purpose:** Control CPU scheduling priority. Range is -20 (highest priority) to 19 (lowest); default is 0. Only root can set negative (higher-than-normal) priority.
```bash
nice -n 10 ./batch_job.sh          # start a new process with LOWER priority (nicer to others)
renice -n 5 -p 1523                    # change priority of an ALREADY-RUNNING process
```
**Real-world example:** running a heavy backup/compression job on a live production server without starving the actual application of CPU:
```bash
nice -n 19 tar -czf backup.tar.gz /opt/app/data
```
**Risk:** 🟢 SAFE (lowering priority), 🟡 USE WITH CARE (raising priority — can starve other processes)

---

## Real incident scenarios

**"CPU is at 100%" — quick triage:**
```bash
top                                 # identify the offending PID by %CPU, sorted by default
ps -o pid,ppid,cmd,%cpu --sort=-%cpu | head    # same info, scriptable
kill -TERM <pid>                     # try graceful first
kill -9 <pid>                          # only if it doesn't respond after a few seconds
```
(Full decision tree in Part 7 / `06-monitoring-troubleshooting.md`.)

**"Application has hung" (not responding, not necessarily high CPU):**
```bash
ps aux | grep <app>                     # is it even still running? check STAT column for D (stuck in I/O) or Z (zombie)
kill -HUP <pid>                            # try a reload signal first if the app supports it
kill <pid>                                    # SIGTERM — graceful
kill -9 <pid>                                    # last resort
```

**Zombie processes:** a `Z` state process has already exited — it's just an entry in the process table waiting for its parent to call `wait()` and read its exit status. **You cannot kill a zombie** (it's already dead); the fix is to signal or fix the *parent*. If the parent itself is unresponsive, restarting the parent (or its systemd service) clears the zombies, since `init`/systemd (PID 1) adopts and reaps orphans.
```bash
ps aux | awk '$8=="Z" {print}'      # find zombies (state column)
ps -o ppid= -p <zombie_pid>           # find its parent, then investigate/restart the PARENT
```

**"Run a process after disconnecting SSH":**
```bash
nohup ./long_task.sh > out.log 2>&1 &
disown
# or, preferably:
tmux new -s work
./long_task.sh
# Ctrl+B then D to detach; `tmux attach -t work` later to resume watching
```
