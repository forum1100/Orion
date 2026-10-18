# DT Export / Live-Capture Reconciliation

Purpose: validate whether DT_CLOSEOUT and future live-capture storage reproduce the observable conversation record contained in an official ChatGPT export.

## Identity rule

Location is not identity. A conversation, message, or Drive artifact may move, be renamed, or be assigned to a project without becoming a new underlying object.

Primary identity evidence, in descending preference:

1. conversation_id
2. message_id / node_id
3. parent node or parent message identity
4. stable provider file ID
5. content hash plus timestamp/lineage evidence

Project name, folder path, title, and filename are mutable observations and must never be used alone as canonical identity.

## Validation role of the official export

The next official ChatGPT export is a validation oracle, not the intended storage mechanism. Live capture passes only to the extent that it can be reconciled against that export without silently filling gaps.

## Required comparison

For each observable exported message, compare conversation identity, node/message identity, parentage, role, timestamp, content hash, and ordering. Separately compare conversation-level title/project/location observations.

Classify every mismatch as one of: MISSING_LIVE_CAPTURE, EXTRA_LIVE_CAPTURE, CONTENT_MISMATCH, PARENTAGE_MISMATCH, ORDERING_MISMATCH, METADATA_MOVEMENT, SOURCE_UNAVAILABLE, or INTENTIONALLY_EXCLUDED.

Hidden internal reasoning is not a required verbatim-capture target unless the product actually exposed it to the user. Observable reasoning recaps or other user-visible UI events may be retained when present in the official source.

## Movement ledger

Every observed move or rename is append-only. A later location does not erase an earlier one. Store previous and new locations, source generation, timestamp, stable identity, before/after hashes when available, and the evidence that supports the event.

## Pass condition

Do not call live decentralized capture validated merely because a transcript looks similar. Validation requires an explicit reconciliation report, unresolved residual list, and a measured match rate against an official export generation.