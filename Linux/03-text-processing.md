# Part 3 — Reading and Manipulating Files (Text Processing)

This is the single most-used skill category in DevOps work: logs are text, configs are text, command output is text. Master this part and most "how do I find/count/extract X" problems become one-liners.

## Quick-reference viewers

## `cat`
**Purpose:** Print whole file contents to stdout; also concatenate multiple files.
```bash
cat app.conf
cat part1.log part2.log > combined.log
cat -n script.sh          # number lines
```
**Common mistake:** using `cat` on huge files (multi-GB logs) — it dumps everything at once, flooding your terminal. Use `less` or `tail` instead for anything you're going to read interactively.
**Risk:** 🟢 SAFE

## `less` (and `more`)
**Purpose:** Page through a file interactively without loading it all into memory — the correct tool for browsing large logs.
```bash
less /var/log/syslog
```
**Inside `less`:** `Space`/`f` page down, `b` page up, `/pattern` search forward, `?pattern` search backward, `n`/`N` next/prev match, `g`/`G` top/bottom, `q` quit. `less +F` behaves like `tail -f` (follow mode) — press `Ctrl+C` then `q` to exit follow mode.
**`more` vs `less`:** `more` is older and more limited (can't scroll backward on all systems); `less` is the modern standard ("less is more"). Always prefer `less` when both are available.
**Risk:** 🟢 SAFE

## `head` / `tail`
**Purpose:** Show the first/last N lines of a file.
```bash
head -50 app.log
tail -50 app.log
tail -f app.log             # follow: stream new lines as they're written — THE live-log-watching command
tail -f app.log | grep ERROR   # follow + filter in real time
tail -n +100 app.log         # everything FROM line 100 onward
tail -F app.log              # like -f but also survives log rotation (reopens by name) — prefer this in production
```
**`-f` vs `-F`:** `-f` follows the file descriptor; if logrotate renames/replaces the file, `-f` keeps watching the old (now-orphaned) file and shows nothing new. `-F` re-checks by filename and reattaches. Always use `-F` when tailing production logs that rotate.
**Risk:** 🟢 SAFE

## `wc`
**Purpose:** Count lines, words, bytes.
```bash
wc -l access.log           # line count — most common use, e.g. count of log entries
grep -c "500" access.log   # (grep's own -c is often better than wc -l | grep for counting matches)
```
**Risk:** 🟢 SAFE

## Sorting, deduplicating, columns

## `sort`
**Purpose:** Sort lines of text.
```bash
sort names.txt
sort -n numbers.txt          # numeric sort (default is lexical: "10" < "9")
sort -r file.txt              # reverse
sort -h sizes.txt              # human-numeric sort: understands "1K", "2M", "1G" — pairs with du -h
sort -k2 -t, data.csv          # sort by 2nd field, comma-delimited
sort -u file.txt                # sort + dedupe in one step
```
**Common mistake:** plain `sort` on numbers gives lexical order (`10` sorts before `2`) — always add `-n` (or `-h` for human-readable sizes) when sorting numeric data.
**Risk:** 🟢 SAFE

## `uniq`
**Purpose:** Collapse adjacent duplicate lines — **must be sorted first**, `uniq` only looks at neighbors.
```bash
sort access.log | uniq                 # dedupe
sort access.log | uniq -c               # count occurrences of each unique line
sort access.log | uniq -c | sort -rn    # THE classic "top N occurrences" pipeline
sort access.log | uniq -d                # only show lines that appeared more than once
```
**Real-world example — top 10 IPs hitting the server:**
```bash
awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -10
```
**Risk:** 🟢 SAFE

## `cut`
**Purpose:** Extract columns by delimiter or fixed character position — simpler and faster than `awk` when you just need column extraction.
```bash
cut -d, -f1,3 data.csv          # comma-delimited, fields 1 and 3
cut -d: -f1 /etc/passwd          # colon-delimited, usernames only
cut -c1-10 file.txt               # fixed character range, regardless of delimiter
```
**Risk:** 🟢 SAFE

## `tr`
**Purpose:** Translate or delete characters (operates on a stream character-by-character, not line-by-line or field-by-field).
```bash
echo "Hello World" | tr 'a-z' 'A-Z'      # uppercase
tr -d '\r' < windows.txt > unix.txt       # strip Windows carriage returns (CRLF -> LF)
tr -s ' ' < messy.txt                       # squeeze repeated spaces into one
cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 20   # quick random string
```
**Risk:** 🟢 SAFE

## `paste` / `join`
**Purpose:** Combine files side-by-side (`paste`) or relationally by a common key (`join`, like a SQL join on sorted text files).
```bash
paste file1.txt file2.txt              # merge line-by-line, tab separated
join -t, -1 1 -2 1 sorted1.csv sorted2.csv   # join on field 1 of both, both must be pre-sorted
```
**When to use `join` vs writing a script:** quick relational lookups on small sorted CSVs directly from the shell, e.g. matching a list of hostnames against an inventory file, without spinning up Python.
**Risk:** 🟢 SAFE

## `diff` / `comm`
**Purpose:** Compare two files.
```bash
diff old.conf new.conf                  # line-by-line differences
diff -u old.conf new.conf                # unified format (like a git diff) — more readable
comm -3 <(sort list1.txt) <(sort list2.txt)   # lines unique to either file (needs pre-sorted input)
```
**Real-world example:** comparing a config before/after a deploy, or diffing two servers' installed package lists to find drift:
```bash
diff <(ssh host1 dpkg -l) <(ssh host2 dpkg -l)
```
**Risk:** 🟢 SAFE

## `tee`
**Purpose:** Write stdout to a file **and** pass it through to the next command/terminal simultaneously — lets you log and view at once.
```bash
long_deploy_script.sh | tee deploy.log
echo "new setting" | sudo tee -a /etc/app.conf     # -a: append; also solves the classic sudo+redirect problem below
```
**The sudo+redirect gotcha:** `sudo echo "x" > /etc/protected_file` FAILS with permission denied — the redirection `>` is done by your unprivileged shell, not by `sudo echo`. `sudo tee` fixes this because `tee` itself (which does the writing) runs as root.
**Risk:** 🟢 SAFE

## `xargs`
**Purpose:** Build and execute commands from stdin — turns a list of items into arguments for another command, essential because many commands don't read from stdin themselves (e.g. `rm`, `chmod`).
```bash
find /tmp -name "*.tmp" | xargs rm                 # delete every match
find . -name "*.log" | xargs gzip                    # gzip every match
echo "file1 file2 file3" | xargs -n1 echo            # -n1: one argument per invocation
cat hosts.txt | xargs -I{} ssh {} "uptime"            # -I{}: placeholder substitution
find . -name "*.log" -print0 | xargs -0 rm            # -print0/-0: NUL-delimited, handles filenames with spaces safely
```
**Common mistake:** piping `find` results with spaces in filenames into plain `xargs` — spaces get treated as argument separators and break things. Always pair `find -print0` with `xargs -0` when filenames might contain spaces/special characters.
**`xargs -P`:** run commands in parallel — `cat urls.txt | xargs -P8 -n1 curl -O` fetches 8 URLs concurrently.
**Risk:** 🟡 USE WITH CARE — it executes commands per input line; a bad pattern match becomes a bad command run many times.

---

## Deep dive: `grep`

## `grep`
**Purpose:** Search text for lines matching a pattern — the single most-used command during incident response.
**Syntax:** `grep [options] "pattern" file(s)`
```bash
grep "ERROR" app.log                       # basic search
grep -i "error" app.log                     # -i: case-insensitive
grep -v "DEBUG" app.log                      # -v: invert match (show non-matching lines)
grep -c "ERROR" app.log                       # -c: count matches instead of printing them
grep -n "ERROR" app.log                        # -n: show line numbers
grep -r "TODO" /opt/app/src                     # -r: recursive through a directory
grep -l "ERROR" /var/log/*.log                   # -l: only list filenames that contain a match
grep -A3 -B1 "Exception" app.log                  # -A/-B: N lines of context After/Before each match
grep -E "error|warning|fatal" app.log               # -E (or egrep): extended regex, allows | alternation
grep -w "cat" file.txt                                # -w: match whole word only (not "category")
```
**Example output (with `-n`):**
```text
1042:2026-08-19 09:14:02 [ERROR] Database connection timeout
1198:2026-08-19 09:14:55 [ERROR] Retry limit exceeded
```
**Useful options:**
| Option | Meaning |
|---|---|
| `-i` | case-insensitive |
| `-v` | invert (non-matching lines) |
| `-c` | count of matching lines |
| `-n` | line numbers |
| `-r` / `-R` | recursive (`-R` follows symlinks too) |
| `-l` / `-L` | filenames with / without a match |
| `-A n` / `-B n` / `-C n` | context lines After / Before / Both |
| `-E` | extended regex (or use `egrep`, now considered legacy — prefer `grep -E`) |
| `-o` | print only the matched portion, not the whole line |
| `-w` | whole word match |
| `--include="*.log"` | limit recursive search to matching filenames |
**`egrep`/`fgrep` note:** these are legacy aliases for `grep -E` and `grep -F`. They still work on most systems but are deprecated — use `grep -E` and `grep -F` explicitly in scripts you expect to be portable.
**Real-world example — finding all HTTP 500s in an access log:**
```bash
grep " 500 " access.log | tail -20
```
**Real-world example — extracting just the IP addresses that produced errors:**
```bash
grep "ERROR" app.log | grep -oE "([0-9]{1,3}\.){3}[0-9]{1,3}"
```
**Common mistake:** forgetting to quote the pattern, so the shell tries to glob-expand special characters in it. Always quote: `grep "pattern"`, not `grep pattern`.
**Risk:** 🟢 SAFE (read-only)

### Regular expressions — the essentials you actually need

| Pattern | Meaning | Example |
|---|---|---|
| `.` | any single character | `a.c` matches `abc`, `axc` |
| `*` | zero or more of the previous atom | `ab*` matches `a`, `ab`, `abbb` |
| `+` (needs `-E`) | one or more | `ab+` matches `ab`, `abbb`, not `a` |
| `?` (needs `-E`) | zero or one | `colou?r` matches `color`, `colour` |
| `^` | start of line | `^ERROR` |
| `$` | end of line | `\.log$` |
| `[...]` | character class | `[0-9]`, `[a-zA-Z]` |
| `[^...]` | negated class | `[^0-9]` (not a digit) |
| `\|` (needs `-E`) | alternation | `error\|warn` |
| `{n,m}` (needs `-E`) | repetition count | `[0-9]{3}` exactly 3 digits |
| `\d` | **not supported in basic/extended grep** — use `[0-9]` or switch to `grep -P` (PCRE) if available | |
**Practical tip:** unless you specifically need PCRE features, `grep -E` covers 95% of real-world log-matching needs and is available everywhere. Basic regex (no `-E`) requires escaping `\+`, `\?`, `\|`, `\{` — annoying; just use `-E`.

---

## Deep dive: `sed` — stream editor

## `sed`
**Purpose:** Non-interactive, line-by-line text transformation — the standard tool for scripted find-and-replace in config files, log processing pipelines, and deployment scripts.
**Syntax:** `sed [options] 'script' file`
```bash
sed 's/foo/bar/' file.txt                # replace FIRST occurrence per line
sed 's/foo/bar/g' file.txt                 # replace ALL occurrences per line (g = global)
sed -i 's/foo/bar/g' file.txt               # -i: edit the file IN PLACE (no output, overwrites!)
sed -i.bak 's/foo/bar/g' file.txt            # -i.bak: in-place but keep a .bak backup first — much safer
sed -n '10,20p' file.txt                      # print only lines 10-20 (-n suppresses default auto-print)
sed '/^#/d' config.conf                        # delete comment lines
sed -n '/START/,/END/p' file.txt                 # print everything between two markers
sed 's/PORT=.*/PORT=8080/' app.env                # replace a whole config line
```
**Example — updating a version string across a config during deploy:**
```bash
sed -i "s/^APP_VERSION=.*/APP_VERSION=2.4.1/" /opt/app/.env
```
**Useful options:**
| Option | Meaning |
|---|---|
| `-i` | edit file in place (🔴 no output otherwise, and no undo — always test without `-i` first, or use `-i.bak`) |
| `-n` | suppress automatic printing (used with explicit `p`) |
| `-e` | allows multiple `-e 'script'` expressions chained |
| `-E` | extended regex support inside sed scripts |
**Common mistake:** running `sed -i` directly against a config on a live production box without a backup or dry-run — a bad regex can silently corrupt every line. Always test the transformation without `-i` first (prints to stdout, file untouched), review the output, *then* add `-i` or `-i.bak`.
**Risk:** 🟡 USE WITH CARE (🔴 DESTRUCTIVE with `-i` and no backup)

---

## Deep dive: `awk` — pattern-action text processing

## `awk`
**Purpose:** Field-aware text processing language — think "`cut` + `grep` + basic arithmetic + formatting," all in one. The go-to tool for parsing structured logs (access logs, CSVs, `ps`/`df` output) column by column.
**Syntax:** `awk 'pattern { action }' file` — `awk` splits each line into fields (`$1`, `$2`, ... `$0` = whole line) on whitespace by default.
```bash
awk '{print $1}' access.log                  # print first field (often the client IP in access logs)
awk '{print $1, $7}' access.log                 # print two fields
awk -F, '{print $2}' data.csv                     # -F: custom field separator (comma here)
awk '$9 == 500 {print $0}' access.log               # print full lines where field 9 (status code) equals 500
awk '{sum += $10} END {print sum}' access.log        # sum a numeric column (e.g. bytes transferred)
awk '{count[$1]++} END {for (ip in count) print count[ip], ip}' access.log | sort -rn | head
```
**Example — parse a standard Nginx/Apache combined log for status codes and count them:**
```bash
awk '{print $9}' access.log | sort | uniq -c | sort -rn
```
```text
   8421 200
    342 404
     89 500
     12 502
```
**Example — average response time from a log with response time as the last field:**
```bash
awk '{sum+=$NF; n++} END {print "avg:", sum/n, "ms"}' app.log
```
**Key `awk` concepts:**
| Concept | Meaning |
|---|---|
| `$0` | the whole line |
| `$1`, `$2`... | individual fields |
| `NF` | number of fields on current line |
| `NR` | current line/record number |
| `$NF` | the *last* field (handy when column count varies) |
| `-F` | set the field separator (default: whitespace) |
| `BEGIN { }` | runs once before processing starts |
| `END { }` | runs once after all lines processed (used for totals/summaries) |
| associative arrays | `arr[$1]++` — awk's dictionaries, used for counting/grouping |
**Real-world example — top 5 slowest requests from a log with response time in field 10:**
```bash
awk '{print $10, $7}' access.log | sort -rn | head -5
```
**Risk:** 🟢 SAFE (read-only unless you explicitly redirect output over a file)

---

## Combining it all — the real DevOps skill

The actual craft isn't knowing any single tool; it's **chaining them**. Progressive example, building up a real incident-response query:

```bash
# 1. Just look at the file
tail -f app.log

# 2. Filter to errors only, live
tail -f app.log | grep ERROR

# 3. Search recent history for a specific error pattern
grep "timeout" app.log

# 4. Count how many times it happened
grep -c "timeout" app.log

# 5. Extract just the timestamps of those events
grep "timeout" app.log | awk '{print $1, $2}'

# 6. Find which minute had the most timeouts (bucket by minute)
grep "timeout" app.log | awk '{print $1, $2}' | cut -c1-16 | sort | uniq -c | sort -rn | head

# 7. Cross-reference: find the top offending client IPs during the worst minute
grep "2026-08-19 09:14" app.log | grep "timeout" | awk -F'client=' '{print $2}' | awk '{print $1}' | sort | uniq -c | sort -rn | head
```

This progression — tail → grep → count → extract fields → bucket by time → cross-reference — is the actual day-to-day muscle memory of log-based incident response, and it's built entirely from the tools above.

**Parsing an access log for the top 10 IPs generating errors, end-to-end:**
```bash
grep -E " (4|5)[0-9]{2} " access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -10
```

**Finding and archiving old logs, safely, in one line:**
```bash
find /var/log/app -name "*.log" -mtime +30 -print0 | xargs -0 -I{} gzip {}
```
