# Part 24 — Terminal Editors

## Overview comparison

| | Vim | Neovim | LazyVim | Nano |
|---|---|---|---|---|
| **What it is** | Classic modal text editor, near-universal on Linux | Vim fork with modern architecture (Lua config, better plugin/LSP APIs, async) | A pre-built, opinionated Neovim configuration distribution (not a separate editor) | Simple, non-modal, beginner-friendly editor |
| **Learning curve** | Steep | Steep (same core as Vim) | Steep, but ships more IDE features out of the box, so less config-building yourself | Minutes |
| **Server availability** | Nearly always preinstalled or one apt/dnf install away | Usually needs explicit install, not always in default repos on older distros | Requires Neovim + LazyVim's setup — not something you'd casually bootstrap on a random production box mid-incident | Frequently preinstalled by default, especially on Debian/Ubuntu |
| **SSH suitability** | Excellent — works over any terminal, low resource use | Excellent, same terminal-native model | Fine once installed, but the *setup itself* isn't SSH-friendly (config, plugins, LSP servers) | Excellent — zero learning curve mid-incident |
| **DevOps suitability (quick server edits)** | Best-in-class once you know it | Equally good, marginal edge in some ergonomics | Overkill for "fix one line in nginx.conf at 2am" | Best-in-class for exactly this use case |
| **Software-engineering suitability (daily driver)** | Good, capable but configuration-heavy to get IDE-like features | Better — modern plugin ecosystem, LSP, Treesitter, async everything | Excellent out of the box — most of that ecosystem pre-wired for you | Not designed for this — no LSP, no real project-navigation model |
| **Resource use** | Very light | Light | Moderate (loads many plugins) | Extremely light |

## Advantages / disadvantages, briefly

**Vim**
- \+ Present on virtually every Linux box you'll ever SSH into — zero setup tax.
- \+ Extremely fast for line-level text edits once muscle memory is built.
- − Steep initial learning curve; plugin ecosystem (Vimscript-based) feels dated next to Neovim's.

**Neovim**
- \+ Same core editing model as Vim (skills transfer 100%), plus modern Lua configuration, built-in LSP client, Treesitter syntax, async job control.
- \+ Actively developed, strong plugin ecosystem (telescope, nvim-lspconfig, etc.).
- − Not guaranteed to be preinstalled on a random server — you may need to install it before you can use it, which matters during an active incident on a locked-down box.

**LazyVim**
- \+ Gives you a fully-configured, IDE-grade Neovim (LSP, autocomplete, fuzzy finder, git integration, file tree) with almost no manual config — excellent if you want Neovim's power without building the config yourself.
- \+ Great as your primary local development environment.
- − It's a *configuration distribution*, not something you'd install fresh on a production server mid-incident — it assumes a local dev machine, internet access to fetch plugins, and some setup time.
- − Because it's opinionated and plugin-heavy, there's more surface area to troubleshoot when something breaks, versus stock Vim's near-zero moving parts.

**Nano**
- \+ Trivial to use immediately — shortcuts shown on-screen at all times, no modal editing to learn.
- \+ Perfect for "I need to change one line in a config file right now and get out."
- − No serious code-editing features (no LSP, minimal syntax awareness, weak multi-file workflows) — not a real option as a primary development editor.

## Clear recommendation

