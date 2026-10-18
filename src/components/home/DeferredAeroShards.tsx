"use client";
import dynamic from "next/dynamic";
import type { AeroShardsProps } from "@/components/ui/AeroShards";
import { useIdleVisual } from "@/hooks/useIdleVisual";
const AeroShards = dynamic(() => import("@/components/ui/AeroShards"), { ssr: false });
// The existing CSS aurora remains on mobile; WebGPU is decorative and expensive.
export default function DeferredAeroShards(props: AeroShardsProps) { return useIdleVisual({ motionOnly: true, desktopOnly: true }) ? <AeroShards {...props} /> : null; }
