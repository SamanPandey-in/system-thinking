# Part 9 — Networking

## 9.1 Core concepts, briefly

- **IP address**: numeric address identifying a host on a network (private, e.g. `10.0.1.15`, inside a VPC; public/Elastic IP for internet-facing access).
- **Interface**: the OS-level network device (`eth0`, `ens5`, `lo` for loopback) an IP is bound to.
- **Routing**: rules deciding which interface/gateway traffic for a given destination goes through.
- **DNS**: translates hostnames to IPs. In AWS, this usually means the VPC's default resolver plus whatever `/etc/resolv.conf` points at.
- **Port**: a numeric endpoint (0-65535) on top of an IP identifying a specific service/socket. TCP (connection-oriented, reliable — HTTP, SSH, databases) vs UDP (connectionless, faster, no guaranteed delivery — DNS queries, some streaming/telemetry).
- **Socket**: the combination of protocol + local IP:port + remote IP:port that uniquely identifies one connection.

## `ip`
**Purpose:** The modern, all-in-one tool for interface, address, and routing info/config (replaces the deprecated `ifconfig`/`route`/`arp` trio from `net-tools`).
```bash
ip addr                  # (or `ip a`) show all interfaces and their IPs
ip route                  # (or `ip r`) show the routing table
ip link                    # interface state (up/down) without address info
ip -s link show eth0         # interface stats: packets/errors/drops
```
**Example output (`ip addr`):**
```text
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 9001
    inet 10.0.1.15/24 brd 10.0.1.255 scope global eth0
```
**Deprecated equivalents (still work on many systems, but avoid in new scripts):** `ifconfig` → `ip addr`; `route` → `ip route`; `arp` → `ip neigh`.
**Risk:** 🟢 SAFE (read); 🟡 USE WITH CARE for `ip addr add/del`, `ip route add/del` (can cut your own SSH session if misapplied)

## `ss`
**Purpose:** Show socket/connection state — the modern replacement for the deprecated `netstat`.
```bash
ss -tulpn
```
- `-t` TCP, `-u` UDP, `-l` listening sockets only, `-p` show owning process, `-n` numeric (skip slow DNS/service-name resolution).
```text
Netid State  Local Address:Port   Peer Address:Port  Process
tcp   LISTEN 0.0.0.0:22            0.0.0.0:*          users:(("sshd",pid=812,fd=3))
tcp   LISTEN 127.0.0.1:5432        0.0.0.0:*          users:(("postgres",pid=1203,fd=5))
```
**Reading this:** `0.0.0.0:22` means SSH is listening on **all** interfaces — reachable from outside (subject to Security Group); `127.0.0.1:5432` means Postgres only accepts **local** connections — the process won't be reachable at all from another host, regardless of firewall rules, until it's bound to a routable address. This distinction (`0.0.0.0` vs `127.0.0.1`) is one of the most common causes of "I opened the port but still can't connect."
```bash
ss -tan state established         # currently established TCP connections
ss -s                                 # summary statistics
```
**Risk:** 🟢 SAFE

## `ping`
**Purpose:** Basic reachability/latency test via ICMP.
```bash
ping -c 4 8.8.8.8          # -c: send exactly 4 and stop (don't leave it running unbounded)
```
**Important AWS caveat:** many EC2 Security Group configurations block ICMP by default, and some managed AWS endpoints (ALB, RDS) don't respond to ping at all even when reachable — a failed ping does **not** conclusively prove a host is unreachable in AWS. Corroborate with `nc`/`curl` on the actual port you care about before concluding connectivity is broken.
**Risk:** 🟢 SAFE

## `traceroute` / `tracepath`
**Purpose:** Show the hop-by-hop path to a destination — useful for spotting where a connection is dying or adding latency.
```bash
traceroute example.com
tracepath example.com       # tracepath needs no special privileges, traceroute may need setuid/root for ICMP mode
```
**AWS caveat:** intra-VPC traceroutes are often not very informative (AWS's SDN doesn't behave like traditional hop-by-hop routing) — more useful for diagnosing internet-egress path issues than internal VPC routing.
**Risk:** 🟢 SAFE

