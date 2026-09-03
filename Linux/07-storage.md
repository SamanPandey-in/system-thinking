# Part 8 — Disk and Storage Management

## 8.1 Core concepts

- **Block device**: a raw storage device, e.g. `/dev/nvme0n1` (an EBS volume on a Nitro-based EC2 instance) or `/dev/xvda` (older Xen-based instances).
- **Partition**: a subdivision of a block device, e.g. `/dev/nvme0n1p1`.
- **Filesystem**: the structure written onto a partition that actually organizes files (ext4, xfs, etc.) — a raw block device/partition is useless until formatted with one.
- **Mount point**: the directory in the tree where a filesystem is attached and becomes accessible, e.g. mounting `/dev/nvme1n1` (an extra EBS volume) at `/data`.
- **Inode**: a data structure holding a file's metadata (permissions, owner, size, pointers to actual data blocks) — **not** the filename itself (names live in the directory entry, which points to an inode). A filesystem has a *finite number* of inodes, separate from its space in bytes.

## `lsblk`
**Purpose:** Show all block devices and their partition/mount layout in a tree.
```bash
lsblk
```
```text
NAME        MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT
nvme0n1     259:0    0   20G  0 disk
├─nvme0n1p1 259:1    0   20G  0 part /
nvme1n1     259:2    0  100G  0 disk
```
Here `nvme1n1` is an attached-but-unmounted EBS volume — visible to the OS, no filesystem/mount yet.
**Risk:** 🟢 SAFE

## `blkid`
**Purpose:** Show filesystem type and UUID for each block device — the UUID is what you should reference in `/etc/fstab` (not the device name, which can shift between boots, especially with multiple EBS volumes).
```bash
sudo blkid
```
```text
/dev/nvme0n1p1: UUID="1234-5678-..." TYPE="ext4" PARTUUID="..."
```
**Risk:** 🟢 SAFE

## `mount` / `umount`
**Purpose:** Attach/detach a filesystem to the directory tree.
```bash
sudo mount /dev/nvme1n1 /data                 # mount an already-formatted volume
sudo mount -t ext4 /dev/nvme1n1 /data           # explicit filesystem type
sudo umount /data                                 # unmount
mount | grep /data                                  # show current mount options/status
```
**Common mistake:** manually running `mount` gets you through a reboot fine — until the next reboot, when the manual mount is gone. Persistent mounts belong in `/etc/fstab` (see below).
**`umount` failing with "target is busy":** something has an open file handle or working directory inside the mount. Find it with `lsof +D /data` or `fuser -vm /data`, then stop/close that process before retrying.
**Risk:** 🟡 USE WITH CARE

