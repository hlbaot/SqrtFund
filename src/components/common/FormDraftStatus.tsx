"use client";
import { useLocale } from "@/lib/context/locale";
import { Button } from "@/components/ui/Button";

export function FormDraftStatus({ ready, hasDraft, storageError, disabled, onDiscard }: {
  ready: boolean; hasDraft: boolean; storageError: boolean; disabled?: boolean; onDiscard: () => void;
}) {
  const { t } = useLocale();
  return <div className="flex flex-wrap items-center justify-between gap-2 border border-line bg-surface-2 p-3 text-xs text-muted">
    <p role="status">{!ready ? t.drafts.loading : storageError ? t.drafts.storageError : hasDraft ? t.drafts.saved : t.drafts.hint}</p>
    {hasDraft && <Button type="button" size="sm" variant="ghost" disabled={disabled || !ready} onClick={onDiscard}>{t.drafts.discard}</Button>}
  </div>;
}
