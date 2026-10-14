import { ContractFunctionRevertedError, BaseError } from "viem";

const ERROR_MESSAGES: Record<string, string> = {
  NotAdmin: "Only the round administrator can perform this action.",
  NotWhitelisted: "Your wallet is not whitelisted. Please request verification first.",
  AlreadyWhitelisted: "This wallet is already whitelisted.",
  AlreadyRequested: "Verification request is already pending admin approval.",
  MaxRequestersReached: "Pending queue is full (max 500 requesters). Please try again later.",
  RoundNotActive: "Donations are only accepted while the round is active.",
  RoundEnded: "This funding round has ended.",
  RoundNotEnded: "Round has not ended yet. Finalization is only allowed after end time.",
  AlreadyFinalized: "This round has already been finalized.",
  NotFinalized: "Round must be finalized before claims or withdrawals.",
  ProjectNotApproved: "This project is not approved to receive donations.",
  ProjectAlreadyApproved: "This project has already been approved.",
  ProjectNotFound: "Project not found.",
  MaxProjectsReached: "Maximum number of projects (50) reached for this round.",
  SelfDonationNotAllowed: "Project owners cannot donate to their own projects.",
  DonationBelowMin: "Donation amount is below the minimum allowed.",
  DonationExceedsMax: "Total donations from your wallet to this project would exceed the maximum limit (5 USDC).",
  AlreadyClaimed: "Funds have already been claimed for this project.",
  NotProjectOwner: "Only the project owner can claim these funds.",
  LeftoverAlreadyWithdrawn: "Leftover matching funds have already been withdrawn.",
  NameLengthInvalid: "Project name must be between 1 and 60 characters.",
  DescriptionLengthInvalid: "Project description must be between 1 and 280 characters.",
  UrlTooLong: "Image or website URL exceeds the 200 character limit.",
  BatchTooLarge: "Batch operation exceeds the maximum allowed size (50).",
  FaucetCooldownActive: "Faucet cooldown is active (1 hour). Please try again later.",
  FaucetCapExceeded: "Lifetime faucet limit of 1,000 USDC reached for this wallet.",
  FinalizeGracePeriodActive: "Finalization is restricted to the admin during the 24-hour grace period following round end.",
  ZeroAmount: "Amount must be greater than zero.",
};

export function getContractErrorMessage(error: unknown): string {
  if (!error) return "An unknown error occurred.";

  if (error instanceof BaseError) {
    const revertError = error.walk((err) => err instanceof ContractFunctionRevertedError) as
      | ContractFunctionRevertedError
      | undefined;

    if (revertError?.data?.errorName) {
      const errorName = revertError.data.errorName;
      return ERROR_MESSAGES[errorName] ?? `Contract error: ${errorName}`;
    }

    if (error.shortMessage) {
      return error.shortMessage;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
