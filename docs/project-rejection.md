# On-chain project rejection

Source feature added for new QFRound deployments. **No deployment, transaction or environment edit was performed by this task.** Existing factory/round addresses remain unchanged.

## Behaviour and limits

- `rejected[id]`, `ProjectRejected(uint256 indexed id)` and `ProjectAlreadyRejected()` represent a permanent admin decision.
- `rejectProject(id)` uses `onlyAdmin` and `notCancelled`. It rejects invalid IDs, already approved/rejected projects and finalized rounds. It can reject a pending project after `endTime` while the round is still unfinalized; this follows the requested guards. Approval still retains its existing end-time restriction.
- Rejection keeps every project field and ID, `projectCount` and `projectsOf`. **It does not free a round's 50-project capacity or a wallet's two-project quota.** There is no on-chain reason, undo, appeal or automatic replacement.
- `approveProject` rejects rejected projects. Approved and rejected are mutually exclusive. Only approved IDs enter `approvedProjectIds`; rejected projects cannot donate, match or claim. `donateMany` rolls back atomically if a batch includes a rejected ID. The QF math, scaling, cap, payout and claim calculation are unchanged.
- `getProject` keeps the original ten fields, appending `isRejected`. `ProjectView` in `getProjects` keeps its original eleven fields, appending `rejected`.

## Frontend

- `/admin`: pending queue excludes rejected projects. The reject button is next to approve, visible only for the connected Fuji round admin, a pending project, an unfinalized/uncancelled round, with the action enabled only when the contract supports rejection. Factory ownership alone does not authorize rejection of someone else's round.
- Confirmation: “Từ chối dự án này? Hành động ghi lên blockchain và không hoàn tác.” VI/EN copy, pending state and receipt-backed toast with transaction hash/Snowtrace and `gasUsed * effectiveGasPrice` via the existing TransactionFlow. After success, refetch projects/round and invalidate other subscribed queries.
- Rejected proposals retain their “Đã từ chối” / “Rejected” badge for the round admin and project owner, including `/my`; they leave the pending counter and public lists/leaderboard. Direct public detail access follows the same visibility filter. This is UI visibility, **not private on-chain data**.
- Donation UI for the owner/admin is disabled with an explanation. Batch allocation and matching simulations include only approved, non-rejected projects.
- Old rounds: `useProjects` probes `rejected(0)` before selecting the tuple ABI. A missing getter uses the frozen pre-rejection ABI; a network failure is an error, not proof of a legacy contract. Old rounds remain readable and show a disabled reject button with an explanation; no rejection transaction can be sent. New fields do not upgrade existing deployed contracts. The existing project in an old round cannot be rejected or deleted on-chain by redeploying a different factory; sample projects must be registered again in the new round.

<a id="validation"></a>
## Validation

Required checks were executed locally; no RPC broadcast or deployment command was run.

| Command | Result | Evidence |
| --- | --- | --- |
| `cd contracts && forge test` | **146 passed, 0 failed, 0 skipped**, 5 suites | [forge-test.log](evidence/project-rejection-2026-10-18/forge-test.log) |
| `pnpm abi` | Exit 0; ABI generated from compiled artifacts | [abi.log](evidence/project-rejection-2026-10-18/abi.log) |
| `pnpm tsc --noEmit` | Exit 0 after correcting a tuple fixture type | [tsc.log](evidence/project-rejection-2026-10-18/tsc.log) |
| `pnpm test` | **274 passed, 13 skipped**, 34 files passed / 2 skipped | [pnpm-test.log](evidence/project-rejection-2026-10-18/pnpm-test.log) |
| `pnpm build` | Exit 0; compiled, type checked, generated routes | [build.log](evidence/project-rejection-2026-10-18/build.log) |

The new Foundry suite has **6 rejection-specific tests** and inherits 27 existing tests; the reported 146 counts suite executions, not 146 independent test bodies. The pre-existing stateful invariant still passes 256 runs / 128,000 calls. Solc emits a pre-existing mutability suggestion in StudentVerification; Foundry cannot flush its external signature cache under the sandbox, without affecting test success. Build retains the existing `ox/tempo` dynamic-dependency warning.

24 new Vitest cases cover project visibility/permissions, actual reject-button rendering, leaderboard exclusion, error copy, and encoding/decoding old/new tuple layouts in `useProjects`. The actual AdminView is also rendered to verify approve/reject placement and old/finalized/cancelled/foreign-admin states. React SSR uses mocked wallet/RPC dependencies; live browser/Core/rejection transactions are **not verified**. The 13 skipped tests are the repo's opt-in DB/RPC integrations.

