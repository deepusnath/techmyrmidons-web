# Cybersecurity Radar

> **Owning chapter:** seeking maintainer · **Last updated:** 2026-07-25 · **Revision:** 1 (AI-seeded baseline, knowledge through Jan 2026)
> New domain: the 2018 taxonomy had no security radar, which says something about 2018.

## How we got here: 2022 → 2026

- **2022:** Supply-chain attacks (Log4Shell's long tail) make SBOMs a boardroom word
- **2023:** Passkeys ship across the big platforms; the beginning of the end of the password
- **2024:** NIST finalizes post-quantum standards (ML-KEM et al.); migration planning becomes a real to-do, not science fiction
- **2025:** LLM applications create a new attack surface (prompt injection, tool abuse, data exfiltration through agents) while AI simultaneously upgrades both attack and defense
- **2026:** Identity is the perimeter; agents are the new insider threat to design for

## Adopt

| Tool / practice | Why | Provenance |
|---|---|---|
| Passkeys / phishing-resistant MFA | Kills the dominant attack vector; user experience finally better than passwords | [ai-seeded] |
| Zero-trust identity (OIDC everywhere, short-lived credentials) | The perimeter is gone; identity-first is the working model | [ai-seeded] |
| Supply-chain hygiene (SBOM, sigstore, dependency scanning) | You ship your dependencies' vulnerabilities; know what is in the box | [ai-seeded] |
| Secrets scanning in CI + push protection | The cheapest breach prevention that exists | [ai-seeded] |
| Prompt-injection-aware design for LLM apps | Treat all model inputs as untrusted; least-privilege for tools; human gates on side effects | [ai-seeded] |

## Trial

| Tool / practice | Why | Provenance |
|---|---|---|
| AI-assisted security operations | Triage, log analysis, detection drafting; force multiplier with human judgment intact | [ai-seeded] |
| Post-quantum migration (hybrid TLS, crypto inventory) | Harvest-now-decrypt-later is already happening; start with the inventory | [ai-seeded] |
| eBPF runtime security (Falco class) | Kernel-level visibility that container-era tools lacked | [ai-seeded] |
| Agent permission frameworks | If software acts autonomously, its authority needs engineering; this layer is being invented now | [ai-seeded] |

## Assess

| Tool / practice | Why | Provenance |
|---|---|---|
| Autonomous pentesting agents | Genuinely useful in labs; authorization and scope questions unsettled | [ai-seeded] |
| Confidential computing (TEEs) for AI workloads | Real demand from regulated sectors; tooling maturing | [ai-seeded] |

## Hold

| Tool / practice | Why | Provenance |
|---|---|---|
| Perimeter-only security (VPN = trusted) | The castle-and-moat model died; stop rebuilding the moat | [ai-seeded] |
| Mandatory periodic password rotation | NIST said stop years ago; it weakens more than it protects | [ai-seeded] |
| Signature-only antivirus thinking | Behavioral and identity signals are where detection lives now | [ai-seeded] |
| Security-by-annual-audit | Compliance theater; controls belong in the pipeline, not the binder | [ai-seeded] |

## Moves this revision

Baseline revision; new domain, no archive predecessor.

## Open disagreements

- **How much autonomy to give defensive AI:** speed of response vs. blast radius of a wrong call. The room should argue it with real incidents.

## The Ladder: where do you stand in security?

| Step | You can honestly say | Your next move |
|---|---|---|
| **Explorer** | "I use a password manager and passkeys, and I can explain phishing to my family." | μLearn cybersecurity interest group; a CTF weekend |
| **Practitioner** | "I have found and fixed real vulnerabilities; I threat-model what I build." | Add scanning + secrets protection to a real repo; attend an Evolve |
| **Builder** | "I have owned security for a product: authn, secrets, dependencies, incident response." | Take a security problem statement; mentor an Explorer |
| **Myrmidon** | "I have handled incidents and made risk calls under pressure; my paranoia is calibrated." | Claim this radar; speak at an Evolve |
