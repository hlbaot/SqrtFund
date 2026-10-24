import { create } from "zustand";

export type StoreChange = { rollback: () => void; commit: () => boolean };
export type MirrorState<T extends { id: string }> = {
  entities: Record<string, T>;
  pending: Record<string, boolean>;
  versions: Record<string, number>;
  updatedAt: Record<string, number>;
  upsert: (entity: T, optimistic?: boolean) => StoreChange;
  patch: (id: string, patch: Partial<T>, optimistic?: boolean) => StoreChange;
  remove: (id: string, optimistic?: boolean) => StoreChange;
  hydrate: (entities: readonly T[], sourceTime?: number) => void;
  reset: () => void;
};
export const addressKey = (address: string) => address.toLowerCase();

/** Memory only: no browser storage access during SSR or the first render.
 * Receipt patches fence off stale queries; rollback never clobbers a newer write. */
export function createMirrorStore<T extends { id: string }, D extends object = Record<never, never>>(
  derive: (entities: Record<string, T>) => D = () => ({} as D),
) {
  return create<MirrorState<T> & D>((set, get) => {
    let revision = 0;
    const snapshots = new Map<number, { key: string; entity: T | undefined; pending: boolean; updatedAt: number; version: number }>();
    const invalid = new Set<number>();
    const mutate = (id: string, value: T | undefined, optimistic = false): StoreChange => {
      const key = addressKey(id), before = get();
      const version = ++revision;
      snapshots.set(version, { key, entity: before.entities[key], pending: before.pending[key] ?? false,
        updatedAt: before.updatedAt[key] ?? 0, version: before.versions[key] ?? 0 });
      const entities = { ...before.entities };
      if (value) entities[key] = { ...before.entities[key], ...value, id: key };
      else delete entities[key];
      set({ entities, ...derive(entities), pending: { ...before.pending, [key]: optimistic },
        versions: { ...before.versions, [key]: version }, updatedAt: { ...before.updatedAt, [key]: Date.now() } } as Partial<MirrorState<T> & D>);
      return {
        commit: () => {
          if (get().versions[key] !== version) return false;
          set({ pending: { ...get().pending, [key]: false } } as Partial<MirrorState<T> & D>);
          return true;
        },
        rollback: () => {
          invalid.add(version);
          const current = get();
          if (current.versions[key] !== version) return;
          let snapshot = snapshots.get(version)!;
          while (invalid.has(snapshot.version) && snapshots.has(snapshot.version)) snapshot = snapshots.get(snapshot.version)!;
          const restored = { ...current.entities };
          if (snapshot.entity) restored[key] = snapshot.entity; else delete restored[key];
          set({ entities: restored, ...derive(restored),
            pending: { ...current.pending, [key]: snapshot.pending },
            versions: { ...current.versions, [key]: snapshot.version },
            updatedAt: { ...current.updatedAt, [key]: snapshot.updatedAt },
          } as Partial<MirrorState<T> & D>);
        },
      };
    };
    return {
      entities: {}, ...derive({}), pending: {}, versions: {}, updatedAt: {},
      upsert: (entity, optimistic) => mutate(entity.id, entity, optimistic),
      patch: (id, patch, optimistic) => {
        const previous = get().entities[addressKey(id)];
        if (!previous) return { rollback() {}, commit: () => false };
        return mutate(id, { ...previous, ...patch, id: previous.id }, optimistic);
      },
      remove: (id, optimistic) => mutate(id, undefined, optimistic),
      hydrate: (values, sourceTime = Date.now()) => {
        const current = get(), entities = { ...current.entities }, updatedAt = { ...current.updatedAt }, versions = { ...current.versions };
        let changed = false;
        for (const value of values) {
          const key = addressKey(value.id);
          if (current.pending[key] || sourceTime < (current.updatedAt[key] ?? 0)) continue;
          entities[key] = { ...entities[key], ...value, id: key };
          updatedAt[key] = sourceTime; versions[key] = ++revision; changed = true;
          for (const [version, snapshot] of snapshots) if (snapshot.key === key) { snapshots.delete(version); invalid.delete(version); }
        }
        if (changed) set({ entities, ...derive(entities), updatedAt, versions } as Partial<MirrorState<T> & D>);
      },
      reset: () => { snapshots.clear(); invalid.clear(); set({ entities: {}, ...derive({}), pending: {}, versions: {}, updatedAt: {} } as Partial<MirrorState<T> & D>); },
    };
  });
}
