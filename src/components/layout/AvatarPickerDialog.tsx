"use client";

import { useRef, useState } from "react";
import { Check } from "lucide-react";
import { AVATARS } from "@/config/avatars";
import { useAvatar } from "@/hooks/useAvatar";
import { useLocale } from "@/lib/context/locale";
import { txToast } from "@/lib/txToast";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { GradientBorder } from "@/components/ui/GradientBorder";

// Mount only while open so a new opening starts from the saved selection.
export function AvatarPickerDialog({ address, onClose }: { address: string; onClose: () => void }) {
  const { t } = useLocale();
  const { avatar, setAvatar } = useAvatar(address);
  const [selected, setSelected] = useState(avatar);
  const grid = useRef<HTMLDivElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const options = [{ id: "auto", name: t.avatar.auto }, ...AVATARS];
  const selectedName = options.find(option => option.id === selected)?.name ?? t.avatar.auto;
  const selectWithKeyboard = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const columns = grid.current ? getComputedStyle(grid.current).gridTemplateColumns.split(/\s+/).length : 3;
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % options.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + options.length) % options.length;
    else if (event.key === "ArrowDown") next = Math.min(index + columns, options.length - 1);
    else if (event.key === "ArrowUp") next = Math.max(index - columns, 0);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = options.length - 1;
    else return; // Enter/Space use native button activation.
    event.preventDefault();
    setSelected(options[next].id);
    buttons.current[next]?.focus();
  };
  return (
    <Dialog isOpen onClose={onClose} title={t.avatar.title} description={t.avatar.choose} className="max-w-2xl">
      <div className="flex items-center gap-4 border-b border-line pb-4">
        <Avatar address={address} size={72} avatarId={selected} />
        <span className="mono-label text-muted" aria-live="polite">{selectedName}</span>
      </div>
      <div ref={grid} role="radiogroup" aria-label={t.avatar.choose}
        className="mt-4 grid max-h-[46dvh] grid-cols-3 gap-3 overflow-y-auto p-1 sm:grid-cols-4 lg:grid-cols-6">
        {options.map((option, index) => {
          const chosen = selected === option.id;
          return (
            <GradientBorder key={option.id} className="avatar-choice rounded-sm transition-transform duration-150 hover:scale-105 motion-reduce:transform-none"
              data-selected={chosen} data-auto={option.id === "auto"}>
              <button ref={element => { buttons.current[index] = element; }} type="button" role="radio"
                aria-label={option.name} aria-checked={chosen} tabIndex={chosen ? 0 : -1} data-autofocus={chosen ? "true" : undefined}
                title={option.name} onClick={() => setSelected(option.id)} onKeyDown={event => selectWithKeyboard(event, index)}
                className="relative flex aspect-square w-full items-center justify-center rounded-sm p-2 focus-visible:outline-offset-2">
                {option.id === "auto" ? <span className="mono-label text-[10px] text-muted">{t.avatar.auto}</span> : <Avatar address={address} size={48} avatarId={option.id} />}
                {chosen && <Check className="absolute right-1 top-1 h-3.5 w-3.5 text-money" aria-hidden="true" />}
              </button>
            </GradientBorder>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end gap-3 border-t border-line pt-4">
        <Button variant="secondary" size="sm" onClick={onClose}>{t.avatar.cancel}</Button>
        <Button variant="primary" size="sm" onClick={() => {
          if (!setAvatar(selected)) return;
          txToast.success("avatar-updated", t.avatar.updated, undefined, undefined, 2000);
          onClose();
        }}>{t.avatar.save}</Button>
      </div>
    </Dialog>
  );
}
