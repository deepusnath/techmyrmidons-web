# Platform & Cloud Radar

> **Owning chapter:** seeking maintainer · **Last updated:** 2026-07-25 · **Revision:** 1 (AI-seeded baseline, knowledge through Jan 2026)

## How we got here: 2022 → 2026

- **2022:** Kubernetes everywhere, including places it never belonged; the DevOps title peaks
- **2023:** Platform engineering renames the discipline: golden paths and internal developer platforms over ticket-ops
- **2024:** The licensing wars (Terraform → OpenTofu fork) teach the ecosystem about open-source governance; OpenTelemetry unifies observability
- **2025:** AI enters operations: incident summarization, log analysis, PR review bots; GPU infrastructure becomes a first-class platform concern
- **2026:** The platform team's new job: making AI workloads (inference, agents, evals) as deployable as web services

## Adopt

| Tool / practice | Why | Provenance |
|---|---|---|
| GitHub Actions (or GitLab CI) | CI/CD as configuration in the repo won; Jenkins survivors are migrating, not choosing | [ai-seeded] |
| Containers + a managed orchestrator | Managed Kubernetes or serverless containers (Cloud Run / Fargate class); undifferentiated cluster ops is not your product | [ai-seeded] |
| Infrastructure as code (OpenTofu/Terraform) | Reproducible infrastructure is table stakes; the fork taught everyone to read licenses | [ai-seeded] |
| OpenTelemetry | The observability standard; instrument once, choose vendors freely | [ai-seeded] |
| Secrets management + OIDC everywhere | Long-lived credentials in CI are how breaches start; workload identity is the pattern | [ai-seeded] |
| uv / modern language toolchains | The Rust-powered toolchain generation (uv, Ruff, Biome) removed whole categories of friction | [ai-seeded] |

## Trial

| Tool / practice | Why | Provenance |
|---|---|---|
| Internal developer platforms (Backstage class) | Golden paths beat tribal knowledge at 20+ engineers; overkill below that | [ai-seeded] |
| AI in the operations loop | Incident copilots, log triage, infra PR review; assist yes, autonomous no | [ai-seeded] |
| eBPF-based networking and observability (Cilium class) | The kernel-level lens; real power, real learning curve | [ai-seeded] |
| GPU/inference platform layer (vLLM serving, model gateways) | If your org ships AI, someone must own tokens-per-rupee; make it deliberate | [ai-seeded] |

## Assess

| Tool / practice | Why | Provenance |
|---|---|---|
| Server-side WebAssembly | Cold starts and sandboxing story is compelling; ecosystem still assembling | [ai-seeded] |
| Autonomous remediation agents | The demos are impressive; the blast radius is your production | [ai-seeded] |

## Hold

| Tool / practice | Why | Provenance |
|---|---|---|
| Jenkins for new pipelines | Two generations behind; keep only what you cannot yet migrate | [ai-seeded] |
| Self-managed Kubernetes for small teams | A full-time job disguised as a deployment choice | [ai-seeded] |
| Snowflake servers and SSH-and-pray deploys | If it is not in code, it does not exist | [ai-seeded] |
| Multi-cloud as a starting posture | Portability theater that doubles complexity before the first customer | [ai-seeded] |

## Moves this revision

Baseline revision. 2018–2021 devops archive preserved in [`archive/`](../archive/).

## Open disagreements

- **Platform engineering below ~15 engineers:** discipline or cargo cult? The room should argue it with team sizes on the table.

## The Ladder: where do you stand in platform?

| Step | You can honestly say | Your next move |
|---|---|---|
| **Explorer** | "I can containerize an app and deploy it somewhere public, and explain what CI does." | Deploy a project with Actions + a managed runtime |
| **Practitioner** | "I run IaC-managed infrastructure with monitoring, and I have been paged and coped." | Add OTel + alerting to a real service; attend an Evolve |
| **Builder** | "I have designed the pipeline and platform for a team; my golden path has users." | Take a platform problem from Beyond Borders; mentor |
| **Myrmidon** | "I have opinions about build-vs-buy at the platform layer that outages paid for." | Claim this radar; speak at an Evolve |
