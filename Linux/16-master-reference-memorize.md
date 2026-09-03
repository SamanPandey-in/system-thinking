# Part 31 — Essential Command Master List

## Navigation
| Command | Description |
|---|---|
| `pwd` | Print current directory |
| `cd` | Change directory |
| `ls` | List directory contents |
| `tree` | Visual directory tree |
| `clear` | Clear terminal |

## Files
| Command | Description |
|---|---|
| `touch` | Create empty file / update timestamp |
| `mkdir` | Create directory |
| `cp` | Copy files/directories |
| `mv` | Move/rename files |
| `rm` | Delete files/directories |
| `rmdir` | Remove empty directory |
| `ln` | Create hard/symbolic links |
| `file` | Identify file type |
| `stat` | Show detailed file metadata |
| `basename` / `dirname` | Split path into filename / directory |

## Search
| Command | Description |
|---|---|
| `find` | Search filesystem live, by name/type/size/age |
| `locate` | Fast indexed filename search |
| `grep` | Search text by pattern |
| `which` / `whereis` / `type` | Locate a command / show what runs |
| `apropos` | Search man pages by keyword |

## Text processing
| Command | Description |
|---|---|
| `cat` | Print/concatenate file contents |
| `less` | Page through a file interactively |
| `head` / `tail` | First/last N lines; `tail -f` follows live |
| `wc` | Count lines/words/bytes |
| `sort` | Sort lines |
| `uniq` | Collapse/count adjacent duplicate lines |
| `cut` | Extract columns |
| `tr` | Translate/delete characters |
| `paste` / `join` | Merge files side by side / relationally |
| `diff` / `comm` | Compare files |
| `tee` | Write to file and stdout simultaneously |
| `xargs` | Build commands from stdin input |
| `sed` | Stream editor — find/replace, line ops |
| `awk` | Field-aware text processing language |

## Permissions
| Command | Description |
|---|---|
| `chmod` | Change permissions |
| `chown` | Change owner (and group) |
| `chgrp` | Change group |
| `umask` | Default permission mask for new files |
| `id` | Show UID/GID/groups |

## Users
| Command | Description |
|---|---|
| `whoami` | Current username |
| `passwd` | Change password |
| `su` | Switch user |
| `sudo` | Run a command as another user (root by default) |
| `useradd` / `adduser` | Create user |
| `usermod` | Modify user |
| `userdel` | Delete user |
| `groupadd` / `groupmod` / `groupdel` | Manage groups |
| `getent` | Query user/group/host databases |

## Processes
| Command | Description |
|---|---|
| `ps` | Snapshot of running processes |
| `top` / `htop` | Live process monitor |
| `pgrep` / `pkill` | Find/kill processes by name pattern |
| `kill` / `killall` | Send a signal to PID(s) |
| `jobs` / `bg` / `fg` | Manage jobs in current shell |
| `nohup` | Run immune to SIGHUP (survives logout) |
| `disown` | Detach a backgrounded job from the shell |
| `nice` / `renice` | Set/change CPU scheduling priority |

## Services
| Command | Description |
|---|---|
| `systemctl` | Control/inspect systemd units |
| `journalctl` | Query the systemd journal |
| `systemd-analyze` | Boot performance analysis |
| `loginctl` | Manage logged-in sessions |

## Networking
| Command | Description |
|---|---|
| `ip` | Interfaces, addresses, routing (modern) |
| `ss` | Socket/connection state (modern netstat) |
| `ping` | ICMP reachability test |
| `traceroute` / `tracepath` | Hop-by-hop path |
| `dig` / `nslookup` / `host` | DNS lookups |
| `curl` | HTTP(S) client |
| `wget` | File downloader |
| `nc` | Raw TCP/UDP connections, port testing |
| `telnet` | Manual raw protocol testing (legacy) |

## SSH
| Command | Description |
|---|---|
| `ssh` | Remote shell connection |
| `ssh-keygen` | Generate SSH keypairs |
| `ssh-agent` / `ssh-add` | Hold decrypted keys in memory for the session |
| `scp` | Copy files over SSH |
| `sftp` | Interactive file transfer over SSH |

## Storage
| Command | Description |
|---|---|
| `df` | Disk usage by filesystem |
| `du` | Disk usage by directory/file |
| `lsblk` | List block devices |
| `blkid` | Show filesystem type/UUID |
| `mount` / `umount` | Attach/detach a filesystem |
| `findmnt` | Query current mounts |
| `fdisk` / `parted` | Partition block devices |
| `mkfs` | Format a filesystem |
| `fsck` | Check/repair filesystem |
| `lsof` | List open files/sockets |

## Monitoring
| Command | Description |
|---|---|
| `uptime` | Load average and uptime |
| `free` | Memory/swap usage |
| `vmstat` | CPU/memory/IO snapshot over time |
| `iostat` | Per-device disk I/O stats |
| `sar` | Historical system activity |
| `mpstat` | Per-core CPU breakdown |
| `watch` | Repeat a command live |
| `time` | Measure command execution time |

## Logs
| Command | Description |
|---|---|
| `journalctl` | systemd journal (see Services) |
| `zgrep` | grep inside gzip-compressed files |
| `logrotate` | Automated log rotation/retention |

## Packages
| Command | Description |
|---|---|
| `apt` / `apt-cache` / `dpkg` | Debian/Ubuntu package management |
| `dnf` / `yum` / `rpm` | RHEL-family/Amazon Linux package management |

