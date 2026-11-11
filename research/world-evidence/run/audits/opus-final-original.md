# Independent final review — 观天下 evidence upgrade (`world-evidence-candidate`)

**Artifact reviewed:** `c0c2172644229d81b982847e17a776420720d85a` (confirmed via `git rev-parse HEAD` inside the candidate snapshot; candidate git log `dfebbb6 → 6e88467 → c0c2172`). Source root HEAD is `b31cb6f` (main, dirty index) — untouched, as required. I did not read the prior reviewer reports (`astra.md`/`opus.md`) before forming my own verdict; I read only the candidate, the gate/CHARTER/PROMPTS, and the two exports cold.

---

## 1 · Reader verdict (cold read, as a colleague)

Both exports hold up to a genuine cold read. Issue 001 ("增长仍在，体感为何分化？") and issue 002 ("黄仁勋承认婚内不忠：政治的牺牲品？") put **evidence and reproducible calculations first, counter-evidence and falsification conditions second, and conditional scenarios last**, exactly the ordering the user demanded ("先数据/事实论证 → 严格论证 → 事实支持 → 最后推演"). The most dangerous epistemic traps the user names are all explicitly pre-empted in the text: same-source laundering ("同一份原始资料的多次引用不构成独立佐证；不同源头也不等同于因果验证"), circular confidence ("消费较慢→信心弱→消费较慢不能形成独立证据链"), and scenario-as-fact ("条件情景（非概率预测）…不是机构基准预测"). Issue 002 deliberately downgrades the intelligence-identity claim to `未证实主张`, separates the *admission* (fact) from the *identity/infiltration/orchestration* (unproven), and refuses to compute a two-day cumulative loss because the two price vendors disagree on 2026-11-10. I would forward this to a colleague without rewriting. **share_ready: yes** — with only cosmetic prose repetition to note.

---

## 2 · Checked claims (independently verified against primary originals)

I re-fetched 13 material claims against primaries; a further 3 were corroborated by web search where the primary is paywalled/dynamic. All checked claims matched the exports.

| # | Claim in export | Independent check | Result |
|---|---|---|---|
| 1 | NVIDIA FY2027 Q2 total revenue 96,221M; prior-year 46,743M | SEC EDGAR 10-Q (`000104581026000075`) | ✅ "Revenue $96,221 $46,743" |
| 2 | IMF WEO Oct 2026 global 3.1% (2026) / 3.4% (2027) | imf.org WEO issue page | ✅ "Resilience Under Strain, Urgent Choices"; 3.1 / 3.4 |
| 3 | WTO Oct 2026 goods 1.9→3.9%, services 4.8→3.3% | wto.org news26 stat_08oct26 | ✅ verbatim |
| 4 | China Q1–Q3 2026 real GDP 4.6%; Q1 5.0 / Q2 4.3 / Q3 4.5 | stats.gov.cn GDP release | ✅ |
| 5 | Q1–Q3 average urban surveyed unemployment 5.2% | same NBS release | ✅ ("平均值为5.2%") |
| 6 | Income real +4.4%, consumption real +2.7%, urban 3.6%, rural 5.6% | stats.gov.cn household release | ✅ all four |
| 7 | Industrial profit +15.5%, margin 5.68% (+0.44pp), receivables 71.6d (+1.3d) | stats.gov.cn profit release | ✅ all three |
| 8 | Huang letter: admits infidelity, apologizes, names no one, admits no leak/license interference | nvidianews "A Message to Our Company" | ✅ exact admission, no confession beyond it |
| 9 | Board 8-Nov statement: independent-committee + outside counsel; "no reason to believe … compromised" | nvidianews board statement | ✅ verbatim |
| 10 | BIS 13-Jan-2026 press release: H200/MI325X case-by-case; FR doc 2026-00789 | bis.gov | ✅ |
| 11 | House letter signed 4-Nov / published 5-Nov; briefing 18-Nov (or alternate), reply by 11-Nov; identity is "publicly reported" | foreignaffairs.house.gov | ✅ (release 5-Nov; letter describes person as "publicly reported PRC intelligence asset") |
| 12 | MFA 9-Nov denial of "Chinese spy" narrative | mfa.gov.cn 20261109 | ✅ "所谓'中国间谍'的论调纯属捕风捉影，污蔑抹黑" |
| 13 | World Bank "Rebalancing Growth: China Economic Update", 7-Jul-2026; cautious consumers, property adjustment, income uncertainty | worldbank.org | ✅ substance matches |
| 14 | Data-center revenue ≈$89.0B, ~92.5% of sales, +117% yoy | Web search (primary 10-Q MD&A truncates) | ✅ corroborated |
| 15 | H200 China shipments <1% of data-center revenue | Web search (Bloomberg/HKET/eet-china) | ✅ corroborated |
| 16 | ~$400M H1 FY2027 H200 excess-inventory/purchase-obligation charge | Web search (moomoo/10-Q coverage) | ✅ corroborated |

