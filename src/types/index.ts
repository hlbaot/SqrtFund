export type ProjectDonations = Record<string, number>;

export type MatchingProjectInput = {
  id: string;
  donations: ProjectDonations;
};

export type MatchingProjectResult = MatchingProjectInput & {
  totalDonated: number;
  raw: number;
  matching: number;
};

export type RoundStatus = "open" | "closed" | "finalized" | "cancelled";

export type Round = {
  id: string;
  title: string;
  description: string;
  matchingPool: number; // đơn vị USDC
  totalDonated: number; // đơn vị USDC
  totalSupporters: number;
  projectCount: number;
  startTime: string; // ngày ISO
  endTime: string; // ngày ISO
  status: RoundStatus;
  sponsorName: string;
  name?: string;
  organizer?: string;
};

export type ProjectCategory = import("@/lib/projectCategories").FundingCategory | "uncategorized";

export type ProjectStatus = "approved" | "pending" | "rejected";

export type Project = {
  id: string;
  roundId: string;
  name: string;
  nameVi?: string;
  ownerName?: string;
  shortDescription: string;
  shortDescriptionVi?: string;
  description: string;
  descriptionVi?: string;
  category: ProjectCategory;
  imageUrl?: string;
  contactUrl: string;
  ownerAddress: string;
  supporterCount: number;
  totalDonated: number; // đơn vị USDC
  estimatedMatching: number; // đơn vị USDC
  claimed?: boolean;
  finalizedAt?: number; // Block timestamp (giây) của event Finalized đã xác nhận.
  fundingState?: "estimated" | "finalized" | "cancelled";
  matchingUnavailable?: boolean;
  finalMatching?: number; // payoutOf(projectId) đã xác nhận, đơn vị USDC; undefined đến khi đọc thành công.
  status: ProjectStatus;
  rejected?: boolean;
  rank?: number;
  whySupportersMatter?: string;
  whySupportersMatterVi?: string;
};

export type Donation = {
  id: string;
  roundId: string;
  projectId: string;
  projectName: string;
  donorAddress: string;
  amount: number; // đơn vị USDC
  txHash: string;
  timestamp: string; // ngày ISO
};

export type WalletRole = "visitor" | "student" | "project_owner" | "admin";
export type NetworkState = "fuji" | "wrong";
export type DataState = "normal" | "loading" | "empty" | "error";

export type WalletRequest = {
  address: string;
  role: WalletRole;
  isVerified: boolean;
  network: NetworkState;
};

export type WhitelistEntry = {
  id: string;
  address: string;
  studentId: string;
  university: string;
  status: "approved" | "pending" | "rejected";
  submittedAt: string;
};