## Archives
| Command | Description |
|---|---|
| `tar` | Bundle files into an archive |
| `gzip` / `gunzip` | Compress/decompress single files |
| `zip` / `unzip` | Cross-platform archive format |
| `xz` / `bzip2` | Alternative compression algorithms |

## Scheduling
| Command | Description |
|---|---|
| `crontab` | Manage recurring scheduled jobs |
| `at` | Schedule a one-time future command |
| systemd timers (`.timer` units) | Modern cron alternative |

## Bash
| Command | Description |
|---|---|
| `export` / `env` / `printenv` | Environment variable management |
| `set` / `unset` | Shell option and variable management |
| `read` | Read input into a variable |
| `getopts` | Parse command-line flags in a script |

## Editors
| Command | Description |
|---|---|
| `vim` / `nvim` | Modal text editor |
| `nano` | Simple non-modal text editor |

## tmux
| Command | Description |
|---|---|
| `tmux new -s NAME` | Start a named session |
| `tmux attach -t NAME` | Reattach to a session |
| `tmux ls` | List sessions |

## AWS-related Linux workflows
| Command/Path | Description |
|---|---|
| `curl http://169.254.169.254/latest/meta-data/...` | EC2 Instance Metadata Service |
| `ssh -i key.pem ubuntu@host` / `ec2-user@host` | Connect per AMI's default user |
| `lsblk`, `mkfs`, `mount`, `/etc/fstab` | Attaching/mounting an EBS volume |
| EC2 Instance Connect / Session Manager | SSH-less access fallback |

---

# Part 32 — What You Actually Need to Memorize

## Tier 1 — MUST MEMORIZE

These get used multiple times *daily*, under time pressure, often mid-incident. You should be able to type these without thinking or looking anything up.

`ls -lah` · `cd` · `pwd` · `cat` · `less` · `tail -f` · `grep` (with `-i -r -n -c -v`) · `cp` / `mv` / `rm` (and their basic flags) · `chmod` / `chown` (numeric + symbolic) · `ps aux` · `top` / `htop` · `kill` / `kill -9` · `df -h` / `du -sh` · `ssh` (basic + `-i`) · `scp` · `systemctl status/start/stop/restart/enable` · `journalctl -u <service> -f` · `curl -I` / `curl -s -o /dev/null -w "%{http_code}"` · `ss -tulpn` · `sudo` · `tar -czf` / `tar -xzf` · basic Vim: `i`, `Esc`, `:wq`, `:q!`, `/search` · `tmux new -s` / `Prefix d` / `tmux attach`

**Why these belong here:** they're either the first command you reach for in almost every troubleshooting scenario in this handbook, or they're what stands between you and losing work (Vim basics, tmux) or losing a system (careful `chmod`/`chown`/`rm`/`kill -9` usage).

## Tier 2 — SHOULD KNOW

You should recognize these instantly, know roughly what they do and when to reach for them, but it's fine to check `--help`/`man` for the exact flag you need in the moment.

`find` (conditions like `-mtime`, `-size`, `-exec`) · `awk`/`sed` for anything beyond a one-liner you've memorized · `xargs` · `sort` / `uniq -c` · `cut` · `nc -zv` · `dig` / `nslookup` · `ip addr` / `ip route` · `mount` / `umount` / `/etc/fstab` syntax · `crontab -e` syntax · `useradd`/`usermod -aG` · `sudoers`/`visudo` concepts · `lsof` · `strace` (basic use) · `sar`/`vmstat`/`iostat` output interpretation · `logrotate` config structure · package manager basics (`apt`/`dnf` install/remove/update) · systemd unit file structure (writing a basic custom service) · `tar` flag combinations beyond the basic `-czf`/`-xzf` · SSH config (`~/.ssh/config`, `ProxyJump`) · `nice`/`renice`

**Why these belong here:** used regularly but not constantly enough to keep exact syntax loaded in working memory — the *concept* and *when to reach for it* matter more than perfect recall of every flag.

## Tier 3 — KNOW THAT IT EXISTS

You don't need the syntax at all — just enough awareness to know "there's a tool for this" so you go look it up instead of reinventing it or missing it entirely during an investigation.

`fdisk`/`parted`/`mkfs`/`fsck` (destructive storage ops — look up carefully every single time, never work from memory here) · `tune2fs` · `ip neigh` · `nsenter` · `systemd-analyze critical-chain` · `getent` · `comm` · `paste`/`join` · advanced Vim (macros, registers, marks — great to have, rarely urgent) · `at` · `ufw`/`firewalld`/`iptables`/`nftables` rule syntax · `rpm`/`dpkg` low-level flags · `zgrep` · `ncdu`/`jq`/`yq`/`fzf`/`ripgrep`/`fd` (know they exist and roughly what problem each solves; install and learn properly once you're on a workstation where it's worth the setup) · `dstat` · LazyVim-specific bindings beyond `<leader>` + `which-key` discovery

**Why these belong here:** either genuinely rare in day-to-day work, high-risk-enough that working from memory is actively a bad idea (destructive storage commands), or trivially discoverable via `--help`/`man` in the moment without any real cost to looking them up.

## The actual meta-skill

Notice what Tier 1 has in common: it's not "the hardest commands" or "the most powerful commands" — it's **the commands you reach for first, in the widest variety of situations, where hesitating costs you time you don't have during an incident.** Tier 3, by contrast, includes some of the most *dangerous* commands in this whole handbook (`mkfs`, `fdisk -w`-equivalent operations) precisely because those should **never** be run from memory under time pressure — looking up the exact syntax and double-checking the target device every single time is the correct, permanent habit, not a sign of inexperience.