## `dig` / `nslookup` / `host`
**Purpose:** DNS lookups and diagnostics.
```bash
dig example.com                     # full, detailed DNS query
dig +short example.com                 # just the IP, script-friendly
dig example.com MX                       # specific record type
dig @8.8.8.8 example.com                   # query a SPECIFIC resolver (bypass local/VPC DNS to isolate the issue)
nslookup example.com                          # simpler, older tool, still widely available
host example.com                                # quick one-liner form
```
**Real-world example — is DNS resolution itself the problem, or something downstream?**
```bash
dig +short myapp.internal @169.254.169.253   # query the VPC's default resolver directly
dig +short myapp.internal @8.8.8.8            # query external DNS for comparison (won't resolve private zones, but proves general DNS path)
```
**`dig` vs `nslookup`:** `dig` gives far more detail (TTL, full response flags, authority section) and is the standard for serious troubleshooting; `nslookup` is simpler/older and technically "deprecated" for scripting use but still common as a quick check since it's preinstalled almost everywhere.
**Risk:** 🟢 SAFE

## `curl`
**Purpose:** Make HTTP(S) (and other protocol) requests from the command line — essential for testing APIs, health checks, and TLS.
```bash
curl https://example.com                      # fetch body, print to stdout
curl -I https://example.com                     # HEAD request — headers only, fast reachability+status check
curl -v https://example.com                       # verbose: show the full request/response including TLS handshake
curl -s -o /dev/null -w "%{http_code}\n" https://example.com   # just the status code, silent, script-friendly
curl -X POST -H "Content-Type: application/json" -d '{"key":"value"}' https://api.example.com/endpoint
curl -u user:pass https://api.example.com/secure     # basic auth
curl -H "Authorization: Bearer $TOKEN" https://api.example.com
curl -w "@curl-format.txt" -o /dev/null -s https://example.com    # detailed timing breakdown (DNS, connect, TLS, TTFB)
curl --resolve example.com:443:10.0.1.15 https://example.com     # force a specific IP, bypassing DNS — great for testing a specific backend
curl -o file.zip https://example.com/file.zip         # save output to a file
```
**Example output (`curl -I`):**
```text
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 1256
```
**Useful options:**
| Option | Meaning |
|---|---|
| `-I` | HEAD only (headers, no body) |
| `-v` | verbose (full request/response, TLS handshake) |
| `-s` | silent (no progress meter) |
| `-o file` | write body to file |
| `-w "format"` | custom output format, e.g. status code or timing |
| `-X METHOD` | HTTP method (POST, PUT, DELETE...) |
| `-H "header"` | add a request header |
| `-d 'data'` | request body (implies POST unless `-X` overrides) |
| `-u user:pass` | basic auth |
| `-k` | skip TLS certificate verification (🟡 for debugging only, never in production automation) |
| `--resolve` | override DNS for this one request |
| `-L` | follow redirects |
**Real-world example — TLS certificate inspection:**
```bash
curl -vI https://example.com 2>&1 | grep -A5 "Server certificate"
```
**Risk:** 🟢 SAFE (read-only requests); 🟡 USE WITH CARE for POST/PUT/DELETE against real endpoints

## `wget`
**Purpose:** Download files — simpler than curl for straightforward fetch/save, with better default resume/retry behavior for large files.
```bash
wget https://example.com/file.tar.gz
wget -c https://example.com/bigfile.iso     # -c: resume a partial download
wget -q -O - https://example.com/script.sh | bash   # fetch-and-pipe (see security note below)
```
**`curl` vs `wget`:** `curl` is a general-purpose HTTP client library/tool (better for APIs, headers, auth, scripting responses); `wget` is purpose-built for recursive/resumable downloading of files. Most DevOps API/health-check work uses `curl`; bulk artifact downloads often use `wget`.
**Security note on `curl ... | bash`:** piping a remote script straight into a shell executes it with zero review — only do this against sources you fully trust (and ideally after inspecting the script first with a plain `curl` to a file).
**Risk:** 🟢 SAFE

