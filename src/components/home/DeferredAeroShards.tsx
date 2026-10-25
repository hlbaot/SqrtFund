"use client";
import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import type { AeroShardsProps } from "@/components/ui/AeroShards";
import { useIdleVisual } from "@/hooks/useIdleVisual";
const AeroShards = dynamic(() => import("@/components/ui/AeroShards"), { ssr: false });
const subscribe = (notify: () => void) => {
  const media = window.matchMedia("(max-width: 1023px)");
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

export default function DeferredAeroShards(props: AeroShardsProps) {
  const ready = useIdleVisual({ motionOnly: true });
  const small = useSyncExternalStore(subscribe, () => window.matchMedia("(max-width: 1023px)").matches, () => false);
  const [failed, setFailed] = useState(false);
  return <>
    {/* Static shards remain visible during loading, reduced motion or GPU failure. */}
    <svg aria-hidden="true" className="absolute inset-0 h-full w-full" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice" fill="#f43f5e" fillOpacity="0.06" stroke="#fb7185" strokeOpacity="0.25">
      {Array.from({ length: 36 }, (_, i) => {
        const x = (i * 137) % 1100 - 50;
        const y = 240 + ((i * 83) % 350);
        return <polygon key={i} points="-45,-8 18,-15 50,8 -12,16" transform={`translate(${x} ${y}) rotate(${i * 19 % 80 - 40}) scale(${0.5 + i % 4 * 0.35})`} />;
      })}
    </svg>
    {ready && !failed && <AeroShards {...props} count={small ? Math.min(props.count ?? 750, 160) : props.count}
      dpr={small ? 1 : props.dpr} mouseInteraction={small ? false : props.mouseInteraction}
      onError={() => setFailed(true)} />}
  </>;
}
