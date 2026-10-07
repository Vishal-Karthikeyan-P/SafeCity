# SafeCity — Documentation Output Index

Generated documentation for the **SafeCity** monorepo (`apps/backend`, `apps/web`, `apps/mobile`, `shared`, `docker`). Everything in this folder was derived exclusively from the repository source code at commit `9390fb7` (`83f0daf` on the branch when analysis began). **No pre-existing project file was modified, moved or deleted** (`git status` shows changes only inside `documentation_output/`).

## 1. Generated files

| File | Contents | Size |
|---|---|---|
| `SafeCity_Project_Report.md` | Complete MCA-level academic report: front matter (Acknowledgement, Synopsis, List of Figures/Tables/Abbreviations), Chapters 1–8, References, Appendices A–F. 3408+ lines, 32 embedded Mermaid figures, 27 tables, ~100 test cases. | ~3400 lines |
| `SafeCity_Diagrams.md` | All 32 Mermaid diagram sources with figure index and report cross-references. | ~1450 lines |
| `README.md` | This index (file list, diagram index, verification status, unverified items). | this file |

### Report structure (chapter → report location)

| Chapter | Sections |
|---|---|
| Front matter | Acknowledgement · Synopsis · List of Figures (32) · List of Tables (27) · List of Abbreviations |
| Chapter 1 — Introduction | 1.1–1.12 incl. Table 1 (Tools & Technologies) |
| Chapter 2 — System Analysis | 2.1–2.12 incl. Tables 2–7 (comparison, 44 FRs, 22 NFRs, hardware/software, feasibility) |
| Chapter 3 — System Design | 3.1–3.19: architecture, modules, transitions (Table 8), UML (Figures 3–12), BPMN (13–18), DFDs (19–23), ER/schema (24–25), data dictionary (Tables 10–12), API/security/deployment (26–28) |
| Chapter 4 — Implementation | 4.1–4.24: every implemented screen/module incl. web, mobile, backend, database, routing, deployment |
| Chapter 5 — Algorithms | 5.1–5.16: severity engine, hazard weights, area score, normalisation, heatmap, route exposure, generation, avoidance, ranking, distance, alert propagation, location alerts, contacts, complexity (Figures 29–32; Tables 13–19) |
| Chapter 6 — Testing | 6.1–6.21: environment, techniques, unit→API/DB/map/routing/score/alert testing, 100 test cases (Tables 21–24), disclosed execution status |
| Chapter 7 — Results | 7.1–7.13 per-module results, performance analysis, findings |
| Chapter 8 — Conclusion | 8.1–8.5 incl. objective achievement matrix (Table 26) |
| References | 23 official technology references + repo-internal docs |
| Appendices | A schema · B 77-endpoint inventory · C test cases · D sample JSON · E screenshot inventory · F configuration |

## 2. Diagram index (32 figures, Mermaid source)

Every diagram exists in **both** `SafeCity_Diagrams.md` and at the cited report location; the Mermaid sources were programmatically verified to be byte-identical (32/32 blocks match).

| # | Figure | Type | Report section |
|---|---|---|---|
| 1 | System Architecture | `flowchart TB` | §3.2 |
| 2 | Module Architecture | `flowchart TB` | §3.3 |
| 3 | Use Case Diagram | `flowchart TB` | §3.12.1 |
| 4 | User Activity Diagram | `flowchart TB` | §3.12.2 |
| 5 | Admin Activity Diagram | `flowchart TB` | §3.12.3 |
| 6 | Class Diagram | `classDiagram` | §3.12.4 |
| 7 | Login Sequence | `sequenceDiagram` | §3.12.5 |
| 8 | Incident Reporting Sequence | `sequenceDiagram` | §3.12.6 |
| 9 | Incident Verification Sequence | `sequenceDiagram` | §3.12.7 |
| 10 | Safe Routing Sequence | `sequenceDiagram` | §3.12.8 |
| 11 | Community Alert Sequence | `sequenceDiagram` | §3.12.9 |
| 12 | Emergency Contact Sequence | `sequenceDiagram` | §3.12.10 |
| 13 | Registration / Login BPMN | `flowchart TB` | §3.13.1 |
| 14 | Incident Reporting BPMN | `flowchart TB` | §3.13.2 |
| 15 | Incident Verification BPMN | `flowchart TB` | §3.13.3 |
| 16 | Safe Routing BPMN | `flowchart TB` | §3.13.4 |
| 17 | Community Alert BPMN | `flowchart TB` | §3.13.5 |
| 18 | Emergency Contact BPMN | `flowchart TB` | §3.13.6 |
| 19 | Context DFD | `flowchart TB` | §3.14.1 |
| 20 | Level-1 DFD | `flowchart TB` | §3.14.2 |
| 21 | Incident Management DFD | `flowchart TB` | §3.14.3 |
| 22 | Safe Routing DFD | `flowchart TB` | §3.14.4 |
| 23 | Safety Analysis DFD | `flowchart TB` | §3.14.5 |
| 24 | ER Diagram | `erDiagram` | §3.15.1 |
| 25 | Database Schema Layout | `flowchart TB` | §3.15.2 |
| 26 | API Architecture | `flowchart TB` | §3.17 |
| 27 | Security Architecture | `flowchart TB` | §3.18 |
| 28 | Deployment Architecture | `flowchart TB` | §3.19 |
| 29 | Safe Routing Flowchart | `flowchart TB` | §5.9 |
| 30 | Area Safety Score Flowchart | `flowchart TB` | §5.5 |
| 31 | Incident Risk (Severity) Flowchart | `flowchart TB` | §5.2 |
| 32 | Alert Propagation Flowchart | `flowchart TB` | §5.13 |

