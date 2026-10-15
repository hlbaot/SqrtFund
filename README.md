# SqrtFund (√Fund)

SqrtFund is a decentralized quadratic funding platform for student clubs and builder initiatives on Avalanche Fuji testnet (Chain ID 43113), built for the Vietnam UniHack hackathon.

Student club funding is often distorted by personal connections or single wealthy patrons. Quadratic funding redistributes sponsor matching capital democratically by prioritizing the **breadth of unique student supporters** over the size of individual contributions.

---

## Quadratic Funding Mechanics & Rules

The smart contracts and frontend enforce the following mathematical and economic rules:

- **Token**: `MockUSDC`, 6 decimals ERC-20 (OpenZeppelin v5). Includes a public `faucetMint()` function minting 100 USDC per call with a 1-hour cooldown and a 1,000 USDC lifetime cap per address.
- **Donation Limits**:
  - Minimum donation: `minDonation` (default 1 USDC).
  - Maximum cumulative donation per student per project: `maxDonation` (default 5 USDC).
  - Multiple donations by the same wallet to the same project are aggregated **before** the square root is computed: $\text{sumSqrt}_p += \sqrt{\text{newTotal} \cdot 10^{12}} - \sqrt{\text{oldTotal} \cdot 10^{12}}$.
  - A project with a single donor yields 0 matching.
  - A student can donate to multiple projects, each with its own limit.
  - Project owners cannot donate to their own project.
- **Whitelist & Verification**:
  - Only whitelisted addresses can donate.
  - Students can request verification on-chain (`requestVerification()`) which adds their address to a bounded pending queue (max 500).
  - Admin approves or rejects via `setWhitelist` or `setWhitelistBatch` (up to 50 addresses per batch). Both approval and rejection remove the address from the queue. No centralized backend or signing server.
- **Project Limits**:
  - Anyone can register a project before `endTime` via `registerProject(name, description, imageUrl, link)` (byte bounds: name $\le 60$, description $\le 280$, URLs $\le 200$).
  - Max 50 projects per round.
  - Admin must approve a project (`approveProject(id)`) before it can receive donations or receive matching funds.
- **Matching Pool & Cap**:
  - Admin deposits matching funds via `depositPool(amount)` before finalization.
  - Matching cap per project: `maxMatchBps` (default 3000 = 30% of the pool).
- **Finalization & Precision**:
  - Callable after `endTime` by anyone.
  - Loops over approved projects only (never over donors).
  - Scaling factor `SCALE = 1e12`.
  - For each approved project: $\text{raw}_p = \max(0, S_p^2 / 10^{12} - \text{totalDonated}_p)$.
  - If $\sum \text{raw} > \text{pool}$, then $\text{payout}_p = \lfloor(\text{pool} \cdot \text{raw}_p) / \sum \text{raw}\rfloor$, else $\text{payout}_p = \text{raw}_p$.
  - $\text{payout}_p = \min(\text{payout}_p, (\text{pool} \cdot \text{maxMatchBps}) / 10000)$.
  - Leftover matching pool funds can be withdrawn once by the admin via `withdrawLeftover()`.
- **Claim**:
  - Project owners claim direct donations + matching payout via `claim(projectId)` after finalization.

---

## Smart Contract Suite

Contracts are located in `contracts/`:
- `contracts/src/MockUSDC.sol`: ERC-20 token with 6 decimals, faucet cooldown and lifetime limits.
- `contracts/src/QFRound.sol`: Core quadratic funding round implementation with OpenZeppelin `SafeERC20`, `ReentrancyGuard`, and `Math.sqrt`. Stores on-chain round `name` (1..60 bytes) and `organizer` (0..60 bytes).
- `contracts/src/RoundFactory.sol`: Deploys and indexes rounds on Fuji via `createRound(string name, string organizer, address token, uint256 startTime, uint256 endTime, uint256 minDonation, uint256 maxDonation, uint256 maxMatchBps)`.
- `contracts/script/Deploy.s.sol`: Deployment script for `MockUSDC` and `RoundFactory`.
- `contracts/script/DeployFactory.s.sol`: Deploys only a new `RoundFactory` (reusing existing `MockUSDC` from `deployments/fuji.json`).
- `contracts/test/QFRound.t.sol`: Comprehensive Foundry test suite (29 tests including name/organizer validation, fuzzing, and dust invariants).

> **Important**: The `RoundFactory` contract must be redeployed to support custom on-chain round names and organizer details. Existing `MockUSDC` tokens can be retained.

---

## Testing

### Foundry Smart Contract Tests
Run from the repository root:
```bash
export PATH="$HOME/.foundry/bin:$PATH"
cd contracts
forge test -vv
```

Tested scenarios:
1. **300 donors x 1 USDC vs 60 donors x 5 USDC**: 300x1 yields raw matching of ~89,700 USDC vs ~17,700 USDC for 60x5 (despite having the exact same direct donation total of 300 USDC).
2. **Aggregation before square root**: 1+1+1 donations aggregate to $\sqrt{3}$, and a single donor project yields 0 matching.
3. **Donation bounds**: Second donation exceeding max reverts; donating to multiple projects allowed.
4. **Pool allocations**: Proportional payout when pool < raw, leftover accounting when pool > raw, dust $\le$ number of projects in wei.
5. **Matching cap**: Per-project cap at 30% enforced.
6. **Preview parity**: `previewMatching()` matches `finalize()` results exactly.
7. **Negative cases & reverts**: Self-donation, unapproved project, unwhitelisted donor, timing violations, duplicate claims, batch/queue limits.
8. **Faucet limits**: Cooldown and 1,000 USDC lifetime cap.
9. **Fuzz testing**: Random donations and pool deposits maintain $\sum \text{payout} \le \text{pool}$ and contract solvency.

