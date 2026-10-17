import { ContractFunctionRevertedError, BaseError } from "viem";
import { formatCooldown } from "@/lib/format";

export const ERROR_SELECTORS: Record<string, string> = {
  // OpenZeppelin ERC20
  "0xe450d38c": "ERC20InsufficientBalance",
  "0xfb8f41b2": "ERC20InsufficientAllowance",
  "0x96c6fd1e": "ERC20InvalidSender",
  "0xec442f05": "ERC20InvalidReceiver",
  "0xe602df05": "ERC20InvalidApprover",
  "0x94280d62": "ERC20InvalidSpender",
  "0x5274afe7": "SafeERC20FailedOperation",

  // OpenZeppelin Ownable
  "0x118cdaa7": "OwnableUnauthorizedAccount",
  "0x1e4fbdf7": "OwnableInvalidOwner",

  "0x971730a9": "NotStudent",
  "0x47a11b8d": "InvalidRoundBudget",
  "0x17144e75": "RoundBudgetExceeded",
  "0xc31a9800": "RoundIsCancelled",
  "0x779df1a9": "RoundNotCancelled",
  "0xf76aef65": "NothingToRefund",
  "0xa30bc0c1": "CancelledPoolAlreadyWithdrawn",
  "0xc2e5347d": "EmptyBatch",
  "0x36df1424": "OwnerProjectLimit",
  // QFRound & MockUSDC custom errors
  "0xd92e233d": "ZeroAddress",
  "0x536a71af": "InvalidTimeRange",
  "0x3321e4a1": "InvalidDonationBounds",
  "0xce2f55d8": "InvalidMaxMatchBps",
  "0x7bfa4b9f": "NotAdmin",
  "0x584a7938": "NotWhitelisted",
  "0xb73e95e1": "AlreadyWhitelisted",
  "0x5303ed82": "AlreadyRequested",
  "0xf8f7e4df": "MaxRequestersReached",
  "0x0b7d62e2": "BatchTooLarge",
  "0x17e37b5c": "BatchLengthMismatch",
  "0x3df07da5": "RoundNotActive",
  "0x6b5fd31b": "RoundEnded",
  "0xc43172d2": "RoundNotEnded",
  "0x475a2535": "AlreadyFinalized",
  "0x1bee0d5a": "NotFinalized",
  "0xfcf60071": "ProjectNotApproved",
  "0xead944ec": "ProjectAlreadyApproved",
  "0x4c4f68ca": "ProjectNotFound",
  "0x4df68de6": "MaxProjectsReached",
  "0x926ddfc0": "SelfDonationNotAllowed",
  "0x99e95c00": "DonationBelowMin",
  "0xf9d3a6a1": "DonationExceedsMax",
  "0x646cf558": "AlreadyClaimed",
  "0x7c2411e9": "NotProjectOwner",
  "0x8bc8cd3a": "LeftoverAlreadyWithdrawn",
  "0x6a96aade": "NameLengthInvalid",
  "0x03115c72": "DescriptionLengthInvalid",
  "0xf84c63c7": "UrlTooLong",
  "0x21a5cdc3": "FinalizeGracePeriodActive",
  "0x1f2a2005": "ZeroAmount",
  "0x85d9f78c": "FaucetCooldownActive",
  "0x1bb26aff": "FaucetCooldownActive",
  "0x9bacae1e": "ClaimCooldown",
  "0x37583762": "FaucetCapExceeded",
};

