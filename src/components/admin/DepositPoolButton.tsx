"use client";

import { useCallback, useState } from "react";
import type { Address } from "viem";
import { Coins, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useLocale } from "@/lib/context/locale";
import { DepositPoolForm } from "./DepositPoolForm";

export function DepositPoolButton({ roundAddress, amount, onDeposited, label, disabled = false }: { roundAddress?: Address; amount?: string; onDeposited?: () => void; label?: string; disabled?: boolean }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => { if (!busy) setOpen(false); }, [busy]);
  return <>
    <Button type="button" variant="secondary" onClick={() => setOpen(true)} disabled={disabled} aria-label={label ?? t.admin.topUpRoundButton} className="gap-2 text-xs focus-visible:ring-2 focus-visible:ring-primary/60">
      <Coins className="h-3.5 w-3.5 text-money" aria-hidden="true" />
      {label ?? t.admin.topUpRoundButton}
      <Plus className="h-3 w-3 text-muted" aria-hidden="true" />
    </Button>
    {open && <Dialog isOpen onClose={close} title={t.admin.depositPoolTitle} description={t.admin.depositPoolDesc} className="max-w-2xl">
      <DepositPoolForm embedded initialRoundAddress={roundAddress} initialAmount={amount} onPendingChange={setBusy}
        onDeposited={() => { setOpen(false); onDeposited?.(); }} />
    </Dialog>}
  </>;
}
