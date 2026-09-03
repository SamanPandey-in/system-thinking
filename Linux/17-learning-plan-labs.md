# Part 33 — 30-Day Linux for DevOps Learning Plan

Each day: ~1-2 hours. Do the exercises on a real disposable EC2 instance (a `t3.micro` on the free tier is plenty) — reading alone won't build the muscle memory.

## Week 1 — Foundations

**Day 1 — Shell basics & navigation**
Topics: kernel/shell/terminal, FHS, absolute/relative paths. Commands: `pwd`, `ls`, `cd`, `man`, `--help`.
Exercise: SSH into your instance, explore `/etc`, `/var`, `/opt`, `/proc` with `ls`/`cd`. Read `man ls` end to end once.
Mini challenge: navigate to `/var/log` using only relative paths from `/home`.

**Day 2 — Files and directories**
Topics: creating, copying, moving, deleting; links.
Commands: `touch`, `mkdir -p`, `cp -r`, `mv`, `rm -r`, `ln -s`.
Exercise: build a nested directory structure (`~/lab/releases/v1`, `v2`, `v3`), create a `current` symlink pointing to `v3`, then swap it to `v2` with `ln -sfn`.
Mini challenge: explain, in your own words, why `ln -sfn` (not just `ln -sf`) matters for the symlink-swap deploy pattern.

**Day 3 — Reading and searching files**
Topics: `cat`/`less`/`head`/`tail`, `grep` basics.
Commands: `cat`, `less`, `tail -f`, `grep -i -n -c -r`.
Exercise: download a sample Nginx access log (or generate fake log lines), grep for status code 500s, count them.
Mini challenge: `tail -f` a file in one terminal while appending lines to it from another (`echo "line" >> file.log`) to see it live.

**Day 4 — Text processing: cut, sort, uniq, tr**
Topics: column extraction, sorting, deduplication.
Commands: `cut`, `sort`, `uniq -c`, `tr`.
Exercise: from your sample access log, extract the IP column and find the top 5 most frequent IPs.
Mini challenge: one-line pipeline for "top 5 IPs" using `awk | sort | uniq -c | sort -rn | head`.

**Day 5 — sed and awk**
Topics: stream editing, field-based processing.
Commands: `sed -i`, `awk '{print $N}'`.
Exercise: use `sed` to replace a version string in a fake config file (test without `-i` first, then with `-i.bak`). Use `awk` to sum a numeric column from your log.
Mini challenge: build the 7-step chained pipeline example from Part 3 against your own sample log.

**Day 6 — Permissions and ownership**
Topics: rwx model, numeric perms, `chmod`/`chown`.
Commands: `chmod`, `chown`, `umask`, `id`.
Exercise: create a file, set it to `600`, try reading it as a different user (should fail), fix by adjusting group ownership instead of loosening to `644`/`777`.
Mini challenge: explain why deleting a file requires write permission on the *directory*, not the file.

**Day 7 — Review + mini-project**
Exercise: write a one-page personal cheat sheet (in your own words) covering Days 1-6. Redo Day 3's log-analysis exercise from memory, timing yourself.

## Week 2 — Processes, users, monitoring

**Day 8 — Users and groups**
Topics: `/etc/passwd`, `/etc/group`, sudo.
Commands: `useradd`, `usermod -aG`, `groups`, `sudo -l`.
Exercise: create a `deploy` user, add to a new `deployers` group, create a directory owned by that group with `775`.
Mini challenge: lock the account (`usermod -L`) and confirm it can no longer log in.

**Day 9 — Processes and signals**
Topics: PID/PPID, process states, signals.
Commands: `ps aux`, `top`, `kill`, `kill -9`.
Exercise: start a long-running `sleep 300 &`, find its PID with `ps`, send SIGTERM, confirm it's gone.
Mini challenge: start another background job, disconnect SSH without `nohup`, reconnect, and observe it's gone — then repeat WITH `nohup` and confirm it survived.

