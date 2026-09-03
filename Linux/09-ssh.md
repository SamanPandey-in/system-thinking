# Part 10 — SSH

SSH is the backbone of DevOps work — nearly everything else in this handbook assumes you got onto the box via SSH first. Worth mastering deeply.

## 10.1 The basics

```bash
ssh user@server                          # connect using default key(s) in ~/.ssh
ssh -i mykey.pem ubuntu@ec2-host          # -i: specify a private key explicitly
ssh -p 2222 user@server                    # non-default port
ssh -v user@server                           # verbose — first thing to add when troubleshooting a failed connection
```
**Risk:** 🟢 SAFE

## 10.2 Public/private key authentication

- **Private key**: stays on your machine, never shared, proves your identity. Must be `600` permissions (Part 4).
- **Public key**: distributed to servers, placed in `~/.ssh/authorized_keys` for the account you're logging into. Safe to share.
- Authentication works by the server issuing a challenge only your private key can correctly answer — the private key itself is never transmitted.

## `ssh-keygen`
**Purpose:** Generate a new SSH keypair.
```bash
ssh-keygen -t ed25519 -C "you@company.com"          # modern default: ed25519 — smaller, faster, equally secure
ssh-keygen -t rsa -b 4096 -C "you@company.com"        # rsa 4096-bit — still common, needed for some legacy systems
```
**When to use ed25519 vs RSA:** prefer `ed25519` for anything new — smaller keys, faster operations, no known weaknesses. Fall back to `rsa -b 4096` only if a specific legacy target system doesn't support ed25519 (rare with anything recent).
**Risk:** 🟢 SAFE (generates locally, doesn't touch any remote system)

## `ssh-agent` / `ssh-add`
**Purpose:** Hold your decrypted private key in memory for the session, so you're not re-entering your key's passphrase on every single connection — especially important when chaining through a bastion/jump host.
```bash
eval "$(ssh-agent -s)"        # start the agent for this shell session
ssh-add ~/.ssh/id_ed25519       # add your key (prompts for passphrase once)
ssh-add -l                        # list keys currently loaded in the agent
ssh-add -D                          # remove all keys from the agent
```
**Agent forwarding** (use with real caution — see security note below):
```bash
ssh -A user@bastion            # forward your LOCAL agent to the bastion, so from there you can jump onward
                                   # WITHOUT copying your private key to the bastion
```
**Security note on `-A`:** agent forwarding means anyone with root on the bastion host, while you're connected, can potentially request signing operations through your forwarded agent (though not extract your actual private key). Only forward your agent to hosts you trust; prefer `ProxyJump` (below) which achieves multi-hop access without this exposure.
**Risk:** 🟢 SAFE (local agent); 🟡 USE WITH CARE (`-A` forwarding)

## `scp`
**Purpose:** Copy files over SSH.
```bash
scp file.txt user@server:/remote/path/            # local → remote
scp user@server:/remote/file.txt ./                 # remote → local
scp -r localdir/ user@server:/remote/path/            # -r: recursive, for directories
scp -i key.pem file.txt ubuntu@ec2-host:/home/ubuntu/   # with a specific key
scp -P 2222 file.txt user@server:/path                  # -P (capital): non-default port — note capital P, unlike ssh's lowercase -p
```
**Risk:** 🟡 USE WITH CARE (can overwrite remote files)

## `sftp`
**Purpose:** Interactive file transfer session over SSH — useful when you need to browse remote directories before deciding what to transfer, rather than knowing the exact path upfront.
```bash
sftp user@server
sftp> ls
sftp> get remote_file.txt
sftp> put local_file.txt
sftp> cd /var/log
sftp> mget *.log
sftp> exit
```
**`scp` vs `sftp`:** `scp` is a single non-interactive command, best for scripts/automation; `sftp` is an interactive session, best for humans exploring an unfamiliar remote filesystem. Note: `scp`'s underlying protocol is considered legacy by OpenSSH upstream — for scripted transfers going forward, `scp -O` (explicitly use legacy protocol) or `rsync -e ssh` are the more future-proof choices, though plain `scp` still works fine on virtually every current system.
**Risk:** 🟡 USE WITH CARE

## 10.3 SSH client config — `~/.ssh/config`

The single highest-leverage SSH productivity feature — define connection shortcuts and per-host behavior once:
```text
Host prod-web
    HostName 54.12.34.56
    User ubuntu
    IdentityFile ~/.ssh/prod-key.pem
    Port 22

Host prod-db
    HostName 10.0.2.15
    User ec2-user
    IdentityFile ~/.ssh/prod-key.pem
    ProxyJump prod-web

Host *.internal
    User deploy
    IdentityFile ~/.ssh/internal-key.pem
    StrictHostKeyChecking accept-new
```
After this, `ssh prod-web` or `ssh prod-db` (which auto-jumps through `prod-web`) just works — no need to remember IPs, keys, or ports each time.
**Risk:** 🟢 SAFE

## 10.4 Port forwarding

**Local forwarding** (`-L`) — access a REMOTE service as if it were local (most common: reach a database that's only accessible from inside a VPC/bastion):
```bash
ssh -L 5432:db.internal:5432 user@bastion
# now connect to localhost:5432 on YOUR machine — traffic tunnels through the bastion to db.internal:5432
```

**Remote forwarding** (`-R`) — expose something on YOUR machine to the remote side (less common, useful for e.g. giving a remote server temporary access to a local dev server):
```bash
ssh -R 8080:localhost:3000 user@remote-server
# now localhost:8080 ON THE REMOTE SERVER reaches YOUR local port 3000
```

**Dynamic forwarding** (`-D`) — turns your SSH connection into a SOCKS proxy, routing arbitrary traffic through the remote host:
```bash
ssh -D 1080 user@bastion
# configure a browser/tool to use localhost:1080 as a SOCKS5 proxy
```

## 10.5 Jump hosts / bastion hosts / ProxyJump

A **bastion host** is a hardened, internet-reachable server whose sole purpose is to be the single entry point into a private network — internal servers have no direct internet-facing SSH access at all, only reachable *through* the bastion. This is the standard AWS pattern for accessing instances in private subnets.

```bash
ssh -J user@bastion user@internal-host       # -J: ProxyJump, one-line multi-hop
```
Or configured permanently (preferred) via `~/.ssh/config` as shown above (`ProxyJump prod-web`), so `ssh prod-db` transparently routes through the bastion without you thinking about it each time.

**Older equivalent (before ProxyJump existed, still seen in older configs):**
```text
Host internal-host
    ProxyCommand ssh -W %h:%p user@bastion
```
`ProxyJump` is simpler and preferred in any current OpenSSH (7.3+, which is effectively all systems in production today).

## 10.6 Host key verification and known_hosts

The first time you connect to a new host, SSH shows the host's fingerprint and asks you to confirm it — this protects against man-in-the-middle attacks by ensuring the server is who it claims to be, on every subsequent connection.

```text
The authenticity of host 'server (1.2.3.4)' can't be established.
ED25519 key fingerprint is SHA256:abc123...
Are you sure you want to continue connecting (yes/no/[fingerprint])?
```

Accepted fingerprints are stored in `~/.ssh/known_hosts`. If a host's key **changes** unexpectedly, SSH refuses to connect with a loud warning — this is a legitimate security feature, but also happens innocuously whenever an EC2 instance is terminated and a new one is launched reusing the same IP (very common with auto-scaling/ephemeral instances).

```text
WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED!
```

**Fix (only after confirming it's actually an expected change, e.g. an instance replacement, not an actual MITM):**
```bash
ssh-keygen -R 1.2.3.4                    # remove the stale entry for that host
# or, for automation against frequently-recycled ephemeral hosts:
ssh -o StrictHostKeyChecking=accept-new user@host    # accepts NEW unknown hosts automatically, but still
                                                        # warns/fails loudly on a CHANGED key — safer than
                                                        # disabling checking entirely
```
**Never blindly use `StrictHostKeyChecking=no` in anything long-lived** — it silently accepts *any* host key, including a genuinely spoofed one, defeating the entire protection. `accept-new` is the safe middle ground for automation against dynamic infrastructure.
**Risk:** 🟡 USE WITH CARE regarding `StrictHostKeyChecking` settings

---

## AWS EC2 SSH troubleshooting checklist

When `ssh ubuntu@ec2-host` fails or hangs, work through in order:

```
1. Is the instance actually running?
   (Check AWS Console/CLI — obvious but the most common real cause)

2. Correct public IP/DNS? Elastic IPs are stable; default public IPs CHANGE on stop/start.

3. Security Group: does it allow inbound TCP 22 from YOUR current IP?
   (Your IP may have changed since the rule was created — especially on home/mobile networks)

4. Network ACL: does the subnet's NACL allow inbound 22 AND outbound ephemeral ports (1024-65535)?

5. Correct username for the AMI? ubuntu (Ubuntu), ec2-user (Amazon Linux/RHEL), admin (Debian), centos (CentOS)

6. Correct key? Match the .pem file to the keypair actually assigned to THIS instance at launch.
   ssh-keygen -y -f mykey.pem   → compare the derived public key against what you expect

7. Key permissions locally too loose?
   chmod 600 mykey.pem   (SSH refuses "unprotected private key" otherwise)

8. Connecting FROM the right network? (VPN/bastion required for private-subnet instances)

9. Is sshd actually running/healthy on the instance?
   (Check via EC2 Instance Connect, Session Manager, or the AWS Console's serial/system log if SSH itself is unreachable)

10. Verbose mode to see exactly where it's failing:
    ssh -vvv ubuntu@ec2-host
    → hangs at "TCP" level: Security Group/NACL/routing (steps 3-4)
    → gets further but auth fails: key/username issue (steps 5-7)
```

**When SSH is completely broken and you're locked out:** use **EC2 Instance Connect** or **AWS Systems Manager Session Manager** (no SSH/inbound port needed at all, works through the AWS API) to regain access, inspect `/var/log/auth.log` or `/var/log/secure`, and fix the underlying `sshd_config`/key issue from inside.