### `/etc/fstab` — persistent mounts
```text
UUID=1234-5678-...  /data  ext4  defaults,nofail  0  2
```
`nofail` is important on cloud instances — without it, a missing/detached volume at boot (e.g. EBS didn't attach in time) can **hang the entire boot process**. Always test with `sudo mount -a` (mounts everything in fstab) before rebooting, to catch typos safely rather than discovering them via a stuck boot.
**Risk:** 🔴 DESTRUCTIVE if wrong — a bad fstab entry can prevent the instance from booting at all (recoverable via detaching the volume and mounting on a rescue instance, but avoidable by testing with `mount -a` first).

## `findmnt`
**Purpose:** Query current mounts in a clean tree/table view, or verify a specific path's mount info.
```bash
findmnt /data
findmnt --verify         # sanity-check /etc/fstab entries against reality
```
**Risk:** 🟢 SAFE

## `fdisk` / `parted`
**Purpose:** Partition block devices.
```bash
sudo fdisk -l                # list partition tables (read-only, safe)
sudo fdisk /dev/nvme1n1        # interactive partitioning session
sudo parted /dev/nvme1n1 print  # parted equivalent; better for GPT and disks >2TB
```
**`fdisk` vs `parted`:** `fdisk` is simpler and fine for MBR/smaller disks; `parted` handles GPT properly and is required for disks over 2TB. On modern cloud volumes, many workflows skip partitioning entirely and format the whole block device directly (`mkfs` straight on `/dev/nvme1n1`), which is simpler and perfectly valid for a dedicated data volume.
**Risk:** 🔴 DESTRUCTIVE — partitioning operations can destroy existing data on a device; always confirm you have the *correct* device name (`lsblk` first) before writing anything.

## `mkfs`
**Purpose:** Format a partition/device with a filesystem.
```bash
sudo mkfs -t ext4 /dev/nvme1n1        # format the WHOLE device with ext4
sudo mkfs.xfs /dev/nvme1n1              # xfs variant
```
**Risk:** 🔴 DESTRUCTIVE — irreversibly wipes any existing data on the target. Triple-check the device path; running this against the wrong device (e.g. your root volume instead of the new data volume) is unrecoverable without a snapshot.

## `fsck`
**Purpose:** Check and repair filesystem consistency, typically after an unclean shutdown.
```bash
sudo fsck /dev/nvme1n1        # should NOT be run on a mounted filesystem
```
**Risk:** 🔴 DESTRUCTIVE-adjacent — never run against a mounted filesystem (unmount first, or it can corrupt data mid-repair); repair actions it takes are sometimes irreversible (e.g. discarding an unrecoverable inode).

## `tune2fs`
**Purpose:** View/adjust ext-family filesystem parameters (label, reserved-block percentage, mount count before forced check, etc.) without reformatting.
```bash
sudo tune2fs -l /dev/nvme0n1p1     # list current parameters — SAFE, read-only
sudo tune2fs -m 1 /dev/nvme1n1        # reduce root-reserved space from default 5% to 1% (common on large data-only volumes)
```
**Risk:** 🟢 SAFE for `-l` (list), 🟡 USE WITH CARE for parameter changes

## `lsof`
**Purpose:** List open files — and on Linux, "everything is a file," so this also shows open network sockets, which is why it appears in both storage and networking troubleshooting.
```bash
lsof /data                       # what has files open under this mount (needed before umount)
lsof +D /data                      # recursive version of the above
lsof -p 1523                         # all files/sockets opened by a specific PID
lsof | grep deleted                    # find deleted-but-still-open files (see below)
sudo lsof -i :443                       # what process is listening on/using port 443 (networking use, Part 9)
```
**Risk:** 🟢 SAFE (read-only)

---

## AWS EBS in practice

- An EBS volume must be **attached** (via AWS API/console — a separate step from Linux) before Linux even sees the block device, then **formatted** (only if new/empty — never `mkfs` an existing volume with data you want to keep) and **mounted**.
- On Nitro-based instances (most current instance types), EBS volumes appear as NVMe devices (`/dev/nvme1n1`, etc.) regardless of the device name you specified when attaching — always confirm the actual kernel name with `lsblk`, don't assume it matches the AWS console's `/dev/sdf`-style name.
- Snapshots are your safety net before anything destructive (`mkfs`, `fdisk`, `fsck`) — take one first on anything containing real data.
- **Resizing an EBS volume** is a 3-step process even after the AWS-side resize completes: (1) grow the partition if partitioned (`growpart`), (2) grow the filesystem (`resize2fs` for ext4, `xfs_growfs` for xfs) — the block device being bigger doesn't automatically give the filesystem the new space.

## Why disk can look full in `df` but not obviously so in `du` — the deleted-but-open-file problem

If `df -h` shows a filesystem at 95% but `du -sh /` on that mount only adds up to a fraction of that, the most common cause is: a process still has a **file handle open** on a file that's since been `rm`'d. Linux doesn't actually free the disk space until the last open handle to that inode closes — the directory entry (name) is gone, so `du` (which walks directory entries) can't see it, but the data blocks are still allocated, so `df` (which asks the filesystem directly) still counts them.

**Diagnosis:**
```bash
sudo lsof | grep deleted
```
```text
nginx    1523  www-data  13w  REG  259,1  8589934592  /var/log/nginx/access.log (deleted)
```
This is extremely common with log files that got deleted (manually, or by a misconfigured logrotate) while the application still has them open for writing — the app keeps appending to the (invisible) file, silently consuming disk.

**Fix:** restart/reload the offending service so it reopens its log file handle against the *current* filename (e.g. `systemctl reload nginx`, or send it `SIGHUP` if it's designed to reopen logs on that signal) — this releases the orphaned space immediately.

## Inodes — the other way a disk can be "full"

`df -h` (space) can show plenty free while writes still fail with "No space left on device" — check inode usage separately:
```bash
df -i
```
```text
Filesystem      Inodes  IUsed   IFree IUse% Mounted on
/dev/nvme0n1p1  1.3M    1.3M    500   100%  /
```
This happens when a filesystem accumulates an enormous number of **tiny** files (a classic cause: an application writing millions of small session/cache files, or a runaway process creating empty files in a loop) — you run out of inodes (a fixed count set at filesystem creation) long before you run out of raw bytes. Fix: find and clean up the directory generating excessive small files; there's no way to add inodes to an existing ext4 filesystem without reformatting (xfs and some other filesystems handle this differently with dynamic inode allocation).

## Command risk summary for this section

| Command | Risk |
|---|---|
| `lsblk`, `blkid`, `df`, `findmnt`, `lsof`, `tune2fs -l` | 🟢 SAFE |
| `mount`, `umount`, `tune2fs` (write) | 🟡 USE WITH CARE |
| `fdisk`, `parted`, `mkfs`, `fsck` | 🔴 DESTRUCTIVE — snapshot first, verify device path twice |
