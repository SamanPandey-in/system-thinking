# Part 29 — Troubleshooting Playbooks

Twelve incident playbooks, each following: **Symptoms → First commands → Investigation sequence → Interpreting results → Likely causes → Remediation → Verification → Prevention.**

---

## Scenario 1 — Server is slow (general, unclear cause)

**Symptoms:** Vague reports of sluggishness; no specific error yet identified.

**First commands:**
```bash
uptime; free -h; df -h
```

**Investigation sequence:**
1. `uptime` — is load average actually elevated relative to `nproc`, and is it rising or falling?
2. `free -h` — check `available`, not `free`; is swap `used` climbing?
3. `df -h` — any filesystem near 100%?
4. `vmstat 2 5` — CPU-bound (`r`, `us`) vs I/O-bound (`wa`, `b`) at a glance.
5. If none of these show anything: suspect the network path (Part 9) or a slow downstream dependency (database, external API) rather than the box itself.

**Interpreting results:** high `r` in vmstat + high `us` = CPU-bound; high `wa`/`b` = I/O-bound; low everything but still "slow" = likely network/dependency latency, not the local machine.

**Likely causes:** traffic spike, a slow downstream dependency, a leaking process, unrotated logs filling disk, or noisy-neighbor I/O contention on shared storage.

**Remediation:** route to the specific playbook matching what you found (CPU, memory, disk, or network).

**Verification:** re-run `uptime`/`free -h`/`df -h`, confirm trending back to baseline.

**Prevention:** baseline monitoring/alerting (CloudWatch or equivalent) on CPU, memory, disk, and load, so "slow" gets caught and characterized before a person notices manually.

---

## Scenario 2 — CPU is 100%

**Symptoms:** High latency, monitoring alert on CPU utilization.

**First commands:**
```bash
top
ps aux --sort=-%cpu | head
```

**Investigation sequence:**
1. Identify the specific offending PID(s) from `top`/`ps`.
2. `ps -o pid,ppid,cmd,%cpu,etime -p <pid>` — how long has it been running, is it one runaway process or many?
3. Check application logs around when the climb started.
4. If genuinely one hung process: consider `strace -p <pid>` briefly to see what syscalls it's stuck in (use sparingly — `strace` itself adds overhead).

**Interpreting results:** one process pegged near 100% = likely a stuck loop or a legitimate heavy single job; many processes summing high = traffic spike or a fork-loop bug.

**Likely causes:** infinite loop/bug, a legitimate but unscaled workload spike, a runaway background job, or a fork bomb from a misbehaving script.

**Remediation:** `kill -TERM <pid>` first (graceful), escalate to `kill -9 <pid>` only if unresponsive after a few seconds. If it's legitimate load, scale out rather than kill.

**Verification:** `uptime` trending down, `top` calm, application latency back to normal.

**Prevention:** CPU alerting before user-visible impact, autoscaling for legitimate load spikes, code review/profiling for the specific hot path if it was a bug.

---

## Scenario 3 — Memory is exhausted

**Symptoms:** OOM-killer log entries, application crashes, general slowness with high swap.

**First commands:**
```bash
free -h
dmesg | grep -i "out of memory"
```

**Investigation sequence:**
1. `free -h` — confirm `available` is genuinely low and `Swap used` is climbing.
2. `ps aux --sort=-%mem | head` — identify top consumers.
3. `journalctl -k | grep -i oom` (or `dmesg`) — confirm whether the kernel OOM-killer has already acted, and on what.
4. Compare current RSS for the suspect process against historical monitoring — steady unbounded growth over hours/days = leak signature.

**Interpreting results:** OOM-killer entries in `dmesg`/journal are the definitive sign the kernel itself intervened — treat this as confirmed memory exhaustion, not a guess.

**Likely causes:** application memory leak, an undersized instance for current load, a burst of concurrent heavy requests, or a misconfigured cache with no eviction limit.

**Remediation:** restart the leaking/crashed service for immediate relief; this is a stopgap, not a fix — the underlying leak still needs a code-level fix. Resize the instance or add swap only as a genuine capacity mismatch, not as a permanent leak workaround.

**Verification:** `free -h` stable, no further OOM entries appearing.

**Prevention:** memory alerting well before OOM territory, per-service memory limits (cgroups/Docker `--memory`, systemd `MemoryMax=`), load testing before release, periodic restarts as an explicit temporary mitigation while root-causing.

---

## Scenario 4 — Disk is full

**Symptoms:** "No space left on device" errors, write failures, service crashes on writes.

