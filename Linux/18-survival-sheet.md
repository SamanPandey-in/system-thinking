# "If You Remember Nothing Else" — The DevOps Linux Survival Sheet

## Instant triage, any incident
```bash
uptime; free -h; df -h; ss -tulpn          # composite health snapshot, run this first, always
```

## CPU
```bash
top                                          # or: ps aux --sort=-%cpu | head
kill -TERM <pid>       # try this first
kill -9 <pid>            # last resort — no cleanup chance for the process
```

## Memory
```bash
free -h                                      # check `available`, not `free`; watch Swap `used`
dmesg | grep -i "out of memory"                # confirm OOM-killer activity
ps aux --sort=-%mem | head
```

## Disk full
```bash
df -h                                        # WHICH filesystem
du -h --max-depth=1 <mount> | sort -rh         # WHERE — repeat into the biggest subdir
sudo lsof | grep deleted                         # df/du mismatch? check for orphaned open file handles
```

## Service down
```bash
systemctl status <svc>
journalctl -u <svc> --since "10 minutes ago" -p err
sudo systemctl restart <svc>
systemctl is-active <svc>                        # verify
```

## Port unreachable — layered check, in order
```bash
dig +short <host>                    # 1. DNS
ip route get <ip>                      # 2. routing
# 3. Security Group   4. NACL   5. local firewall  <- check in AWS console / iptables
ss -tulpn | grep <port>                  # 6. is it even listening, and on which interface (0.0.0.0 vs 127.0.0.1)?
nc -zv <host> <port>                       # 7. raw TCP — "refused"=nothing listening, "timeout"=network layer
curl -v https://<host>:<port>/health         # 8. application layer
```

## SSH failure checklist
```bash
ssh -vvv user@host       # WHERE does it fail — TCP connect (network/SG) vs auth (key/username)?
```
Instance running? · Elastic/current IP? · SG allows YOUR current IP on 22? · NACL allows 22 in + ephemeral out? · Right AMI user (`ubuntu`/`ec2-user`/`admin`)? · Right `.pem`, `chmod 600`? · Locked out entirely → **EC2 Instance Connect** or **Session Manager**.

## Nginx 502
```bash
tail -50 /var/log/nginx/error.log        # exact upstream failure reason
systemctl status <upstream-app>            # is it even running?
ss -tulpn | grep <upstream-port>             # is it listening where nginx expects?
```

## Log investigation, one-liners
```bash
tail -F app.log | grep ERROR                                              # live, rotation-safe
grep "ERROR" app.log | awk '{print $1,$2}' | cut -c1-16 | sort | uniq -c | sort -rn | head   # error spike by minute
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head            # top IPs
awk '{print $9}' access.log | sort | uniq -c | sort -rn                     # status code breakdown
zgrep "ERROR" app.log.*.gz                                                    # search rotated/compressed logs
```

## The permission fix that ISN'T `chmod 777`
```bash
ls -la <path>              # who owns it, what perms does it actually have?
sudo chown -R <correct-user>:<correct-group> <path>     # fix OWNERSHIP first
chmod -R 750 <path>          # then set the NARROWEST permission that actually works
```

## Safe deletion habit
```bash
find /path -name "pattern" -mtime +30 -print     # DRY RUN — read this output
find /path -name "pattern" -mtime +30 -delete       # only THEN add -delete
```

## Safe sed edit habit
```bash
sed 's/old/new/g' file            # no -i: preview first
sed -i.bak 's/old/new/g' file       # THEN edit, with a backup
```

## Survive an SSH disconnect
```bash
tmux new -s work        # start
# Ctrl+b  d                detach
tmux attach -t work        # reattach later, from anywhere
```

## Vim, absolute minimum
```
i           insert mode
Esc         back to normal mode
:wq         save and quit
:q!         quit WITHOUT saving
/pattern    search
dd / yy / p   delete-line / copy-line / paste
```

## Firewall/SSH config changes — never lock yourself out
1. Keep your CURRENT session open.
2. Test syntax first (`sshd -t`, `nginx -t`, `ufw`/`firewalld` dry checks where available).
3. `reload`, not `restart`, when the option exists.
4. Verify with a BRAND NEW connection before closing the original.

## Command risk, one glance
| 🟢 SAFE | 🟡 CARE | 🔴 DESTRUCTIVE |
|---|---|---|
| `ls`, `cat`, `grep`, `ps`, `df`, `top`, `dig`, `curl` (GET) | `chmod`/`chown` (non-recursive), `mv`/`cp` onto existing files, `kill` (SIGTERM), `sed -i` with backup, firewall/`sshd_config` changes | `rm -rf`, `dd`, `mkfs`, `fdisk`/`parted` writes, `chmod/chown -R` on wrong path, `kill -9` reflexively, `find -delete` without a dry run first, `docker system prune -a` |

## The one meta-rule
**Before anything recursive, destructive, or built from a variable: run the read-only / dry-run version first, and actually read the output.** `ls` before `rm -r`. `find -print` before `-delete`. `sed` without `-i` before `-i`. `fdisk -l` before writing. This single habit prevents the majority of real production incidents caused by tooling, not by the underlying problem being investigated.