export const ERROR_MESSAGES_EN: Record<string, string> = {
  // Token & Transfer errors
  ERC20InsufficientBalance:
    "Insufficient USDC balance. Your wallet does not have enough USDC to complete this action. Please claim 100 USDC from the Faucet in 'My Dashboard'.",
  ERC20InsufficientAllowance:
    "Insufficient USDC allowance. Please approve the USDC transfer transaction in your wallet first.",
  SafeERC20FailedOperation:
    "USDC transfer failed. Please verify that your wallet has enough USDC balance and approved allowance.",
  ERC20InvalidSender: "Invalid token sender address.",
  ERC20InvalidReceiver: "Invalid token receiver address.",
  OwnableUnauthorizedAccount: "Unauthorized: only the contract owner can perform this action.",
  OwnableInvalidOwner: "Invalid owner address provided.",

  NotStudent: "Verify your university email at /verify before participating.",
  InvalidRoundBudget: "The round budget must be at least the per-project limit.",
  RoundBudgetExceeded: "This donation exceeds your remaining round budget.",
  RoundIsCancelled: "This round was cancelled. Request a refund for your donations.",
  RoundNotCancelled: "Refunds are available only after the round is cancelled.",
  NothingToRefund: "There is no remaining donation to refund for this project.",
  CancelledPoolAlreadyWithdrawn: "The cancelled round pool has already been returned.",
  EmptyBatch: "Select at least one project.",
  OwnerProjectLimit: "Each wallet can register at most 2 projects per round, including pending projects.",
  // Round errors
  NotAdmin: "Only the round administrator can perform this action.",
  NotWhitelisted: "Your wallet is not whitelisted. Please request student verification first.",
  AlreadyWhitelisted: "This wallet is already whitelisted.",
  AlreadyRequested: "Your verification request is already pending admin approval.",
  MaxRequestersReached: "Pending queue is full (max 500 requesters). Please try again later.",
  RoundNotActive: "Donations are only accepted while the round is active.",
  RoundEnded: "This funding round has ended.",
  RoundNotEnded: "Round has not ended yet. Finalization is only allowed after the end time.",
  AlreadyFinalized: "This round has already been finalized.",
  NotFinalized: "Round must be finalized before funds can be claimed or withdrawn.",
  ProjectNotApproved: "This project is not approved to receive donations in this round.",
  ProjectAlreadyApproved: "This project has already been approved.",
  ProjectNotFound: "Project not found.",
  MaxProjectsReached: "Maximum number of projects (50) reached for this round.",
  SelfDonationNotAllowed: "Project owners cannot donate to their own projects.",
  DonationBelowMin: "Donation amount is below the minimum allowed limit (1 USDC).",
  DonationExceedsMax:
    "Total donations from your wallet to this project would exceed the maximum limit (5 USDC).",
  AlreadyClaimed: "Matching funds have already been claimed for this project.",
  NotProjectOwner: "Only the project owner can claim these matching funds.",
  LeftoverAlreadyWithdrawn: "Leftover matching funds have already been withdrawn.",
  NameLengthInvalid: "Project name must be between 1 and 60 characters.",
  DescriptionLengthInvalid: "Project description must be between 1 and 280 characters.",
  UrlTooLong: "Image or website URL exceeds the 200 character limit.",
  BatchTooLarge: "Batch operation exceeds the maximum allowed size (50).",
  BatchLengthMismatch: "The two batch arrays must have equal lengths.",
  FaucetCooldownActive: "Faucet cooldown is active. Please try again later.",
  ClaimCooldown: "Cooldown not finished, try again later.",
  FaucetCapExceeded: "Lifetime faucet limit of 1,000 USDC reached for this wallet.",
  FinalizeGracePeriodActive:
    "Finalization is restricted to the admin during the 24-hour grace period following round end.",
  ZeroAmount: "Amount must be greater than zero.",
  ZeroAddress: "Invalid zero address provided.",
  InvalidTimeRange: "End time must be strictly after start time.",
  InvalidDonationBounds: "Invalid donation limits configured.",
  InvalidMaxMatchBps: "Matching cap exceeds maximum allowed (10,000 basis points / 100%).",
};

