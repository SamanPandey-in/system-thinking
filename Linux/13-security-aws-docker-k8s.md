# Part 21 — Security Basics

Defensive server administration — hardening what you control, not offensive security testing.

## SSH hardening
```text
# /etc/ssh/sshd_config
PermitRootLogin no                  # force named-user + sudo, never direct root login
PasswordAuthentication no             # key-only auth — eliminates brute-force password attacks entirely
PubkeyAuthentication yes
AllowUsers deploy ubuntu                # explicit allow-list (optional, extra layer)
Port 22                                    # changing this is weak "security by obscurity" but does cut automated scan noise
MaxAuthTries 3
ClientAliveInterval 300                       # drop dead/idle connections
```
```bash
sudo sshd -t                    # test config syntax BEFORE reloading — a bad config can lock out ALL future SSH access
sudo systemctl reload sshd        # apply (reload, not restart — doesn't drop your CURRENT session)
```
**Risk:** 🔴 potentially lockout-inducing if misconfigured — always test syntax first, and keep an existing session open until you've confirmed a NEW connection also works.

## File permissions and sudo
- Covered fully in Part 4 — the short version: least privilege by default, `600`/`700` for anything sensitive, `sudo` (not shared root passwords) for elevation, `visudo` only for editing sudoers.
- Audit periodically: `sudo -l` for what a user can run; grep `/etc/sudoers` and `/etc/sudoers.d/` for overly broad `ALL=(ALL) NOPASSWD:ALL` grants that were meant to be temporary.

## Users, groups, and secrets
- Dedicated non-login service accounts (shell `/usr/sbin/nologin`) for each application — never run application processes as root.
- Secrets (API keys, DB passwords) belong in `600`-permission files or a secrets manager (AWS Secrets Manager/SSM Parameter Store), never committed to version control or left world-readable in `/etc/environment`.
- Rotate SSH keys and credentials on personnel changes — don't rely solely on account deactivation.

## Firewall basics

## `ufw` (Ubuntu's simplified firewall front-end for iptables/nftables)
```bash
sudo ufw status
sudo ufw allow 22/tcp
sudo ufw allow from 10.0.0.0/8 to any port 5432    # restrict a port to a specific source range
sudo ufw deny 23
sudo ufw enable
```
**Risk:** 🔴 can lock yourself out if you enable it without an explicit allow rule for your current SSH port first.

## `firewalld` (RHEL-family default, including Amazon Linux)
```bash
sudo firewall-cmd --state
sudo firewall-cmd --list-all
sudo firewall-cmd --add-port=8080/tcp --permanent
sudo firewall-cmd --reload
```
**Risk:** 🔴 same lockout risk as `ufw` — always verify SSH access is explicitly allowed before reloading with new rules.

## `iptables` / `nftables`
**Purpose:** The lower-level packet-filtering frameworks that `ufw`/`firewalld` are front-ends for. `nftables` is the modern replacement for `iptables`, but `iptables` syntax/commands remain extremely common in existing scripts and documentation (often transparently translated to nftables under the hood on newer kernels).
```bash
sudo iptables -L -n -v          # list current rules (numeric, verbose)
sudo nft list ruleset               # nftables equivalent
```
**On AWS specifically:** Security Groups and NACLs (cloud-layer firewalling, Part 9) handle most perimeter filtering — host-level `iptables`/`ufw`/`firewalld` is a valuable **defense-in-depth** layer but rarely your *only* firewall in a well-architected AWS setup. Don't assume host firewall rules alone are sufficient without also reviewing Security Groups.
**Risk:** 🟡 USE WITH CARE reading; 🔴 DESTRUCTIVE/lockout-risk when modifying rules remotely — always have an out-of-band access method (Session Manager, EC2 Instance Connect, console) available before changing firewall rules over SSH.

## Exposed ports and processes — routine self-audit
```bash
ss -tulpn                     # what's actually listening, and on which interface (Part 9)
sudo dnf update / sudo apt update && sudo apt upgrade   # keep packages patched — the single highest-value security habit
```

## Package updates
Staying current with security patches is the single most effective, lowest-effort security practice available. Automate where feasible (`unattended-upgrades` on Ubuntu, `dnf-automatic` on RHEL-family) for security-only updates, while still testing full version upgrades before rolling to production.

---

# Part 22 — AWS EC2 + Linux

Practical Linux-side workflows for the most common EC2 tasks.

## Connecting to EC2
```bash
ssh -i mykey.pem ubuntu@<public-ip-or-dns>          # Ubuntu AMI
ssh -i mykey.pem ec2-user@<public-ip-or-dns>          # Amazon Linux / RHEL-family AMI
```
No SSH key/port available at all? Use **EC2 Instance Connect** (browser-based, short-lived key injection) or **Systems Manager Session Manager** (no inbound port required, works through the SSM agent + AWS API) — both accessible from the AWS Console without needing your `.pem` file or an open port 22.

## Health checks (chain the tools from earlier parts)
```bash
uptime; free -h; df -h; ss -tulpn                    # quick composite health snapshot
curl -s http://169.254.169.254/latest/meta-data/instance-id     # confirm which instance you're actually on (IMDSv1-style; use the token flow for IMDSv2-enforced instances)
```

