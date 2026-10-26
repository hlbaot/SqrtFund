import { create } from "zustand";
import { organizerStore } from "./organizerStore";

export type OrganizerReadCredential = {
  identity: string;
  token: string;
  expiresAt: number;
  nonce: string;
};
/** Memory only. Signatures must never enter localStorage, URLs or query keys. */
export const organizerReadStore = create<{
  identity?: string;
  credential?: OrganizerReadCredential;
  generation: number;
  isAuthorizing: boolean;
  error?: string;
}>(() => ({ generation: 0, isAuthorizing: false }));

export function clearOrganizerReadAccess(identity?: string) {
  organizerReadStore.setState((state) => ({
    identity,
    credential: undefined,
    isAuthorizing: false,
    error: undefined,
    generation: state.generation + 1,
  }));
  organizerStore.getState().reset();
}

export function syncOrganizerReadIdentity(identity?: string) {
  if (organizerReadStore.getState().identity !== identity)
    clearOrganizerReadAccess(identity);
}