### Frontend Unit Tests (QF Math Mirror)
Run from the repository root:
```bash
pnpm test
```
Validates the BigInt implementation in `src/lib/qf.ts` against the identical test vectors used in Foundry.

---

## Frontend Architecture

- **Framework**: Next.js App Router (TypeScript, Tailwind CSS).
- **Web3 Stack**: `wagmi` (v2) and `viem` with `injected()` connector for Core wallet and MetaMask.
- **Role Detection**: Derived strictly on-chain using the connected wallet address (no role selector UI):
  - Admin: matches `admin()` on the active round.
  - Student: `isWhitelisted(address) == true`.
  - Project Owner: wallet owns an approved or registered project.
- **Two-Step Stepper**: Token approval followed by donation with transaction confirmation toasts and Snowtrace explorer links.
- **ABI Synchronization**: Run `pnpm abi` to extract compiled Foundry artifacts from `contracts/out/` into typed `as const` TypeScript files in `src/lib/contracts/abis/`.

---

## Exact Deployment Steps (Avalanche Fuji)

### Option A: Redeploy ONLY RoundFactory (preserves MockUSDC)
```bash
cd contracts
forge script script/DeployFactory.s.sol:DeployFactory --rpc-url fuji --account deployer --broadcast
cd ..
pnpm abi
```
Update `NEXT_PUBLIC_FACTORY_ADDRESS` in `.env.local` and Vercel with the newly deployed `roundFactory` address from `contracts/deployments/fuji.json`.

### Option B: Deploy ONLY a new MockUSDC (with Owner Minting)
When you need a new MockUSDC token with `mint(address, uint256)` capability (owner = deployer) to test large matching pool deposits without caps:
```bash
cd contracts
forge script script/DeployMockUSDC.s.sol --rpc-url fuji --account deployer --broadcast
cd ..
```
Then:
1. Copy the new MockUSDC address logged in the terminal (also recorded as `newMockUsdc` in `contracts/deployments/fuji.json`).
2. Update `NEXT_PUBLIC_USDC_ADDRESS` in `.env.local` with this new address.
3. Synchronize ABIs:
   ```bash
   pnpm abi
   ```
4. Restart the development server:
   ```bash
   pnpm dev
   ```
5. Create a new round on `/admin` (the new round will bind to the new token; old rounds preserve the old token).

### Option C: Full Fresh Deployment (MockUSDC + RoundFactory)
1. **Import your deployer account into the Foundry keystore** (never commit or pass private keys directly):
   ```bash
   cast wallet import deployer --interactive
   ```
   *(You will be prompted to paste your private key and enter a keystore password)*

2. **Verify deployer address and test AVAX balance**:
   ```bash
   cast wallet address --account deployer
   cast balance --rpc-url https://api.avax-test.network/ext/bc/C/rpc $(cast wallet address --account deployer)
   ```
   *(If needed, fund test AVAX via [Avalanche Testnet Faucet](https://faucet.avax.network/))*

3. **Deploy contracts to Fuji**:
   ```bash
   cd contracts
   forge script script/Deploy.s.sol:Deploy --rpc-url fuji --account deployer --broadcast
   cd ..
   ```

4. **Sync ABIs and configure environment**:
   ```bash
   pnpm abi
   cp .env.example .env.local
   ```
   Fill in `.env.local`:
   ```env
   NEXT_PUBLIC_CHAIN_ID=43113
   NEXT_PUBLIC_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
   NEXT_PUBLIC_EXPLORER_URL=https://testnet.snowtrace.io
   NEXT_PUBLIC_FACTORY_ADDRESS=<ROUND_FACTORY_ADDRESS_FROM_STEP_3>
   NEXT_PUBLIC_USDC_ADDRESS=<MOCK_USDC_ADDRESS_FROM_STEP_3>
   ```

5. **Run the application**:
   ```bash
   pnpm dev
   ```

---

## Deployed Addresses (Avalanche Fuji - Chain ID 43113)

| Contract | Fuji Address | Explorer Link |
| :--- | :--- | :--- |
| **RoundFactory** | `TODO` | `TODO` |
| **MockUSDC** | `TODO` | `TODO` |
| **QFRound** (deployed via factory) | `TODO` | `TODO` |

*(Do not invent addresses; fill in after deploying via Step 3 above)*

---

## Known Limitations

1. **Admin Trust**: The round administrator possesses unilateral on-chain authority to verify student wallets (`setWhitelist`), approve participating projects (`approveProject`), deposit matching pool funds (`depositPool`), and holds exclusive finalization rights during the 24-hour post-round grace period.
2. **Unclaimed Funds Stay Locked**: Direct student donations and quadratic matching payouts allocated to an approved project remain locked in the contract until the project owner explicitly invokes `claim(projectId)`. The admin has no backdoor to sweep or seize unclaimed project funds.
3. **Sybil Resistance & Collusion**: In an open testnet setting without decentralized identity (DID), soulbound tokens, or biometric verification, fake wallets and off-chain collusion cannot be fully prevented. Manual admin whitelisting serves as an MVP gate.
4. **Testnet Scope**: Built specifically for Avalanche Fuji Testnet (Chain ID 43113) utilizing `MockUSDC` and test AVAX.