## Mounting an additional EBS volume
```bash
lsblk                                     # confirm the new device name (Part 8)
sudo mkfs -t ext4 /dev/nvme1n1              # ONLY if it's a genuinely new/empty volume
sudo mkdir -p /data
sudo mount /dev/nvme1n1 /data
echo "UUID=$(sudo blkid -s UUID -o value /dev/nvme1n1)  /data  ext4  defaults,nofail  0  2" | sudo tee -a /etc/fstab
sudo mount -a          # test the fstab entry before rebooting
```

## Installing software (Ubuntu vs Amazon Linux)
```bash
# Ubuntu
sudo apt update && sudo apt install -y nginx

# Amazon Linux 2023 / RHEL-family
sudo dnf install -y nginx
```

## Managing users on a fresh instance
```bash
sudo useradd -m -s /bin/bash deploy
sudo usermod -aG sudo deploy          # Ubuntu: 'sudo' group; Amazon Linux: 'wheel' group instead
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh
sudo chmod 600 /home/deploy/.ssh/authorized_keys
```
**Amazon Linux note:** the sudo-equivalent group is `wheel`, not `sudo` — `usermod -aG wheel deploy` on Amazon Linux/RHEL vs `usermod -aG sudo deploy` on Ubuntu/Debian.

## Deploying an application (the pattern from Part 12's Script 6)
```bash
scp -i mykey.pem release.tar.gz ubuntu@ec2-host:/tmp/
ssh -i mykey.pem ubuntu@ec2-host
sudo mkdir -p /opt/app/releases/v2.4.1
sudo tar -xzf /tmp/release.tar.gz -C /opt/app/releases/v2.4.1
sudo ln -sfn /opt/app/releases/v2.4.1 /opt/app/current
sudo systemctl restart myapp
```

## Troubleshooting connectivity — see the full workflow in Part 9 (`08-networking.md`)

---

# Part 23 — Linux Commands for Docker and Kubernetes (Host Perspective)

This section covers only the **Linux host-level** commands useful when troubleshooting containerized workloads — not Docker/Kubernetes API usage itself. Understanding that containers are just regular Linux processes with isolation (namespaces + cgroups), not a separate kind of "thing," is what makes this troubleshooting tractable.

## Why Linux fundamentals make container troubleshooting easier

A container is a normal Linux process, given its own isolated view of:
- **PID namespace** — its own process tree (PID 1 inside the container is a different, unrelated process to PID 1 on the host)
- **Network namespace** — its own network interfaces/routing table
- **Mount namespace** — its own filesystem view
- **cgroups** — CPU/memory limits enforced by the kernel, the same mechanism that powers `nice`/resource limits elsewhere in this handbook

This means: every tool in Parts 5-9 of this handbook (`ps`, `ss`, `df`, `top`) still fundamentally applies — you're just often looking at things from the host's outside view instead of from inside the container's isolated view.

## Processes
```bash
ps aux | grep docker                 # see the containerd/dockerd processes themselves
ps -ef --forest                        # tree view — shows container processes as children of containerd-shim
docker top <container>                   # docker's own view: which HOST pids belong to a given container
```

## Namespaces
```bash
sudo lsns                          # list all namespaces on the host, by type (pid, net, mnt, etc.)
sudo nsenter -t <pid> -n ip addr     # enter a specific process's NETWORK namespace and run a command inside it —
                                        # extremely useful for inspecting a running container's networking
                                        # from the host WITHOUT needing docker exec / a shell inside the image
```

## Ports
```bash
ss -tulpn | grep docker              # what ports docker/containerd itself has bound on the HOST
docker port <container>                 # docker's mapping of container-internal ports to host ports
```

## Filesystem/mounts
```bash
docker system df                     # Docker's own disk usage breakdown (images, containers, volumes, cache) —
                                        # THE first command when a host's disk fills up and docker is suspected
df -h /var/lib/docker                   # if Docker's data root is on its own mount, check it directly
du -sh /var/lib/docker/*                  # break down where Docker's usage actually is
docker system prune -a                       # reclaim space — 🔴 removes ALL unused images/containers/networks, review first
```

## Logs
```bash
docker logs <container>              # container's own stdout/stderr, as captured by Docker's logging driver
journalctl -u docker                   # the Docker DAEMON's own logs (different from any individual container's logs)
```

## CPU/memory
```bash
docker stats                          # live per-container resource usage — the container-scoped version of `top`
cat /sys/fs/cgroup/memory.max            # (cgroup v2) inspect a specific cgroup's memory limit directly, if you know its path
```

## PID inspection across host/container boundary
```bash
docker inspect --format '{{.State.Pid}}' <container>    # the HOST-side PID of a container's main process
ps -p <that_pid> -o pid,ppid,cmd                            # now inspect it with ordinary host tools
```

## Disk usage inside a container's writable layer
```bash
docker ps -s                          # shows each container's writable-layer size alongside normal `docker ps` output
```

**Summary takeaway:** when a container-related symptom shows up (high CPU, disk full, network unreachable), the fastest path is usually: find the **host-level PID or interface** belonging to that container (`docker inspect`, `docker top`, `nsenter`), then apply the exact same Linux commands from Parts 6-9 of this handbook directly against it — you don't need container-specific tools for most of the actual diagnosis.