## `nc` (netcat)
**Purpose:** The network Swiss-army knife — raw TCP/UDP connections, port scanning, simple listeners.
```bash
nc -zv hostname 443           # -z: scan/test only (no data sent), -v: verbose — THE quick "is this port open" command
nc -zv db.internal 5432 3306 6379   # test multiple ports at once
echo "test" | nc -w2 hostname 80     # send raw data with a timeout
nc -l 8080                              # listen on a port (quick throwaway test server)
```
**Example output:**
```text
Connection to db.internal 5432 port [tcp/postgresql] succeeded!
```
vs.
```text
nc: connect to db.internal port 5432 (tcp) failed: Connection timed out
```
**Interpreting the failure mode matters:** "Connection refused" means something IS reachable at that IP but nothing is listening on that port (or a local firewall rejected it explicitly); "Connection timed out" means packets aren't getting a response at all — often a Security Group/NACL/routing issue, not the application.
**Risk:** 🟢 SAFE (test mode `-z`); 🟡 USE WITH CARE (`-l` opens a listener, a firewall/security consideration)

## `telnet`
**Purpose:** Legacy remote terminal protocol — insecure and rarely used for its original purpose now (replaced by SSH), but still handy as a **manual raw TCP connection tester**, similar to `nc -zv` but interactive.
```bash
telnet hostname 80
GET / HTTP/1.1
Host: hostname
[blank line]
```
**When to use it vs `nc`:** `nc -zv` is faster for a yes/no port check; `telnet` is occasionally still used to manually speak a plaintext protocol (like raw HTTP, or SMTP) line-by-line for deep debugging. Not always preinstalled on minimal images — `nc` is the more portable modern choice.
**Risk:** 🟢 SAFE (as a test client; never use telnet itself as a remote-login protocol — unencrypted)

## `ip neigh` (modern `arp`) and routing table inspection
```bash
ip neigh              # ARP table — which MAC addresses have been resolved for which IPs recently
ip route get 8.8.8.8    # show exactly which interface/gateway would be used to reach a specific destination
```
**Risk:** 🟢 SAFE

---

## The full AWS connectivity troubleshooting workflow

**Symptom: "My EC2 instance can't connect to [database / another service / the internet]."**

Work through these layers in order — each rules out a category before you waste time on the next:

```
1. DNS — can the hostname even resolve?
   dig +short the-hostname
   → No answer / NXDOMAIN: DNS problem (wrong zone, VPC DNS settings, typo) — fix here before going further
   → Resolves to an unexpected IP: possible split-horizon DNS or stale record

2. Local routing — does this instance know how to reach that IP at all?
   ip route get <resolved-ip>
   → No route / wrong interface: VPC route table issue, or instance in the wrong subnet

3. Security Groups — does the SOURCE (this instance) have EGRESS allowed, and does the
   DESTINATION have INGRESS allowed, on the specific port?
   (Check in the AWS Console/CLI — Security Groups are stateful, but both sides' rules still apply
   for the initial connection direction)

4. NACLs — Network ACLs are STATELESS (unlike Security Groups) — verify BOTH inbound
   and outbound rules explicitly allow the port range AND the ephemeral return ports
   (typically 1024-65535) on both subnets involved

5. Local firewall on either host — is iptables/nftables/ufw/firewalld blocking it locally,
   independent of AWS's network layer?
   sudo iptables -L -n   /   sudo ufw status   /   sudo firewall-cmd --list-all

6. Is the destination service actually LISTENING, and on the right interface?
   ss -tulpn | grep <port>          (run ON the destination host)
   → Listening on 127.0.0.1 only: not reachable remotely at all, regardless of firewall — fix the app's bind address

7. Raw TCP test — isolate network-layer reachability from the application itself:
   nc -zv <destination-ip-or-host> <port>
   → "Connection refused": reached the host, nothing listening (or explicit local reject) — app/bind config issue
   → "Connection timed out": never got a response — Security Group/NACL/routing issue, back to steps 3-5

8. Application-layer test — now confirm the actual protocol works, not just the raw port:
   curl -v https://destination:port/health
   → Connects but errors: application-level issue (auth, TLS cert mismatch, app bug), not network
```

This layered order (DNS → routing → SG → NACL → local firewall → listening state → raw TCP → application) is the systematic version of "is it DNS? it's always DNS" — and in practice, working top-to-bottom through this list resolves the overwhelming majority of AWS connectivity incidents without guesswork.