**Could not re-fetch (my-tool limits, disclosed):** AP articles (`apnews.com` blocks WebFetch), ILO 2025 page (HTTP 403), and the Yahoo/StockAnalysis price histories (dynamic/blocked). The export itself flags the 11-10 price-vendor divergence and declines to use it; the −4.27% single-day figure (178.67÷186.64−1) is arithmetically correct regardless of source, and its *causal* interpretation is correctly withheld.

---

## 3 · Findings (ranked) — no Critical, no Major

**Critical:** none.
**Major:** none.

**Minor:**
- **M1 (presentation)** `verification/world-evidence-176.md` / `185.md` — the disclaimer sentence "本章将事实与编辑机制分析分开；示例为概念推演，不是企业或家庭的实地调查。" is repeated verbatim after **every** lens chapter (6× in 176). The charter's own rule is "免责只说一次". Once document-level suffices; the per-chapter copy is stock-frame prose.
- **M2 (presentation)** "下一步观察" is used as a recurring section header 7× (176) and 8× (185). Legitimate for the requested falsifiable follow-ups, but the identical imperative header reads templated.
- **M3 (presentation)** "不等于" appears 11× (176) / 15× (185) — above the de-ai 3× threshold and flagged by `world-evidence-style-002.log`. Most are necessary disambiguation (each negates a distinct metric-misreading), but the density is a genuine tell.
- **M4 (presentation)** The evidence header renders a first-screen count ("{N} 条证据记录"; "15 条来源" in sources view). Factual and low-harm, but it is exactly the "首屏计数句" the scoring card caps.
- **M5 (maintainability/cosmetic)** World Bank source title stored as "China Economic Update: Rebalancing Growth" while the primary is titled "Rebalancing Growth: China Economic Update" (`backend/prisma/world-evidence-001.ts`, `WB26`). No factual impact; not verbatim.

---

## 4 · Source & logic assessment (the substance)

- **Calculated-vs-data separation** is real, not cosmetic: `worldReport002.metrics` carries `kind: 'calculated'` for the 92.5% metric; `worldEvidenceCalculation` renders formula + rounded result from the same `calculateWorldEvidence` used by schema validation, and the schema rejects zero denominators, unit mismatches, and non-finite results (`worldSchema.ts` superRefine). Tests assert `1.7 / 92.52 / 105.85 / −4.27` reproduce (`backend/test/world.test.ts`).
- **Source-laundering is structurally prevented:** each record's `origin` (源头组) is a dedup group; the UI groups records by `origin`, and the copy states non-independent citation explicitly. Issue 2 correctly refuses to count Congress + board + lawsuit as three independent identity confirmations because all three react to the same press report — this is the "dependent source laundering" trap named in the prompt, handled correctly.
- **Circular-confidence argument is refused:** the "信心弱" claim is graded `insufficient`, with reasoning that a household aggregate is not same-household panel and that WB reuses official underlying data ("不是第二份独立住户测量"). Exactly right.
- **Allegations not treated as known:** `identity` and `lawsuit` are `allegation`; the `known`/`supported` claim now references only `admission` + `inquiry` (both `fact`) — I verified this in `world-evidence-002.ts` (the schema even rejects a `supported` claim lacking a data/fact record).
- **Politics honestly graded:** "政治关注增加，不足以证明政治设局" is `insufficient` — no fabricated orchestration, no FBI remark treated as fact (it is `statement`).
- **Profit aggregate caveat:** `profit` basis states "不能说明多数企业改善"; the 15.5% headline is presented as counter-evidence, not as "most firms fine".
- **Causation is never claimed from prices:** the −4.27% is "未控制行情和其他消息的价格变化…不等于本案损失", and 11-10 is excluded for vendor disagreement. This is precisely the "price movement does not identify causation" limitation, honored.

---

## 5 · Engineering (source, schema, upgrade, tests)

- **Schema** (`backend/src/worldSchema.ts`): zod v1 report; rejects duplicate source/section/evidence IDs, unknown source refs, chart bars exceeding axis, sources published after cutoff, non-chronological timelines, `data` records without numeric value/unit (and vice-versa), `difference` across differing periods, non-positive denominators, and a `supported` claim lacking direct data/fact. Solid.
- **Upgrade** (`backend/prisma/upgrade-world-evidence.ts`): runs inside one `$transaction`; `beforeApply` (backup write) is invoked *before* any `content.update`, so a backup failure aborts with zero writes — the correct ordering the prompt asked to check. User-edited descriptions (not matching any baseline) are detected as `conflicts` and preserved; `topics`/`sortOrder` metadata untouched.
- **Tests:** backend 30 pass / frontend 32 pass (`verification/world-evidence-tests-final.log`, exit 0). World tests cover: repeatable seed + edit preservation; schema rejects broken refs/axis/future-dates/zero-denominator/period-mismatch; calculation reproducibility; upgrade preview = 14 changes, conflict detection, backup-failure rollback, and idempotence (second apply = 0 changes); auth + admin-edit.
- **Typecheck/lint/build:** all exit 0 (`verification/world-evidence-typecheck.log`, `-lint.log`, `-build.log`). Only the pre-existing Vite chunk-size warning remains.

---

## 6 · Browser / screenshots — what I actually checked

