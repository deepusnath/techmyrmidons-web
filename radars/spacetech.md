# Spacetech Radar

> **Owning chapter:** Space Evolve (proposed; launches Sep 2026, FAYA Trivandrum) · **Last updated:** 2026-07-25 · **Revision:** 1 (AI-seeded baseline, knowledge through Jan 2026)
> Trivandrum context: VSSC/ISRO heritage plus the private wave (IN-SPACe era). This radar especially needs its practitioners; the chapter lead's validation pass is revision 2.

## How we got here: 2022 → 2026

- **2022:** India opens space to private players in earnest (IN-SPACe operational); rideshare launches make orbit a line item
- **2023:** Chandrayaan-3 lands; Indian spacetech startups raise real rounds; smallsat constellations become the dominant commercial architecture
- **2024:** Reusability economics reshape planning; Earth-observation data products (not satellites) become the business
- **2025:** Direct-to-device connectivity goes commercial; on-orbit AI inference starts appearing in payloads
- **2026:** The differentiator shifts from getting to orbit to what your data and payload do there

## Adopt

| Tool / practice | Why | Provenance |
|---|---|---|
| CubeSat/smallsat standards + COTS buses | The proven fast path from design to orbit; heritage components de-risk schedules | [ai-seeded] |
| Rideshare launch procurement | Orbit as a purchase order; design to the rideshare envelope from day one | [ai-seeded] |
| Open-source flight software (NASA cFS, F´) | Flight-proven frameworks beat bespoke firmware for new teams | [ai-seeded] |
| Software-defined radios + GNU Radio | The ground-segment workhorse for comms development and testing | [ai-seeded] |
| Ground-station-as-a-service | Renting global ground coverage beats building antennas; capex → opex | [ai-seeded] |

## Trial

| Tool / practice | Why | Provenance |
|---|---|---|
| Onboard AI/edge inference payloads | Downlink is the bottleneck; process in orbit, send insights not pixels (natural link to Kerala's edge-AI silicon story) | [ai-seeded] |
| SAR and hyperspectral data products | The EO value moved up the stack: analytics-ready data over raw imagery | [ai-seeded] |
| Optical inter-satellite links | Constellation coherence without RF spectrum fights; maturing fast | [ai-seeded] |
| Digital-twin simulation for mission design | Iterate the mission in software before bending metal | [ai-seeded] |

## Assess

| Tool / practice | Why | Provenance |
|---|---|---|
| Direct-to-cell from LEO | Commercially live in early forms; business models still shaking out | [ai-seeded] |
| On-orbit servicing and manufacturing (ISAM) | The decade's big bet; watch, few entry points for small teams yet | [ai-seeded] |
| Very-low-Earth-orbit platforms | Interesting physics, unproven economics | [ai-seeded] |

## Hold

| Tool / practice | Why | Provenance |
|---|---|---|
| Bespoke monolithic satellites for startup missions | The constellation-of-small logic won on cost, risk, and iteration speed | [ai-seeded] |
| Proprietary everything in the ground segment | Open standards and GSaaS made closed stacks a liability | [ai-seeded] |
| Space missions designed without a data-product plan | "We will figure out the business after launch" stopped getting funded | [ai-seeded] |

## Moves this revision

Baseline revision; new domain (the 2018 taxonomy predated Kerala's private-space wave).

## Open disagreements

- **Build satellites vs. build on satellite data:** for a new Kerala team, which entry point compounds faster? The chapter should argue it with founders of both kinds in the room.

## The Ladder: where do you stand in spacetech?

| Step | You can honestly say | Your next move |
|---|---|---|
| **Explorer** | "I can explain orbits, link budgets, and why smallsats changed the industry." | Space Evolve's first session (Sep 2026); a cubesat simulator project |
| **Practitioner** | "I have built something real against space data or hardware: an SDR ground station, an EO analysis, flight-software contributions." | Ship a project on open EO data; demo at Space Evolve |
| **Builder** | "I have delivered flight or ground systems others depend on, through reviews and testing discipline." | A Beyond Borders spacetech problem statement; mentor |
| **Myrmidon** | "I have hardware in orbit or systems in the loop, and scars from integration and test." | Speak at Space Evolve; co-maintain this radar |
