# RHCSA Exam Simulator

An interactive web-based simulator for practicing the Red Hat Certified System Administrator (RHCSA) exam. It focuses on the tasks that candidates most commonly fail, with instant grading, detailed walkthroughs, and explanations of common pitfalls.

## Features

- **12 high-failure tasks** spanning 8 RHCSA domains
- **Instant grading** with per-check pass/fail breakdown
- **Detailed walkthroughs** with answer keys, common traps, and step-by-step explanations
- **Three exam modes:**
  - **Full Exam** — all tasks across all domains
  - **Targeted** — highest fail-rate tasks first
  - **Random Mix** — 5 randomly selected tasks under time pressure
- **Domain filtering** — practice specific areas
- **Live timer** — tracks how long you take, just like the real exam
- **70% pass threshold** — matches real RHCSA scoring

## Domains Covered

| Domain | Tasks |
|--------|-------|
| Essential Tools | SUID file search, tar archiving |
| Users & Groups | User creation with UID/groups, collaborative directories with SetGID & ACLs |
| Storage | LVM logical volumes, persistent swap |
| SELinux | File context restoration, non-standard ports |
| Networking | Static IP with nmcli |
| Scheduled Tasks | systemd timers |
| Boot & Recovery | Root password reset via rd.break |
| Containers | Rootless Podman as a systemd service |

## Tech Stack

- React 19 + TypeScript
- Vite
- No external dependencies — everything runs in the browser

## Getting Started

```bash
npm install
npm run dev
```

Then open the URL shown in your terminal.

## Build

```bash
npm run build
```

The production build is output to `dist/`.

## How Grading Works

Each task has a custom grader that checks your answer for the correct commands, critical flags, persistence requirements, and security best practices — exactly how Red Hat grades on the real exam. Partial credit is awarded per check.

## License

MIT
