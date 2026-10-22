# SqrtFund Smart Contracts (Foundry)

Contracts for the SqrtFund decentralized quadratic funding platform on Avalanche Fuji (Chain ID 43113).

The admin form now requires a confirmed deposit before creating a funded round. See [deposit-before-create deployment and recovery guide](../docs/deposit-before-create.md). This requires a newly deployed Factory; changing the ABI does not upgrade an existing Factory.

## Architecture

- **`src/MockUSDC.sol`**: 6 decimals ERC-20 token with a faucet function (`faucetMint`).
- **`src/QFRound.sol`**: Core quadratic funding round contract. Stores on-chain metadata:
  - `name`: round name (1..60 bytes, required).
  - `organizer`: round organizer / sponsor (0..60 bytes, optional).
- **`src/RoundFactory.sol`**: Factory contract that deploys and indexes `QFRound` instances.
  - Creation and pre-deposits are available to the factory owner and authorized Organizers. Only the owner can grant or revoke Organizers.
  - Emits `RoundCreated(address indexed roundAddress, address indexed admin, address token, string name)`.
  - `depositInitialPool(token, amount)` reserves wallet-owned credit; `withdrawInitialPool(token, amount)` refunds unused credit, including after ownership transfer.
  - `createFundedRound(..., maxPerRound, initialPool)` consumes confirmed credit and transfers funds atomically into a `PrefundedQFRound`, which inherits the normal round API.

### `createRound` Signature

```solidity
function createRound(
    string calldata name,
    string calldata organizer,
    address token,
    uint256 startTime,
    uint256 endTime,
    uint256 minDonation,
    uint256 maxDonation,
    uint256 maxMatchBps,
    uint256 maxPerRound
) external nonReentrant onlyOrganizer returns (address roundAddress);
```

> **Note**: To support on-chain custom round names and organizers, the `RoundFactory` contract must be redeployed.

---

## Commands

### Build & Test

```bash
forge build
forge test -vv
```

### Deploy Only RoundFactory (Reuse existing MockUSDC)

To deploy only a new `RoundFactory` and update `deployments/fuji.json` automatically while keeping `mockUsdc` intact:

```bash
forge script script/DeployFactory.s.sol:DeployFactory --rpc-url fuji --account deployer --broadcast
```

### Full Deployment (MockUSDC + RoundFactory)

```bash
forge script script/Deploy.s.sol:Deploy --rpc-url fuji --account deployer --broadcast
```