A source-body comparison against the pre-change commit confirms `_recordDonation`, `_computeMatching`, `claim`, `donate`, `donateMany` and `finalize` are unchanged: [comparison](evidence/project-rejection-2026-10-18/qf-unchanged.json). No gas report was rerun; earlier gas snapshots in README/EVALUATION are historical baselines, not measurements of this new bytecode.

<a id="manual-deployment"></a>
## Manual deployment — commands for the project owner, not executed by the agent

1. Review the local code, tests and synced ABI. Check that `contracts/deployments/fuji.json` has the **existing MockUSDC you intend to reuse**. `DeployFactory.s.sol` **reads `.mockUsdc` from that file**, reads `STUDENT_REGISTRY_ADDRESS` from the command environment, deploys only a new RoundFactory, and writes the new factory plus reused token/registry back to the same manifest. It does not deploy MockUSDC or create a round. Do not run it with a stale token manifest. You may review the manifest yourself; it contains public addresses.

2. Deploy using your existing **`deployer` keystore** and enter its password interactively. These are commands for you to run; no private key argument or sourcing `.env.local` is needed:

```sh
cd /Users/baotoan/Documents/SqrtFund/contracts
forge build
STUDENT_REGISTRY_ADDRESS=0xbA0b756Ac2830743Cc56Fb42E504ED4d374Fe58e forge script script/DeployFactory.s.sol:DeployFactory --rpc-url https://api.avax-test.network/ext/bc/C/rpc --account deployer --broadcast -vvvv
```

The script itself updates `contracts/deployments/fuji.json`. Read its logged new factory address and verify that manifest, registry and reused MockUSDC are correct; do not copy an address from an old report.

3. **You** update `NEXT_PUBLIC_FACTORY_ADDRESS` in `.env.local` and Vercel to the new factory, and the current deployment address/Snowtrace links in README. Keep `fuji.json` consistent with the script result. This task does not fill a new address because nothing was deployed. Check that USDC/registry public configuration still points to the intended reused contracts. Restart your local dev server after changing public env.

4. From the repository root, regenerate ABI and rerun the existing read-only bytecode verifier:

```sh
cd /Users/baotoan/Documents/SqrtFund
pnpm abi
python3 docs/evidence/2026-10-17/verify-fuji.py
```

Confirm `roundFactory.runtimeMatchIgnoringMetadataAndImmutables` is `true` for the newly built/deployed factory and `factoryRegistry` is `0xbA0b756Ac2830743Cc56Fb42E504ED4d374Fe58e`. Inspect all three comparison results; reusing an older MockUSDC does not make its runtime automatically match today's artifact. Investigate build provenance if it differs; this rejection feature does not require or authorize an automatic token redeploy. The script compares bytecode, not explorer verification badges.

5. Create a **new sample round** through `/admin` connected with the factory owner's wallet, using the updated local config (or the frontend deployed with that config). Existing rounds are immutable and cannot gain rejection. Recreate sample project registrations in the new round; an empty new factory is expected until this step. With a verified student wallet, register a proposal; with round admin, test approve and reject on distinct proposals. Confirm rejected status, quota retention, no public listing and no donation/claim.

6. **You Redeploy Vercel**, leaving **Use existing Build Cache unchecked** so the new `NEXT_PUBLIC_FACTORY_ADDRESS` is embedded in the build. If you create the sample round through hosted `/admin`, redeploy with the new factory configuration first, then create the round. Test VI/EN, the confirmation/cancel flow, rejected proposal in admin and owner `/my`, public listings, and Snowtrace/fee display. Record actual reject transaction receipts if needed; none were generated in this task.

## Files and tests

Contract: [QFRound.sol](../contracts/src/QFRound.sol), [ProjectRejection.t.sol](../contracts/test/ProjectRejection.t.sol). The new suite covers event, getters, access, invalid ID, approved/double rejection, reapproval, single/batch donation, unchanged good-project payouts, denied claim, finalize/cancel boundaries and quota retention. All prior suites are run as regression coverage.

Frontend: [useProjects](../src/hooks/useProjects.ts), [frozen old read ABI](../src/lib/contracts/legacyProjectAbi.ts), [visibility/permission helpers](../src/lib/projectVisibility.ts), [RejectProjectButton](../src/components/admin/RejectProjectButton.tsx), [admin](../src/views/admin.tsx), [my](../src/views/my.tsx), [DonateBox](../src/components/project/DonateBox.tsx), [BatchDonationForm](../src/components/project/BatchDonationForm.tsx), public home/rounds/detail views, project card, leaderboard model/count, notification counter, types, bilingual copy, error selector and generated ABIs. README/EVALUATION link to this deployment boundary.

Vitest: [actual admin queue rendering](../__tests__/admin-project-rejection.test.ts), [visibility/button permissions](../__tests__/project-rejection.test.ts), [old/new project tuple reads](../__tests__/project-rejection-reads.test.ts). Tests use local fixtures, no keys or external transactions.