export const ERROR_MESSAGES_VI: Record<string, string> = {
  // Token & Transfer errors
  ERC20InsufficientBalance:
    "Số dư USDC không đủ. Ví của bạn không đủ USDC để thực hiện giao dịch này. Vui lòng nhận 100 USDC từ Faucet tại trang 'My Dashboard'.",
  ERC20InsufficientAllowance:
    "Hạn mức chuyển USDC chưa được cấp phép. Vui lòng ký xác nhận Approve trên ví trước.",
  SafeERC20FailedOperation:
    "Giao dịch chuyển USDC thất bại. Vui lòng kiểm tra lại số dư ví và hạn mức phê duyệt.",
  ERC20InvalidSender: "Địa chỉ người gửi token không hợp lệ.",
  ERC20InvalidReceiver: "Địa chỉ người nhận token không hợp lệ.",
  OwnableUnauthorizedAccount: "Chỉ người sở hữu hợp đồng (Owner) mới có quyền thực hiện thao tác này.",
  OwnableInvalidOwner: "Địa chỉ Owner không hợp lệ.",

  NotStudent: "Xác thực email trường tại /verify trước khi tham gia.",
  InvalidRoundBudget: "Trần tổng mỗi round phải lớn hơn hoặc bằng trần mỗi dự án.",
  RoundBudgetExceeded: "Khoản ủng hộ vượt ngân sách còn lại của bạn trong round.",
  RoundIsCancelled: "Vòng này đã hủy. Bạn có thể hoàn lại khoản đã ủng hộ.",
  RoundNotCancelled: "Chỉ được hoàn tiền sau khi vòng bị hủy.",
  NothingToRefund: "Không còn khoản ủng hộ để hoàn cho dự án này.",
  CancelledPoolAlreadyWithdrawn: "Pool của vòng đã hủy đã được rút.",
  EmptyBatch: "Vui lòng chọn ít nhất một dự án.",
  OwnerProjectLimit: "Mỗi ví chỉ được đăng ký tối đa 2 dự án trong một vòng, gồm cả dự án chờ duyệt.",
  // Round errors
  NotAdmin: "Chỉ có Admin của vòng mới có quyền thực hiện thao tác này.",
  NotWhitelisted: "Ví của bạn chưa được duyệt Whitelist sinh viên. Vui lòng gửi yêu cầu xác thực trước.",
  AlreadyWhitelisted: "Ví này đã có trong danh sách Whitelist rồi.",
  AlreadyRequested: "Yêu cầu xác thực ví của bạn đang chờ Admin phê duyệt.",
  MaxRequestersReached: "Hàng đợi xác thực đã đầy (tối đa 500 yêu cầu). Vui lòng thử lại sau.",
  RoundNotActive: "Vòng tài trợ hiện chưa hoạt động để nhận quyên góp.",
  RoundEnded: "Vòng tài trợ này đã kết thúc.",
  RoundNotEnded: "Vòng tài trợ chưa kết thúc. Chỉ có thể Finalize sau khi hết thời gian vòng.",
  AlreadyFinalized: "Vòng tài trợ này đã được Finalize trước đó.",
  NotFinalized: "Vòng tài trợ phải được Finalize trước khi nhận tiền thưởng hoặc rút quỹ.",
  ProjectNotApproved: "Dự án này chưa được duyệt tham gia nhận tài trợ.",
  ProjectAlreadyApproved: "Dự án này đã được Admin duyệt trước đó.",
  ProjectNotFound: "Không tìm thấy thông tin dự án.",
  MaxProjectsReached: "Đã đạt giới hạn tối đa 50 dự án cho vòng này.",
  SelfDonationNotAllowed: "Chủ dự án không được phép tự quyên góp cho dự án của chính mình.",
  DonationBelowMin: "Số tiền quyên góp thấp hơn mức tối thiểu (1 USDC).",
  DonationExceedsMax:
    "Tổng số tiền quyên góp từ ví của bạn cho dự án này đã vượt mức tối đa (5 USDC).",
  AlreadyClaimed: "Tiền tài trợ của dự án này đã được nhận rồi.",
  NotProjectOwner: "Chỉ chủ dự án mới có quyền nhận số tiền tài trợ này.",
  LeftoverAlreadyWithdrawn: "Số tiền matching pool còn dư đã được rút trước đó.",
  NameLengthInvalid: "Tên dự án phải từ 1 đến 60 ký tự.",
  DescriptionLengthInvalid: "Mô tả dự án phải từ 1 đến 280 ký tự.",
  UrlTooLong: "Đường dẫn hình ảnh hoặc website vượt quá độ dài tối đa (200 ký tự).",
  BatchTooLarge: "Thao tác theo lô vượt quá số lượng tối đa cho phép (50).",
  BatchLengthMismatch: "Hai danh sách trong thao tác theo lô phải cùng độ dài.",
  FaucetCooldownActive: "Faucet đang trong thời gian chờ. Vui lòng thử lại sau.",
  ClaimCooldown: "Chưa hết thời gian chờ, thử lại sau.",
  FaucetCapExceeded: "Ví đã đạt hạn mức nhận tối đa 1,000 USDC từ Faucet.",
  FinalizeGracePeriodActive:
    "Trong vòng 24 giờ sau khi kết thúc, chỉ có Admin mới được quyền Finalize.",
  ZeroAmount: "Số tiền phải lớn hơn 0.",
  ZeroAddress: "Địa chỉ không hợp lệ (0x0).",
  InvalidTimeRange: "Thời gian kết thúc phải sau thời gian bắt đầu.",
  InvalidDonationBounds: "Hạn mức tiền quyên góp không hợp lệ.",
  InvalidMaxMatchBps: "Trần matching pool vượt quá giới hạn tối đa (100%).",
};

