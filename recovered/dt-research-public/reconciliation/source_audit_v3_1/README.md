# DT_CLOSEOUT source audit — v3.1

Universal subject scope. These tools audit a supplied canonical export; they do not access every live ChatGPT event or implement a continuous capture service. They use only Python's standard library. All raw sources and private outputs must remain outside the public repository.

## Verified baseline
The six Generation-2 working shards are individually SHA-256 verified. Their parent ZIP binding is unresolved. The full source index contains 581 conversations and two preserved non-conversation entries. The inventory uses exact raw byte spans, not reserialized copies. The v3.1 scanner handles all JSON value types; regression against the six shards reproduced all 583 original objects and byte spans unchanged.

## Running
Use a private directory containing conversations-000.json through conversations-005.json. Run `python build_source_inventory.py SOURCE_DIR PRIVATE_OUTPUT_DIR` to inventory every subject and all mapping branches. Run `python reconcile_closeouts_v3.py SOURCE_DIR ARCHIVE_DIR --output PRIVATE_REPORT.json` and `python audit_native_coverage.py SOURCE_DIR ARCHIVE_DIR PRIVATE_OUTPUT_DIR` to audit historical archives. Run `python recover_observable_v3.py SOURCE_MEMBER.json ORIGINAL_ARCHIVE.jsonl PRIVATE_RECOVERY_DIR` only after reviewing the source identity and original archive. Run `python build_asset_reference_index.py --help` for its exact input contract. Run `python -m unittest discover -s . -p test_source_audit_v3.py -v` for the synthetic regression suite.

## Custody and limits
Text equality is not native-content equality, attachment-byte custody, or evidence of independent live capture. Preserve source metadata, native content types, roles, parent/child topology, off-chain records, source identities, and source-available attachments. Hidden internal reasoning is not copied or reconstructed. Observable reasoning recaps are preserved. All recovery is append-only with original archive hashes and must pass Librarian review before canonical promotion. A source-only recovery closes an availability gap but does not erase the independent-capture failure. Never backfill the frozen expected-export snapshot before comparison. Do not publish personal material, credentials, or private correspondence.

The v3.1 parser correction is a tooling fault fix; it does not change historical source payloads or the previously recorded audit results. Five synthetic tests pass. The ten-closeout historical scope remains a partial corpus audit, not a global completion certificate. The existing v2 files and receipts remain intact.
