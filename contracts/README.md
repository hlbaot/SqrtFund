# SqrtFund Smart Contracts (Foundry)

Contracts for the SqrtFund decentralized quadratic funding platform on Avalanche Fuji (Chain ID 43113).

## Architecture

- **`src/MockUSDC.sol`**: 6 decimals ERC-20 token with a faucet function (`faucetMint`).
- **`src/QFRound.sol`**: Core quadratic funding round contract. Stores on-chain metadata:
  - `name`: round name (1..60 bytes, required).
  - `organizer`: round organizer / sponsor (0..60 bytes, optional).
- **`src/RoundFactory.sol`**: Factory contract that deploys and indexes `QFRound` instances.
  - Callable only by the factory owner.
  - Emits `RoundCreated(address indexed roundAddress, address indexed admin, address token, string name)`.

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
    uint256 maxMatchBps
) external onlyOwner returns (address roundAddress);
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
