# Multi-AI collaboration and provenance standard

## Intended outcome
ChatGPT, Gemini, Grok, Orion's internal agents, and human contributors must be distinguishable in public Orion development: **who proposed a change, what and where, why, what ran, and which authority actually approved/pushed it**.

## Four identities, never collapsed
1. **Proposer** — claimed model/service/person who composed the change; specify provider and model if known. This is self-attested unless independent logs corroborate.
2. **Executor** — local tool/agent environment that wrote files or ran tests; an identity with a real process and execution receipt.
3. **Git committer** — the GitHub identity whose credentials pushed the commit. Git author strings alone are editable and do not authenticate model origin.
4. **Reviewer/promoter** — authorized owner/supervisor or scoped review service responsible for qualification/release decision. A comment cannot substitute for signing authority.

## Branch and file organization
Use `ai/<provider>/<work-id>`, `orion/<office>/<work-id>`, or `human/<handle>/<work-id>`. Each nontrivial change includes a JSON record under `contributions/<work-id>.json` following `schemas/contribution.schema.json`. One contributor may have multiple commits on a branch; attach hashes and parent commits after execution.

For GitHub-origin collaboration use PRs to `main` with reviewable diff, a clear description, tests and evidence links. Do not share a universal PAT among models or embed tokens in prompts, issues, commits or Docs. Grant GitHub privileges to real accounts or narrowly scoped approved apps; each provider must use its own attributed agent identity. Without an authenticated access channel, providers may supply patch text or PR suggestions for the owner to apply. **No claimed AI identity alone establishes authentication.**

## Manifest minimum
`contribution_id, provider, model, proposer_kind, actor_identity_class, task_id, timestamp, purpose, source_refs, changed_paths, expected_behavior, implementation_status, tests, observations, failures, commit_sha, reviewer_status, approval_proof_ref`.

Terms:
- `expected_behavior` = prediction BEFORE executing;
- `observations` = recorded runs after executing;
- `failures` = unhidden failed and incomplete attempts;
- `approval_proof_ref` = reference to separately scoped permission, **never** raw secret;
- `commit_sha` and `run_hash` = observable version/evidence identifiers, not scientific proof.

## Review/promotion lifecycle
`PROPOSED -> REVIEWABLE -> TESTED_ISOLATED -> QUALIFIED -> TRAINING -> OWNER_APPROVED_RELEASE -> DEPLOYED_VERIFIED`. Failure at a gate yields `FAILED_PRESERVED`, `BLOCKED` or `ROLLED_BACK` with a linked residual. Model applause, source texts, and simulated tests never skip gates.

## Example three-provider session
Gemini proposes a numerical variant on `ai/gemini/constraint-demo-001` with `provider=google`. Grok reviews and runs an independent negative test under its own contribution ID. ChatGPT documents the result under `ai/chatgpt/explain-001`. The owner-authorized account reviews PRs. Each model's analysis remains distinct; one merged artifact may cite all three without pretending they formed a single untraceable speaker.

## Scope limitations
No actual Gemini/Grok repository authentication, auto-sync, hosted bot, model API key, payment integration or working continuous integration is established by these documents. GitHub Actions is disabled to avoid unapproved costs. Google Drive remains original/memory custody. A successful public PR does not alter the running Orion or Guardian.
