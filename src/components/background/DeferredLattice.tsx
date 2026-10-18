"use client";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { useIdleVisual } from "@/hooks/useIdleVisual";

type LatticeProps = ComponentProps<typeof import("./ChainLatticeBackground").ChainLatticeBackground>;
const Lattice = dynamic(() => import("./ChainLatticeBackground").then(module => module.ChainLatticeBackground), { ssr: false });
const SiteLattice = dynamic(() => import("./ChainLatticeBackground").then(module => module.SiteChainLatticeBackground), { ssr: false });
export function ChainLatticeBackground(props: LatticeProps) { return useIdleVisual() ? <Lattice {...props} /> : null; }
export function SiteChainLatticeBackground() { return useIdleVisual() ? <SiteLattice /> : null; }
