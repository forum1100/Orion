# Zero-surprise-cost policy

**Owner decision — 18 October 2026.** Orion is free to use, including commercial use; donations are voluntary. This policy applies to Orion's development tools and any future connected AI agents, CI services, paid applications, or GitHub integrations.

## No unapproved spending

- Never start, subscribe to, purchase, upgrade, provision, or trigger any paid or metered third-party service on the owner's behalf unless the owner explicitly approves the specific provider, purpose, estimated cost, billing method, spending ceiling, and stop condition.
- Never purchase a GitHub plan, Copilot service, hosted coding-agent plan, runner minutes, hosted storage, model tokens, API credits, or third-party wrapper by implication from a general development authorization.
- Before considering a paid option, present an existing/free/local alternative. Published example commands must not automatically turn on billing.
- No unattended scheduled process may make metered API calls, initiate purchases, or submit paid inference jobs.
- Do not install workflows, PATs, billing integrations, CI secrets, or external bots to bypass a failed connector. Treat credentials as sensitive and non-public.
- If the proposed feature's pricing, billing limits, or ability to cap charges is unknown, keep it disabled and mark it BLOCKED_PENDING_COST_APPROVAL.
- This document is a project rule, not a substitute for the owner's account-level billing settings. Check the provider's limits before approving a deployment.

## Present repository state

GitHub Actions was disabled on this public repository on 18 October 2026 to prevent accidental workflow runs. No auto-update workflow or paid model runner is installed by this project. Documentation and code changes can be made using the owner's already authenticated GitHub CLI with explicit, logged commits.

## Spending approval receipt

A proposal needing payment must identify: provider, service name, whether first/second/third party, one-time price, recurring price, metered rate and maximum exposure, currency, billing account, owner authorization evidence, revocation path and expected consequence of cancellation. No payment authorization is delegated by this README or to agents.

## Donation distinction

X donations, if offered directly by the developer, are **voluntary support** and not software licensing fees, required payments, or permission to charge a user's card. Payment providers may have their own fees; none are promised away here.

## GitHub severability

Orion must work with GitHub disconnected; Google Drive custody, local source recovery, and protected Guardian control remain independent. Disable/revoke GitHub integrations only with historical checkpoints and verification.
