# Project highlights and sponsor contact

Project detail now presents the owner's proposal as responsive highlight cards: lead, problem/beneficiaries, solution differentiator, prototype/progress, requested USDC budget, spending plan, and measurable milestones. Differentiator and progress are optional, limited to 2,000 characters, and covered by the existing owner signature and revision checks. Old proposals remain valid; missing details show an explicit empty state.

The approved project's “Quan tâm tài trợ” action opens a dialog with an editable message, a copy action and the team's existing HTTP(S) contact URL. No message is sent, interest record stored, wallet signature requested or transfer initiated. Clipboard failure is visible. Missing, executable or credential-bearing contact URLs do not become links. The dialog uses the shared keyboard/focus-managed Dialog component. Vietnamese and English are supported.

This extends the existing JSONB proposal payload and requires no additional migration beyond the project's existing project_profiles migration. No contract changes or deployment are included.

Validation: 27 related tests pass, including legacy profile compatibility, signed highlight tampering, API/editor regressions and sponsorship dialog/clipboard failure. Typecheck and changed-file ESLint pass. Local browser opens the round list but shows zero rounds, so rendering against a real project and publishing with a real wallet remain unverified. Next.js generated AGENTS.md when starting its development server.
