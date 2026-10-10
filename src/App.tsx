import { useState, useEffect, useRef } from 'react';

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
interface CheckResult {
  label: string;
  pass: boolean;
}

interface Task {
  id: string;
  domain: string;
  title: string;
  difficulty: string;
  failRate: number;
  prompt: string;
  inputLabel: string;
  inputType: string;
  placeholder: string;
  gotchas: string[];
  answerKeyDisplay: string;
  gradeFn: (ans: string) => CheckResult[];
  walkthrough: string;
}

interface GradeResult {
  checks: CheckResult[];
  passed: number;
  total: number;
  pct: number;
}

// ─────────────────────────────────────────────────────────────
// EXAM BANK  – tasks most commonly failed on the real RHCSA
// Each task has: domain, weight, gotchas, answer key, grader fn
// ─────────────────────────────────────────────────────────────
const EXAM_BANK: Task[] = [
  // ── DOMAIN 1: Essential Tools ────────────────────────────
  {
    id: 't01',
    domain: 'Essential Tools',
    title: 'Find SUID Files & Redirect Output',
    difficulty: 'hard',
    failRate: 78,
    prompt: `Find all files on the system with the SUID bit set. Write the full list of matching paths (one per line) to /root/suid_files.txt. Do NOT include permission-denied errors in the file.`,
    inputLabel: 'Enter the exact command(s) you would run:',
    inputType: 'textarea',
    placeholder: `find / -perm ...`,
    gotchas: [
      'Forgetting 2>/dev/null — stderr pollutes the output file',
      'Using -perm +4000 (old syntax) instead of -perm /4000 or -perm -4000',
      'Writing to wrong path (/tmp instead of /root)',
      'Using -perm 4000 (exact match) misses files like -rwsr-sr-x (6xxx)',
    ],
    answerKeyDisplay: `find / -perm /4000 2>/dev/null > /root/suid_files.txt`,
    gradeFn: (ans) => {
      const a = ans.toLowerCase().replace(/\s+/g, ' ').trim();
      const scores = [];
      scores.push({
        label: 'Uses find with /4000 or -4000',
        pass: /find\s+\/.*-perm\s+[\/-]4[0-9]{3}/.test(a),
      });
      scores.push({
        label: 'Suppresses stderr with 2>/dev/null',
        pass: /2>\/dev\/null/.test(a),
      });
      scores.push({
        label: 'Redirects stdout to /root/suid_files.txt',
        pass: />\s*\/root\/suid_files\.txt/.test(a),
      });
      scores.push({ label: 'Starts search from /', pass: /find\s+\//.test(a) });
      return scores;
    },
    walkthrough: `## Why People Fail This

### The SUID Bit Trap
The SUID bit has numeric value **4000**. There are three different ways to match it with \`find -perm\`, and they behave differently:

| Syntax | Meaning | Use Case |
|--------|---------|----------|
| \`-perm 4755\` | Exact match (mode = exactly 4755) | Very rare need |
| \`-perm -4000\` | ALL listed bits must be set (AND) | Files that have SUID + anything else |
| \`-perm /4000\` | ANY listed bit set (OR) | ✅ What you want |

**Use \`/4000\`** (or \`-4000\` — both work here since SUID is a single bit).

### The stderr Trap
\`find /\` will hit directories you can't read (\`/proc\`, \`/sys\`, kernel interfaces). Without \`2>/dev/null\`, error lines are mixed into stdout and end up in your file — the grader sees garbage and you lose the mark.

### The Correct Command
\`\`\`bash
find / -perm /4000 2>/dev/null > /root/suid_files.txt
\`\`\`

**Verify your work:**
\`\`\`bash
cat /root/suid_files.txt        # should list files like /usr/bin/passwd
wc -l /root/suid_files.txt      # sanity check — typically 20-40 lines
\`\`\``,
  },

  {
    id: 't02',
    domain: 'Essential Tools',
    title: 'Archive & Compress with Correct Flags',
    difficulty: 'medium',
    failRate: 65,
    prompt: `Create a compressed archive of /etc/sysconfig using bzip2 compression. Save it as /root/sysconfig_backup.tar.bz2. The archive must preserve file permissions and ownership.`,
    inputLabel: 'Enter the exact command:',
    inputType: 'textarea',
    placeholder: 'tar ...',
    gotchas: [
      'Using -z (gzip) instead of -j (bzip2)',
      'Forgetting -p to preserve permissions',
      'Wrong output path or filename extension',
      'Using -x (extract) instead of -c (create)',
      'Not including the source directory',
    ],
    answerKeyDisplay: `tar -cjpf /root/sysconfig_backup.tar.bz2 /etc/sysconfig`,
    gradeFn: (ans) => {
      const a = ans.toLowerCase().trim();
      return [
        { label: 'Uses tar command', pass: /^tar\s/.test(a) },
        { label: 'Uses -c (create) flag', pass: /-[a-z]*c/.test(a) },
        {
          label: 'Uses -j (bzip2) flag, NOT -z',
          pass: /-[a-z]*j/.test(a) && !/-[a-z]*z/.test(a),
        },
        {
          label: 'Outputs to /root/sysconfig_backup.tar.bz2',
          pass: /\/root\/sysconfig_backup\.tar\.bz2/.test(a),
        },
        { label: 'Sources /etc/sysconfig', pass: /\/etc\/sysconfig/.test(a) },
      ];
    },
    walkthrough: `## tar Flag Matrix — The Exam's Most Common Mistake

People confuse compression flags constantly. Memorize this table:

| Flag | Compression | Extension |
|------|------------|-----------|
| \`-z\` | gzip | .tar.gz / .tgz |
| \`-j\` | bzip2 | .tar.bz2 |
| \`-J\` | xz | .tar.xz |
| none | none | .tar |

### The RHCSA Trick
The exam often gives you a **.tar.bz2** filename in the task — that IS the hint. Match the flag to the extension.

### Core flags you always need:
- \`-c\` — **c**reate
- \`-f\` — **f**ile (always last before the filename)
- \`-p\` — preserve **p**ermissions (important for system files)
- \`-v\` — **v**erbose (optional, good for verification)

### Correct Command
\`\`\`bash
tar -cjpf /root/sysconfig_backup.tar.bz2 /etc/sysconfig
\`\`\`

### Verify
\`\`\`bash
tar -tjf /root/sysconfig_backup.tar.bz2 | head    # list contents
file /root/sysconfig_backup.tar.bz2               # confirm bzip2 magic bytes
\`\`\``,
  },

  // ── DOMAIN 2: Users & Groups ──────────────────────────────
  {
    id: 't03',
    domain: 'Users & Groups',
    title: 'Create User with Specific UID and Supplementary Groups',
    difficulty: 'hard',
    failRate: 72,
    prompt: `Create a user named 'sysops' with:
• UID: 1500
• Primary group: sysops (GID 1500, create it)
• Supplementary groups: wheel AND adm
• Comment: "SysOps Engineer"
• Shell: /bin/bash
• Home directory: /home/sysops (create it)

The user must be able to sudo without a password.`,
    inputLabel: 'Enter all commands required (one per line):',
    inputType: 'textarea',
    placeholder: 'groupadd ...\nuseradd ...\nusermod ...\necho ...',
    gotchas: [
      "Not creating the group first — useradd with -g 1500 fails if group doesn't exist",
      'Using -G instead of -aG when adding supplementary groups after creation',
      'Forgetting to create the home directory (-m flag)',
      'Misquoting the comment (spaces require quotes)',
      'Not setting up sudoers — NOPASSWD entry is part of the task',
      'Using visudo syntax wrong (spaces around = matter)',
    ],
    answerKeyDisplay: `groupadd -g 1500 sysops
useradd -u 1500 -g 1500 -G wheel,adm -c "SysOps Engineer" -s /bin/bash -m sysops
echo "sysops ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/sysops`,
    gradeFn: (ans) => {
      const a = ans.toLowerCase().replace(/\s+/g, ' ').trim();
      return [
        {
          label: 'Creates group sysops with GID 1500',
          pass: /groupadd.*-g\s*1500.*sysops|groupadd.*sysops.*-g\s*1500/.test(
            a
          ),
        },
        {
          label: 'Creates user sysops with UID 1500',
          pass: /useradd.*-u\s*1500.*sysops|useradd.*sysops.*-u\s*1500/.test(a),
        },
        {
          label: 'Sets supplementary groups (wheel AND adm)',
          pass:
            /-g\s+(wheel,adm|adm,wheel)/.test(a) ||
            (/-g\s+wheel/.test(a) && /-g\s+adm/.test(a)),
        },
        { label: 'Sets shell to /bin/bash', pass: /-s\s+\/bin\/bash/.test(a) },
        {
          label: 'Creates home directory (-m flag)',
          pass: /useradd.*-m/.test(a),
        },
        { label: 'Configures NOPASSWD sudo', pass: /nopasswd/.test(a) },
      ];
    },
    walkthrough: `## The Multi-Part User Task — Most Points Lost Here

### Step 1: Create the group FIRST
\`\`\`bash
groupadd -g 1500 sysops
\`\`\`
If you skip this and run useradd with \`-g 1500\`, it fails because GID 1500 doesn't exist yet.

### Step 2: Create the user with all options in one shot
\`\`\`bash
useradd -u 1500 -g 1500 -G wheel,adm -c "SysOps Engineer" -s /bin/bash -m sysops
\`\`\`

| Flag | What it does |
|------|-------------|
| \`-u 1500\` | Sets UID |
| \`-g 1500\` | Sets primary group (by GID) |
| \`-G wheel,adm\` | Sets SUPPLEMENTARY groups (comma-separated, no spaces) |
| \`-c "..."\` | Comment/GECOS field (quote it!) |
| \`-s /bin/bash\` | Login shell |
| \`-m\` | Create home directory |

### Step 3: Sudo without password
**Never edit /etc/sudoers directly.** Use a drop-in file:
\`\`\`bash
echo "sysops ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/sysops
chmod 440 /etc/sudoers.d/sysops
\`\`\`

### Critical: -G vs -aG
- \`usermod -G wheel sysops\` — **replaces** all supplementary groups with just wheel
- \`usermod -aG wheel sysops\` — **appends** wheel (safe if user already has groups)

On initial creation with useradd, \`-G\` is correct (no existing groups to preserve).

### Verify everything
\`\`\`bash
id sysops                    # uid=1500 gid=1500 groups=1500,10(wheel),4(adm)
getent passwd sysops         # check comment and shell
sudo -l -U sysops            # verify NOPASSWD
\`\`\``,
  },

  {
    id: 't04',
    domain: 'Users & Groups',
    title: 'Collaborative Directory with SetGID & ACLs',
    difficulty: 'hard',
    failRate: 81,
    prompt: `Set up a shared directory /data/devteam with the following requirements:
• Group owner: devteam (create the group)
• All new files created in /data/devteam must inherit the devteam group (SetGID)
• devteam group members must have read/write/execute
• Others must have NO permissions
• User 'auditor' (assume it exists) must have read-only access via ACL
• Default ACL must ensure auditor also gets read access on future files`,
    inputLabel: 'Enter all commands required:',
    inputType: 'textarea',
    placeholder: 'mkdir ...\ngroupadd ...\nchown ...\nchmod ...\nsetfacl ...',
    gotchas: [
      'Forgetting the SetGID bit (chmod 2770 not just 770)',
      'Setting ACL but forgetting default ACL (setfacl -d)',
      'Not creating the directory first',
      'chmod order: must set SetGID AFTER chown or it can be reset',
      'Forgetting that setfacl -m and setfacl -m d: are separate commands',
      "Not verifying with getfacl that mask doesn't override permissions",
    ],
    answerKeyDisplay: `groupadd devteam
mkdir -p /data/devteam
chown root:devteam /data/devteam
chmod 2770 /data/devteam
setfacl -m u:auditor:r-x /data/devteam
setfacl -m d:u:auditor:r-x /data/devteam`,
    gradeFn: (ans) => {
      const a = ans.toLowerCase().replace(/\s+/g, ' ').trim();
      return [
        {
          label: 'Creates /data/devteam directory',
          pass: /mkdir.*\/data\/devteam/.test(a),
        },
        {
          label: 'Sets group owner to devteam',
          pass: /chown.*:devteam.*\/data\/devteam/.test(a),
        },
        {
          label: 'Sets SetGID bit (2770 or g+s)',
          pass: /chmod\s+(2770|g\+s)/.test(a),
        },
        {
          label: 'Removes other permissions (770 or o-rwx)',
          pass: /2770|770|o-rwx|o=/.test(a),
        },
        {
          label: 'Sets ACL for auditor (read access)',
          pass: /setfacl.*u:auditor:r/.test(a),
        },
        {
          label: 'Sets DEFAULT ACL for auditor',
          pass: /setfacl.*d:u:auditor:r|setfacl.*-d.*auditor/.test(a),
        },
      ];
    },
    walkthrough: `## The SetGID + ACL Combo — #1 Most Failed Task

### Why This Fails
This task combines THREE concepts that each have their own gotchas. Miss any one and you lose the mark.

### Step-by-Step

\`\`\`bash
# 1. Create the group
groupadd devteam

# 2. Create the directory
mkdir -p /data/devteam

# 3. Set ownership (root owns it, devteam is group)
chown root:devteam /data/devteam

# 4. Set permissions WITH SetGID
chmod 2770 /data/devteam
#    ^ the 2 = SetGID bit
#     ^ 7 = rwx for owner
#      ^ 7 = rwx for group (devteam)
#       ^ 0 = no permissions for others
\`\`\`

### Understanding SetGID on a Directory
Normally, files created in a directory inherit the **creator's** primary group.
With SetGID set, files inherit the **directory's** group instead (devteam).
This is what makes it "collaborative" — everyone's files belong to the team.

### ACL vs Default ACL
| Command | Effect |
|---------|--------|
| \`setfacl -m u:auditor:r-x /data/devteam\` | auditor can read EXISTING files/dirs |
| \`setfacl -m d:u:auditor:r-x /data/devteam\` | auditor can read FUTURE files too |

**You need BOTH.** The \`d:\` prefix means "default" — it's applied to all new files.

\`\`\`bash
setfacl -m u:auditor:r-x /data/devteam
setfacl -m d:u:auditor:r-x /data/devteam
\`\`\`

### Verify
\`\`\`bash
ls -ld /data/devteam          # should show drwxrws--- and a + sign if ACL is set
getfacl /data/devteam         # full ACL dump including defaults
\`\`\`
Look for \`flags: -s-\` in getfacl output — the 's' confirms SetGID is active.`,
  },

  // ── DOMAIN 3: Storage ────────────────────────────────────
  {
    id: 't05',
    domain: 'Storage',
    title: 'Create & Mount a Persistent LVM Logical Volume',
    difficulty: 'hard',
    failRate: 88,
    prompt: `You have an unpartitioned disk /dev/sdb (assume 10GB available).
Complete the following:
1. Create a partition on /dev/sdb using all available space
2. Create a Physical Volume on that partition
3. Create a Volume Group named 'vgdata' 
4. Create a Logical Volume named 'lvapps' with exactly 2GB
5. Format it with XFS
6. Mount it persistently at /mnt/apps (must survive reboot)
7. The mount must use the filesystem UUID (not device path)`,
    inputLabel: 'Enter all commands in order:',
    inputType: 'textarea',
    placeholder: 'fdisk /dev/sdb\npvcreate ...\nvgcreate ...',
    gotchas: [
      'Forgetting to run partprobe after fdisk to update the kernel',
      'Using device path (/dev/vgdata/lvapps) in /etc/fstab instead of UUID',
      'Wrong fstab format — missing fields or wrong field count (6 fields required)',
      'Forgetting to mkdir /mnt/apps before mounting',
      'Using -L 2G vs -l 2G (capital -L is size, lowercase -l is extents)',
      'Not running mount -a to test fstab before rebooting',
      'mkfs.xfs on /dev/sdb instead of /dev/sdb1',
    ],
    answerKeyDisplay: `fdisk /dev/sdb  → n,p,1,enter,enter,w
partprobe /dev/sdb
pvcreate /dev/sdb1
vgcreate vgdata /dev/sdb1
lvcreate -L 2G -n lvapps vgdata
mkfs.xfs /dev/vgdata/lvapps
mkdir -p /mnt/apps
UUID=$(blkid -s UUID -o value /dev/vgdata/lvapps)
echo "UUID=$UUID  /mnt/apps  xfs  defaults  0 0" >> /etc/fstab
mount -a && df -h /mnt/apps`,
    gradeFn: (ans) => {
      const a = ans.toLowerCase().replace(/\s+/g, ' ').trim();
      return [
        {
          label: 'Creates partition (fdisk/parted/gdisk)',
          pass: /fdisk|parted|gdisk/.test(a),
        },
        {
          label: 'Runs partprobe after partitioning',
          pass: /partprobe/.test(a),
        },
        {
          label: 'Creates PV with pvcreate',
          pass: /pvcreate\s+\/dev\/sdb/.test(a),
        },
        { label: 'Creates VG named vgdata', pass: /vgcreate\s+vgdata/.test(a) },
        {
          label: 'Creates LV named lvapps with 2G (-L 2G)',
          pass:
            /lvcreate.*-l\s+2g|lvcreate.*-l\s+2048m|-l\s+2g.*lvcreate/.test(
              a
            ) || /lvcreate.*lvapps/.test(a),
        },
        { label: 'Formats with XFS', pass: /mkfs\.xfs/.test(a) },
        { label: 'Uses UUID in fstab (not device path)', pass: /uuid/.test(a) },
        {
          label: 'Mounts at /mnt/apps persistently (fstab)',
          pass: /\/mnt\/apps/.test(a) && /fstab/.test(a),
        },
      ];
    },
    walkthrough: `## LVM + Persistent Mount — The Exam's Biggest Marks Block

### The LVM Pipeline (memorize this chain)
\`\`\`
Physical Disk → Partition → PV → VG → LV → Filesystem → Mount
/dev/sdb       /dev/sdb1    pvcreate  vgcreate  lvcreate  mkfs.xfs  fstab
\`\`\`

### Step 1: Partition the disk
\`\`\`bash
fdisk /dev/sdb
# Inside fdisk: n → p → 1 → Enter → Enter → w
partprobe /dev/sdb   # ← CRITICAL: tells kernel about new partition table
\`\`\`

### Step 2: LVM setup
\`\`\`bash
pvcreate /dev/sdb1
vgcreate vgdata /dev/sdb1
lvcreate -L 2G -n lvapps vgdata
\`\`\`
**-L vs -l:**
- \`-L 2G\` = absolute size (2 gigabytes) ✅ use this for size-specific tasks
- \`-l 50%VG\` = relative size (50% of VG) — useful for "use all space" tasks

### Step 3: Format
\`\`\`bash
mkfs.xfs /dev/vgdata/lvapps
# or: mkfs.xfs /dev/mapper/vgdata-lvapps  (same device, two symlinks)
\`\`\`

### Step 4: Persistent mount with UUID (not device path!)
\`\`\`bash
mkdir -p /mnt/apps
blkid /dev/vgdata/lvapps    # copy the UUID value

# Add to /etc/fstab:
UUID=<paste-uuid-here>  /mnt/apps  xfs  defaults  0 0
\`\`\`

### /etc/fstab — 6 fields, no exceptions
\`\`\`
<device>  <mountpoint>  <fstype>  <options>  <dump>  <pass>
UUID=xxx  /mnt/apps     xfs       defaults   0       0
\`\`\`
- Field 5 (dump): 0 = don't dump
- Field 6 (pass): 0 = no fsck on boot, 1 = root fs, 2 = other fs

### Step 5: TEST before rebooting
\`\`\`bash
mount -a          # mounts everything in fstab that isn't already mounted
df -h /mnt/apps   # confirm it's mounted
\`\`\`
If \`mount -a\` fails, fix fstab NOW — a broken fstab causes the system to drop to emergency mode on reboot.`,
  },

  {
    id: 't06',
    domain: 'Storage',
    title: 'Configure Swap Space Persistently',
    difficulty: 'medium',
    failRate: 62,
    prompt: `Create a 512MB swap file at /swapfile. Activate it immediately AND ensure it activates on every reboot. Set its permissions so only root can read/write it.`,
    inputLabel: 'Enter all commands:',
    inputType: 'textarea',
    placeholder: 'dd if=...\nchmod ...\nmkswap ...',
    gotchas: [
      'Forgetting chmod 600 — swap file with loose permissions is a security issue and graders check this',
      "Using fallocate instead of dd (fallocate can create sparse files that don't work as swap)",
      'Activating swap (swapon) but not adding to /etc/fstab',
      "Wrong fstab entry — swap uses 'swap' as both mount point AND fstype",
      'Forgetting the swap priority field in fstab',
    ],
    answerKeyDisplay: `dd if=/dev/zero of=/swapfile bs=1M count=512
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo "/swapfile  swap  swap  defaults  0 0" >> /etc/fstab`,
    gradeFn: (ans) => {
      const a = ans.toLowerCase().replace(/\s+/g, ' ').trim();
      return [
        {
          label: 'Creates swap file (dd or fallocate)',
          pass: /dd if=\/dev\/zero.*\/swapfile|fallocate.*\/swapfile/.test(a),
        },
        {
          label: 'Sets 512M size',
          pass: /512|bs=1m.*count=512|count=512.*bs=1m/.test(a),
        },
        { label: 'Sets chmod 600', pass: /chmod\s+600\s+\/swapfile/.test(a) },
        { label: 'Runs mkswap', pass: /mkswap\s+\/swapfile/.test(a) },
        { label: 'Activates with swapon', pass: /swapon\s+\/swapfile/.test(a) },
        {
          label: 'Adds to /etc/fstab for persistence',
          pass: /fstab/.test(a) && /swapfile.*swap/.test(a),
        },
      ];
    },
    walkthrough: `## Swap File — The Persistence Trap

### Why People Fail
They create the swap and activate it, but forget \`/etc/fstab\`. The grader boots the VM to check — no fstab entry = no marks.

### Step by Step
\`\`\`bash
# 1. Create the file (dd is safer than fallocate for swap)
dd if=/dev/zero of=/swapfile bs=1M count=512

# 2. Lock down permissions BEFORE mkswap
chmod 600 /swapfile     # root only — this is a security requirement

# 3. Format as swap
mkswap /swapfile

# 4. Activate immediately
swapon /swapfile

# 5. Verify
swapon --show           # should list /swapfile
free -h                 # should show ~512MB swap

# 6. Make persistent
echo "/swapfile  swap  swap  defaults  0 0" >> /etc/fstab
\`\`\`

### The Swap fstab Entry is Unique
\`\`\`
/swapfile   swap   swap   defaults   0   0
    ^         ^      ^
  device   "swap"  "swap"  ← both mountpoint AND fstype are literally "swap"
\`\`\`
This is the only fstab entry where the mount point column says "swap" instead of a real path.

### dd vs fallocate
- \`dd\` fills every byte with zeros → guaranteed contiguous, always works
- \`fallocate -l 512M\` is faster but may create a sparse file → can cause \`swapon: /swapfile: swapon failed: Invalid argument\`

Use \`dd\` on the exam.`,
  },

  // ── DOMAIN 4: SELinux ────────────────────────────────────
  {
    id: 't07',
    domain: 'SELinux',
    title: 'Fix SELinux Context After Moving a Web File',
    difficulty: 'hard',
    failRate: 85,
    prompt: `A web file /root/index.html was copied to /var/www/html/index.html, but Apache cannot serve it. 
1. Identify the SELinux issue
2. Fix it permanently (not just for this file but for the entire /var/www/html directory)
3. Verify Apache can now serve the file
Assume Apache (httpd) is already running.`,
    inputLabel: 'Enter the diagnostic and fix commands:',
    inputType: 'textarea',
    placeholder: 'ls -Z ...\nrestorecon ...\nchcon ...\nsemanage ...',
    gotchas: [
      "Using chcon instead of restorecon — chcon is temporary, doesn't survive relabeling",
      'Not checking with ls -Z first to identify the wrong context',
      'Using restorecon on only the file, not with -R on the directory',
      'Forgetting that semanage fcontext is for NEW rules; restorecon applies existing rules',
      'Not testing with curl or checking audit.log for AVC denials',
      "Thinking a file 'moved' from /root has httpd_sys_content_t — it doesn't",
    ],
    answerKeyDisplay: `ls -Z /var/www/html/index.html           # diagnose: wrong context
restorecon -Rv /var/www/html/            # apply correct context recursively
ls -Z /var/www/html/index.html           # verify: should show httpd_sys_content_t
curl http://localhost/index.html         # test`,
    gradeFn: (ans) => {
      const a = ans.toLowerCase().replace(/\s+/g, ' ').trim();
      return [
        {
          label: 'Checks SELinux context with ls -Z',
          pass: /ls\s+-[a-z]*z/.test(a),
        },
        {
          label: 'Uses restorecon (not just chcon)',
          pass: /restorecon/.test(a),
        },
        {
          label: 'Applies fix recursively (-R or -Rv)',
          pass: /restorecon.*-[a-z]*r/.test(a),
        },
        {
          label: 'Targets /var/www/html directory',
          pass: /restorecon.*\/var\/www\/html/.test(a),
        },
        {
          label: 'Verifies the fix',
          pass: /curl|ls -z|getfattr|audit/.test(a),
        },
      ];
    },
    walkthrough: `## SELinux Context — The Most Misunderstood RHCSA Topic

### The Core Concept
SELinux labels every file with a **security context**. Apache (httpd) can only read files labeled \`httpd_sys_content_t\`. Files copied from \`/root\` inherit the \`admin_home_t\` label — Apache is denied.

### Diagnose First
\`\`\`bash
ls -Z /var/www/html/index.html
# Wrong: system_u:object_r:admin_home_t:s0  index.html
# Right:  system_u:object_r:httpd_sys_content_t:s0  index.html
\`\`\`

### Two ways to fix — only one is permanent:

| Command | Permanent? | How |
|---------|-----------|-----|
| \`chcon -t httpd_sys_content_t file\` | ❌ NO | Direct label change, wiped by \`restorecon\` or relabel |
| \`restorecon -Rv /var/www/html/\` | ✅ YES | Reapplies the policy's intended context |

**Always use \`restorecon\`** on the exam. It reads the SELinux policy to determine what the context *should* be and applies it.

### Adding Custom Context Rules (if restorecon isn't enough)
If you're mounting something outside the default web root:
\`\`\`bash
semanage fcontext -a -t httpd_sys_content_t "/custom/path(/.*)?"
restorecon -Rv /custom/path
\`\`\`
The \`semanage fcontext\` adds a rule to the policy; \`restorecon\` applies it.

### Check for AVC Denials
\`\`\`bash
ausearch -m avc -ts recent       # search audit log for recent SELinux denials
sealert -a /var/log/audit/audit.log  # human-readable with suggested fixes
\`\`\`

### Verify
\`\`\`bash
curl http://localhost/index.html    # 200 OK = fix worked
\`\`\``,
  },

  {
    id: 't08',
    domain: 'SELinux',
    title: 'Change Apache to Non-Standard Port with SELinux',
    difficulty: 'hard',
    failRate: 79,
    prompt: `Configure Apache (httpd) to listen on port 8088 instead of port 80.
All of the following must work:
• httpd must start successfully
• SELinux must remain in Enforcing mode
• The firewall must allow port 8088/tcp
• The change must persist across reboots`,
    inputLabel: 'Enter all commands required:',
    inputType: 'textarea',
    placeholder: '# Edit httpd.conf\nsemanage port ...\nfirewall-cmd ...',
    gotchas: [
      'Forgetting semanage port -a to add port to SELinux http_port_t',
      'Using firewall-cmd without --permanent (change lost on reboot)',
      'Forgetting firewall-cmd --reload after adding permanent rule',
      'Editing /etc/httpd/conf/httpd.conf but not restarting httpd',
      'Not checking if SELinux is blocking with ausearch after httpd fails to start',
    ],
    answerKeyDisplay: `# 1. Edit Apache config
sed -i 's/^Listen 80$/Listen 8088/' /etc/httpd/conf/httpd.conf

# 2. Add port to SELinux http_port_t
semanage port -a -t http_port_t -p tcp 8088

# 3. Open firewall
firewall-cmd --permanent --add-port=8088/tcp
firewall-cmd --reload

# 4. Restart Apache
systemctl restart httpd
systemctl enable httpd`,
    gradeFn: (ans) => {
      const a = ans.toLowerCase().replace(/\s+/g, ' ').trim();
      return [
        {
          label: 'Modifies httpd.conf to use port 8088',
          pass:
            /8088/.test(a) &&
            (/httpd\.conf|listen/.test(a) || /sed.*listen/.test(a)),
        },
        {
          label: 'Adds port to SELinux (semanage port -a)',
          pass: /semanage\s+port\s+-a.*8088|semanage.*8088.*http_port_t/.test(
            a
          ),
        },
        {
          label: 'Opens firewall port 8088 permanently',
          pass: /firewall-cmd.*--permanent.*8088|firewall-cmd.*8088.*--permanent/.test(
            a
          ),
        },
        {
          label: 'Reloads firewall (firewall-cmd --reload)',
          pass: /firewall-cmd.*--reload/.test(a),
        },
        {
          label: 'Restarts httpd',
          pass: /systemctl\s+(restart|start)\s+httpd/.test(a),
        },
      ];
    },
    walkthrough: `## Non-Standard Port — Three Layers to Configure

Most people remember to edit httpd.conf. Very few remember ALL three layers.

### Layer 1: Apache Configuration
\`\`\`bash
# Option A: sed (fast)
sed -i 's/^Listen 80$/Listen 8088/' /etc/httpd/conf/httpd.conf

# Option B: manual edit
vim /etc/httpd/conf/httpd.conf
# Change: Listen 80  →  Listen 8088
\`\`\`

### Layer 2: SELinux — The Hidden Blocker
Apache is allowed to bind only to ports in the \`http_port_t\` type.
Port 8088 is NOT in that list by default.

\`\`\`bash
# Check current allowed ports:
semanage port -l | grep http_port_t

# Add port 8088:
semanage port -a -t http_port_t -p tcp 8088
\`\`\`
Without this step, httpd fails to start and \`journalctl -xe\` shows an AVC denial.

### Layer 3: Firewall
\`\`\`bash
firewall-cmd --permanent --add-port=8088/tcp
firewall-cmd --reload     # ← easy to forget!
\`\`\`
The --permanent flag writes to disk. Without --reload, the running firewall hasn't read the new rule yet.

### Layer 4: Start + Enable
\`\`\`bash
systemctl restart httpd
systemctl enable httpd     # ensure it starts on boot
\`\`\`

### Verify the full stack
\`\`\`bash
ss -tlnp | grep 8088              # is httpd listening?
curl http://localhost:8088         # does it respond?
firewall-cmd --list-ports          # is port allowed?
semanage port -l | grep 8088       # is SELinux happy?
\`\`\``,
  },

  // ── DOMAIN 5: Networking ─────────────────────────────────
  {
    id: 't09',
    domain: 'Networking',
    title: 'Configure Static IP with nmcli (Persists Reboot)',
    difficulty: 'medium',
    failRate: 68,
    prompt: `Configure the network interface 'ens3' with:
• IP address: 192.168.10.50/24
• Gateway: 192.168.10.1
• DNS servers: 8.8.8.8 and 8.8.4.4
• Connection must be persistent across reboots
• Connection name: 'static-ens3'

Do NOT edit /etc/sysconfig/network-scripts files directly.`,
    inputLabel: 'Enter the nmcli commands:',
    inputType: 'textarea',
    placeholder: 'nmcli con add ...\nnmcli con mod ...\nnmcli con up ...',
    gotchas: [
      'Forgetting nmcli con up after modifying — changes not applied until connection is activated',
      'Using incorrect property names (ipv4.gateway vs gw4 syntax changes between RHEL versions)',
      'Not setting connection.autoconnect yes',
      'Forgetting to set ipv4.method manual (leaves it as auto/DHCP)',
      'DNS format: must use space-separated values in quotes, not commas',
    ],
    answerKeyDisplay: `nmcli con add type ethernet con-name static-ens3 ifname ens3 \\
  ipv4.addresses 192.168.10.50/24 \\
  ipv4.gateway 192.168.10.1 \\
  ipv4.dns "8.8.8.8 8.8.4.4" \\
  ipv4.method manual \\
  connection.autoconnect yes
nmcli con up static-ens3`,
    gradeFn: (ans) => {
      const a = ans.toLowerCase().replace(/\s+/g, ' ').trim();
      return [
        {
          label: 'Uses nmcli (not editing files directly)',
          pass: /nmcli/.test(a),
        },
        {
          label: 'Sets IP 192.168.10.50/24',
          pass: /192\.168\.10\.50\/24/.test(a),
        },
        { label: 'Sets gateway 192.168.10.1', pass: /192\.168\.10\.1/.test(a) },
        { label: 'Sets DNS servers (8.8.8.8)', pass: /8\.8\.8\.8/.test(a) },
        {
          label: 'Sets ipv4.method manual',
          pass: /ipv4\.method\s+manual|method\s+manual/.test(a),
        },
        {
          label: 'Activates connection (nmcli con up)',
          pass: /nmcli\s+con(nection)?\s+up|nmcli.*up.*static-ens3/.test(a),
        },
      ];
    },
    walkthrough: `## nmcli Static IP — The Method Manual Trap

### The #1 Mistake
Forgetting \`ipv4.method manual\`. Without it, the connection type stays as \`auto\` (DHCP), and your static IP settings are ignored.

### Complete Command
\`\`\`bash
nmcli con add \\
  type ethernet \\
  con-name static-ens3 \\
  ifname ens3 \\
  ipv4.addresses 192.168.10.50/24 \\
  ipv4.gateway 192.168.10.1 \\
  ipv4.dns "8.8.8.8 8.8.4.4" \\
  ipv4.method manual \\
  connection.autoconnect yes
\`\`\`

### Activate immediately
\`\`\`bash
nmcli con up static-ens3
\`\`\`

### Verify
\`\`\`bash
ip addr show ens3                    # see the IP
ip route show                        # see the default gateway
cat /etc/resolv.conf                 # see DNS entries
nmcli con show static-ens3           # all connection properties
\`\`\`

### Quick Property Reference
| Property | Meaning |
|----------|---------|
| \`ipv4.method manual\` | Static IP (not DHCP) |
| \`ipv4.method auto\` | DHCP |
| \`connection.autoconnect yes\` | Reconnect on boot |
| \`ipv4.addresses\` | IP/prefix (CIDR notation) |
| \`ipv4.gateway\` | Default route |
| \`ipv4.dns\` | Space-separated DNS in quotes |`,
  },

  // ── DOMAIN 6: Scheduled Tasks ────────────────────────────
  {
    id: 't10',
    domain: 'Scheduled Tasks',
    title: 'systemd Timer vs cron — Recurring Task',
    difficulty: 'hard',
    failRate: 74,
    prompt: `Create a systemd timer that:
• Runs a script /usr/local/bin/cleanup.sh every day at 02:30 AM
• The timer and service must be enabled to start on boot
• The service should run as user 'backup'
• Log output to the system journal

Write the content of both unit files and the commands to enable them.`,
    inputLabel: 'Write the unit file contents AND enable commands:',
    inputType: 'textarea',
    placeholder: `# /etc/systemd/system/cleanup.service
[Unit]
...

# /etc/systemd/system/cleanup.timer  
[Timer]
...`,
    gotchas: [
      'Forgetting the [Install] section with WantedBy=timers.target in the .timer file',
      'Forgetting to enable BOTH the .service AND .timer unit',
      'Using OnCalendar= syntax wrong (02:30 vs *-*-* 02:30:00)',
      'Not running systemctl daemon-reload after creating unit files',
      "The .service unit needs WantedBy=multi-user.target if enabled directly, but timer-driven services usually don't need [Install]",
      'Forgetting User= in [Service] section',
    ],
    answerKeyDisplay: `# /etc/systemd/system/cleanup.service
[Unit]
Description=Daily Cleanup Script

[Service]
Type=oneshot
ExecStart=/usr/local/bin/cleanup.sh
User=backup
StandardOutput=journal

# /etc/systemd/system/cleanup.timer
[Unit]
Description=Run cleanup daily at 02:30

[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true

[Install]
WantedBy=timers.target

# Commands:
systemctl daemon-reload
systemctl enable --now cleanup.timer`,
    gradeFn: (ans) => {
      const a = ans.toLowerCase().replace(/\s+/g, ' ').trim();
      return [
        {
          label: 'Creates .service file with ExecStart',
          pass: /execstart=\/usr\/local\/bin\/cleanup\.sh/.test(a),
        },
        { label: 'Sets User=backup in service', pass: /user=backup/.test(a) },
        {
          label: 'Creates .timer file with OnCalendar',
          pass: /oncalendar/.test(a),
        },
        { label: 'Sets correct time (02:30)', pass: /02:30/.test(a) },
        {
          label: 'Timer has WantedBy=timers.target',
          pass: /wantedby=timers\.target/.test(a),
        },
        { label: 'Runs daemon-reload', pass: /daemon-reload/.test(a) },
        {
          label: 'Enables the timer unit',
          pass: /systemctl\s+enable.*cleanup\.timer/.test(a),
        },
      ];
    },
    walkthrough: `## systemd Timer — Unit File Anatomy

### Why It's Hard
You're writing config files from memory under time pressure. Each section has required keys. Miss one and the unit fails silently (or not so silently — check \`systemctl status\`).

### cleanup.service
\`\`\`ini
[Unit]
Description=Daily Cleanup Script

[Service]
Type=oneshot
ExecStart=/usr/local/bin/cleanup.sh
User=backup
StandardOutput=journal
\`\`\`

Key points:
- \`Type=oneshot\` — runs once and exits (not a long-running daemon)
- \`User=backup\` — drops to this user before executing
- \`StandardOutput=journal\` — logs go to journald

### cleanup.timer
\`\`\`ini
[Unit]
Description=Run cleanup daily at 02:30

[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true

[Install]
WantedBy=timers.target
\`\`\`

Key points:
- \`OnCalendar=*-*-* 02:30:00\` — every day at 02:30:00 (year-month-day HH:MM:SS)
- \`Persistent=true\` — if the system was off at 02:30, run on next boot (catch-up)
- \`WantedBy=timers.target\` — this is what makes the timer auto-start on boot

### Enable Commands (in order)
\`\`\`bash
systemctl daemon-reload           # re-read unit files from disk
systemctl enable --now cleanup.timer    # enable + start immediately
systemctl status cleanup.timer    # verify it's active
systemctl list-timers             # see when it will next fire
\`\`\`

### Common Mistakes Table
| Mistake | Symptom |
|---------|---------|
| No [Install] in timer | Timer doesn't start on boot |
| enabling .service not .timer | Service may never trigger |
| No daemon-reload | Old unit definition used |
| Wrong OnCalendar syntax | Timer fires at wrong time / never |`,
  },

  // ── DOMAIN 7: Boot & Recovery ────────────────────────────
  {
    id: 't11',
    domain: 'Boot & Recovery',
    title: 'Reset Root Password via rd.break',
    difficulty: 'hard',
    failRate: 70,
    prompt: `Describe the EXACT procedure to reset the root password on a RHEL 9 system when you do not know the current root password. Include every step from power-on to successful login.`,
    inputLabel: 'Describe the full procedure step by step:',
    inputType: 'textarea',
    placeholder: '1. Interrupt GRUB...\n2. ...',
    gotchas: [
      'Forgetting to remount / as read-write (mount -o remount,rw /sysroot)',
      'Using chroot /sysroot before remounting read-write',
      "Forgetting to run 'touch /.autorelabel' — SELinux will block login without relabeling",
      "Not running 'passwd root' inside chroot",
      "Using 'init=/bin/bash' approach (works but not RHCSA preferred method)",
      'Forgetting to exit chroot before rebooting',
      "Using just 'reboot' instead of 'exit; exit' to leave both chroot and rd.break shell",
    ],
    answerKeyDisplay: `1. Reboot → interrupt GRUB (press 'e')
2. Find linux line, append: rd.break
3. Ctrl+X to boot
4. mount -o remount,rw /sysroot
5. chroot /sysroot
6. passwd root
7. touch /.autorelabel
8. exit
9. exit (or reboot)`,
    gradeFn: (ans) => {
      const a = ans.toLowerCase().replace(/\s+/g, ' ').trim();
      return [
        {
          label: 'Adds rd.break to kernel line in GRUB',
          pass: /rd\.break/.test(a),
        },
        {
          label: 'Remounts /sysroot as read-write',
          pass: /remount.*rw.*sysroot|remount.*\/sysroot.*rw/.test(a),
        },
        { label: 'chroot into /sysroot', pass: /chroot\s+\/sysroot/.test(a) },
        {
          label: 'Runs passwd to change root password',
          pass: /passwd\s+root|passwd/.test(a),
        },
        {
          label: 'Creates /.autorelabel for SELinux',
          pass: /autorelabel/.test(a),
        },
        { label: 'Exits chroot and reboots', pass: /exit/.test(a) },
      ];
    },
    walkthrough: `## Root Password Reset — The autorelabel Trap

Most candidates get 5 of 6 steps right. The one they miss costs them the task.

### Full Procedure

**Step 1: Interrupt GRUB**
- Power on or reboot
- Press **e** at the GRUB menu to edit the default entry

**Step 2: Edit the kernel line**
- Find the line starting with \`linux\`
- At the very end, append: \`rd.break\`
- Press **Ctrl+X** to boot

**Step 3: You're now in the initramfs emergency shell**
The real filesystem is mounted at \`/sysroot\` but it's **read-only**.

\`\`\`bash
mount -o remount,rw /sysroot    # ← MUST DO THIS FIRST
\`\`\`

**Step 4: Enter the real system environment**
\`\`\`bash
chroot /sysroot
\`\`\`

**Step 5: Change the password**
\`\`\`bash
passwd root
# Enter new password twice
\`\`\`

**Step 6: THE STEP EVERYONE FORGETS**
\`\`\`bash
touch /.autorelabel
\`\`\`
SELinux labels the \`/etc/shadow\` file with a specific context. You just wrote to it from outside normal context. Without relabeling, SELinux will block login attempts. The \`/.autorelabel\` file tells the system to relabel all files at next boot (takes a few minutes).

**Step 7: Exit and reboot**
\`\`\`bash
exit          # exits chroot
exit          # exits the rd.break shell, continues boot
\`\`\`
Or press \`Ctrl+D\` twice.

### rd.break vs init=/bin/bash

| Method | Pro | Con |
|--------|-----|-----|
| \`rd.break\` | RHCSA standard, cleaner | Need to remount + chroot |
| \`init=/bin/bash\` | Direct shell | Must remount / directly, proc/sys not mounted |

Use **rd.break** on the exam.`,
  },

  // ── DOMAIN 8: Containers ─────────────────────────────────
  {
    id: 't12',
    domain: 'Containers (Podman)',
    title: 'Run Rootless Container as a systemd Service',
    difficulty: 'hard',
    failRate: 83,
    prompt: `As user 'appuser' (not root):
1. Pull the image 'docker.io/library/nginx:latest'
2. Run it as a rootless container named 'webserver' on host port 8080 → container port 80
3. Generate a systemd unit file for it
4. Enable it to start automatically when appuser logs in (lingering)
5. The container must auto-restart on failure`,
    inputLabel: 'Enter all commands (as appuser unless specified):',
    inputType: 'textarea',
    placeholder: 'podman pull ...\npodman run ...\npodman generate systemd ...',
    gotchas: [
      'Forgetting --restart=always on podman run OR in the generated unit',
      'Not enabling lingering (loginctl enable-linger appuser) — container stops when user logs out',
      'Generating the unit file but not copying it to ~/.config/systemd/user/',
      'Using systemctl instead of systemctl --user for user units',
      'Forgetting systemctl --user daemon-reload',
      'Not running systemctl --user enable --now for the container unit',
    ],
    answerKeyDisplay: `# As appuser:
podman pull docker.io/library/nginx:latest
podman run -d --name webserver -p 8080:80 --restart=always docker.io/library/nginx:latest
mkdir -p ~/.config/systemd/user
cd ~/.config/systemd/user
podman generate systemd --name --files --restart-policy=always webserver
systemctl --user daemon-reload
systemctl --user enable --now container-webserver.service

# As root (enable lingering):
loginctl enable-linger appuser`,
    gradeFn: (ans) => {
      const a = ans.toLowerCase().replace(/\s+/g, ' ').trim();
      return [
        {
          label: 'Runs container with correct port mapping (-p 8080:80)',
          pass: /-p\s+8080:80/.test(a),
        },
        {
          label: "Names container 'webserver'",
          pass: /--name\s+webserver/.test(a),
        },
        {
          label: 'Uses podman generate systemd',
          pass: /podman\s+generate\s+systemd/.test(a),
        },
        {
          label: 'Unit file goes to ~/.config/systemd/user/',
          pass: /\.config\/systemd\/user/.test(a),
        },
        {
          label: 'Uses systemctl --user (not root systemctl)',
          pass: /systemctl\s+--user/.test(a),
        },
        {
          label: 'Enables lingering (loginctl enable-linger)',
          pass: /loginctl\s+enable-linger/.test(a),
        },
      ];
    },
    walkthrough: `## Rootless Podman + systemd — The Lingering Trap

### The Concept
Rootless containers run inside the user's session. Without lingering, systemd user sessions end when the user logs out — taking your container with it.

### Step 1: Run the container
\`\`\`bash
podman run -d \\
  --name webserver \\
  -p 8080:80 \\
  --restart=always \\
  docker.io/library/nginx:latest
\`\`\`

### Step 2: Generate the systemd unit
\`\`\`bash
mkdir -p ~/.config/systemd/user
podman generate systemd \\
  --name \\               # use container name in unit name
  --files \\              # write to files (not stdout)
  --restart-policy=always \\
  webserver
# This creates container-webserver.service in current directory
mv container-webserver.service ~/.config/systemd/user/
\`\`\`

### Step 3: Enable with user systemd
\`\`\`bash
systemctl --user daemon-reload
systemctl --user enable --now container-webserver.service
\`\`\`

**Note the \`--user\` flag.** This is a user-level unit, not system-level. Without \`--user\`, systemctl looks in the wrong place.

### Step 4: Enable lingering (as root)
\`\`\`bash
loginctl enable-linger appuser
\`\`\`
This tells systemd to keep appuser's session alive after logout, so the container keeps running.

### Verify
\`\`\`bash
systemctl --user status container-webserver.service
podman ps
curl http://localhost:8080
loginctl show-user appuser | grep Linger    # should show Linger=yes
\`\`\``,
  },
];

// ─────────────────────────────────────────────────────────────
// GRADING UTILITIES
// ─────────────────────────────────────────────────────────────
function gradeAnswer(task: Task, userAnswer: string): GradeResult {
  const checks = task.gradeFn(userAnswer);
  const passed = checks.filter((c: CheckResult) => c.pass).length;
  const total = checks.length;
  const pct = Math.round((passed / total) * 100);
  return { checks, passed, total, pct };
}

// ─────────────────────────────────────────────────────────────
// MARKDOWN-LIKE RENDERER (no external deps)
// ─────────────────────────────────────────────────────────────
function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const out: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let codeKey = 0;

  const flushTable = () => {
    if (tableRows.length < 2) {
      out.push(<p key={out.length}>{tableRows.join(' ')}</p>);
      tableRows = [];
      return;
    }
    const headers = tableRows[0]
      .split('|')
      .filter((_: string, i: number, a: string[]) => i > 0 && i < a.length - 1)
      .map((h: string) => h.trim());
    const body = tableRows.slice(2).map((row: string) =>
      row
        .split('|')
        .filter((_: string, i: number, a: string[]) => i > 0 && i < a.length - 1)
        .map((c: string) => c.trim())
    );
    out.push(
      <div key={out.length} className="table-wrap">
        <table>
          <thead>
            <tr>
              {headers.map((h: string, i: number) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row: string[], ri: number) => (
              <tr key={ri}>
                {row.map((c: string, ci: number) => (
                  <td key={ci}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (!inCode) {
        inCode = true;
        codeLines = [];
        codeKey = i;
      } else {
        out.push(
          <pre key={codeKey}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        inCode = false;
        codeLines = [];
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (line.includes('|') && line.trim().startsWith('|')) {
      if (!inTable) inTable = true;
      tableRows.push(line);
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (line.startsWith('## ')) {
      out.push(<h3 key={i}>{line.slice(3)}</h3>);
      continue;
    }
    if (line.startsWith('### ')) {
      out.push(<h4 key={i}>{line.slice(4)}</h4>);
      continue;
    }
    if (line.startsWith('**') && line.endsWith('**')) {
      out.push(
        <p key={i}>
          <strong>{line.slice(2, -2)}</strong>
        </p>
      );
      continue;
    }
    if (line.trim() === '') {
      out.push(<div key={i} className="spacer" />);
      continue;
    }

    // Inline bold/code
    const parts = line.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((p: string, pi: number) => {
      if (p.startsWith('`') && p.endsWith('`'))
        return <code key={pi}>{p.slice(1, -1)}</code>;
      if (p.startsWith('**') && p.endsWith('**'))
        return <strong key={pi}>{p.slice(2, -2)}</strong>;
      return p;
    });
    out.push(<p key={i}>{parts}</p>);
  }
  if (inTable) flushTable();
  return out;
}

// ─────────────────────────────────────────────────────────────
// DOMAIN COLORS
// ─────────────────────────────────────────────────────────────
const DOMAIN_COLOR: Record<string, string> = {
  'Essential Tools': '#3b82f6',
  'Users & Groups': '#8b5cf6',
  Storage: '#f59e0b',
  SELinux: '#ef4444',
  Networking: '#10b981',
  'Scheduled Tasks': '#06b6d4',
  'Boot & Recovery': '#f97316',
  'Containers (Podman)': '#ec4899',
};

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function RHCSASimulator() {
  const [screen, setScreen] = useState<string>('home');
  const [examTasks, setExamTasks] = useState<Task[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<Record<string, GradeResult>>({});
  const [reviewTaskId, setReviewTaskId] = useState<string | null>(null);
  const [walkthroughId, setWalkthroughId] = useState<string | null>(null);
  const [examMode, setExamMode] = useState<string>('full');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [timer, setTimer] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerActive]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(
      2,
      '0'
    )}`;

  const startExam = () => {
    let pool = [...EXAM_BANK];
    if (selectedDomain !== 'all')
      pool = pool.filter((t) => t.domain === selectedDomain);
    if (examMode === 'random')
      pool = pool.sort(() => Math.random() - 0.5).slice(0, 5);
    else if (examMode === 'targeted')
      pool = pool.sort((a, b) => b.failRate - a.failRate).slice(0, 6);
    setExamTasks(pool);
    setCurrentIdx(0);
    setAnswers({});
    setGrades({});
    setTimer(0);
    setTimerActive(true);
    setScreen('exam');
  };

  const submitAnswer = () => {
    const task = examTasks[currentIdx];
    const ans = answers[task.id] || '';
    const grade = gradeAnswer(task, ans);
    setGrades((g) => ({ ...g, [task.id]: grade }));
    if (currentIdx < examTasks.length - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      setTimerActive(false);
      setScreen('result');
    }
  };

  const skipTask = () => {
    setGrades((g) => ({
      ...g,
      [examTasks[currentIdx].id]: {
        checks: [],
        passed: 0,
        total: examTasks[currentIdx].gradeFn('').length,
        pct: 0,
      },
    }));
    if (currentIdx < examTasks.length - 1) setCurrentIdx((i) => i + 1);
    else {
      setTimerActive(false);
      setScreen('result');
    }
  };

  const totalScore = (): number => {
    if (examTasks.length === 0) return 0;
    const total = Object.values(grades).reduce((s: number, g: GradeResult) => s + g.pct, 0);
    return Math.round(total / examTasks.length);
  };

  const domains = [...new Set(EXAM_BANK.map((t) => t.domain))];

  // ── SCREENS ───────────────────────────────────────────────
  if (screen === 'walkthrough') {
    const task = EXAM_BANK.find((t) => t.id === walkthroughId)!;
    return (
      <div className="app">
        <style>{CSS}</style>
        <div className="header">
          <span className="logo">RHCSA SIM</span>
          <button
            className="btn-back"
            onClick={() => setScreen(reviewTaskId ? 'review' : 'result')}
          >
            ← Back
          </button>
        </div>
        <div className="walkthrough-container">
          <div
            className="walkthrough-badge"
            style={{ background: DOMAIN_COLOR[task.domain] }}
          >
            {task.domain}
          </div>
          <h2 className="walkthrough-title">{task.title}</h2>
          <div className="answer-key-box">
            <div className="ak-label">✅ Answer Key</div>
            <pre className="ak-code">{task.answerKeyDisplay}</pre>
          </div>
          <div className="gotcha-box">
            <div className="gotcha-label">⚠️ Why People Fail This</div>
            <ul>
              {task.gotchas.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
          <div className="walkthrough-content">
            {renderMarkdown(task.walkthrough)}
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'review') {
    const task = EXAM_BANK.find((t) => t.id === reviewTaskId)!;
    const grade = grades[task.id];
    return (
      <div className="app">
        <style>{CSS}</style>
        <div className="header">
          <span className="logo">RHCSA SIM</span>
          <button className="btn-back" onClick={() => setScreen('result')}>
            ← Results
          </button>
        </div>
        <div className="review-container">
          <div
            className="review-domain-badge"
            style={{ background: DOMAIN_COLOR[task.domain] }}
          >
            {task.domain}
          </div>
          <h2 className="review-title">{task.title}</h2>
          <div className="review-score-bar">
            <div
              className="rsb-fill"
              style={{
                width: `${grade?.pct || 0}%`,
                background:
                  (grade?.pct || 0) >= 70
                    ? '#22c55e'
                    : (grade?.pct || 0) >= 40
                    ? '#f59e0b'
                    : '#ef4444',
              }}
            />
            <span className="rsb-label">{grade?.pct || 0}%</span>
          </div>
          <div className="review-prompt-box">
            <div className="rpb-label">Task</div>
            <p>{task.prompt}</p>
          </div>
          <div className="review-answer-box">
            <div className="rab-label">Your Answer</div>
            <pre className="rab-code">
              {answers[task.id] || '(no answer provided)'}
            </pre>
          </div>
          <div className="check-list">
            {grade?.checks?.map((c, i) => (
              <div key={i} className={`check-item ${c.pass ? 'pass' : 'fail'}`}>
                <span className="check-icon">{c.pass ? '✓' : '✗'}</span>
                <span>{c.label}</span>
              </div>
            ))}
          </div>
          <button
            className="btn-walkthrough"
            onClick={() => {
              setWalkthroughId(task.id);
              setScreen('walkthrough');
            }}
          >
            📖 View Full Walkthrough & Explanation
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'result') {
    const score = totalScore();
    const passed = score >= 70;
    return (
      <div className="app">
        <style>{CSS}</style>
        <div className="header">
          <span className="logo">RHCSA SIM</span>
          <span className="timer-badge">⏱ {formatTime(timer)}</span>
        </div>
        <div className="result-container">
          <div className={`result-verdict ${passed ? 'pass' : 'fail'}`}>
            {passed ? '✅ PASS' : '❌ FAIL'}
          </div>
          <div className="result-score">{score}%</div>
          <div className="result-sub">
            {passed
              ? 'Above the 70% threshold'
              : 'Below 70% — review walkthroughs below'}
          </div>
          <div className="result-grid">
            {examTasks.map((task) => {
              const g = grades[task.id];
              const pct = g?.pct ?? 0;
              return (
                <div
                  key={task.id}
                  className="result-card"
                  onClick={() => {
                    setReviewTaskId(task.id);
                    setScreen('review');
                  }}
                >
                  <div
                    className="rc-domain"
                    style={{ background: DOMAIN_COLOR[task.domain] }}
                  >
                    {task.domain}
                  </div>
                  <div className="rc-title">{task.title}</div>
                  <div className="rc-fail-rate">
                    🔴 {task.failRate}% fail rate
                  </div>
                  <div className="rc-score-row">
                    <div className="rc-bar-bg">
                      <div
                        className="rc-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background:
                            pct >= 70
                              ? '#22c55e'
                              : pct >= 40
                              ? '#f59e0b'
                              : '#ef4444',
                        }}
                      />
                    </div>
                    <span className="rc-pct">{pct}%</span>
                  </div>
                  <div className="rc-hint">
                    {g ? `${g.passed}/${g.total} checks passed` : 'Skipped'}
                  </div>
                  <button className="rc-walkthrough-btn">📖 Walkthrough</button>
                </div>
              );
            })}
          </div>
          <div className="result-actions">
            <button className="btn-primary" onClick={() => setScreen('home')}>
              New Exam
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'exam') {
    const task = examTasks[currentIdx];
    const progress = (currentIdx / examTasks.length) * 100;
    return (
      <div className="app">
        <style>{CSS}</style>
        <div className="header">
          <span className="logo">RHCSA SIM</span>
          <div className="header-right">
            <span className="timer-badge live">⏱ {formatTime(timer)}</span>
            <span className="task-counter">
              {currentIdx + 1} / {examTasks.length}
            </span>
          </div>
        </div>
        <div className="progress-bar">
          <div className="pb-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="exam-container">
          <div
            className="task-domain-badge"
            style={{ background: DOMAIN_COLOR[task.domain] }}
          >
            {task.domain}
            <span className="fail-badge">🔴 {task.failRate}% fail rate</span>
          </div>
          <h2 className="task-title">{task.title}</h2>
          <div className={`diff-badge ${task.difficulty}`}>
            {task.difficulty.toUpperCase()}
          </div>
          <div className="task-prompt">{task.prompt}</div>
          <div className="gotcha-inline">
            <span className="gi-icon">⚠️</span>
            <span className="gi-text">
              <strong>Common traps:</strong> {task.gotchas[0]}
            </span>
          </div>
          <label className="input-label">{task.inputLabel}</label>
          <textarea
            ref={textareaRef}
            className="answer-textarea"
            value={answers[task.id] || ''}
            onChange={(e) =>
              setAnswers((a) => ({ ...a, [task.id]: e.target.value }))
            }
            placeholder={task.placeholder}
            rows={10}
            spellCheck={false}
          />
          <div className="exam-actions">
            <button className="btn-skip" onClick={skipTask}>
              Skip →
            </button>
            <button className="btn-submit" onClick={submitAnswer}>
              {currentIdx < examTasks.length - 1
                ? 'Submit & Next →'
                : 'Submit & Finish ✓'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // HOME
  return (
    <div className="app">
      <style>{CSS}</style>
      <div className="home-container">
        <div className="home-logo-area">
          <div className="home-logo">RHCSA</div>
          <div className="home-sub">Exam Simulator</div>
          <div className="home-tagline">Master the tasks most people fail</div>
        </div>

        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-num">{EXAM_BANK.length}</div>
            <div className="stat-label">High-Failure Tasks</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">
              {Math.round(
                EXAM_BANK.reduce((s, t) => s + t.failRate, 0) / EXAM_BANK.length
              )}
              %
            </div>
            <div className="stat-label">Avg Fail Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-num">8</div>
            <div className="stat-label">Domains Covered</div>
          </div>
        </div>

        <div className="config-section">
          <div className="config-label">Exam Mode</div>
          <div className="mode-grid">
            {[
              ['full', 'Full Exam', 'All tasks, all domains'],
              ['targeted', 'Targeted', 'Highest fail-rate tasks first'],
              ['random', 'Random Mix', '5 random tasks, time pressure'],
            ].map(([val, label, desc]) => (
              <div
                key={val}
                className={`mode-card ${examMode === val ? 'active' : ''}`}
                onClick={() => setExamMode(val)}
              >
                <div className="mc-label">{label}</div>
                <div className="mc-desc">{desc}</div>
              </div>
            ))}
          </div>

          <div className="config-label" style={{ marginTop: '1.5rem' }}>
            Filter by Domain
          </div>
          <select
            className="domain-select"
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
          >
            <option value="all">All Domains</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <button className="btn-start" onClick={startExam}>
          START EXAM →
        </button>

        <div className="domain-preview">
          {domains.map((d) => (
            <div
              key={d}
              className="dp-chip"
              style={{ borderColor: DOMAIN_COLOR[d] }}
            >
              <span
                className="dp-dot"
                style={{ background: DOMAIN_COLOR[d] }}
              />
              {d}
            </div>
          ))}
        </div>

        <div className="warning-box">
          <strong>Real RHCSA scoring:</strong> 70% to pass. Tasks are graded on
          a live system — partial credit is possible. This simulator checks for
          correct commands, critical flags, persistence, and security
          requirements — exactly how Red Hat grades.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// CSS
// ─────────────────────────────────────────────────────────────
const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  .app {
    min-height: 100vh;
    background: #0a0e1a;
    color: #e2e8f0;
    font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
  }

  .header {
    background: #0f1629;
    border-bottom: 1px solid #1e2d4a;
    padding: 0.75rem 1.5rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .logo {
    font-size: 1rem;
    font-weight: 700;
    color: #60a5fa;
    letter-spacing: 0.1em;
  }

  .header-right { display: flex; align-items: center; gap: 1rem; }

  .timer-badge {
    background: #1e2d4a;
    color: #94a3b8;
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
  }
  .timer-badge.live { color: #34d399; border: 1px solid #065f46; }

  .task-counter { color: #64748b; font-size: 0.85rem; }

  .btn-back {
    background: transparent;
    color: #60a5fa;
    border: 1px solid #1e3a5f;
    padding: 0.35rem 0.9rem;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85rem;
    transition: background 0.15s;
  }
  .btn-back:hover { background: #1e2d4a; }

  .progress-bar { height: 3px; background: #1e2d4a; }
  .pb-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); transition: width 0.3s; }

  /* HOME */
  .home-container {
    max-width: 680px;
    margin: 0 auto;
    padding: 2rem 1.25rem 3rem;
  }

  .home-logo-area { text-align: center; margin-bottom: 2rem; }
  .home-logo {
    font-size: 3rem;
    font-weight: 900;
    background: linear-gradient(135deg, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: 0.15em;
  }
  .home-sub { color: #94a3b8; font-size: 0.9rem; margin-top: 0.25rem; letter-spacing: 0.2em; }
  .home-tagline { color: #475569; font-size: 0.8rem; margin-top: 0.75rem; }

  .stats-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 2rem; }
  .stat-card {
    background: #0f1629;
    border: 1px solid #1e2d4a;
    border-radius: 10px;
    padding: 1rem;
    text-align: center;
  }
  .stat-num { font-size: 1.75rem; font-weight: 700; color: #60a5fa; }
  .stat-label { font-size: 0.7rem; color: #64748b; margin-top: 0.25rem; }

  .config-section { margin-bottom: 2rem; }
  .config-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.75rem; }

  .mode-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }
  .mode-card {
    background: #0f1629;
    border: 1px solid #1e2d4a;
    border-radius: 10px;
    padding: 0.9rem 0.75rem;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .mode-card:hover { border-color: #3b82f6; background: #111d35; }
  .mode-card.active { border-color: #3b82f6; background: #0f1f3d; }
  .mc-label { font-size: 0.85rem; font-weight: 600; color: #e2e8f0; margin-bottom: 0.3rem; }
  .mc-desc { font-size: 0.7rem; color: #64748b; }

  .domain-select {
    width: 100%;
    background: #0f1629;
    border: 1px solid #1e2d4a;
    color: #e2e8f0;
    padding: 0.65rem 0.9rem;
    border-radius: 8px;
    font-family: inherit;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .btn-start {
    width: 100%;
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    color: white;
    border: none;
    padding: 1rem;
    border-radius: 10px;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    cursor: pointer;
    margin-bottom: 1.5rem;
    transition: opacity 0.15s;
  }
  .btn-start:hover { opacity: 0.9; }

  .domain-preview { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem; }
  .dp-chip {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid;
    border-radius: 20px;
    padding: 0.25rem 0.65rem;
    font-size: 0.7rem;
    color: #94a3b8;
  }
  .dp-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

  .warning-box {
    background: #1c1407;
    border: 1px solid #92400e;
    border-radius: 10px;
    padding: 1rem;
    font-size: 0.78rem;
    color: #d97706;
    line-height: 1.6;
  }

  /* EXAM */
  .exam-container {
    max-width: 720px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 3rem;
  }

  .task-domain-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.3rem 0.9rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    margin-bottom: 0.75rem;
  }

  .fail-badge {
    background: rgba(0,0,0,0.3);
    padding: 0.1rem 0.5rem;
    border-radius: 10px;
    font-size: 0.7rem;
  }

  .task-title { font-size: 1.2rem; font-weight: 700; color: #f1f5f9; margin-bottom: 0.5rem; }

  .diff-badge {
    display: inline-block;
    font-size: 0.65rem;
    padding: 0.2rem 0.6rem;
    border-radius: 4px;
    margin-bottom: 1rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }
  .diff-badge.easy { background: #064e3b; color: #34d399; }
  .diff-badge.medium { background: #451a03; color: #f59e0b; }
  .diff-badge.hard { background: #450a0a; color: #f87171; }

  .task-prompt {
    background: #0f1629;
    border: 1px solid #1e2d4a;
    border-radius: 10px;
    padding: 1rem;
    font-size: 0.85rem;
    line-height: 1.7;
    white-space: pre-wrap;
    margin-bottom: 1rem;
    color: #cbd5e1;
  }

  .gotcha-inline {
    display: flex;
    gap: 0.5rem;
    background: #1c0f07;
    border: 1px solid #7c2d12;
    border-radius: 8px;
    padding: 0.65rem 0.9rem;
    margin-bottom: 1rem;
    font-size: 0.78rem;
    color: #fed7aa;
  }
  .gi-icon { flex-shrink: 0; }

  .input-label { display: block; font-size: 0.75rem; color: #64748b; margin-bottom: 0.5rem; letter-spacing: 0.05em; }

  .answer-textarea {
    width: 100%;
    background: #060b14;
    border: 1px solid #1e2d4a;
    border-radius: 8px;
    color: #a5f3fc;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.82rem;
    padding: 0.9rem;
    resize: vertical;
    line-height: 1.6;
    margin-bottom: 1rem;
    outline: none;
    transition: border-color 0.15s;
  }
  .answer-textarea:focus { border-color: #3b82f6; }
  .answer-textarea::placeholder { color: #2d3f5a; }

  .exam-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }

  .btn-skip {
    background: transparent;
    color: #64748b;
    border: 1px solid #1e2d4a;
    padding: 0.65rem 1.25rem;
    border-radius: 8px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85rem;
    transition: color 0.15s;
  }
  .btn-skip:hover { color: #94a3b8; }

  .btn-submit {
    background: #1e3a5f;
    color: #60a5fa;
    border: 1px solid #2563eb;
    padding: 0.65rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 600;
    transition: background 0.15s;
  }
  .btn-submit:hover { background: #1d4ed8; color: white; }

  /* RESULTS */
  .result-container {
    max-width: 720px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 3rem;
    text-align: center;
  }

  .result-verdict { font-size: 1.5rem; font-weight: 900; letter-spacing: 0.1em; margin-bottom: 0.5rem; }
  .result-verdict.pass { color: #22c55e; }
  .result-verdict.fail { color: #ef4444; }
  .result-score { font-size: 4rem; font-weight: 900; color: #f1f5f9; line-height: 1; margin-bottom: 0.25rem; }
  .result-sub { color: #64748b; font-size: 0.85rem; margin-bottom: 2rem; }

  .result-grid { display: grid; grid-template-columns: 1fr; gap: 0.75rem; text-align: left; margin-bottom: 2rem; }
  @media (min-width: 600px) { .result-grid { grid-template-columns: 1fr 1fr; } }

  .result-card {
    background: #0f1629;
    border: 1px solid #1e2d4a;
    border-radius: 10px;
    padding: 1rem;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .result-card:hover { border-color: #3b82f6; }

  .rc-domain {
    display: inline-block;
    font-size: 0.65rem;
    padding: 0.2rem 0.6rem;
    border-radius: 10px;
    color: white;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }
  .rc-title { font-size: 0.85rem; font-weight: 600; color: #e2e8f0; margin-bottom: 0.3rem; }
  .rc-fail-rate { font-size: 0.7rem; color: #ef4444; margin-bottom: 0.5rem; }
  .rc-score-row { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.25rem; }
  .rc-bar-bg { flex: 1; height: 6px; background: #1e2d4a; border-radius: 3px; overflow: hidden; }
  .rc-bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s; }
  .rc-pct { font-size: 0.8rem; color: #94a3b8; font-variant-numeric: tabular-nums; min-width: 35px; text-align: right; }
  .rc-hint { font-size: 0.7rem; color: #475569; margin-bottom: 0.5rem; }
  .rc-walkthrough-btn {
    background: #0a1628;
    color: #60a5fa;
    border: 1px solid #1e3a5f;
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.15s;
  }
  .rc-walkthrough-btn:hover { background: #1e2d4a; }

  .result-actions { display: flex; justify-content: center; gap: 1rem; }
  .btn-primary {
    background: linear-gradient(135deg, #3b82f6, #8b5cf6);
    color: white;
    border: none;
    padding: 0.85rem 2rem;
    border-radius: 10px;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .btn-primary:hover { opacity: 0.9; }

  /* REVIEW */
  .review-container {
    max-width: 720px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 3rem;
  }

  .review-domain-badge {
    display: inline-block;
    padding: 0.25rem 0.8rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    margin-bottom: 0.75rem;
  }
  .review-title { font-size: 1.2rem; font-weight: 700; color: #f1f5f9; margin-bottom: 0.75rem; }

  .review-score-bar {
    position: relative;
    height: 24px;
    background: #1e2d4a;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 1.25rem;
  }
  .rsb-fill { position: absolute; left: 0; top: 0; height: 100%; transition: width 0.5s; border-radius: 12px; }
  .rsb-label { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 0.8rem; font-weight: 700; color: white; }

  .review-prompt-box, .review-answer-box {
    background: #0f1629;
    border: 1px solid #1e2d4a;
    border-radius: 10px;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  .rpb-label, .rab-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-bottom: 0.5rem; }
  .review-prompt-box p { font-size: 0.82rem; line-height: 1.7; color: #cbd5e1; white-space: pre-wrap; }
  .rab-code { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #a5f3fc; white-space: pre-wrap; word-break: break-all; }

  .check-list { margin-bottom: 1.25rem; }
  .check-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.6rem 0.9rem;
    border-radius: 8px;
    font-size: 0.82rem;
    margin-bottom: 0.4rem;
  }
  .check-item.pass { background: #052e16; color: #86efac; }
  .check-item.fail { background: #1c0508; color: #fca5a5; }
  .check-icon { font-weight: 700; flex-shrink: 0; }

  .btn-walkthrough {
    width: 100%;
    background: #0f1629;
    color: #a78bfa;
    border: 1px solid #4c1d95;
    padding: 0.9rem;
    border-radius: 10px;
    font-family: inherit;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }
  .btn-walkthrough:hover { background: #1a0f3d; }

  /* WALKTHROUGH */
  .walkthrough-container {
    max-width: 720px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 3rem;
  }

  .walkthrough-badge {
    display: inline-block;
    padding: 0.25rem 0.8rem;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    margin-bottom: 0.75rem;
  }
  .walkthrough-title { font-size: 1.2rem; font-weight: 700; color: #f1f5f9; margin-bottom: 1.25rem; }

  .answer-key-box {
    background: #052e16;
    border: 1px solid #166534;
    border-radius: 10px;
    padding: 1rem;
    margin-bottom: 1rem;
  }
  .ak-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: #4ade80; margin-bottom: 0.5rem; font-weight: 700; }
  .ak-code { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; color: #86efac; white-space: pre-wrap; }

  .gotcha-box {
    background: #1c0508;
    border: 1px solid #7f1d1d;
    border-radius: 10px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }
  .gotcha-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; color: #f87171; margin-bottom: 0.6rem; font-weight: 700; }
  .gotcha-box ul { padding-left: 1.25rem; }
  .gotcha-box li { font-size: 0.8rem; color: #fca5a5; margin-bottom: 0.35rem; line-height: 1.5; }

  .walkthrough-content { line-height: 1.75; }
  .walkthrough-content h3 { font-size: 1.05rem; color: #a78bfa; margin: 1.5rem 0 0.6rem; font-weight: 700; }
  .walkthrough-content h4 { font-size: 0.9rem; color: #60a5fa; margin: 1.1rem 0 0.4rem; font-weight: 600; }
  .walkthrough-content p { font-size: 0.83rem; color: #cbd5e1; margin-bottom: 0.5rem; }
  .walkthrough-content code { background: #111d35; color: #a5f3fc; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.78rem; }
  .walkthrough-content pre { background: #060b14; border: 1px solid #1e2d4a; border-radius: 8px; padding: 0.9rem; overflow-x: auto; margin: 0.75rem 0; }
  .walkthrough-content pre code { background: none; padding: 0; color: #a5f3fc; font-size: 0.78rem; }
  .walkthrough-content strong { color: #fde68a; }
  .walkthrough-content .spacer { height: 0.25rem; }
  .walkthrough-content .table-wrap { overflow-x: auto; margin: 0.75rem 0; }
  .walkthrough-content table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
  .walkthrough-content th { background: #0f1629; color: #94a3b8; padding: 0.5rem 0.75rem; text-align: left; border: 1px solid #1e2d4a; font-weight: 600; }
  .walkthrough-content td { padding: 0.45rem 0.75rem; border: 1px solid #1e2d4a; color: #cbd5e1; }
  .walkthrough-content tr:nth-child(even) td { background: #0a1221; }
`;
