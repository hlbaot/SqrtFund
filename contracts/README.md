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

### Hợp đồng ví cho người dùng Core

| Hợp đồng | Chức năng |
| --- | --- |
| [`SmartWallet`](src/SmartWallet.sol) | Ví hợp đồng do chủ ví kiểm soát. Chủ ví có thể dùng Core để ký giao dịch. Ví hỗ trợ giao dịch đơn qua `execute`, giao dịch theo lô qua `executeBatch` và chữ ký EIP-712 qua `executeWithSig`. Relayer trả phí gas khi gửi lệnh đã ký. Hạn mức chi tiêu chỉ áp dụng cho AVAX gốc. Để khôi phục quyền sở hữu, cần đủ số guardian xác nhận và chờ ít nhất một ngày. |
| [`WalletFactory`](src/WalletFactory.sol) | Tạo bản sao `SmartWallet` tại địa chỉ xác định trước. Dùng `getAddress(owner, salt)` để tính địa chỉ ví và `createWallet(owner, salt)` để triển khai. Factory lưu danh sách ví theo chủ sở hữu ban đầu. Sau khi khôi phục, đọc `SmartWallet.owner()` để biết chủ sở hữu hiện tại. |
| [`MultiSigTreasury`](src/MultiSigTreasury.sol) | Quỹ giữ AVAX và token của nền tảng. Chủ quỹ có thể đề xuất, xác nhận, rút xác nhận và thực thi giao dịch. Giao dịch cần đủ M trong N chủ quỹ xác nhận theo ngưỡng đã cấu hình. Việc thay đổi chủ quỹ hoặc ngưỡng xác nhận cũng phải được thực hiện thông qua giao dịch của quỹ. |

Web hiện hỗ trợ kết nối Core cho tính năng gây quỹ. Màn hình Smart Wallet và dịch vụ relayer vẫn đang chờ tích hợp.

---

## Commands

### Build & Test

```bash
forge build
forge test -vv
```

Chạy riêng bộ kiểm thử ví và quỹ đa chữ ký từ thư mục `contracts/` bằng lệnh sau.

```bash
forge test --match-contract '^(SmartWalletTest|MultiSigTreasuryTest)$' -vv
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

### Triển khai hợp đồng ví

Chạy lệnh sau từ thư mục `contracts/` để mô phỏng triển khai trên máy cục bộ.

```bash
forge script script/DeployWallet.s.sol:DeployWallet
```

Script triển khai `WalletFactory` và bản triển khai gốc của `SmartWallet`. Để mô phỏng thêm `MultiSigTreasury`, đặt `TREASURY_OWNERS` thành danh sách các địa chỉ khác nhau, khác địa chỉ 0 và được phân cách bằng dấu phẩy. Đặt `TREASURY_THRESHOLD` là số nguyên từ 1 đến số lượng chủ quỹ.

Trước khi gửi giao dịch triển khai, cần xử lý hai vấn đề đã phát hiện. Quỹ cần tính xác nhận theo danh sách chủ quỹ hiện tại. Quy trình khôi phục đang chờ cần được bảo vệ khỏi việc guardian liên tục đặt lại. Sau khi triển khai lên Fuji, ghi lại chain ID, mã giao dịch và địa chỉ hợp đồng. Script in các địa chỉ ra terminal. Cần cập nhật `deployments/fuji.json` thủ công.
