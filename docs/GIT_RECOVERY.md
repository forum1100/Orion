# Git recovery and failed-push inventory — September 8 onward

**Work in progress / non-destructive investigation.** Do **not** import the full E: checkout or bundle into this public repository until a path-by-path privacy, secret and license audit is completed. Do not alter its Git metadata, force-push, reset or remove branches. GitHub publication and local Orion runtime are separate systems.

## Observed 2026-10-18
- Public repositories available to authenticated owner: `forum1100/DT-Desktop-Suite`, `forum1100/Distel-Theory-Research`, `forum1100/Orion`.
- Current on-disk historical source checkout: `E:\Orion\Source\DT-Desktop-Suite`. Git invocation required a **one-command** safe-directory exception on a filesystem that does not record ownership; no global trust change was required.
- Local historical source `main` HEAD **d6a4448**, dated 2026-10-10, subject: `feat(orion): add owner-private Google Drive Office provider and release gate`.
- Local branch output contained numerous `feature/orion-*` and `orion-improve/*` lines; many are worktree-marked `+`, not proof of a successful network push. A separate enumeration and worktree inspection is required to count unique lines correctly.
- `git remote -v` displayed no configured remote in this inspected checkout. Absence of a current remote does not establish what earlier remote was used or whether pushes succeeded.
- `git status --short -uno` reported 53 lines on this checkout when inspected; the number is not a count of all untracked changes.
- Examples of preserved development commits: `bfb355c` (GitHub transport retirement), `ae37ba0` (fluid 3D SelfGraph), `a728531` (Perception Point lineage), `d245a33` (durable candidate reassessment), `20e257f` (standing grant utility), `7b43713` (live learned skills graph), `d6a4448` (Drive Office release gate). Their presence does NOT prove public pushes or deployed software.
- Historical cross-chat records report September 22 `94103348...` baseline, 102/102 tests, and some unverified mirrors; October 10 later staged isolated test receipts, and failed-preserved operations. They require comparison with actual local refs and GitHub remote commits.

## Classification table (never guess)
| Label | Evidence required |
|---|---|
| REMOTE_CONFIRMED | named commit reachable on authenticated remote, including SHA and date |
| LOCAL_ONLY | actual local commit/branch exists, not reachable from inspected remote(s) |
| PUSH_REJECTED | dated command/stdout/stderr or provider response shows attempted push rejection |
| PUSH_SUCCESS_UNVERIFIED | historical assistant or AI claims push succeeded but remote readback missing |
| DIVERGED | both histories present and different; neither side force-overwritten |
| FAILED_PRESERVED | code candidate failed test/qualification or recorded execution—not necessarily push |
| UNKNOWN | insufficient logs or no original remote identity |

## Investigation order
1. Record repository names, current remotes, `git worktree list`, `git branch -avv`, tags, reflogs and pack integrity **read-only**; save a machine-readable inventory including timestamps and SHA.
2. List GitHub remote refs/commits across the public historical `DT-Desktop-Suite` repository, the research repository and any earlier known remote. Record the exact remote, not inferred branch aliases.
3. Match SHAs via reachability queries; audit historical push stderr/logs where available. A commit existing locally and remotely may have been pushed at a different date.
4. Recover historical failed command lines from owner-authorized logs, Drive receipts and per-agent records. Retain raw evidence privately; publish only sanitized ledger entries.
5. Classify each orphaned branch by diff, tests, dependency, security/privacy and migration provenance; review in isolated worktrees. Preserve rejected branches even when no longer promoted.
6. Migrate approved source onto a **new GitHub review branch**; do not reset current `main`, rewrite prior history or silently merge.
7. Track residuals in this registry until each source is verified and dispositioned.

## Why this matters
The local historical Git graph and the public research replay packs are different things. Not every past commit is a simulation result, and not every failed *code* branch was a failed *network push*. This distinction protects accurate attribution and reconstructs the real timeline.


## Read-only graph comparison completed on 2026-10-18
The public DT-Desktop-Suite remote `main` points to `94103348b7402056de64f10fe86826562d9b9363`. The local E: main is `d6a4448d615b5c50a2c0b7c800b65bae8c8733c6`. A direct `git merge-base --is-ancestor` returned **exit code 0**, confirming that the September remote baseline is an ancestor of the October local checkout. `git rev-list --count 94103348..d6a4448` returned **26 local mainline commits beyond the public remote baseline**. This does **not** prove that all 26 were historically attempted as pushes or that none exist under another remote/branch.

The same local scan found **96 local branches** and **102 listed worktrees**. A worktree/branch is a local Git record, not automatically an execution receipt or a published branch. The public `Orion` repository itself was newly created October 18 and has a separate history; importing a whole older Git graph without review could reveal personal/private data and create merge ambiguity.

**Priority next forensic artifact:** generate a read-only, source-linked map of 26 mainline commits, 96 branch refs, worktree state, historical remote attempts and failed-push logs. Save the full unredacted recovery manifest in access-controlled custody, with only a sanitized public manifest after review.
