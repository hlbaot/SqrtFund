"use client";

import { useEffect, useId, useRef, type CSSProperties } from "react";
import { usePathname } from "next/navigation";

type Variant = "default" | "dense" | "calm" | "broken" | "footer";

const leftTraces = [
  "M0 144H128L256 272H384",
  "M0 400H128L256 528V656",
  "M128 16V144L256 272",
  "M0 656H128L256 784",
];
const rightTraces = [
  "M1536 272H1408L1280 400H1152",
  "M1536 656H1408L1280 528V400",
  "M1408 16V144L1280 272H1152",
  "M1536 784H1408L1280 656",
];
const timelineTrace = "M384 400H640L768 272H896L1024 400H1152";

function CircuitSignal({ path, duration, delay, gradient, className }: {
  path: string;
  duration: string;
  delay: string;
  gradient: string;
  className?: string;
}) {
  return (
    <g className={className}>
      <path d="M-48 0H0" stroke={`url(#${gradient})`} strokeWidth="2" strokeLinecap="round" />
      <circle r="2" fill="#E84142" />
      <circle r="0.8" fill="white" fillOpacity="0.9" />
      <animateMotion path={path} dur={duration} begin={delay} rotate="auto" calcMode="linear" repeatCount="indefinite" />
    </g>
  );
}

// One visible lattice owns the motion budget: 3 signals + 2 confirmation rings.
// Other instances remain static, including during section transitions.
const motionOwners = new Map<HTMLElement, { area: number; play: (active: boolean) => void }>();
function selectMotionOwner() {
  let owner: HTMLElement | undefined;
  let largest = 0;
  if (!document.hidden) {
    motionOwners.forEach(({ area }, element) => {
      if (area > largest && element.getClientRects().length) {
        largest = area;
        owner = element;
      }
    });
  }
  motionOwners.forEach(({ play }, element) => play(element === owner));
}

export function ChainLatticeBackground({
  variant = "default",
  className = "",
  style,
}: {
  variant?: Variant;
  className?: string;
  style?: CSSProperties;
}) {
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const signalGradient = `chain-signal-${useId()}`;

  useEffect(() => {
    const element = root.current;
    const circuit = svg.current;
    if (!element || !circuit || variant === "calm" || variant === "footer") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const play = (active: boolean) => {
      const running = active && !reduced.matches;
      element.dataset.running = String(running);
      if (running) circuit.unpauseAnimations();
      else circuit.pauseAnimations();
    };
    play(false);
    motionOwners.set(element, { area: 0, play });
    const observer = new IntersectionObserver(([entry]) => {
      const owner = motionOwners.get(element);
      if (owner) owner.area = entry.isIntersecting
        ? entry.intersectionRect.width * entry.intersectionRect.height : 0;
      selectMotionOwner();
    }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
    observer.observe(element);
    document.addEventListener("visibilitychange", selectMotionOwner);
    reduced.addEventListener("change", selectMotionOwner);
    return () => {
      observer.disconnect();
      motionOwners.delete(element);
      document.removeEventListener("visibilitychange", selectMotionOwner);
      reduced.removeEventListener("change", selectMotionOwner);
      selectMotionOwner();
    };
  }, [variant]);

  const animated = variant === "default" || variant === "dense";
  return (
    <div ref={root} aria-hidden="true" data-variant={variant}
      className={`chain-lattice ${className}`} style={style}>
      <div className="chain-lattice__ambient" />
      <div className="chain-lattice__field">
        <div className="chain-lattice__dots" />
        {variant === "dense" && <div className="chain-lattice__columns" />}
        {variant !== "calm" && (
          <svg ref={svg} className="chain-lattice__circuits" width="1536" height="800" fill="none">
            {animated && <defs>
              <linearGradient id={signalGradient} x1="-48" y1="0" x2="0" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#E84142" stopOpacity="0" />
                <stop offset="0.55" stopColor="#E84142" stopOpacity="0.5" />
                <stop offset="1" stopColor="#E84142" stopOpacity="0.95" />
              </linearGradient>
            </defs>}
            <g className="chain-lattice__traces" stroke="white" strokeOpacity="0.24" strokeWidth="1">
              <g>{leftTraces.map((d, i) => <path className={i > 1 ? "chain-lattice__desktop" : undefined} key={d} d={d} />)}</g>
              <g className="chain-lattice__right">{rightTraces.map((d, i) => <path className={i > 1 ? "chain-lattice__desktop" : undefined} key={d} d={d} />)}</g>
              {variant === "dense" && <path className="chain-lattice__timeline chain-lattice__desktop" d={timelineTrace} strokeOpacity="0.7" />}
              {variant === "broken" && <path d="M384 272H576 M704 272H768L896 400H1152" />}
            </g>
            {animated && <g className="chain-lattice__motion">
              <CircuitSignal path={variant === "dense" ? timelineTrace : leftTraces[0]} duration="16s" delay="-4s" gradient={signalGradient} />
              <g className="chain-lattice__right">
                <CircuitSignal path={rightTraces[0]} duration="20s" delay="-11s" gradient={signalGradient} />
              </g>
              <CircuitSignal className="chain-lattice__desktop" path={leftTraces[1]} duration="12s" delay="-8s" gradient={signalGradient} />
              <g transform={variant === "dense" ? "translate(1152 400)" : "translate(384 272)"}>
                <circle className="chain-lattice__ripple" r="3" stroke="#E84142" strokeWidth="1" />
              </g>
              <g className="chain-lattice__right"><g transform="translate(1152 400)">
                <circle className="chain-lattice__ripple chain-lattice__ripple--second" r="3" stroke="#E84142" strokeWidth="1" />
              </g></g>
            </g>}
            {variant === "broken" && <circle className="chain-lattice__lost-node" cx="640" cy="272" r="1.5" fill="#E84142" />}
          </svg>
        )}
      </div>
      <div className="chain-lattice__grain" />
    </div>
  );
}

export function SiteChainLatticeBackground() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  const calm = /^\/(register|my|admin)(\/|$)/.test(pathname);
  const dense = /^\/(round|rounds|dev)(\/|$)/.test(pathname);
  // Stable per-route placement without listeners or render-time randomness.
  const seed = Array.from(pathname).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return <ChainLatticeBackground variant={calm ? "calm" : dense ? "dense" : "default"}
    className="chain-lattice--site" style={{ "--lattice-ambient-x": `${seed % 2 ? 8 : 92}%`, "--lattice-ambient-y": `${16 + seed % 47}%` } as CSSProperties} />;
}
