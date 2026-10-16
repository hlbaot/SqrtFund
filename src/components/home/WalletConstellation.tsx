"use client";

import React, { useState } from "react";
import { useLocale } from "@/lib/context/locale";

interface NodePoint {
  x: number;
  y: number;
  r: number;
  delay: number;
  tier: "inner" | "mid" | "outer";
}

// 24 wallet nodes distributed in concentric rings around (260, 260)
const WALLET_NODES: NodePoint[] = [
  // Ring 1 (Inner, r ~ 112px): 6 nodes
  { x: 357, y: 316, r: 4.5, delay: 0.3, tier: "inner" },
  { x: 262, y: 372, r: 4.0, delay: 0.7, tier: "inner" },
  { x: 163, y: 316, r: 4.5, delay: 1.1, tier: "inner" },
  { x: 163, y: 204, r: 4.0, delay: 1.5, tier: "inner" },
  { x: 258, y: 148, r: 5.0, delay: 1.9, tier: "inner" },
  { x: 357, y: 204, r: 4.0, delay: 2.3, tier: "inner" },

  // Ring 2 (Middle, r ~ 175px): 8 nodes
  { x: 432, y: 275, r: 4.5, delay: 0.5, tier: "mid" },
  { x: 384, y: 384, r: 4.0, delay: 0.9, tier: "mid" },
  { x: 260, y: 435, r: 5.0, delay: 1.3, tier: "mid" },
  { x: 136, y: 384, r: 4.0, delay: 1.7, tier: "mid" },
  { x: 86, y: 260, r: 4.5, delay: 2.1, tier: "mid" },
  { x: 136, y: 136, r: 4.0, delay: 2.5, tier: "mid" },
  { x: 265, y: 85, r: 5.0, delay: 2.9, tier: "mid" },
  { x: 384, y: 136, r: 4.0, delay: 3.3, tier: "mid" },

  // Ring 3 (Outer, r ~ 235px): 10 nodes (desktop only)
  { x: 492, y: 240, r: 4.5, delay: 0.8, tier: "outer" },
  { x: 456, y: 372, r: 4.0, delay: 1.2, tier: "outer" },
  { x: 368, y: 468, r: 4.5, delay: 1.6, tier: "outer" },
  { x: 230, y: 494, r: 4.0, delay: 2.0, tier: "outer" },
  { x: 98, y: 452, r: 4.5, delay: 2.4, tier: "outer" },
  { x: 28, y: 310, r: 4.0, delay: 2.8, tier: "outer" },
  { x: 48, y: 172, r: 4.5, delay: 3.2, tier: "outer" },
  { x: 146, y: 68, r: 4.0, delay: 3.6, tier: "outer" },
  { x: 288, y: 26, r: 4.5, delay: 4.0, tier: "outer" },
  { x: 428, y: 62, r: 4.0, delay: 4.4, tier: "outer" },
];

