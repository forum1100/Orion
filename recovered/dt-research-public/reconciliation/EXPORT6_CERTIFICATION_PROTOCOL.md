# Export 6 Certification Protocol

## Purpose
Export 6 is a validation oracle, not the primary archive.
The live capture must be frozen before the official export is ingested.
The test asks whether independently captured observable conversation history can be reconstructed faithfully.

## Freeze Rule
1. Define a certification interval before requesting Export 6.
2. Freeze the live append-only capture for that interval with a SHA-256 inventory.
3. Freeze DT_CLOSEOUT and Perception Point manifests covering the same interval.
4. Record current conversation/project titles and known move events separately from identity.
5. Do not backfill live records from Export 6 before comparison.

## Stable Identity
Primary keys: conversation_id, message_id, node_id where available.
Mutable metadata: title, project membership, folder path, filename, display location.
A move or rename is not a delete/recreate event unless stable identity or payload evidence supports that conclusion.

## Required Record Classes
- visible_user
- visible_assistant
- observable_reasoning_recap
- tool/event metadata when exposed and intentionally captured
- excluded_hidden_internal, represented by structural metadata only when knowable

## Certification Outputs
The comparator must emit exact matches, omissions, extras, content mismatches, parentage mismatches, role mismatches, and movement-only differences.
No unexplained mismatch may be silently collapsed into a summary.

## Pass Criteria
A pass requires 100% disposition coverage for official-export observable messages in the frozen interval.
Every official message must be EXACT_MATCH or have an explicit, evidence-backed residual classification.
A high percentage alone is insufficient if unexplained omissions remain.

## Residual Classes
- MISSING_LIVE_CAPTURE
- EXTRA_LIVE_CAPTURE
- CONTENT_MISMATCH
- PARENTAGE_MISMATCH
- ROLE_MISMATCH
- ORDERING_MISMATCH
- BRANCH_SELECTION_DIFFERENCE
- METADATA_MOVEMENT_ONLY
- INTENTIONALLY_EXCLUDED
- SOURCE_UNAVAILABLE

## Independence Rule
Export 6 may close residuals after comparison, but it may not retroactively convert a failed pre-export live capture into a passing one.
The pre-export hash inventory is the immutable test specimen.

## Successor Architecture
After certification, routine continuity should use append-only live capture plus replicated storage and movement/provenance ledgers.
Official ChatGPT exports become periodic audits and disaster-recovery evidence rather than the ordinary continuity mechanism.