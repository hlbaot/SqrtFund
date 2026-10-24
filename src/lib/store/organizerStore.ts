import type { OrganizerApplication } from "@/lib/server/organizerApplications";
import { createMirrorStore } from "./mirror";
export type StoredOrganizer = {
  id: string; authorized?: boolean; confirmedBlock?: bigint; application?: OrganizerApplication | null;
};
export const organizerStore = createMirrorStore<StoredOrganizer, {
  organizersByWallet: Record<string, StoredOrganizer>;
}>(entities => ({ organizersByWallet: entities }));