export function WalletConstellation() {
  const { t } = useLocale();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setTilt({ x: x * 14, y: y * 14 });
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  };

  return (
    <div
      data-aos="fade-left"
      data-aos-duration="800"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative flex w-full flex-col items-center justify-center select-none"
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
            /* Particle Flow toward center */
            @keyframes particleStream {
              0% {
                stroke-dashoffset: 190;
                opacity: 0;
              }
              15% {
                opacity: 0.95;
              }
              80% {
                opacity: 0.95;
              }
              100% {
                stroke-dashoffset: 0;
                opacity: 0;
              }
            }

            /* Central Node 9s Quadratic Cycle */
            @keyframes centerScaleCycle {
              0%, 100% {
                transform: scale(0.96);
                filter: drop-shadow(0 0 16px rgba(232, 65, 66, 0.45));
              }
              25% {
                transform: scale(1.0);
                filter: drop-shadow(0 0 20px rgba(232, 65, 66, 0.55));
              }
              55% {
                transform: scale(1.08);
                filter: drop-shadow(0 0 28px rgba(232, 65, 66, 0.7)) drop-shadow(0 0 40px rgba(34, 197, 94, 0.25));
              }
              72% {
                transform: scale(1.16);
                filter: drop-shadow(0 0 38px rgba(232, 65, 66, 0.85)) drop-shadow(0 0 55px rgba(34, 197, 94, 0.55));
              }
              88% {
                transform: scale(1.04);
                filter: drop-shadow(0 0 22px rgba(232, 65, 66, 0.5));
              }
            }

            /* Expanding Ripples */
            @keyframes rippleWave1 {
              0%, 60% {
                r: 44px;
                opacity: 0;
                stroke-width: 2.5px;
              }
              65% {
                opacity: 0.75;
              }
              90% {
                r: 155px;
                opacity: 0;
                stroke-width: 0.5px;
              }
              100% {
                opacity: 0;
              }
            }

            @keyframes rippleWave2 {
              0%, 68% {
                r: 44px;
                opacity: 0;
                stroke-width: 2.5px;
              }
              73% {
                opacity: 0.7;
              }
              96% {
                r: 175px;
                opacity: 0;
                stroke-width: 0.5px;
              }
              100% {
                opacity: 0;
              }
            }

            /* Wallet Nodes Gentle Pulse */
            @keyframes walletPulse {
              0%, 100% {
                transform: scale(1);
                opacity: 0.8;
              }
              50% {
                transform: scale(1.22);
                opacity: 1;
              }
            }

            /* Orbit Rings Slow Drift */
            @keyframes orbitSpin {
              from {
                transform: rotate(0deg);
              }
              to {
                transform: rotate(360deg);
              }
            }

            /* Phased Floating Labels (0-33%, 33-66%, 66-100%) */
            @keyframes phaseLabel1 {
              0%, 30% {
                opacity: 1;
                filter: drop-shadow(0 0 8px rgba(34, 197, 94, 0.65));
                color: #22c55e;
                transform: translateY(-2px);
              }
              35%, 100% {
                opacity: 0.35;
                filter: none;
                color: var(--muted);
                transform: translateY(0);
              }
            }

            @keyframes phaseLabel2 {
              0%, 32% {
                opacity: 0.35;
                filter: none;
                color: var(--muted);
                transform: translateY(0);
              }
              36%, 63% {
                opacity: 1;
                filter: drop-shadow(0 0 10px rgba(232, 65, 66, 0.7));
                color: #e84142;
                transform: translateY(-2px);
              }
              67%, 100% {
                opacity: 0.35;
                filter: none;
                color: var(--muted);
                transform: translateY(0);
              }
            }

            @keyframes phaseLabel3 {
              0%, 65% {
                opacity: 0.35;
                filter: none;
                color: var(--muted);
                transform: translateY(0);
              }
              68%, 92% {
                opacity: 1;
                filter: drop-shadow(0 0 12px rgba(34, 197, 94, 0.85));
                color: #22c55e;
                transform: translateY(-2px);
              }
              96%, 100% {
                opacity: 0.35;
                filter: none;
                color: var(--muted);
                transform: translateY(0);
              }
            }

            .stream-line {
              animation: particleStream 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
            }

            .center-node-anim {
              transform-origin: 260px 260px;
              animation: centerScaleCycle 9s ease-in-out infinite;
            }

            .ripple-1 {
              transform-origin: 260px 260px;
              animation: rippleWave1 9s ease-out infinite;
            }

            .ripple-2 {
              transform-origin: 260px 260px;
              animation: rippleWave2 9s ease-out infinite;
            }

            .node-pulse {
              transform-origin: center;
              animation: walletPulse 3s ease-in-out infinite;
            }

            .phase-tag-1 {
              animation: phaseLabel1 9s ease-in-out infinite;
            }

            .phase-tag-2 {
              animation: phaseLabel2 9s ease-in-out infinite;
            }

            .phase-tag-3 {
              animation: phaseLabel3 9s ease-in-out infinite;
            }

            @media (prefers-reduced-motion: reduce) {
              .stream-line,
              .center-node-anim,
              .ripple-1,
              .ripple-2,
              .node-pulse,
              .phase-tag-1,
              .phase-tag-2,
              .phase-tag-3 {
                animation: none !important;
                opacity: 1 !important;
                transform: none !important;
              }
            }
          `,
        }}
      />

      {/* Main SVG Constellation Container */}
      <div className="relative w-full max-w-[320px] sm:max-w-[420px] lg:max-w-[500px] aspect-square cursor-crosshair">
        {/* Floating Unframed Mono Labels */}
        <div className="phase-tag-1 mono-label pointer-events-none absolute top-1 left-2 sm:top-2 sm:left-4 z-10 flex items-center gap-2 text-xs font-bold tracking-wider transition-all">
          <span className="h-1.5 w-1.5 rounded-full bg-money" />
          <span>{t.homeIntro.visualOne}</span>
        </div>

        <div className="phase-tag-2 mono-label pointer-events-none absolute top-1 right-2 sm:top-2 sm:right-4 z-10 flex items-center gap-2 text-xs font-bold tracking-wider transition-all">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span>{t.homeIntro.visualRoot}</span>
        </div>

        <div className="phase-tag-3 mono-label pointer-events-none absolute bottom-1 right-2 sm:bottom-2 sm:right-4 z-10 flex items-center gap-2 text-xs font-bold tracking-wider transition-all">
          <span className="h-1.5 w-1.5 rounded-full bg-money" />
          <span>+ {t.homeIntro.visualMatch}</span>
        </div>

        <svg
          viewBox="0 0 520 520"
          className="h-full w-full block overflow-visible"
          aria-label="Quadratic Funding Wallet Constellation"
        >
          <defs>
            {/* Project node border gradient: Red -> Orange */}
            <linearGradient id="proj-border-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e84142" />
              <stop offset="60%" stopColor="#ff5a5b" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>

            {/* Project node dark fill gradient */}
            <radialGradient id="proj-fill-grad" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#1e0f14" />
              <stop offset="65%" stopColor="#0d0d14" />
              <stop offset="100%" stopColor="#08080d" />
            </radialGradient>

            {/* Central Glow radial gradient */}
            <radialGradient id="core-glow-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#e84142" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#22c55e" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#07070c" stopOpacity="0" />
            </radialGradient>

            {/* Particle head gradient */}
            <radialGradient id="particle-dot" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#a7f3d0" />
              <stop offset="70%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#16a34a" />
            </radialGradient>
          </defs>

          {/* Background Ambient Radial Glow behind Project */}
          <circle
            cx="260"
            cy="260"
            r="160"
            fill="url(#core-glow-grad)"
            className="pointer-events-none"
          />

          {/* Concentric Guide Orbit Rings */}
          <g className="pointer-events-none opacity-40">
            <circle
              cx="260"
              cy="260"
              r="112"
              fill="none"
              stroke="#22c55e"
              strokeWidth="1"
              strokeDasharray="4 6"
              strokeOpacity="0.25"
            />
            <circle
              cx="260"
              cy="260"
              r="175"
              fill="none"
              stroke="#22c55e"
              strokeWidth="1"
              strokeDasharray="3 8"
              strokeOpacity="0.18"
            />
            {/* Outer ring hidden on small screens */}
            <circle
              cx="260"
              cy="260"
              r="236"
              fill="none"
              stroke="#22c55e"
              strokeWidth="1"
              strokeDasharray="2 10"
              strokeOpacity="0.12"
              className="hidden sm:block"
            />
          </g>

          {/* WALLET NODES & CONNECTING RAYS (with parallax tilt) */}
          <g
            style={{
              transform: `translate(${tilt.x}px, ${tilt.y}px)`,
              transition: isHovered ? "transform 100ms ease-out" : "transform 400ms ease-out",
            }}
          >
            {WALLET_NODES.map((node, idx) => {
              const isOuter = node.tier === "outer";
              return (
                <g
                  key={idx}
                  className={isOuter ? "hidden sm:block" : undefined}
                >
                  {/* Static subtle ray line */}
                  <line
                    x1={node.x}
                    y1={node.y}
                    x2={260}
                    y2={260}
                    stroke="#22c55e"
                    strokeWidth="1"
                    strokeOpacity="0.13"
                    strokeDasharray="2 4"
                  />

                  {/* Flowing donation particle stream */}
                  <line
                    x1={node.x}
                    y1={node.y}
                    x2={260}
                    y2={260}
                    stroke="#4ade80"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray="8 180"
                    className="stream-line"
                    style={{ animationDelay: `${node.delay}s` }}
                  />

                  {/* Wallet Node Circle: Outer Halo */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.r + 3.5}
                    fill="#22c55e"
                    fillOpacity="0.18"
                    className="node-pulse"
                    style={{ animationDelay: `${node.delay}s` }}
                  />

                  {/* Wallet Node Circle: Core */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.r}
                    fill="url(#particle-dot)"
                    stroke="#14532d"
                    strokeWidth="0.8"
                  />
                </g>
              );
            })}
          </g>

          {/* Expanding Ripples from Project Node */}
          <circle
            cx="260"
            cy="260"
            fill="none"
            stroke="url(#proj-border-grad)"
            className="ripple-1 pointer-events-none"
          />
          <circle
            cx="260"
            cy="260"
            fill="none"
            stroke="#22c55e"
            className="ripple-2 pointer-events-none"
          />

          {/* CENTRAL PROJECT NODE (Parallax + Scaling + Pulse) */}
          <g
            className="center-node-anim"
            style={{
              transform: `translate(${tilt.x * 0.35}px, ${tilt.y * 0.35}px)`,
              transition: isHovered ? "transform 100ms ease-out" : "transform 400ms ease-out",
            }}
          >
            {/* Outer glowing halo */}
            <circle
              cx="260"
              cy="260"
              r="48"
              fill="url(#proj-border-grad)"
              opacity={isHovered ? 0.35 : 0.18}
              className="transition-opacity duration-300"
            />

            {/* Inner Project Body */}
            <circle
              cx="260"
              cy="260"
              r="43"
              fill="url(#proj-fill-grad)"
              stroke="url(#proj-border-grad)"
              strokeWidth={isHovered ? 3.5 : 2.5}
              className="transition-all duration-300"
            />

            {/* Dotted Inner Orbit Line */}
            <circle
              cx="260"
              cy="260"
              r="34"
              fill="none"
              stroke="#e84142"
              strokeWidth="1"
              strokeDasharray="3 3"
              strokeOpacity="0.4"
            />

            {/* Stylized Square Root Symbol (√) */}
            <text
              x="260"
              y="256"
              textAnchor="middle"
              dominantBaseline="central"
              className="font-mono text-[32px] font-black select-none pointer-events-none fill-foreground"
              style={{
                filter: "drop-shadow(0 0 10px rgba(232, 65, 66, 0.85))",
              }}
            >
              √
            </text>

            {/* Small Monospace Label */}
            <text
              x="260"
              y="282"
              textAnchor="middle"
              className="font-mono text-[8.5px] font-bold tracking-[0.22em] select-none pointer-events-none fill-primary"
            >
              PROJECT
            </text>
          </g>
        </svg>
      </div>

      {/* Subtle Caption beneath visual (no card frame) */}
      <div className="mt-2 sm:mt-3 flex items-center justify-center gap-2 text-xs text-muted font-mono">
        <span className="h-1.5 w-1.5 rounded-full bg-money animate-pulse" />
        <span className="tracking-wide uppercase text-[11px] sm:text-xs">
          {t.homeIntro.visualDescription}
        </span>
      </div>
    </div>
  );
}