**Best editor for remote server administration (SSH into a random EC2 box to fix a config):** **Vim** (or `nano` if you genuinely just need a one-line edit and don't want to think about modes at all). Reasoning: it's *already there* on almost every server you'll ever touch, works identically over any SSH connection regardless of terminal capabilities, and the core skills (`i`, `Esc`, `:wq`) cover 90% of real server-editing needs. Investing in Vim fluency pays off precisely because you can't guarantee LazyVim/Neovim will be installed on the box you're on at 2am during an incident.

**Best editor for full-time software development (your own workstation, daily coding):** **Neovim with LazyVim** (or an equivalent curated config). Reasoning: you control your own environment, have time to set it up once, and benefit enormously from LSP-driven autocomplete/diagnostics, fuzzy file finding, and git integration that stock Vim doesn't give you out of the box.

**Practical middle path many DevOps engineers land on:** learn Vim modal editing well enough to be fast and comfortable *anywhere* (servers, containers, minimal images), and separately run Neovim+LazyVim (or VS Code) as your actual daily-driver IDE locally — the modal-editing skill transfers completely between the two, so it's not wasted effort in either direction.

---

# Part 25 — Vim / Neovim / LazyVim Reference

## Modes
| Mode | Purpose | Enter with |
|---|---|---|
| Normal | Navigation and commands (the default mode) | `Esc` from any other mode |
| Insert | Typing actual text | `i`, `a`, `o`, etc. from Normal |
| Visual | Selecting text | `v` (char), `V` (line), `Ctrl+v` (block) |
| Command | `:`-prefixed commands (save, quit, search/replace) | `:` from Normal |

## Essential movement (Normal mode)
| Key | Moves |
|---|---|
| `h` `j` `k` `l` | left / down / up / right |
| `w` | next word start |
| `b` | previous word start |
| `e` | end of current/next word |
| `0` | start of line |
| `$` | end of line |
| `gg` | top of file |
| `G` | bottom of file |
| `{N}G` | go to line N, e.g. `42G` |
| `Ctrl+d` / `Ctrl+u` | half-page down / up |

## Editing
| Key | Action |
|---|---|
| `i` | insert before cursor |
| `a` | insert after cursor |
| `I` | insert at start of line |
| `A` | insert at end of line |
| `o` | open new line below, enter insert mode |
| `O` | open new line above, enter insert mode |
| `x` | delete character under cursor |
| `dd` | delete (cut) current line |
| `yy` | yank (copy) current line |
| `p` | paste after cursor/line |
| `u` | undo |
| `Ctrl+r` | redo |
| `dw` | delete to next word |
| `.` | repeat last change — extremely powerful for repetitive edits |

## Search
| Key | Action |
|---|---|
| `/pattern` | search forward |
| `?pattern` | search backward |
| `n` | next match |
| `N` | previous match (opposite direction of the last search) |

## Save/quit
| Command | Action |
|---|---|
| `:w` | write (save) |
| `:q` | quit (fails if unsaved changes) |
| `:wq` or `ZZ` | save and quit |
| `:q!` | quit WITHOUT saving — discard changes |
| `:wq!` | force save and quit (e.g. overriding a readonly flag) |

## Visual mode
| Key | Selects |
|---|---|
| `v` | character-wise |
| `V` | line-wise |
| `Ctrl+v` | block-wise (columns) — great for editing a vertical slice across many lines at once |
After selecting: `d` (delete selection), `y` (yank selection), `>` / `<` (indent/outdent).

## Advanced essentials
- **Macros:** `qa` (start recording into register `a`) → do your edit → `q` (stop) → `@a` (replay) → `5@a` (replay 5 more times). Huge for repetitive structured edits across many lines.
- **Registers:** every delete/yank goes into a register; `"ayy` yanks into register `a` explicitly, `"ap` pastes from it — lets you hold multiple clipboards at once.
- **Marks:** `ma` sets mark `a` at the cursor; `` `a `` jumps back to it — useful for bouncing between two spots in a large file.
- **Buffers:** each open file is a buffer; `:ls` lists them, `:b2` switches to buffer 2, `:bn`/`:bp` next/previous.
- **Windows:** `:split` / `:vsplit` divide the screen; `Ctrl+w` then an arrow/`h/j/k/l` moves between them.
- **Tabs:** `:tabnew`, `gt`/`gT` to cycle — less central to Vim workflow than in GUI editors; buffers+splits usually cover more.
- **Search/replace:** `:%s/old/new/g` (whole file, all occurrences per line), `:%s/old/new/gc` (with confirmation prompt per match), `:s/old/new/` (current line only).
- **`:set`:** `:set number` (line numbers), `:set relativenumber`, `:set ignorecase`, `:set expandtab tabstop=4` (spaces instead of tabs) — persist any of these in `~/.vimrc`/`~/.config/nvim/init.lua`.

## Compact cheat sheet
```
MOVE     h j k l  w b e  0 $  gg G
EDIT     i a I A o O  x  dd  yy  p  u  Ctrl+r  .
SEARCH   /pat  ?pat  n  N
SAVE     :w  :q  :wq  ZZ  :q!
VISUAL   v  V  Ctrl+v  →  d / y / > / <
REPLACE  :%s/old/new/g     :%s/old/new/gc
MACRO    qa ... q   then  @a  or  5@a
```

## LazyVim — the important concepts, not every plugin
- Ships with a curated, sane-default plugin set: file explorer (`neo-tree`), fuzzy finder (`telescope`/`fzf-lua`), LSP + autocomplete pre-wired per language, git signs in the gutter, a status line.
- `<leader>` key (usually `Space`) is the entry point to almost everything — press it and a menu (`which-key`) pops up showing available commands, so you don't need to memorize LazyVim's bindings up front.
- `<leader>ff` — find files; `<leader>fg` — live grep across the project; `<leader>e` — toggle file explorer; `gd` — go to definition (LSP); `K` — hover documentation (LSP); `<leader>ca` — code actions.
- Config lives in `~/.config/nvim/`, plugins managed declaratively via `lazy.nvim` (the plugin manager LazyVim itself is built on).
- **Practical note:** don't try to learn all of LazyVim's bindings at once — lean on the `which-key` popup (`Space` and wait) to discover commands contextually as you need them.

---

# Part 26 — Nano

## Core operations
| Shortcut | Action |
|---|---|
| `Ctrl+O` | Save (WriteOut) — prompts for filename, confirm with `Enter` |
| `Ctrl+X` | Exit (prompts to save if there are unsaved changes) |
| `Ctrl+W` | Search (Where is) |
| `Ctrl+\` | Search and replace |
| `Ctrl+K` | Cut current line |
| `Ctrl+U` | Paste (Uncut) |
| `Ctrl+_` then a number | Go to a specific line |
| `Alt+U` | Undo |
| `Alt+E` | Redo |
| `Ctrl+G` | Help menu |

Nano displays its most relevant shortcuts on-screen at the bottom at all times (`^` represents `Ctrl`) — this is precisely why it needs no dedicated cheat sheet to be usable: the interface teaches itself.

```bash
nano /etc/nginx/nginx.conf          # just open and edit — no modes, no surprises
```

## When Nano is the right call on production servers
- A single-line emergency config fix during an active incident, where you (or whoever's on call) doesn't have Vim fluency — Nano's zero learning curve means zero chance of getting stuck in a mode you don't understand under pressure.
- Any teammate/runbook step that needs to work reliably regardless of who's on call and their Vim experience level.
- Quick review of a file's content combined with a trivial edit, where firing up any more elaborate tooling would be pure overhead.

---

# Part 27 — Terminal Multiplexers

## Why this matters for DevOps specifically
An SSH session dying (network blip, laptop sleeps, VPN drops) kills every foreground process in it — including a long-running deploy, a `tail -f` you were watching, or a multi-step debugging session you were mid-way through. A terminal multiplexer runs your session on the **server**, independent of your SSH connection, so you can detach, disconnect entirely, reconnect from anywhere (even a different machine), and reattach to exactly where you left off.

## `tmux` vs `screen`
`tmux` is the modern standard — more actively developed, better scripting/config support, nicer pane-splitting UX. `screen` is older but still occasionally the only one preinstalled on a minimal/legacy image. Learn `tmux`; fall back to `screen` only when it's genuinely all that's available (`apt/dnf install tmux` if you have any install access at all).

## Core concepts
- **Session**: a full workspace, survives disconnection, has a name (`work`, `deploy`, etc.).
- **Window**: like a tab within a session.
- **Pane**: a split within a window (side-by-side or stacked terminals).

## `tmux` practical reference
```bash
tmux new -s work                # start a NEW named session
tmux ls                            # list existing sessions
tmux attach -t work                  # reattach to a named session
tmux kill-session -t work              # destroy a session
```
**Inside tmux, the prefix key is `Ctrl+b` by default** (many configs remap it to `Ctrl+a`) — press it, release, then the following key:
| Prefix + | Action |
|---|---|
| `d` | Detach (session keeps running in background) |
| `c` | New window |
| `n` / `p` | Next / previous window |
| `0`-`9` | Jump to window number |
| `%` | Split pane vertically |
| `"` | Split pane horizontally |
| Arrow keys | Move between panes |
| `x` | Close current pane (confirms) |
| `[` | Enter scroll/copy mode (arrow keys or `Page Up` to scroll back, `q` to exit) |
| `,` | Rename current window |

## The SSH-disconnection-survival workflow, concretely
```bash
ssh user@server
tmux new -s deploy
./long-running-deploy.sh
# Ctrl+b, then d      -> detach, deploy keeps running
# (close laptop, lose wifi, whatever)

ssh user@server
tmux attach -t deploy    # right back where you left off, output and all
```

## Compact tmux cheat sheet
```
SESSIONS   tmux new -s NAME   tmux ls   tmux attach -t NAME   tmux kill-session -t NAME
DETACH     Prefix d
WINDOWS    Prefix c (new)   Prefix n/p (next/prev)   Prefix 0-9 (jump)
PANES      Prefix % (vsplit)   Prefix " (hsplit)   Prefix + arrow (move)   Prefix x (close)
SCROLL     Prefix [  then arrows/PgUp, q to exit
```

---

# Part 28 — Essential DevOps CLI Tools

These aren't part of a base Linux install but are common enough on a DevOps engineer's own workstation/bastion that installing them pays for itself almost immediately. Split by how essential each is.

## Essential — install these on any box you work from regularly

## `jq`
**Purpose:** Parse, filter, and reshape JSON from the command line — essential for working with AWS CLI output, API responses, and structured logs.
**Install:** `sudo apt install jq` / `sudo dnf install jq`
```bash
aws ec2 describe-instances | jq '.Reservations[].Instances[].InstanceId'
curl -s https://api.example.com/status | jq '.status'
echo '{"name":"web1","status":"running"}' | jq -r '.name'    # -r: raw output, no quotes
cat data.json | jq '.[] | select(.status=="failed")'
```
**Why essential:** AWS CLI, most modern APIs, and increasingly structured application logs all output JSON — without `jq` you're stuck eyeballing or writing fragile `grep`/`sed` against JSON, which breaks constantly.

## `yq`
**Purpose:** `jq` for YAML — parse/edit Kubernetes manifests, Ansible playbooks, docker-compose files, CI configs.
**Install:** `sudo snap install yq` or download the binary from its GitHub releases
```bash
yq '.spec.replicas' deployment.yaml
yq -i '.spec.replicas = 5' deployment.yaml     # -i: in-place edit
```
**Why essential:** Kubernetes and most CI/CD configuration is YAML — same argument as `jq` above, just for the other dominant config format.

## `ripgrep` (`rg`)
**Purpose:** A dramatically faster, smarter `grep` replacement — respects `.gitignore` automatically, recursive by default, better defaults for source-code searching.
**Install:** `sudo apt install ripgrep` / `sudo dnf install ripgrep`
```bash
rg "TODO" .                    # recursive by default, skips .git/node_modules automatically
rg -i "error" /var/log/app         # case-insensitive
rg --type py "def main"              # search only Python files
```
**Why essential:** for searching through a codebase (as opposed to a single log file, where plain `grep` is still perfectly fine), `rg` is faster and has far better defaults out of the box.

## `fd`
**Purpose:** A faster, friendlier alternative to `find` for simple name-based searches (not a full replacement — `find`'s advanced conditions/actions still matter for scripting and are POSIX-standard/always-available, see Part 2).
**Install:** `sudo apt install fd-find` (binary may install as `fdfind` on Debian/Ubuntu) / `sudo dnf install fd-find`
```bash
fd nginx.conf                 # simpler syntax than find for common cases
fd -e log                       # find by extension
```
**Why essential-ish:** genuinely faster and more pleasant for interactive use; still worth knowing plain `find` well since it's guaranteed to exist everywhere `fd` might not be installed.

## `fzf`
**Purpose:** General-purpose fuzzy finder — pipe any list into it (files, command history, process list, git branches) and interactively filter/select.
**Install:** `sudo apt install fzf` / `sudo dnf install fzf`
```bash
vim $(fzf)                       # fuzzy-pick a file to open
kill -9 $(ps aux | fzf | awk '{print $2}')    # fuzzy-pick a process to kill
Ctrl+R                              # (once shell-integrated) fuzzy search command HISTORY — a massive daily quality-of-life upgrade
```
**Why essential:** once shell-integrated, it fundamentally changes how fast you navigate files, history, and command output — one of the highest ROI tools on this list.

## `tmux`
Covered fully in Part 27 — essential for any work that might outlive your SSH connection.

## `htop`
Covered in Part 6 — essential for any interactive process/resource troubleshooting session.

## `ncdu`
**Purpose:** Interactive, navigable disk-usage explorer — the du output from Part 2/8, but browsable instead of a static wall of numbers.
**Install:** `sudo apt install ncdu` / `sudo dnf install ncdu`
```bash
ncdu /var
```
Navigate with arrow keys, drill into subdirectories, delete files directly from the interface (`d`) — dramatically faster than repeated manual `du --max-depth` commands during a disk-full incident.
**Why essential:** turns the Part 7 disk-full decision tree's manual drill-down into a 30-second interactive session instead of a dozen typed commands.

## `curl`, `wget`, `dig`, `nc`
Already covered in depth in Part 9 — essential, and preinstalled or one command away on virtually every distro.

## Nice-to-have — valuable, but lower priority than the above

| Tool | Purpose |
|---|---|
| `bat` | `cat` with syntax highlighting and line numbers — nicer for reading source/config files interactively |
| `httpie` | More human-friendly alternative to raw `curl` for manual API testing (`http POST api.example.com/x key=val`) |
| `k9s` | Terminal UI for Kubernetes cluster management (only relevant if you work with K8s regularly) |
| `direnv` | Auto-load/unload environment variables per-directory — handy for juggling multiple projects' configs |
| `entr` | Re-run a command automatically when watched files change — useful for quick local iteration loops |
| `duf` | A more visual/modern `df` |
| `procs` | A more visual/modern `ps` |

**How to decide what to actually install on a given box:** on your own workstation/bastion, install the full essential list — it's a one-time cost with permanent payoff. On a random production EC2 instance during an incident, **don't** spend time installing tooling — stick to what's already there (`grep`, `awk`, `top`, `ps`, `find`) unless you have a very good reason and time to spare; every install is one more thing to justify/audit on a production box.
