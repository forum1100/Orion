# Component dictionary — what, why, owner, proof

Status in this document = **architecture function**, NOT blanket runtime verification. A separate evidence table is required before any component is labeled live.

| Component | Ordinary-language job | Why this way? | Evidence necessary before live claim |
|---|---|---|---|
| Owner Root | Person's top-level authorization | AI text cannot manufacture permission | verified local owner-root proof |
| Protected Supervisor | Central permission/integrity referee | separates clever ideas from authorized actions | deny/allow tests with signed policy |
| Crypto/Integrity Engine | verify identity and file hashes | defend against changed files/forged identity | real signature verification/negative tests |
| Event Ledger | chronological account of actions | later reviewers can reconstruct causality | append/readback, tamper/replay tests |
| IPC Broker | messages between parts | decouple modules, bound privileges | authenticated queues and receipts |
| Capability Bus | permissions on concrete tools | a model may read without being allowed to write | scoped action/expiry/denial tests |
| Orion TaskEngine | persist, assign and resume work | do not rely on ChatGPT timer prompts | queue/restart/checkpoint receipts |
| Chapter / Office | grouping for specialty work | scalable delegation without one giant assistant | registry and scoped assignments |
| TKE Pledge | an accountable agent doing a task | independently trace who did what | worker identity/action receipt |
| Scroll | persistent agent identity and lineage | process restarts must not erase history | durable state + resurrection tests |
| Agent Foundry | register/birth subordinate agents | accountable delegation instead of ghost agents | lineage, supervisor scope, audit |
| Librarian | retrieve, contextualize and file sources | memory is not only a model context window | retrieval fidelity, original linkage |
| Memory Convergence | merge related context without rewriting originals | reuse knowledge while retaining differences | false merge and contradiction tests |
| Perception Point | store a meaningful intermediate state | preserve branching without derailing the task | typed record + source/next action |
| Frozen Moment | what actor knew at a past instant | stop hindsight editing historical choices | actor-time state & source snapshot |
| Branch Registry | retain successful, failed and alternative paths | failed branches explain limits | full disposition + residual |
| Guardian | independent watchdog/recovery system | protect against an Orion process failure | observed independent process + recovery exercise |
| Sandbox | isolated place for proposed execution | evaluate without altering live state | no escape/resource tests |
| Resource Governor | limits CPU/GPU/IO/memory and time | agent growth cannot exhaust the computer | measured enforcement tests |
| Evolution/Validation | compare new implementation with known baseline | avoid self-fulfilling upgrades | reproducible negative and positive tests |
| Upgrade Candidate | proposed code/config revision | a passing candidate isn't installed | qualification IDs + diff + receipts |
| OrionSelfGraph | machine-readable model of real Orion state | introspection and visualization share evidence | rebuild from event ledger & checkpoints |
| Fluid 3D Brain | interactive presentation of that real graph | help users inspect operations and relationships | exact node-to-source mapping |
| Orion History | causal archive of recorded work | preserve event provenance and revisions | archived receipts & source pointers |
| DT_CLOSEOUT / safe mode | archive a recoverable handoff | avoid context loss on chat rollover | append/readback with no runtime disruption |
| HTI (historical proposal) | high-authority emergency interrupt | emergency safety is distinct from archiving | live distributed stop/recovery validation |
| Provider adapter | bridge to Gemini/Grok/ChatGPT/local model | no vendor controls the whole platform | attributed inputs/outputs and access checks |
| Drive port | remote durable storage interface | Google Drive remains available without GitHub | full byte readback/hash/permissions |
| GitHub publication port | optional public source collaboration | freely inspectable source and review | clean/sanitized commit + attributable PR |

**Key caution:** Google clipboard's seven snippets (telemetry, client proxy, HTI, x86 handshake, C memory locker, NumPy memory, numeric solver) were explicitly historical experimental extracts **not production-ready code**. They must be routed into the right subsystem and independently reviewed before execution.
