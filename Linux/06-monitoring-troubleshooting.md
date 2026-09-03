# Part 7 — System Monitoring and Troubleshooting

This is the highest-leverage section in the whole handbook: the difference between a junior and senior engineer during an incident is usually *which command they run first* and *how correctly they interpret the output*.

## `uptime`
**Purpose:** Quick system health snapshot — how long it's been running, and load average.
```bash
uptime
```
```text
 09:41:03 up 12 days,  3:22,  2 users,  load average: 2.15, 1.87, 1.42
```
**Load average** is three numbers: average number of processes wanting CPU time, over the last **1, 5, and 15 minutes**. Interpretation requires knowing your core count:
```bash
nproc      # number of CPU cores
```
- Load **below** core count → generally fine (processes aren't queuing for CPU).
- Load **at/above** core count → processes are waiting; on a 4-core box, load average of 8 means, roughly, twice as much work queued as the CPUs can immediately handle.
- **Rising trend** (1min > 5min > 15min) → load is getting worse right now. **Falling trend** → recovering from a recent spike.
- Load average includes processes waiting on **I/O**, not just CPU — high load with low CPU usage often points to disk/network I/O bottlenecks, not compute (see decision tree below).
**Risk:** 🟢 SAFE

## `free`
**Purpose:** Memory and swap usage.
```bash
free -h
```
```text
              total        used        free      shared  buff/cache   available
Mem:           15Gi       4.2Gi       1.1Gi       210Mi        10Gi        10Gi
Swap:         2.0Gi          0B       2.0Gi
```
**Reading this correctly (the #1 misread metric in Linux):** `free` (1.1Gi) looks low, but `available` (10Gi) is what actually matters — Linux aggressively uses spare RAM for disk **cache** (`buff/cache`), which is reclaimed instantly if an application needs it. Low `free` + high `buff/cache` is **normal and healthy**, not a memory problem. The metric to actually watch is `available`, and whether `Swap used` is climbing.
**Swap usage growing** under load is a real warning sign — it means physical RAM is genuinely exhausted and the kernel is paging to disk, which is drastically slower and often *causes* the load spike you're investigating (see decision tree).
**Risk:** 🟢 SAFE

## `vmstat`
**Purpose:** A compact rolling snapshot of CPU, memory, and I/O — good for watching *trends* over a few seconds.
```bash
vmstat 2 5      # sample every 2 seconds, 5 times
```
```text
procs -----------memory---------- ---swap-- -----io---- -system-- ------cpu-----
 r  b   swpd   free   buff  cache   si   so    bi    bo   in   cs us sy id wa st
 2  1      0 120500  85200 4102300    0    0    45   120  980 1500 12  3 84  1  0
```
Key columns: `r` (processes runnable/waiting for CPU — sustained high values = CPU-bound), `b` (processes blocked on I/O), `si`/`so` (swap in/out — should be 0 on a healthy box), `wa` (% CPU time waiting on I/O — high = disk-bound, not CPU-bound).
**Risk:** 🟢 SAFE

## `iostat`
**Purpose:** Per-device disk I/O statistics (part of the `sysstat` package — install if missing: `apt/dnf install sysstat`).
```bash
iostat -xz 2 5      # extended stats, skip idle devices, every 2s, 5 samples
```
Key column: **`%util`** — how busy the device is; sustained near-100% means the disk is your bottleneck, regardless of what CPU/memory look like. `await` is average I/O wait time in ms per request — rising `await` under load points to a saturated or slow (network/EBS) disk.
**Risk:** 🟢 SAFE

## `sar`
**Purpose:** Historical system activity — unlike `top`/`vmstat` (live only), `sar` (also `sysstat` package) can report **past** data if collection is enabled, invaluable for "what was happening at 3am when the alert fired" without having been logged in at the time.
```bash
sar -u 1 5           # CPU, live
sar -r 1 5            # memory
sar -u -f /var/log/sysstat/sa19    # CPU usage from a specific past day's data file
```
**Risk:** 🟢 SAFE

## `mpstat`
**Purpose:** Per-CPU-core breakdown (also `sysstat`) — useful to spot a **single-threaded** app pegging one core to 100% while `top`'s aggregate view looks merely "busy but not maxed."
```bash
mpstat -P ALL 2
```
**Risk:** 🟢 SAFE

## `watch`
**Purpose:** Re-run any command repeatedly, showing live-updating output — turns any static command into a monitor.
```bash
watch -n 2 'df -h'                 # re-run every 2 seconds
watch -n 1 'ps aux --sort=-%cpu | head'
```
**Risk:** 🟢 SAFE

## `time`
**Purpose:** Measure how long a command takes, and how it split between real/user/sys time.
```bash
time ./build.sh
```
```text
real    0m42.113s
user    0m38.220s
sys     0m2.310s
```
`real` = actual elapsed wall-clock time; `user` = CPU time spent in your program's own code; `sys` = CPU time spent in kernel calls on its behalf. A large gap between `real` and `user+sys` usually means the process spent time waiting (I/O, network, sleeping), not computing.
**Risk:** 🟢 SAFE

---

## Interpreting the numbers — key concepts

- **CPU utilization**: percentage of time cores are busy. Split into `us` (userspace), `sy` (kernel/system), `wa` (waiting on I/O), `id` (idle). High `wa` with low `us`/`sy` = disk-bound, not CPU-bound — don't chase a CPU fix for an I/O problem.
- **Context switching**: the kernel swapping which process is actively running on a core. Some is normal; an abnormally high rate (visible in `vmstat`'s `cs` column) can indicate too many small processes/threads contending, or a misbehaving app spinning.
- **Cached memory**: not "used" memory in any concerning sense — the kernel opportunistically caches recently-read disk data in free RAM for speed, and instantly evicts it if a real application needs the memory instead.

---

## Linux Troubleshooting Decision Trees

### CPU high
```
1. uptime / top  → confirm load average is actually elevated, and note the trend (rising/falling)
2. top (sorted by %CPU) or `ps aux --sort=-%cpu | head`  → identify the specific process(es)
3. Is it ONE process pegged near 100%, or many processes summing high?
     → ONE process: likely a runaway/stuck loop, or a legitimate heavy computation
     → MANY processes: likely a traffic spike or a fork-bomb-like pattern
4. Inspect that process:
     - `ps -o pid,ppid,cmd,%cpu,etime -p <pid>`  (how long has it been running?)
     - Application logs around the time it started climbing
     - `strace -p <pid>` (briefly) if you need to see what syscalls it's stuck in (advanced/careful use)
5. Decide: expected heavy load (scale out) vs. bug (restart/kill and investigate the code path)
6. Remediate: graceful kill+restart of the offending process/service, or scale horizontally if it's genuine legitimate load
7. Verify: `uptime` trending back down, `top` calm
8. Prevent: add CPU alerting *before* it's user-visible, consider autoscaling, profile the code path that spiked
```

### Memory high
```
1. free -h  → check `available`, not `free`; check if Swap `used` is climbing
2. If available is low AND swap is climbing → genuine memory pressure
3. `ps aux --sort=-%mem | head`  → identify top memory consumers
4. Check for a memory LEAK signature: does RSS for one process grow steadily over hours/days with no drop? (compare against historical monitoring/CloudWatch)
5. Check dmesg/journalctl for OOM killer activity: `dmesg | grep -i "out of memory"` or `journalctl -k | grep -i oom`
6. Remediate: restart the leaking service (temporary relief), then fix the underlying leak in code; add/resize swap only as a stopgap, not a permanent fix for a real leak
7. Verify: free -h stabilizes, no further OOM kills in dmesg
8. Prevent: memory limits + alerts (CloudWatch, cgroup limits in Docker/systemd), regular restarts as a stopgap only while root cause is fixed, load testing before release
```

### Disk full
```
1. df -h  → which filesystem is full (e.g. `/` at 100%, or a separate `/var` mount)
2. du -h --max-depth=1 <mount> | sort -rh  → drill down directory by directory to find the big consumer
3. Repeat du drill-down into the biggest subdirectory until you find specific large files/dirs
4. Common culprits: /var/log (runaway/unrotated logs), Docker images/volumes (`docker system df`), old kernel packages, core dumps, /tmp
5. If du and df totals don't add up: a deleted file is still held open by a running process — see Part 8 for `lsof | grep deleted`
6. Clean up safely: compress/archive old logs rather than blind delete where retention matters; confirm nothing critical before rm
7. Verify: df -h shows freed space
8. Prevent: logrotate configured with sane retention, disk usage alerting well before 100% (e.g. at 80%), separate partitions for volatile data (logs, Docker) so a runaway doesn't take down root
```

### "Server is slow" (general, unclear cause)
```
1. uptime           → is load actually elevated?
2. free -h            → memory pressure / swapping?
3. df -h                → any filesystem at/near 100%?
4. vmstat 2 5             → CPU-bound (r, us/sy) vs I/O-bound (wa, b) at a glance
5. Narrow to the specific subsystem using the trees above, then follow that tree
6. If none of the above show a problem: check the NETWORK path next (Part 8) — DNS latency,
   security group/NACL issues, or a downstream dependency (database, external API) being slow
   is a very common "server itself looks fine" root cause
```
