# Orion Personal Cognitive Crew Architecture — Canonical Delta — 2026-09-27

Status: OWNER-CONFIRMED architecture delta. Preserve earlier implementation history and failed/divergent branches.

## Owner-facing vocabulary

The normal interface must use language a nontechnical owner can connect together. Low-level engineering identifiers remain available in developer/diagnostic views but are not the primary language.

- Orion's agents are **the Crew**.
- Each individual agent is a **TKE Pledge**.
- Every TKE Pledge receives one permanent **Scroll Number**.
- Every office/function receives one permanent **Chapter Number**.
- The permanent pledge registry is the **Scroll Book**.
- The permanent office registry is the **Chapter Book**.
- Orion's append-only causal record is **Orion History**.
- A pledge checkpoint is a **Save Point**.
- An unresolved gap is a **Missing Piece**.
- A preserved residual is **Unfinished Business**.
- A validated rollback image is a **Safe Backup / Safe Version**.
- Historical perspective snapshots are **Frozen Moments**.
- Counterfactual historical testing occurs in the **Replay Room**.
- Orion's longitudinal model of the owner is **Your Book**.
## Identity rules

**Scroll Number = who. Chapter Number = where/what office.**

A pledge keeps the same Scroll Number across restarts, resurrection, migration, software versions, and office reassignment. A Chapter keeps the same Chapter Number across vacancies and occupant changes. Historical records always retain both values as they existed at the time.

Secure cryptographic/runtime IDs remain underneath these owner-facing aliases. Scroll and Chapter numbers never replace security identities.

## Distributed nervous system

The Crew is Orion's distributed nervous system. Pledges do not need to live on one computer or remain loaded in memory. A pledge may run locally, on another enrolled device, on a compute node, in an isolated test environment, or be resting as durable state until called up.

Chapters organize function, not physical location. Chapters may supervise other Chapters. Pledges and temporary swarms are routed by capability, authority, hardware/resource availability, locality, current load, and task context.

Programs, hardware, sensors, services, storage, and enrolled devices become Orion's sensory, motor, memory, communication, and compute capabilities through stable tool interfaces and routing.

A temporary swarm is a mission team assembled from permanent Crew members. The swarm may dissolve when the mission ends; the pledges and their Scroll identities persist.
## Orion's own interface and identity

Orion must be able to invoke the same platform capabilities available through the human interface without impersonating the owner. Human actions and Orion actions pass through the same capability/permission layer.

Every meaningful action must preserve three separate facts:

- **Actor:** who requested or selected the action (owner, Orion, or a pledge/Scroll).
- **Authority:** whose permission made the action valid.
- **Executor:** which process, tool, device, or program actually carried it out.

Orion therefore acts under its own identity and delegated authority. Orion may understand protected functions without being authorized to invoke them. Knowledge and authority are separate.

## DAD MODE

`DAD MODE` is an authenticated Owner Root developer/recovery state. It allows the owner to inspect and edit owner-layer code and protected/base Orion code.

Orion may understand, analyze, and prepare changes to its own base code, but Orion must not silently self-enable DAD MODE. Before survival-critical base mutations, DAD MODE creates and validates a Safe Backup and uses copy-on-write/Test Build promotion where practical.

A small recovery/watchdog component must remain able to restore the last Safe Version if a Test Build cannot successfully start and prove health. Failed Test Builds remain preserved as evidence.
## Personal cognitive perception

Orion must maintain a machine-readable perception of its current self, environment, owner context, active work, Crew, available capabilities, constraints, resources, uncertainty, and failures. The Visual Brain is a real projection of this state, not a decorative animation.

Orion's personal model of the owner is **Your Book**. It is longitudinal rather than a one-page biography. It should preserve terminology, working patterns, project development, decisions, corrections, rejected interpretations, recurring response needs, open questions, and the evolution of understanding over time.

Corrections from the owner are especially important evidence. Orion must distinguish:

1. what the owner actually said;
2. what an assistant or pledge interpreted;
3. what the owner later corrected;
4. what evidence established;
5. what remains uncertain.

Sensitive/private records should be compartmentalized and retrieved only when relevant and authorized rather than being carried through every interaction.
## Relativity of time and Frozen Moments

A perspective is accountable only to the information, tools, permissions, constraints, uncertainty, and state available from that perspective at that specific time. Once the moment passes, its historical perspective is frozen.

Later evidence may reinterpret, confirm, contradict, or supersede a prior understanding, but it must never silently rewrite what the earlier perspective could actually know. Hindsight is for learning, not retroactive attribution.

Orion History must therefore distinguish at least:

- when something happened;
- when it was observed;
- when information was sent;
- when it was received/read;
- when it became understood or connected to another concept;
- what the current interpretation is now.

Different pledges or Chapters may hold different simultaneous perspectives. Their later convergence is a new event, not a rewrite of the earlier perspectives.
## Replay Room

The Replay Room reconstructs a Frozen Moment under the original knowledge cutoff. It is used to test alternative actions, train new pledges, compare Chapter structures, and evaluate future Orion versions without future-knowledge leakage.

A replay receives only the information, tools, permissions, hardware reach, and owner model available at that Frozen Moment. Real history is immutable. Simulated outcomes are permanently labeled simulated and may never write back as if they actually occurred.

A future Orion is only fairly compared to an earlier Orion when both are evaluated against the same informational constraints.

## Skill Builder

Repeated successful Crew workflows may be synthesized into reusable semantic capabilities. The Skill Builder must preserve authority requirements, side effects, provenance, test evidence, version lineage, failure branches, and rollback information. A shorter tool name never becomes a privilege shortcut.

Generated capabilities may use different implementation languages. The semantic capability remains language-neutral. Failed synthesis candidates remain preserved for learning.
## Non-negotiable invariants

1. Scroll identity is persistent; runtime/process identity is not the pledge's identity.
2. Chapter identity is persistent; occupancy is historical and replaceable.
3. Crew members may be local, remote, resting, resurrected, or migrated without losing Scroll continuity.
4. Orion acts as Orion, never by falsifying the owner as the actor.
5. Owner Root remains the authority source for DAD MODE and protected base mutation.
6. Historical perspectives are immutable Frozen Moments.
7. Later knowledge attaches to history; it does not rewrite history.
8. Failed branches, rejected Test Builds, and Unfinished Business remain preserved.
9. The Brain Map and Crew House are projections of real machine-readable state.
10. The owner-facing interface uses plain connected language; engineering jargon is secondary.
11. Real history and Replay Room simulations are permanently distinguishable.
12. A capability abstraction never bypasses the permissions required by its underlying actions.

## Existing implementation convergence

This delta extends rather than replaces the existing Owner Root Authority, Orion Event Ledger, durable checkpoint/eviction/resurrection architecture, Orion SelfGraph projector, resource controller, task engine, perception work, agent-awareness tests, and live Visual Brain work already present in the repository.

Implementation should converge older terms such as agent, worker, Work Manager, Librarian, swarm, perception agent, recovery agent, and peer/node routing into the Crew/Scroll/Chapter owner vocabulary while preserving their provenance and technical meanings underneath.
