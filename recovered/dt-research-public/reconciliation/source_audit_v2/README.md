# DT_CLOSEOUT source reconciliation v2

This is an additive source audit, not a replacement for the historical archive or earlier audit ledger. The six verified Generation-2 members are the authoritative baseline for this batch.

Run `python reconcile_closeouts.py <source-directory> <private-archive-directory> --output <private-report.json>`. The source directory must contain all six `conversations-000.json` through `conversations-005.json`. The script compares native identifiers, parentage, timestamps, roles, content types, observable UTF-8 text, stored metadata, and stored native content. It reports selected-chain structural omissions, off-branch nodes, hidden-node omissions, and native-content gaps separately.

Run `python recover_recaps.py <conversations-004.json> <original-69fbc4e7-archive.jsonl> <new-private-recovery-directory>` to reproduce the seven-record recovery. This exact-target operation verifies both immutable source hashes and the original raw record hashes, writes a new patch and manifest, and tests an in-memory overlay. It never overwrites the original archive or exposes hidden thoughts. Existing differing outputs cause failure.

The old ledger's five supposed normalization differences in 6a00d980 are superseded by direct field comparison: all 28 observable strings and their stored metadata agree. The 69fbc4e7 gap is real and is labeled a source recovery, not independent-capture success. The remaining work includes full historical inventory, native media custody, live suffixes, and a pre-Export6 cumulative freeze. Do not promote this batch into a global completion certificate.

Private payloads and recovery files remain outside public GitHub. See the machine-readable v2 ledger for hashes, record counts, residuals, and the original-archive preservation status.
