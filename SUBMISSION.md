# Hacktoberfest Hackathon NUST × NSTP — submission sheet

Copy these answers into the organisers' submission form. Items marked
**TEAM** must be filled in by the team; nothing here should be guessed.

| # | Form field (brief §7) | Answer |
|---|---|---|
| 1 | **Project name & description** | **EzScene**: an open-source university approvals platform. Students fill or upload a request, EzScene routes it to the right signers in order, and the student downloads a stamped PDF anyone can verify by ID or QR code. |
| 2 | **Team details** | **TEAM**: names and what each person did (also in README → Team contributions). |
| 3 | **Public GitHub repository** | **TEAM**: `https://github.com/<team>/ezscene` (must be public, no special permissions). |
| 4 | **Problem statement** | Paper approvals at universities mean walking a form between advisor, HoD and dean; students can't see where it is stuck, faculty sign stacks of paper, files get lost when leadership changes, and stamped paper is easy to forge. Users: students, faculty/authorities, the registrar's office, and anyone who receives a document. |
| 5 | **Solution overview** | Online forms with live preview, or upload your own PDF/Word file · rule-based scan suggests the approval chain with reasons; the student edits it · each authority signs with a saved signature (desktop or phone swipe) · live tracking, reminders, withdraw, request changes · final PDF with signature blocks, seals, QR, ID and SHA-256 fingerprint · public verification by ID or file · admin designations (reassign moves pending work), templates, hash-chained audit log, accounts. |
| 6 | **Technology stack** | TypeScript, React 19, Vite 8, Tailwind CSS 4, jsPDF, pdf-lib, qrcode, Web Crypto + js-sha256, optional Supabase (Postgres + Realtime), optional Google Gemini (server-side), Vitest, Playwright, GitHub Actions. |
| 7 | **Open-source license** | MIT License (`LICENSE` in the repo root). Third-party licenses listed in `THIRD_PARTY_NOTICES.md`. |
| 8 | **Setup instructions** | `npm install` then `npm run dev`, open http://localhost:3000. No keys needed for the demo. Optional `.env` settings are in the README. |
| 9 | **Demo** | **TEAM**: live URL and/or video link. In the app: landing page → "Try it in one click" → walk the request through Student → Advisor → HoD → Admin. Suggested 3-minute script in the README → Demo. |
| 10 | **Kiro usage** | **TEAM**: describe how Kiro helped (the earlier ApplyEase code was built in Kiro IDE; add specifics), or leave out. |

## Final participant checklist (brief §12)

| Check | Status |
|---|---|
| Built a project with meaningful original contributions | ✅ Listed in README → "What we built vs. what we built on" |
| Addresses a clear problem or use case | ✅ README → Problem statement; in-app About page |
| Source code in a public GitHub repository | ⬜ **TEAM**: push and make the repository public |
| Repository contains a recognised open-source license | ✅ `LICENSE` (MIT) |
| README explains the project and how to run it | ✅ |
| Major third-party dependencies acknowledged | ✅ README → Acknowledgements, `THIRD_PARTY_NOTICES.md` |
| No exposed secrets or credentials | ✅ `npm run check:secrets` passes and runs in CI; `.env*` is git-ignored. Demo passwords are documented sample data |
| Functional feature or demonstrable prototype | ✅ 18 unit tests and a full browser walkthrough pass |
| Team can explain its implementation and contributions | ⬜ **TEAM**: fill in the contributions table; read `docs/ARCHITECTURE.md` |
| Project demonstration prepared | ⬜ **TEAM**: deploy (`npm run build`, then host `dist/`) and/or record the walkthrough |
| If Kiro was used, can explain how | ⬜ **TEAM** |

## Before you push

```bash
npm run check:secrets
npm run lint && npm test && npm run build
git init && git add . && git commit -m "EzScene: open-source university approvals"
git branch -M main
git remote add origin https://github.com/<team>/ezscene.git
git push -u origin main
```

Then set `VITE_REPO_URL` to the repository URL in your hosting settings so the
footer and About page link to it.
