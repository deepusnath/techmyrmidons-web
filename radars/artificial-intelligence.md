# Artificial Intelligence Radar

> **Owning chapter:** AI Evolve (proposed) · **Last updated:** 2026-07-25 · **Revision:** 1 (AI-seeded baseline, knowledge through Jan 2026)
> Every entry is `[ai-seeded]` until AI Evolve validates it. No vendor can buy a ring.

## How we got here: 2022 → 2026

- **2022:** ChatGPT and Stable Diffusion detonate the field; "using AI" stops meaning "training models" for most builders
- **2023:** GPT-4 raises the ceiling; Meta's Llama releases make open weights a real strategy; the RAG + vector database pattern becomes the default enterprise architecture
- **2024:** Multimodality goes mainstream; small models (7B class) become genuinely useful; structured outputs and function calling turn LLMs into components, not chatbots
- **2025:** The reasoning-model era (extended thinking, o-series, DeepSeek R1's open-weight shock); agents move from demos to production; Model Context Protocol standardizes tool connection; AI-assisted coding becomes the profession's default
- **2026:** The center of gravity is agentic systems in production and the engineering discipline around them: evals, observability, cost control

## Adopt

*Practitioners use this in production. Learn it with confidence.*

| Tool / practice | Why | Provenance |
|---|---|---|
| Frontier-model APIs (Anthropic, OpenAI, Google) | For most products, calling a frontier model beats hosting your own; model choice is now an engineering tradeoff, not an identity | [ai-seeded] |
| PyTorch | Still the lingua franca of everything below the API line | [ai-seeded] |
| Hugging Face ecosystem | The de facto registry for open models, datasets, and fine-tuning tooling | [ai-seeded] |
| RAG with a real vector store (pgvector, Qdrant) | The default pattern for grounding models in your data; boring now, which is the point | [ai-seeded] |
| Structured outputs + tool calling | What turns a chat model into a system component | [ai-seeded] |
| AI-assisted coding (Claude Code, Cursor class) | The productivity delta is no longer arguable; not using it is the anomaly | [ai-seeded] |
| Local inference (llama.cpp, Ollama) | Open weights on your own hardware: privacy, cost, and offline paths that production teams actually use | [ai-seeded] |
| Systematic evals (before scaling anything) | The teams that win treat evals like tests: written first, run always | [ai-seeded] |

## Trial

*Serious people are betting on it. A good second tool.*

| Tool / practice | Why | Provenance |
|---|---|---|
| Model Context Protocol (MCP) | The emerging USB standard for connecting models to tools and data; ecosystem snowballed through 2025 | [ai-seeded] |
| Agentic frameworks and orchestration | Production agents are real but the framework layer is still consolidating; bet small, learn fast | [ai-seeded] |
| Open-weight frontier-class models (Llama, Qwen, DeepSeek) | Closing the gap release by release; sovereignty and cost arguments get stronger yearly | [ai-seeded] |
| vLLM and serious serving infrastructure | If you self-host, this layer decides your economics | [ai-seeded] |
| Parameter-efficient fine-tuning (LoRA class) | The right first answer to "should we fine-tune?"; cheap enough to experiment honestly | [ai-seeded] |
| On-device small models (Gemma, Phi class) | Edge AI for real: phones, browsers, embedded; pairs naturally with Kerala's edge-silicon story | [ai-seeded] |

## Assess

*Watch it, play with it, no career bets yet.*

| Tool / practice | Why | Provenance |
|---|---|---|
| Computer-use / GUI agents | Impressive trajectory, reliability still maturing for unattended use | [ai-seeded] |
| World models and video generation for robotics/simulation | Potentially the next detonation; currently a research spectator sport for most builders | [ai-seeded] |
| Alternative architectures (state-space models) | The transformer tax is real, but no successor has closed the deal | [ai-seeded] |

## Hold

*Still everywhere, no longer where the future is.*

| Tool / practice | Why | Provenance |
|---|---|---|
| TensorFlow for new projects | Maintenance mode in practice; the ecosystem voted | [ai-seeded] |
| Hand-rolled NLP pipelines for tasks an LLM call solves | Classification, extraction, summarization: the build-vs-call math flipped years ago | [ai-seeded] |
| "Prompt engineering" as a standalone career bet | It compressed into ordinary engineering skill; context and system design is the real discipline | [ai-seeded] |
| Heavyweight MLOps platforms for foundation-model apps | Designed for the train-your-own era; most teams now need eval + observability, not feature stores | [ai-seeded] |

## Moves this revision

Baseline revision; no prior state. The 2018–2021 archive (Singa, MLlib era) is preserved in [`archive/`](../archive/) as the historical record.

## Open disagreements

- **LangChain-class abstraction layers:** some practitioners ship on them daily; others call them scaffolding you outgrow in a month. Both camps are represented in production. The radar takes no side until AI Evolve does.
- **Fine-tune vs. context-engineer:** the eternal fork; the honest answer is workload-specific and the room should argue it on real cases.

## The Ladder: where do you stand in AI?

| Step | You can honestly say | Your next move |
|---|---|---|
| **Explorer** | "I use AI assistants daily and can explain what a context window and a hallucination are." | μLearn AI interest group; attend AI Evolve |
| **Practitioner** | "I have built something real on a model API: tool calls, structured output, and I handle failures." | Ship a RAG or agent project end to end; demo at an Evolve open floor |
| **Builder** | "I have shipped AI features users depend on, with evals, and I know my cost and latency budgets." | Take a Beyond Borders AI problem statement; mentor an Explorer |
| **Myrmidon** | "I have opinions about serving economics and eval design that scars paid for; practitioners ask me for them." | Speak at AI Evolve; co-maintain this radar |