**First commands:**
```bash
df -h
```

**Investigation sequence:**
1. `df -h` — identify which filesystem/mount is full.
2. `du -h --max-depth=1 <mount> | sort -rh` — drill down, repeating into the largest subdirectory each time.
3. If `du` totals don't match `df`'s reported usage: `sudo lsof | grep deleted` — look for a deleted-but-still-open file (Part 8).
4. Also check `df -i` in parallel — confirm it's actually a space problem and not an inode exhaustion problem (Part 8), which needs a different fix.

**Interpreting results:** a specific directory dominating usage points to logs, Docker artifacts, core dumps, or old package caches; a `df`/`du` mismatch points to an orphaned open file handle; `df -i` near 100% with plenty of byte-space free points to too many small files, not big ones.

**Likely causes:** unrotated/runaway logs, Docker image/volume sprawl, old kernel packages left behind after upgrades, application core dumps, a deleted-but-open log file.

**Remediation:** compress/archive logs respecting retention needs rather than blind deletion; `docker system prune` (reviewed first) for Docker sprawl; reload/restart the service holding a deleted file handle open to release that space immediately.

**Verification:** `df -h` shows freed space, write errors stop.

**Prevention:** `logrotate` configured with sane retention (Part 14), disk alerting at 80% not 100%, separate mounts for volatile data (logs, Docker) so a runaway there can't take down the root filesystem.

---

## Scenario 5 — Application is down

**Symptoms:** Health check failing, users reporting the app is unreachable/erroring.

**First commands:**
```bash
systemctl status myapp
journalctl -u myapp --since "10 minutes ago"
```

**Investigation sequence:**
1. `systemctl status` — is it even running? Check `Active:` state and `Main PID`.
2. If crashed: `journalctl -u myapp -p err --since "30 minutes ago"` — the actual error/stack trace at time of failure.
3. Check whether it's crash-looping (`systemctl status` will show a rapidly incrementing restart count / recent "start-limit-hit" if so).
4. If it's "running" per systemd but still unreachable: confirm it's actually listening where expected — `ss -tulpn | grep <port>` (is it bound to `127.0.0.1` instead of `0.0.0.0`, Part 9?).
5. Check upstream dependencies (database, cache, external API) the app depends on — a healthy process can still fail all requests if a dependency is down.

**Interpreting results:** systemd shows "failed" + start-limit-hit = it tried and gave up automatically, needs a manual fix + `systemctl reset-failed` + restart; "active (running)" but still unreachable = listening/networking/dependency issue, not a crash.

**Likely causes:** unhandled exception/crash on startup, a bad deploy, a dependency (DB/cache) being unreachable, resource exhaustion (memory/disk) preventing startup, a config error.

**Remediation:** fix the root cause identified in the journal (bad config, missing env var, dependency down), then `systemctl reset-failed myapp && systemctl start myapp` if it had hit the restart limit. Roll back the deploy if it correlates with a recent release.

**Verification:** `systemctl status` shows stable `active (running)`, health-check endpoint returns 200, no further crash-loop entries in the journal.