- `verification/browser-check.js` contains real assertions, not screenshot-only: for each issue and each width 1440/390/320 it throws if `document.documentElement.scrollWidth > viewport` or if any descendant overflows horizontally; it also verifies source `<a href>` is http(s), record-anchor navigation (`#world-record-…`), and an actual Markdown download. The successful run is in `world-evidence-browser-final.log` (downloads completed, no error events).
- I did **not** perform my own pixel-level PNG inspection of the screenshots (Opus PNG-reading limits disclosed per the gate). I rely on the programmatic overflow assertions above plus the CSS I read directly: `world.css` line ~87–91 overrides evidence body text to `12px` / `#53665a` (the "darker 12px evidence body" change), and the `world-kind.calculated` + market-platform chart title ("FY2027 Q2 公司按市场平台披露的营收") are present in `world-002-data.ts` / `WorldSpace.tsx`.

---

## 7 · Style log and weakest prose (up to five, quoted)

`verification/world-evidence-style-001.log` (176): tells 3.0/1k, notes 2.8/1k, cap 4. `style-002.log` (185): tells 2.8/1k, notes 3.9/1k, cap 8 — both under the site cap, but repeated frames "不等于 ×11/×15" and "下一轮/下一步 ×7/×8" are flagged. Genuine weak lines:

1. "本章将事实与编辑机制分析分开；示例为概念推演，不是企业或家庭的实地调查。" — repeated verbatim after every lens chapter (6×, 176).
2. "下一步观察" — used as an identical standalone header 7×/8×; e.g. "下一步观察\n\n观察资本开支之外的订单、利用率和现金流；区分价格推动的名义增长与实际数量增长。"
3. "政策目标不等于实施结果。" — a necessary disambiguation, but one of 15 "不等于" tokens in 185; the frame density is the tell, not this single line.
4. "口径与边界：按常住地分类的人均可支配收入，人口构成可变化。" — the "期间／源头组／口径与边界／来源" quad is templated for every record; structurally necessary but reads mechanical.
5. "引用证据：[gdp] 实际GDP同比增长；[income] …；[consumption] …" — the 引用证据/引用计算/源头组 triad is mechanical-list prose, again structural rather than fluent.

**Methodological false positives I am NOT waiving, but explaining as necessary:** "口径与边界/源头组/来源" is the dedup-and-boundary apparatus the user explicitly demanded (准确数据 + 严格口径), so it must appear per record; each "不等于" negates a *specific* misreading (≠分配率, ≠因果, ≠本案损失) and is the mechanism that prevents the exact circular-confidence error the user complained about; "反证或替代解释 / 验证条件" per claim is what makes the conclusions falsifiable ("论证要严格…最后才是推演"). These are load-bearing for an evidence audit, not AI padding. The genuinely trimmable items are M1–M4 above.

---

## 8 · Residual gaps / limitations (honest)

- **Subjective nationwide perception is not measured** — acknowledged as the core scope limit ("本期没有全国同户预期…直接调查"); the "体感" question is answered with bounded/insufficient grades rather than an invented number. Correct, but means the headline question is only partially resolved (by design).
- **Identity/security/orchestration not proven** — issue 2 correctly leaves these unproven; a reader wanting a conclusion on "政治的牺牲品" gets "现有证据不足以断言" (the honest answer).
- **Price movement not causal** — stated plainly; no abnormal-return model is run (appropriate without an event-study window and clean data).
- **Un-verifiable-by-me sources:** AP (blocked), ILO (403), price vendors (dynamic). The work's own flags for 11-10 divergence cover the risky one.
- **No product edits, DB runs, credentials, browser UI, or publishing performed** by me, per instructions.

---

## 9 · Rubric

- **correctness = 9** — 13 primary + 3 search-corroborated claims all matched; calculations reproduce; one cosmetic source-title inversion (M5) and two sources I could not re-fetch are the only reservations.
- **logic = 9** — the evidence→counter-evidence→conditional ordering, source-independence discipline, and refusal of circular/causal fallacies are exactly right; the one imperfection is that some reasoning is necessarily qualitative hedged prose (correct for the evidence base).
- **coverage = 9** — 12/2/5 (001) and 15/3/5 (002) records/calcs/claims, six lenses each, timelines, scenarios, watchlists, and per-source scope; the only "gap" is the disclosed, honest scope limit on subjective perception.
- **presentation = 8** — rigorous and readable, but capped by the repeated disclaimer (M1), "下一步观察" header (M2), "不等于" density (M3), and first-screen count (M4).
- **maintainability = 9** — zod-validated schema, idempotent seed, conservative transaction-with-rollback upgrade, strong focused tests; M5 (title wording) is the only nit.

Weighted total = 0.30·9 + 0.25·9 + 0.15·9 + 0.15·8 + 0.15·9 = **8.85 / 10** → ≥ 8.5 pass. All floors met (9/9/9/8/9 vs. 9/9/8/8/8). Zero Critical, zero Major.

---

REVIEWER: claude-opus-5
ARTIFACT: c0c2172644229d81b982847e17a776420720d85a
SCORES: correctness=9, logic=9, coverage=9, presentation=8, maintainability=9
VERDICT: PASS
USE: yes