export type DraftFields = Record<string, string>;
export type DraftSnapshot = {
  values: DraftFields;
  ready: boolean;
  hasDraft: boolean;
  storageError: boolean;
};

/** Tách nội dung theo form, chain, Factory, ví và Round; không dùng một key chung. */
export function formDraftKey(kind: string, chain: number, factory: string, wallet?: string, round?: string) {
  if (!wallet || !factory || (kind === "project" && !round)) return undefined;
  return ["sqrt-fund:form-draft:v1", kind, chain, factory, wallet, round ?? ""].join(":").toLowerCase();
}

/** Store không đọc localStorage lúc render/SSR. Ghi ngay khi nhập để rời trang
 * không mất ký tự cuối. Không autosave bằng effect nên hydrate/đổi ví không
 * ghi nhầm form rỗng hoặc dữ liệu ví cũ vào bản nháp mới.
 */
export function createFormDraftStore(storage: () => Pick<Storage, "getItem" | "setItem" | "removeItem">) {
  const snapshots = new Map<string, DraftSnapshot>();
  const schemas = new Map<string, DraftFields>();
  const listeners = new Map<string, Set<() => void>>();
  const publish = (key: string, snapshot: DraftSnapshot) => {
    snapshots.set(key, snapshot);
    listeners.get(key)?.forEach(listener => listener());
  };
  const decode = (raw: string | null, defaults: DraftFields) => {
    if (!raw) return null;
    try {
      if (raw.length > 100_000) return null;
      const record: unknown = JSON.parse(raw);
      if (!record || typeof record !== "object" || !("version" in record) || record.version !== 1
        || !("values" in record) || !record.values || typeof record.values !== "object") return null;
      const input = record.values as Record<string, unknown>;
      const values = { ...defaults };
      for (const field of Object.keys(defaults)) {
        if (typeof input[field] !== "string" || input[field].length > 20_000) return null;
        values[field] = input[field];
      }
      return values;
    } catch { return null; }
  };
  return {
    snapshot: (key: string) => snapshots.get(key),
    subscribe(key: string, listener: () => void) {
      const group = listeners.get(key) ?? new Set();
      group.add(listener);
      listeners.set(key, group);
      return () => { group.delete(listener); if (!group.size) listeners.delete(key); };
    },
    hydrate(key: string, defaults: DraftFields, initial: () => DraftFields = () => defaults) {
      schemas.set(key, defaults);
      try {
        const values = decode(storage().getItem(key), defaults);
        // Giữ bản trong bộ nhớ nếu lần ghi trước lỗi quota/blocked storage.
        const cached = snapshots.get(key);
        if (cached?.storageError) return;
        publish(key, { values: values ?? initial(), ready: true, hasDraft: values !== null, storageError: false });
      } catch {
        const cached = snapshots.get(key);
        publish(key, cached ? { ...cached, storageError: true } : { values: initial(), ready: true, hasDraft: false, storageError: true });
      }
    },
    setField(key: string, field: string, value: string) {
      const current = snapshots.get(key);
      const defaults = schemas.get(key);
      if (!current?.ready || !defaults || !Object.hasOwn(defaults, field) || typeof value !== "string") return;
      const values = { ...current.values, [field]: value };
      let storageError = false;
      try {
        const raw = JSON.stringify({ version: 1, values });
        if (raw.length > 100_000 || Object.values(values).some(value => value.length > 20_000)) throw new Error("Draft too large");
        storage().setItem(key, raw);
      }
      catch { storageError = true; }
      publish(key, { values, ready: true, hasDraft: true, storageError });
    },
    clear(key: string, initial: DraftFields, expected?: DraftFields) {
      const current = snapshots.get(key);
      // Giao dịch cũ xác nhận sau khi đã sửa nháp: giữ nội dung mới.
      if (expected && (!current || Object.keys(expected).some(field => current.values[field] !== expected[field]))) return;
      let storageError = false;
      try { storage().removeItem(key); } catch { storageError = true; }
      publish(key, { values: initial, ready: true, hasDraft: false, storageError });
    },
    stored(key: string, raw: string | null, initial: () => DraftFields) {
      const defaults = schemas.get(key);
      if (!defaults) return;
      const values = decode(raw, defaults);
      publish(key, { values: values ?? initial(), ready: true, hasDraft: values !== null, storageError: false });
    },
  };
}