Diagram conventions: vertical `TB` orientation for A4 rendering, quoted node labels, real entity/endpoint/constant names from the code base, no crossing-heavy layouts.

## 3. Validation performed

1. **Feature cross-check** — every documented feature traced to source (routers, services, repositories, models, pages, screens).
2. **Database cross-check** — all 15 tables/columns/keys traced to `app/models/*` + `migrations/versions/*`.
3. **Algorithm cross-check** — all constants, weights, thresholds, formulas read from `severity_engine.py`, `safety_score_service.py`, `route_service.py`, `location_notification_service.py` (Tables 13–19); two documentation errors found and corrected during review (resolved-factor = 0.5×, `MAX_INCIDENTS_IN_PAYLOAD` active).
4. **API/workflow cross-check** — endpoint inventory built from `@router` decorators across all 12 routers (76 + `/health` = 77); status matrix taken from `VALID_STATUS_TRANSITIONS`.
5. **Mermaid validation** — automated structural lint of all 32 blocks (diagram-type header, `subgraph`/`end` balance, `classDiagram`/`erDiagram` brace balance, `sequenceDiagram` `alt`/`loop`/`end` balance, bracket balance outside quoted labels): **PASS**. Report-vs-diagrams block comparison: **32/32 identical**.
6. **No project files changed** — `git status --porcelain` lists only `documentation_output/*`; `git diff --stat` confirms zero changes elsewhere.
7. **Output containment** — all new/edited files reside in `documentation_output/`.

## 4. Not implemented / Not verified items

Explicitly marked **Not implemented / Not verified** in the report:

| # | Item | Where marked |
|---|---|---|
| 1 | **UI screenshots** — none exist in the repository (only app icons and demo upload photos); Appendix E is a screen inventory placeholder | App. E, §4 intro |
| 2 | **Test execution results** — scripts exist but were not executed for this documentation; no measured pass/fail rates reported | §6.19, §6.5 |
| 3 | **pytest suite** — no collectable test modules/conftest (only ad-hoc scripts) | §6.3 |
| 4 | **Measured performance metrics** — no profiling/latency artefacts in repo | §6.9 |
| 5 | **Security scanning / penetration output** | §6.10 |
| 6 | **Formal usability study metrics** | §6.11 |
| 7 | **SMTP OTP e-mail delivery** — requires credentials; not verified | §2.12, §8.4 |
| 8 | **CI pipeline definitions** — no workflow files found | §1.6, §1.10 |
| 9 | **`new_users_this_month` statistic** — hard-coded `0` in `admin_stats` | §1.10, §7.10 |
| 10 | **`SafetyMapPage.tsx`** — implemented but not routed (`/safety-map` → `/map`) | §1.10, §4.6 |
| 11 | **iOS build configuration** — only an Android EAS profile exists | §1.6 |
| 12 | **Live API responses** — Appendix D samples are *constructed from response models*, not captured from a running server | App. D |
| 13 | **Mobile LAN-IP fallback** (`10.89.126.243`) — environment-specific | §1.10, App. F.5 |

## 5. Converting to Word / PDF

The report is plain Markdown with ATX headings, pipe tables, fenced code and Mermaid blocks. Example conversion:

```bash
pandoc SafeCity_Project_Report.md -o SafeCity_Report.docx --toc --toc-depth=2
# PDF (requires mermaid rendering, e.g. mmdc pre-pass or VS Code Markdown PDF export)
```

Mermaid figures render natively in GitHub, VS Code (with a Mermaid preview extension), Obsidian, Typora, and `mermaid-cli`/`mmdc` for PNG/SVG export.

