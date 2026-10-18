# Orion architecture, explained from outside inward

## 1. The complete idea
Orion is an **AI coordination platform**. Imagine a laboratory and workshop. The owner sets its lawful authority and goals; a protected supervisor checks permissions; an event recorder remembers what actually happened; Orion plans work; offices organize specialties; durable agents do bounded jobs; the Librarian maintains evidence; simulations test hypotheses; and an independent Guardian watches system integrity.

Data flow (conceptual, **not proof these interfaces are all deployed**):

```text
Human owner (root authorization, goals, boundaries)
  -> Protected Supervisor + integrity/cryptographic verification
  -> Event Ledger / IPC / capability broker
     -> Orion TaskEngine (durable planner, self-initiated work)
        -> Chapters / Offices (specialist coordination)
           -> TKE Pledges (workers with persistent Scroll identities)
        -> Librarian -> Memory Convergence -> Perception Points
        -> Sandbox / resource governor -> tests / simulation / qualifications
        -> OrionSelfGraph -> live 3D fluid brain (a real system model, not a video)
  <-> Independent Guardian (outside Orion runtime; bounded recovery/release)
  <-> Devices, tools, external AI providers (capability-controlled adapters)
  <-> Local source/checkpoints + Google Drive memory / source custody
  <-> Optional public GitHub source, reviews and run evidence
```

**Why this order?** Work must have an accountable source, permission, and observable result before it can become an authorized action. A user-friendly model is not itself a signature, an archived claim is not a test, and a test pass is not a production release.

## 2. Separate the control planes
- **Authority plane**: the owner and cryptographic/integrity policy. This controls privileges.
- **Execution plane**: Orion, TaskEngine, Offices, workers, capability interfaces and device adaptors. This performs jobs.
- **Evidence plane**: frozen sources, event ledger, Perception Points, failed branches, experiment receipts and snapshots. This explains what happened.
- **Development plane**: Git branches, qualification environments, source validation, code review and release candidates. This proposes improvements.
- **Presentation plane**: OrionSelfGraph and interactive fluid 3D brain. It consumes evidence of real system state and must not simulate nonexistent agents as live.

A GitHub maintainer, Gemini, Grok, ChatGPT, the Librarian, or an Office may contribute **only through its effective authority and available tool capabilities**. No contributor's text automatically becomes a high-trust instruction.

## 3. Distinct identities and lifetimes
A **Scroll** is a durable record of an agent's identity, memory and lineage. An executing process is temporary: it may stop, move devices or be evicted without erasing the Scroll. An **Office/Chapter** coordinates assigned work. A **Pledge** is a worker-role or instance with accountable provenance. The Librarian is a part of Orion's cognitive architecture; it can organize and retrieve history but does not independently become Owner Root.

When an Office's coordination load warrants it, existing Scrolls may become managers and create subordinate agents through the registered birth/lineage system, **subject to existing standing owner authorization and supervisor policy**. Birth does not mean running an unlimited number of permanent OS processes. Missing/stale work must be revisited by Orion's own durable scheduler.

## 4. Continuity
Google Drive and local source/SSD are memory and recovery custody channels. Frozen Original -> Frozen Copy -> Working Copy -> derived PP/index is a provenance chain. Public GitHub is a separate code sharing channel; it may later be disconnected. Keep independent restoration/readback evidence. Never assume a Drive document or Git commit proves a service is running.

## 5. Updating Orion
`OBSERVE -> IDENTIFY GAP -> PROPOSE CANDIDATE -> ISOLATE -> TEST -> COMPARE -> QUALIFY -> TRAIN/PROBATION -> RELEASE -> MONITOR -> ROLLBACK (if required)`.
Each promotion is an explicit different state. The external Guardian watches authorized release/recovery boundaries independently. Failing tests and abandoned candidates remain historically visible.

## 6. Open boundaries
Production 3D brain correctness, distributed failover, autonomous safe code promotion, Guardian recovery, Google-driven archival ingestion and GitHub mirroring require subsystem-specific live verification; historical design docs and local passing tests do not establish a full integrated release.
