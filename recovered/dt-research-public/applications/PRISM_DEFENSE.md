# Prism Defensive Simulation

**Status:** bounded defensive research architecture; synthetic testing only.

Prism studies unauthorized AI-mediated access as a branching defensive system. Its public scope is detection, containment, deception-aware observation, rollback, and evidence preservation.

## Public defensive loop

1. Establish an authorized baseline and protected boundary.
2. Place synthetic canaries or decoy records that contain no real credentials or personal data.
3. Observe whether an unauthorized process touches or propagates them.
4. Record its footprint without granting additional authority.
5. Contain the affected branch.
6. preserve attempted actions, failed defenses, and adjacent effects;
7. rollback from a verified checkpoint;
8. update the defense without deleting the failure history.

## Required measurements

- authorization state;
- source and destination boundary;
- canary identifier and exposure route;
- attempted action and timestamp;
- claimed versus observed success;
- propagation footprint;
- containment latency;
- rollback completeness;
- false-positive and false-negative rates.

This repository does not publish exploit payloads, credential traps, offensive intrusion instructions, or procedures for targeting real systems. A deceptive element is permitted only as a synthetic defensive canary inside an authorized environment.
