# Linux for DevOps: The Production Engineer's Handbook

A complete, practical Linux reference for a DevOps / SRE / Cloud Engineer who manages AWS Linux servers over SSH. This is not a generic Linux tutorial — every command is framed around real production use: incident response, deployments, monitoring, security, and day-to-day server administration.

**Primary distro emphasis:** Ubuntu/Debian is used as the default for command examples. Where Amazon Linux (RHEL-family) differs, it's called out explicitly in a **"Amazon Linux note"** callout.

**Risk legend used throughout:**
- 🟢 **SAFE** — read-only or low-impact, safe to run anytime
- 🟡 **USE WITH CARE** — can affect running services, permissions, or data; understand before running
- 🔴 **DESTRUCTIVE** — can cause data loss, downtime, or lockout if misused; double-check before running

## How this handbook is organized

This handbook is split into multiple Markdown files so each part is independently readable and searchable. Read them in order the first time through; use them as a reference (Ctrl+F) afterward.

| File | Covers |
|---|---|
| [01-linux-fundamentals.md](01-linux-fundamentals.md) | What Linux is, shell basics, filesystem hierarchy, PATH, exit codes, redirection basics, foundational nav commands |
| [02-files-directories.md](02-files-directories.md) | Creating/copying/moving/finding files, links, `find`, `du`/`df` basics |
| [03-text-processing.md](03-text-processing.md) | `cat`/`less`/`head`/`tail`/`sort`/`uniq`/`cut`/`tr`, deep `grep`/`sed`/`awk`, regex, log-parsing pipelines |
| [04-permissions-users.md](04-permissions-users.md) | Ownership, chmod/chown, numeric vs symbolic perms, users & groups, sudo, `/etc/passwd` |
| [05-processes-jobs.md](05-processes-jobs.md) | ps/top/htop, signals, kill, background jobs, nohup, nice/renice, zombies |
| [06-monitoring-troubleshooting.md](06-monitoring-troubleshooting.md) | CPU/memory/load/I/O tools, decision trees for high CPU/mem/disk |
| [07-storage.md](07-storage.md) | Disks, mounts, partitions, inodes, EBS, "disk full" mysteries |
| [08-networking.md](08-networking.md) | ip/ss/curl/dig/nc, DNS, ports, the full AWS connectivity troubleshooting workflow |
| [09-ssh.md](09-ssh.md) | Keys, agent, config, port forwarding, bastion/ProxyJump, EC2 SSH checklist |
| [10-environment-bash-scripting.md](10-environment-bash-scripting.md) | Env vars, shell config files, full Bash scripting course with real scripts |
| [11-systemd-logs.md](11-systemd-logs.md) | systemctl, journalctl, unit files, custom services, log rotation |
| [12-packages-archives-cron.md](12-packages-archives-cron.md) | apt/dnf/yum/rpm, tar/gzip/zip, cron syntax, systemd timers |
| [13-security-aws-docker-k8s.md](13-security-aws-docker-k8s.md) | Server hardening basics, firewalls, EC2 workflows, Linux-side Docker/K8s troubleshooting |
| [14-editors-tmux-tools.md](14-editors-tmux-tools.md) | Vim/Neovim/LazyVim/Nano comparison + cheat sheets, tmux, jq/fzf/ripgrep/ncdu etc. |
| [15-troubleshooting-playbooks.md](15-troubleshooting-playbooks.md) | 12 full incident playbooks (high CPU, disk full, 502, DNS, SSH failure, etc.) |
| [16-master-reference-memorize.md](16-master-reference-memorize.md) | Categorized command master list + Tier 1/2/3 memorization guide |
| [17-learning-plan-labs.md](17-learning-plan-labs.md) | 30-day learning plan + 10 hands-on EC2 labs |
| [18-survival-sheet.md](18-survival-sheet.md) | **"If you remember nothing else"** — the 2-page condensed incident-response sheet |

## Suggested usage

- **Learning it for the first time:** go in file order, do the labs in [17-learning-plan-labs.md](17-learning-plan-labs.md) as you go.
- **During an incident:** jump straight to [18-survival-sheet.md](18-survival-sheet.md), then [15-troubleshooting-playbooks.md](15-troubleshooting-playbooks.md) for the matching scenario.
- **Command lookup:** [16-master-reference-memorize.md](16-master-reference-memorize.md) has the categorized index.