**Prevention:** pre-deploy smoke tests, health-check-gated deploys (don't shift traffic until the new version passes its health check), dependency health checks/circuit breakers in the app itself.

---

## Scenario 6 — Port is not reachable

**Symptoms:** Connection timeout/refused from a client trying to reach a specific service/port.

**First commands (on the destination host):**
```bash
ss -tulpn | grep <port>
```

**Investigation sequence:** follow the full layered workflow from Part 9 (`08-networking.md`): DNS → local routing → Security Groups → NACLs → local firewall → listening state → raw TCP test (`nc -zv`) → application-layer test (`curl`).

**Interpreting results:** "Connection refused" from `nc`/`curl` = reached the host, nothing listening there (or explicit reject) — check bind address and service state; "Connection timed out" = never got a response at all — almost always Security Group, NACL, or routing, not the application.

**Likely causes:** service not actually running/listening, service bound to `127.0.0.1` instead of `0.0.0.0`, Security Group missing the inbound rule, NACL blocking the port or the ephemeral return-port range, local host firewall (iptables/ufw/firewalld) blocking it.

**Remediation:** fix whichever layer the investigation identified — add the missing SG/NACL rule, rebind the service to the correct interface, adjust the local firewall, or start the crashed service.

**Verification:** `nc -zv` succeeds from the same origin that originally failed; the actual client-side symptom resolves.

**Prevention:** infrastructure-as-code review for SG/NACL changes (catch missing rules before deploy), standard health-check monitoring per port/service.

---

## Scenario 7 — DNS is not resolving

**Symptoms:** "Could not resolve host," connection attempts failing before even reaching a network-level timeout.

**First commands:**
```bash
dig +short <hostname>
```

**Investigation sequence:**
1. `dig +short <hostname>` from the affected host — does it resolve at all?
2. `dig @8.8.8.8 <hostname>` (or a known-good external resolver) — isolate whether it's this host's/VPC's resolver specifically, vs. the record genuinely not existing.
3. `cat /etc/resolv.conf` — confirm the host is pointed at the expected resolver (VPC default, or a custom one).
4. For private/internal DNS (Route 53 private hosted zones, etc.): confirm the querying host is actually in a VPC associated with that private zone.
5. Check TTL and recent record changes — a recent DNS change may not have propagated everywhere yet.

**Interpreting results:** resolves fine against `8.8.8.8` but not the local/VPC resolver = local resolver config or private-zone association issue; doesn't resolve anywhere = the record itself is wrong/missing, or truly hasn't propagated yet.

**Likely causes:** VPC DNS settings (`enableDnsSupport`/`enableDnsHostnames`) misconfigured, wrong `/etc/resolv.conf`, private hosted zone not associated with the VPC, a genuinely missing/typo'd DNS record, very recent record change still propagating.

**Remediation:** fix the record, VPC DNS settings, or hosted-zone association as identified; for a genuinely urgent path, temporarily hardcode via `/etc/hosts` (`🟡 use with care`, temporary only, remember to remove it) or `curl --resolve` for a specific test.

**Verification:** `dig +short` returns the expected IP consistently across repeated queries.

**Prevention:** monitor DNS resolution as part of standard health checks, review DNS changes through the same change-management process as other infra changes, sane TTLs for records that might need fast rollback.

---

## Scenario 8 — SSH connection fails

**Symptoms:** `ssh` hangs, times out, or is rejected when connecting to an EC2 instance.

**First commands:**
```bash
ssh -vvv user@host
```

**Investigation sequence:** follow the full EC2 SSH checklist from Part 10 (`09-ssh.md`) — instance running? correct IP (did it change on stop/start)? Security Group allows your current IP on 22? NACL allows inbound 22 + outbound ephemeral? correct AMI username? correct key, correct local permissions (`600`)? connecting from a network with actual path to a private-subnet instance (VPN/bastion)?

**Interpreting results:** `ssh -vvv` hanging at the TCP-connect stage = Security Group/NACL/routing (never got a response); getting further but failing at auth = wrong key or wrong username, not a network problem.

**Likely causes:** stale IP after instance stop/start, Security Group rule scoped to an old IP, wrong `.pem` file, private key permissions too open, wrong AMI default username, no path from your network to a private-subnet instance.

**Remediation:** fix the specific layer identified; if genuinely locked out, use EC2 Instance Connect or Systems Manager Session Manager to regain access without needing SSH/port 22 at all, then fix `sshd_config`/keys from inside.

**Verification:** a fresh `ssh` connection succeeds cleanly.

**Prevention:** use an Elastic IP (or DNS name) instead of relying on the default public IP for anything you SSH to repeatedly; keep Security Group source IP rules current if your team's IPs change; enable Session Manager as a standing fallback access path on every instance.

---

## Scenario 9 — Service keeps restarting (crash-looping)

**Symptoms:** `systemctl status` shows frequent restarts, or eventually "failed" with a start-limit message.

**First commands:**
```bash
systemctl status myapp
journalctl -u myapp -n 100
```

**Investigation sequence:**
1. `journalctl -u myapp -n 100` — read the actual error immediately preceding each crash, not just the last one (patterns across multiple crashes are more informative than a single instance).
2. Check for a correlated recent change: a deploy, a config edit, a dependency version bump.
3. Check resource limits — is it being OOM-killed each time (`journalctl -k | grep -i oom`)? Hitting a file-descriptor or connection limit?
4. Check the unit file's `Restart=`/`RestartSec=`/`StartLimitBurst=` settings (Part 13) to understand the exact retry behavior you're observing.

**Interpreting results:** same error every time = a deterministic bug/config issue (most common and easiest to fix); different/random errors each time = possibly resource exhaustion or a race condition, harder to pin down, look for a pattern in *what's different* about each crash rather than the error text itself.

**Likely causes:** bad config or missing environment variable introduced by a recent deploy, a hard dependency (database) unreachable at startup with no retry/backoff in the app, resource limits, a code bug triggered by specific input/timing.

**Remediation:** roll back the recent change if correlated; fix the identified root cause; if it's a startup-ordering issue (app starts before its dependency is ready), add `After=`/`Requires=` ordering in the unit file, or retry/backoff logic in the app itself.

**Verification:** `systemctl status` stable, restart count stops climbing, `journalctl -u myapp` quiet.

**Prevention:** startup health checks/dependency checks before accepting traffic, canary/staged deploys to catch this before it hits 100% of instances, alerting on restart-count/crash-loop patterns specifically (not just "is it down").

---

## Scenario 10 — Nginx returns 502

**Symptoms:** Nginx serves a 502 Bad Gateway to clients.

**First commands:**
```bash
tail -50 /var/log/nginx/error.log
systemctl status myapp
```

**Investigation sequence:**
1. `/var/log/nginx/error.log` — Nginx logs the specific upstream failure reason (connection refused, timeout, reset by peer).
2. Confirm the upstream application is actually running: `systemctl status myapp`, `ss -tulpn | grep <upstream_port>`.
3. If the upstream IS running: check if it's bound to the address/port Nginx's `proxy_pass` config actually expects — a mismatch here (`127.0.0.1` vs a different interface, or a changed port) is a very common real cause.
4. Check upstream response time/timeouts — a 502 can also mean the upstream is up but too slow, exceeding Nginx's `proxy_read_timeout`, and Nginx gave up.
5. Check upstream's own logs/health for the actual root failure (crash, resource exhaustion, dependency).

**Interpreting results:** "connection refused" in Nginx's error log = nothing listening where Nginx expects (crashed app, wrong port config); "upstream timed out" = app is up but too slow or hung; "reset by peer" = the upstream process died mid-request.

**Likely causes:** upstream app crashed/not running, upstream bound to the wrong interface/port, Nginx `proxy_pass` misconfigured after a port/service change, upstream overloaded and too slow, a recent deploy that broke the upstream.

**Remediation:** restart/fix the upstream application per Scenario 5's playbook; correct the Nginx `proxy_pass` target if it's a config mismatch, then `nginx -t && systemctl reload nginx`.

**Verification:** requests through Nginx return 200 again; `error.log` stops showing upstream failures.

**Prevention:** health-check-gated deploys for the upstream service, Nginx-level upstream health checks (with a module/config that supports active health checks) to fail over or fail fast instead of surfacing raw 502s, alerting on 502 rate specifically as distinct from general error-rate alerts.

---

## Scenario 11 — Application logs contain errors

**Symptoms:** No user-visible outage yet, but error-rate monitoring or a log scan surfaces a spike in ERROR-level entries.

**First commands:**
```bash
grep -c "ERROR" app.log
```

**Investigation sequence:** apply the Part 3 log-analysis progression directly:
```bash
grep "ERROR" app.log | tail -20                                    # see the actual recent errors
grep "ERROR" app.log | awk '{print $1, $2}' | cut -c1-16 | sort | uniq -c | sort -rn | head   # bucket by minute, find the spike window
grep "<error-signature>" app.log | wc -l                             # how many times has THIS specific error occurred
```
Cross-reference the spike window against deploy history, dependency status, and traffic volume (was it a traffic-proportional increase, or a step-change indicating a code/config regression?).

**Interpreting results:** errors proportional to traffic growth = likely a capacity issue, not a bug; a step-change unrelated to traffic = almost always correlates with a recent deploy or an external dependency incident.

**Likely causes:** a regression from a recent deploy, a downstream dependency degrading, a data edge case not previously encountered, resource pressure (memory/connections) causing sporadic failures under load.

**Remediation:** if deploy-correlated, roll back; if dependency-correlated, escalate to that dependency's own troubleshooting path; if it's a genuine new bug, patch and deploy through normal process, using the error signature/stack trace to guide the fix.

**Verification:** error rate returns to baseline; the specific error signature stops recurring.

**Prevention:** error-rate alerting (not just uptime/health-check alerting) so regressions are caught even when the app is technically "up," structured logging with consistent error signatures to make this kind of bucketing/counting reliable.

---

## Scenario 12 — EC2 instance cannot reach another service

**Symptoms:** Application-level errors connecting to a database, cache, or another internal service, distinct from a generic "site is down."

**First commands (on the source instance):**
```bash
nc -zv <destination-host> <port>
```

**Investigation sequence:** this is the full AWS connectivity workflow from Part 9, applied end to end: DNS resolution of the destination → local routing to its IP → Security Group egress on the source AND ingress on the destination → NACL rules on both subnets (remember NACLs are stateless — check both directions explicitly) → raw TCP reachability (`nc -zv`) → application-layer test (`curl`/a protocol-specific client) once the raw port is confirmed open.

**Interpreting results:** identical to Scenario 6/the Part 9 workflow — "timed out" points to the network layers (SG/NACL/routing); "connection refused" points to the destination service itself; connects fine at the TCP level but the application protocol still fails = likely an auth/TLS/application-config issue on top of otherwise-working connectivity.

**Likely causes:** Security Group on the destination doesn't allow the source instance/SG as an inbound rule, NACL blocking the specific port or ephemeral return range, the source and destination are in subnets without a route between them (e.g. missing VPC peering route, wrong route table association), the destination service down or bound to the wrong interface.

**Remediation:** add/correct the missing Security Group or NACL rule; fix the route table if it's a routing gap; restart/fix the destination service if that's the actual root cause once connectivity is confirmed fine.

**Verification:** `nc -zv` succeeds, and the actual application-level operation (query, API call) succeeds against the destination.

**Prevention:** Security Groups referenced by *SG-to-SG* rules rather than hardcoded IPs where possible (survives IP changes automatically), infrastructure-as-code review that specifically checks new services have their required SG/NACL rules before launch, connectivity checks as part of deploy validation for any new inter-service dependency.

---

# Part 30 — Command Risk Classification (Consolidated)

A single consolidated reference of the destructive/careful commands called out throughout this handbook — review before running any of these against production, especially with a variable-built path or a recursive flag.

| Command | Risk | Why |
|---|---|---|
| `rm -rf` | 🔴 DESTRUCTIVE | No undo; unset/empty variables can expand a targeted path into something catastrophic (e.g. `rm -rf $DIR/*` with `$DIR` empty) |
| `dd` | 🔴 DESTRUCTIVE | Writes raw blocks to a device; the wrong `of=` target overwrites a disk with zero warning |
| `mkfs` | 🔴 DESTRUCTIVE | Irreversibly wipes any existing data on the target device |
| `fdisk` / `parted` (write operations) | 🔴 DESTRUCTIVE | Can destroy a partition table / existing data; read-only listing (`fdisk -l`) is safe |
| `fsck` (on a mounted filesystem) | 🔴 DESTRUCTIVE-adjacent | Can corrupt data if run against a live mounted filesystem; unmount first |
| `chmod -R` | 🟡→🔴 | Wrong path/mode recursively applied can lock you out of a directory or expose secrets broadly |
| `chown -R` | 🟡→🔴 | Wrong path recursively applied can hand ownership of unrelated files to the wrong user |
| `kill -9` | 🟡 USE WITH CARE | Gives the process zero chance to clean up (flush writes, close connections); try SIGTERM first |
| `pkill` with a broad/unanchored pattern | 🟡→🔴 | Can match and kill far more processes than intended |
| Firewall changes (`ufw`, `firewalld`, `iptables`) over SSH | 🔴 lockout risk | A rule that doesn't explicitly allow your current SSH source can cut your own access; have an out-of-band access path ready |
| `sshd_config` changes | 🔴 lockout risk | Test syntax (`sshd -t`) and reload (not restart) while keeping your current session open |
| `sed -i` without a backup | 🟡→🔴 | No output preview, no undo; test without `-i` first or use `-i.bak` |
| `find ... -delete` / `-exec rm` | 🟡→🔴 | Always dry-run with `-print` before adding `-delete` |
| `mv`/`cp` onto an existing target | 🟡 USE WITH CARE | Silently overwrites without `-i`/`-n` |
| `xargs` feeding a destructive command | 🟡 USE WITH CARE | A bad pattern match becomes a bad command run many times over |
| `docker system prune -a` | 🔴 DESTRUCTIVE | Removes all unused images/containers/networks — review `docker system df` first |
| `userdel -r` | 🔴 DESTRUCTIVE | Permanently deletes the user's home directory |
| `logrotate --vacuum-*` / manual log deletion | 🟡 USE WITH CARE | Removes log history that may be needed for a later investigation or compliance retention |

**The one habit that prevents most of the entries above from becoming incidents:** before running anything recursive, destructive, or built from a variable, run the read-only/dry-run version first (`ls` the target, `find ... -print` before `-delete`, `sed` without `-i`, `fdisk -l` before writing) and actually read the output.
