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
  matchingPool: number; // in USDC
  totalDonated: number; // in USDC
  totalSupporters: number;
  projectCount: number;
  startTime: string; // ISO date
  endTime: string; // ISO date
  status: RoundStatus;
  sponsorName: string;
  name?: string;
  organizer?: string;
};

export type ProjectCategory = "education" | "technology" | "environment" | "arts";

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
  totalDonated: number; // in USDC
  estimatedMatching: number; // in USDC
  fundingState?: "estimated" | "finalized" | "cancelled";
  matchingUnavailable?: boolean;
  finalMatching?: number; // Confirmed payoutOf(projectId), in USDC; undefined until read successfully.
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
  amount: number; // in USDC
  txHash: string;
  timestamp: string; // ISO date
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
