"use client";

import { useState } from "react";
import { AVATARS } from "@/config/avatars";
import { useLocale } from "@/lib/context/locale";

export function Avatar({ address, size = 40, avatarId = "auto", forceAuto = false }: {
  address: string;
  size?: number;
  avatarId?: string;
  forceAuto?: boolean;
}) {
  const { t } = useLocale();
  const item = forceAuto ? undefined : AVATARS.find(avatar => avatar.id === avatarId);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const hue = (parseInt(address.slice(2, 8), 16) || 0) % 360;
  const label = t.avatar.forAddress.replace("{address}", address);
  if (item && failedSource !== item.src) {
    return (
      // The catalog contains only our own SVG data URIs; arbitrary URLs are never accepted.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={item.src} alt={`${item.name} — ${label}`} width={size} height={size}
        className="shrink-0 rounded-full border border-line-strong object-cover"
        style={{ width: size, height: size, imageRendering: "pixelated" }}
        onError={() => setFailedSource(item.src)} />
    );
  }
  return (
    <span role="img" aria-label={`${t.avatar.auto} — ${label}`}
      className="inline-flex shrink-0 items-center justify-center rounded-full border border-line-strong font-mono font-bold leading-none"
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.3), background: `hsl(${hue} 40% 18%)`, color: `hsl(${hue} 70% 75%)` }}>
      {address.slice(2, 4).toUpperCase() || "?"}
    </span>
  );
}