export function getContractErrorMessage(error: unknown, locale: "en" | "vi" = "en"): string {
  if (!error) {
    return locale === "vi" ? "Đã xảy ra lỗi không xác định." : "An unknown error occurred.";
  }

  const messages = locale === "vi" ? ERROR_MESSAGES_VI : ERROR_MESSAGES_EN;

  // 1. Check viem ContractFunctionRevertedError in the error chain
  let errorName: string | undefined;

  if (error instanceof BaseError) {
    const revertError = error.walk((err) => err instanceof ContractFunctionRevertedError) as
      | ContractFunctionRevertedError
      | undefined;

    if (revertError?.data?.errorName) {
      errorName = revertError.data.errorName;
    }
  }

  // 2. Check for hex selector or errorName on any cause in error chain
  if (!errorName && typeof error === "object" && error !== null) {
    let current: unknown = error;
    while (current && !errorName) {
      const currentObj = current as { data?: unknown; cause?: unknown };
      if (typeof currentObj.data === "string") {
        const hex = currentObj.data.toLowerCase();
        for (const [selector, name] of Object.entries(ERROR_SELECTORS)) {
          if (hex.includes(selector.toLowerCase())) {
            errorName = name;
            break;
          }
        }
      } else if (
        typeof currentObj.data === "object" &&
        currentObj.data !== null &&
        "errorName" in currentObj.data &&
        typeof (currentObj.data as { errorName?: unknown }).errorName === "string"
      ) {
        errorName = (currentObj.data as { errorName: string }).errorName;
        break;
      }
      current = currentObj.cause;
    }
  }

  // 3. Search the stringified error message for known 4-byte selectors or names
  const fullMessage =
    (typeof error === "object" && error !== null && "shortMessage" in error && typeof (error as { shortMessage: unknown }).shortMessage === "string"
      ? (error as { shortMessage: string }).shortMessage
      : "") ||
    (typeof error === "object" && error !== null && "details" in error && typeof (error as { details: unknown }).details === "string"
      ? (error as { details: string }).details
      : "") ||
    (error instanceof Error ? error.message : String(error));

  const lowerMessage = fullMessage.toLowerCase();

  if (!errorName) {
    for (const [selector, name] of Object.entries(ERROR_SELECTORS)) {
      if (lowerMessage.includes(selector.toLowerCase())) {
        errorName = name;
        break;
      }
    }
  }

  if (!errorName) {
    for (const name of Object.keys(ERROR_MESSAGES_EN)) {
      if (lowerMessage.includes(name.toLowerCase())) {
        errorName = name;
        break;
      }
    }
  }

  if (errorName && (errorName === "FaucetCooldownActive" || errorName === "ClaimCooldown")) {
    let nextAt: number | undefined;
    if (error instanceof BaseError) {
      const revertError = error.walk((err) => err instanceof ContractFunctionRevertedError) as
        | ContractFunctionRevertedError
        | undefined;
      const rawArg = revertError?.data?.args?.[0];
      if (typeof rawArg === "bigint" || typeof rawArg === "number") {
        nextAt = Number(rawArg);
      }
    }
    if (nextAt && nextAt > 0) {
      const diff = Math.max(0, nextAt - Math.floor(Date.now() / 1000));
      if (diff > 0) {
        return locale === "vi"
          ? `Chưa hết thời gian chờ, thử lại sau ${formatCooldown(diff)}`
          : `Cooldown not finished, try again in ${formatCooldown(diff)}`;
      }
    }
  }

  if (errorName && messages[errorName]) {
    return messages[errorName];
  }

  // 4. Common web3 / RPC failure patterns
  if (isUserRejected(error)) {
    return locale === "vi"
      ? "Giao dịch đã bị từ chối trên ví của bạn."
      : "Transaction was rejected in your wallet.";
  }

  if (/insufficient funds for gas|intrinsic transaction cost/i.test(fullMessage)) {
    return locale === "vi"
      ? "Ví của bạn không đủ AVAX để trả phí gas giao dịch. Hãy nhận thêm AVAX từ Fuji Faucet."
      : "Insufficient AVAX for transaction gas fee. Please claim testnet AVAX from the Fuji faucet.";
  }

  if (/connector not found|wallet not found/i.test(fullMessage)) {
    return locale === "vi"
      ? "Không tìm thấy ví Web3. Vui lòng cài đặt và bật tiện ích Core hoặc MetaMask."
      : "Web3 wallet not found. Please install or enable Core or MetaMask.";
  }

  // 5. Clean up ugly technical execution reverted strings
  if (
    /execution reverted/i.test(fullMessage) ||
    /unable to calculate gas limit/i.test(fullMessage) ||
    /action="estimategas"/i.test(fullMessage)
  ) {
    return locale === "vi"
      ? "Giao dịch bị từ chối bởi smart contract. Vui lòng kiểm tra lại số dư token và điều kiện vòng."
      : "Transaction reverted by smart contract. Please check your token balance and round conditions.";
  }

  if (error instanceof BaseError && error.shortMessage) {
    return error.shortMessage;
  }

  if (error instanceof Error) {
    const firstLine = error.message.split("\n")[0];
    return firstLine.length > 180 ? `${firstLine.slice(0, 180)}...` : firstLine;
  }

  return String(error);
}

/** Wallet libraries wrap EIP-1193 rejection errors in nested causes. */
export function isUserRejected(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    if (typeof current === "object") {
      const value = current as { code?: unknown; message?: string; shortMessage?: string; cause?: unknown };
      if (value.code === 4001 || value.code === "4001" || value.code === "ACTION_REJECTED") return true;
      if (/user rejected|user denied|ACTION_REJECTED/i.test(`${value.message ?? ""} ${value.shortMessage ?? ""}`)) return true;
      current = value.cause;
    } else {
      return /user rejected|user denied|ACTION_REJECTED/i.test(String(current));
    }
  }
  return false;
}