**Day 10 — Job control and nohup/tmux**
Topics: bg/fg/jobs, nohup, disown, tmux basics.
Commands: `jobs`, `bg`, `fg`, `nohup`, `tmux new -s`.
Exercise: start a `tmux` session, run a long `sleep`, detach (`Prefix d`), disconnect SSH entirely, reconnect, and reattach (`tmux attach`).
Mini challenge: run two things in separate tmux panes (`Prefix %`) at once.

**Day 11 — CPU/memory monitoring**
Topics: load average, `free`, cached memory vs. available.
Commands: `uptime`, `free -h`, `vmstat`.
Exercise: run a CPU-heavy command (`yes > /dev/null &` a few times) and watch `top`/`uptime` load average climb; kill them and watch it settle.
Mini challenge: explain in your own words why `free`'s "free" column being low isn't automatically a problem.

**Day 12 — Disk monitoring and troubleshooting**
Topics: `df` vs `du`, deleted-but-open files.
Commands: `df -h`, `du -sh`, `lsof | grep deleted`.
Exercise: create a large file, delete it while `tail -f`-ing it in another terminal (keeping the handle open), and observe `df` still shows the space used.
Mini challenge: find and kill the process holding it open, confirm space is released.

**Day 13 — systemd basics**
Topics: units, systemctl, journalctl.
Commands: `systemctl status/start/stop/enable`, `journalctl -u`.
Exercise: install and manage nginx purely through systemctl; watch its logs live with `journalctl -u nginx -f` while curling it.
Mini challenge: `stop` nginx without disabling it, reboot the instance, confirm it comes back up anyway (because it's still enabled) — then fix that by explicitly disabling first if that's not what you wanted.

**Day 14 — Review + mini-project**
Exercise: write a small Bash script (Day 9-13 concepts) that checks if nginx is running, and if not, starts it and logs the action with a timestamp.

## Week 3 — Networking, SSH, Bash scripting

**Day 15 — Networking fundamentals**
Topics: IP/interfaces/routing/ports.
Commands: `ip addr`, `ip route`, `ss -tulpn`.
Exercise: identify every listening port on your instance and what process owns each.
Mini challenge: explain the difference between something listening on `127.0.0.1` vs `0.0.0.0`.

**Day 16 — DNS and curl**
Topics: DNS resolution, HTTP testing.
Commands: `dig`, `curl -I`, `curl -v`.
Exercise: `dig` a few real domains, then use `curl -w` to measure and print just the HTTP status code for several URLs in a loop.
Mini challenge: use `curl --resolve` to hit a host while forcing a specific IP.

**Day 17 — nc and connectivity troubleshooting**
Topics: raw TCP testing, the AWS connectivity workflow.
Commands: `nc -zv`.
Exercise: intentionally misconfigure a Security Group to block a port, observe the `nc -zv` timeout, fix it, confirm success.
Mini challenge: work through the full 8-step Part 9 connectivity workflow against your own two-instance setup (or simulate with a local service + `iptables` block).

**Day 18 — SSH deep dive**
Topics: keys, config, agent.
Commands: `ssh-keygen`, `~/.ssh/config`.
Exercise: generate a new ed25519 key, add it as an authorized key on your instance, set up an `~/.ssh/config` entry with a friendly host alias.
Mini challenge: set up a two-hop `ProxyJump` config using a second instance as a simulated bastion.

**Day 19 — Bash scripting fundamentals**
Topics: variables, conditionals, loops, functions.
Exercise: write a script that loops over a list of servers (even fake ones) and pings each, printing OK/FAIL.
Mini challenge: convert it to use a proper `getopts`-based flag interface (`-f serverlist.txt`).

**Day 20 — Bash scripting: real scripts**
Topics: `set -euo pipefail`, error handling.
Exercise: write and test the disk-usage-alert script from Part 12 against your own instance, including intentionally triggering the alert (fill a small test volume).
Mini challenge: add `set -u` and deliberately reference an unset variable to see it fail loudly, then fix it.

**Day 21 — Review + mini-project**
Exercise: write a service-health-checker script (Part 12 Script 3) combining systemd status + an HTTP check, and schedule it via cron every 5 minutes with output redirected to a log file.

## Week 4 — Logs, packages, security, AWS integration, troubleshooting

**Day 22 — Logs and log rotation**
Topics: journal vs flat files, `logrotate`.
Exercise: write a custom `logrotate` config for a sample app log, test with `logrotate -d` (dry run), then force it with `-f`.
Mini challenge: add a `postrotate` hook that reloads a service, and explain why it matters (Part 8/14's deleted-file problem).

**Day 23 — Package management**
Topics: apt/dnf, dependency handling.
Exercise: install, update, and cleanly remove a package using your distro's tool; inspect what files it installed (`dpkg -L` or `rpm -ql`).
Mini challenge: pin/install a specific older version of a package deliberately, then explain why you might need to in production.

**Day 24 — Archives and backups**
Topics: tar/gzip, backup patterns.
Exercise: write and run the backup script from Part 12 (Script 5), including the retention-cleanup logic.
Mini challenge: restore from the backup you just created into a different directory, verifying integrity.

**Day 25 — Cron and systemd timers**
Topics: cron syntax, `flock`, systemd timers.
Exercise: schedule your Day 21 health-checker via both a cron entry AND an equivalent systemd timer; compare the logging experience (`journalctl -u` vs a flat log file).
Mini challenge: intentionally make the health-check script take longer than its interval, and add `flock` to prevent overlapping runs.

**Day 26 — Security basics**
Topics: SSH hardening, firewalls, sudo hygiene.
Exercise: harden `sshd_config` (disable root login, disable password auth), test carefully (keep an existing session open!), reload.
Mini challenge: configure `ufw`/`firewalld` to allow only SSH and HTTP, verify with `ss -tulpn` and an external `nc -zv` test that nothing else is reachable.

**Day 27 — AWS EC2 integration**
Topics: instance metadata, EBS volumes.
Exercise: attach a new EBS volume, partition/format/mount it, add a correct `/etc/fstab` entry with `nofail`, test with `mount -a` before rebooting.
Mini challenge: query the instance metadata service for instance ID/type and print it in a health-check script.

**Day 28 — Docker/container troubleshooting basics**
Topics: host-level container inspection.
Exercise: run a simple container, then find its host-side PID with `docker inspect`, and inspect its resource usage with `docker stats` and `ps` from the host side.
Mini challenge: use `nsenter` to inspect the container's network namespace directly from the host.

**Day 29 — Full incident simulation**
Exercise: pick 3 scenarios from Part 15's playbooks (e.g. disk full, service crash-looping, port unreachable) and deliberately break your own instance to match each, then work the playbook end-to-end to resolve it, timing yourself.

**Day 30 — Capstone**
Exercise: from a fresh EC2 instance, in one sitting: create a deploy user, harden SSH, install and configure nginx as a reverse proxy to a simple app, set up the app as a systemd service with `Restart=on-failure`, configure logrotate for its logs, write and schedule a health-check script, and do a full symlink-swap style deploy of a "new version." Document what you did as a short runbook for your future self.

---

# Part 34 — Hands-On Labs

## Lab 1 — Create users and configure permissions

**Objective:** practice user/group creation and correct (not `777`) permission fixing.
**Prerequisites:** sudo access on an EC2 instance.
**Setup:** none beyond a fresh instance.
**Commands:**
```bash
sudo groupadd deployers
sudo useradd -m -s /bin/bash -G deployers deploy
sudo mkdir -p /opt/shared-app
sudo chown root:deployers /opt/shared-app
sudo chmod 775 /opt/shared-app
```
**Expected result:** the `deploy` user can create files inside `/opt/shared-app`; a user NOT in `deployers` cannot.
**Explanation:** group-based write access, not world-writable `777`, is how multiple trusted users/services share a directory safely.
**Challenge:** add a second user to `deployers`, confirm they can also write; then remove one user from the group and confirm access is revoked without touching the directory's permissions at all.
**Solution:** `sudo usermod -aG deployers seconduser`; `sudo gpasswd -d deploy deployers` to remove, then re-test with a fresh shell (group membership is evaluated at login).

## Lab 2 — Deploy Nginx

**Objective:** install, configure, and manage Nginx via systemd.
**Prerequisites:** Lab 1 optional context.
**Setup:** fresh instance, port 80 allowed in Security Group.
**Commands:**
```bash
sudo apt update && sudo apt install -y nginx          # or: sudo dnf install -y nginx
sudo systemctl enable --now nginx
curl -I http://localhost
```
**Expected result:** `curl` returns `HTTP/1.1 200 OK`.
**Explanation:** `enable --now` both starts it immediately and ensures it survives reboot — the combined pattern from Part 13.
**Challenge:** edit `/etc/nginx/sites-available/default` (or `/etc/nginx/conf.d/`) to change the response, then apply the change WITHOUT dropping any in-flight connections.
**Solution:** `sudo nginx -t && sudo systemctl reload nginx` (reload, not restart).

## Lab 3 — Investigate a full disk

**Objective:** practice the Part 7/15 disk-full decision tree end to end.
**Prerequisites:** a disposable instance (this lab intentionally fills disk space).
**Setup:**
```bash
fallocate -l 2G ~/junkfile1
fallocate -l 1G ~/junkfile2
```
**Commands:**
```bash
df -h
du -h --max-depth=1 ~ | sort -rh
```
**Expected result:** `df -h` shows elevated usage on `/`; the `du` drill-down identifies `junkfile1`/`junkfile2` as the cause.
**Explanation:** this mirrors real disk-full triage — `df` tells you THAT it's full, `du` tells you WHERE.
**Challenge:** delete one file while `tail -f`-ing it in another pane first (to simulate the deleted-but-open scenario), and observe `df` doesn't immediately reflect the freed space.
**Solution:** `sudo lsof | grep deleted`, identify the holding process, kill/restart it, confirm `df -h` now reflects the true freed space.

## Lab 4 — Find a high-CPU process

**Objective:** practice the CPU-high decision tree.
**Prerequisites:** none.
**Setup:**
```bash
yes > /dev/null &
yes > /dev/null &
```
**Commands:**
```bash
top
ps aux --sort=-%cpu | head
```
**Expected result:** two `yes` processes visible near the top, consuming significant CPU.
**Explanation:** `yes` is a harmless, infinite-output command — a safe stand-in for a runaway process in a lab setting.
**Challenge:** kill them gracefully, confirm load average trends back down over the next minute (`uptime` — remember the 1/5/15 min averages lag).
**Solution:** `pkill -f "yes"` then watch `uptime` over a few minutes as the 1-minute average catches up to reality.

## Lab 5 — Create a systemd service

**Objective:** package a simple script as a managed, auto-restarting systemd service.
**Prerequisites:** none.
**Setup:**
```bash
cat << 'EOF' | sudo tee /usr/local/bin/heartbeat.sh
#!/usr/bin/env bash
while true; do echo "$(date): heartbeat"; sleep 5; done
EOF
sudo chmod +x /usr/local/bin/heartbeat.sh
```
**Commands:**
```bash
sudo tee /etc/systemd/system/heartbeat.service << 'EOF'
[Unit]
Description=Heartbeat test service
[Service]
ExecStart=/usr/local/bin/heartbeat.sh
Restart=on-failure
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now heartbeat
journalctl -u heartbeat -f
```
**Expected result:** a new "heartbeat" log line every 5 seconds, visible live in `journalctl -f`.
**Explanation:** demonstrates the full custom-unit workflow from Part 13, plus journal integration.
**Challenge:** kill the underlying process directly (`pkill -f heartbeat.sh`) and confirm systemd's `Restart=on-failure` brings it back automatically.
**Solution:** watch `journalctl -u heartbeat -f` continue uninterrupted (aside from a brief gap) after the kill — systemd restarted it per policy.

## Lab 6 — Analyze logs

**Objective:** practice the Part 3 text-processing pipelines against a realistic log.
**Prerequisites:** none.
**Setup:** download or generate a sample access log (many sample Apache/Nginx combined-format logs are available online, or generate synthetic lines).
**Commands:**
```bash
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10
awk '{print $9}' access.log | sort | uniq -c | sort -rn
```
**Expected result:** a top-10 IP list and a status-code breakdown.
**Explanation:** exactly the pipeline used in real incident response (Part 3/15 Scenario 11).
**Challenge:** find the single busiest one-minute window in the log.
**Solution:** `awk '{print $4}' access.log | cut -c1-18 | sort | uniq -c | sort -rn | head -1` (adjust field/cut range to your log's actual timestamp format).

## Lab 7 — Troubleshoot a network port

**Objective:** practice the Part 9/15 port-unreachable workflow.
**Prerequisites:** two instances (or one instance + a local test), Security Group edit access.
**Setup:** start a simple listener: `nc -l 8080` on the target instance/host.
**Commands (from a second host):**
```bash
nc -zv <target-ip> 8080
```
**Expected result:** initially fails (Security Group doesn't allow 8080 yet).
**Explanation:** reproduces the most common real-world "I opened the app but can't reach it" scenario.
**Challenge:** work through the Part 9 layered workflow to find and fix the actual blocker.
**Solution:** add an inbound Security Group rule for TCP 8080 from your source, re-test `nc -zv`, confirm it now succeeds.

## Lab 8 — Create a Bash health-check script

**Objective:** build and schedule Part 12's Script 3 pattern for real.
**Prerequisites:** Lab 2 (nginx running).
**Setup:** none beyond nginx being installed and running.
**Commands:** write `/usr/local/bin/health-check.sh` per Part 12 Script 3, test manually first, then:
```bash
sudo chmod +x /usr/local/bin/health-check.sh
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/health-check.sh >> /var/log/health-check.log 2>&1") | crontab -
```
**Expected result:** `/var/log/health-check.log` accumulates an OK line every 5 minutes.
**Explanation:** demonstrates the full cron-with-logging pattern from Part 20, avoiding the "silent cron failure" trap.
**Challenge:** stop nginx manually and confirm the script both detects it AND self-heals via restart on its next scheduled run.
**Solution:** `sudo systemctl stop nginx`, wait for the next cron tick, `tail /var/log/health-check.log` to confirm the restart attempt and subsequent success.

## Lab 9 — Configure SSH securely

**Objective:** apply Part 21's SSH hardening safely.
**Prerequisites:** an active SSH session you can keep open as a safety net.
**Setup:** **keep your current SSH session open in one terminal at all times during this lab.**
**Commands:**
```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sshd -t
sudo systemctl reload sshd
```
**Expected result:** `sshd -t` reports no syntax errors; a NEW ssh connection (opened in a third terminal, while your original session stays connected) still succeeds via key auth.
**Explanation:** models the safe change-management pattern for anything that could lock you out — test syntax, reload (not restart), verify a fresh connection before closing your safety-net session.
**Challenge:** intentionally introduce a syntax error and observe `sshd -t` catching it before you ever reload.
**Solution:** revert from the `.bak` file if anything goes wrong: `sudo cp /etc/ssh/sshd_config.bak /etc/ssh/sshd_config && sudo systemctl reload sshd`.

## Lab 10 — Use tmux for persistent remote work

**Objective:** experience the SSH-disconnection-survival workflow firsthand.
**Prerequisites:** `tmux` installed (`sudo apt/dnf install tmux`).
**Setup:** none.
**Commands:**
```bash
tmux new -s labwork
for i in $(seq 1 100); do echo "iteration $i"; sleep 3; done
```
Then press `Ctrl+b` `d` to detach, and fully close your terminal/SSH client.
**Expected result:** reconnecting via SSH and running `tmux attach -t labwork` shows the loop still running, uninterrupted, exactly where it would have been if you'd never disconnected.
**Explanation:** directly demonstrates why `tmux` (not a bare foreground command) is the correct tool for anything long-running you might need to step away from.
**Challenge:** split the tmux window into two panes (`Ctrl+b` `%`) and run `htop` in one pane while the loop continues in the other.
**Solution:** `Ctrl+b` `%` to split, `Ctrl+b` then an arrow key to switch panes, run `htop` in the new pane — both remain live and independently scrollable.
