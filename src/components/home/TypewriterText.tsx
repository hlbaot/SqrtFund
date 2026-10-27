"use client";

import React, { useEffect, useState, useRef, memo } from "react";

interface TypewriterTextProps {
  phrases: string[];
  typingSpeed?: number;
  deletingSpeed?: number;
  pauseDuration?: number;
  startDelay?: number;
  initialText?: string;
  className?: string;
  cursorClassName?: string;
}

export const TypewriterText = memo(function TypewriterText({
  phrases,
  typingSpeed = 70,
  deletingSpeed = 35,
  pauseDuration = 2400,
  startDelay = 1200,
  initialText,
  className,
  cursorClassName,
}: TypewriterTextProps) {
  const safePhrases = phrases && phrases.length > 0 ? phrases : ["Every voice counts."];
  const phrasesRef = useRef(safePhrases);
  phrasesRef.current = safePhrases;

  const [displayText, setDisplayText] = useState(() => initialText || safePhrases[0] || "");
  const [isReady, setIsReady] = useState(false);

  // Defer starting animation until after page load & hydration settles
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayText(phrasesRef.current[0]);
      return;
    }

    const startTimer = setTimeout(() => {
      setIsReady(true);
    }, startDelay);

    return () => clearTimeout(startTimer);
  }, [startDelay]);

  // Main typing loop using requestAnimationFrame / setTimeout
  useEffect(() => {
    if (!isReady) return;

    let isDeleting = false;
    let phraseIdx = 0;
    let currentStr = displayText;
    let timeoutId: ReturnType<typeof setTimeout>;
    let isCancelled = false;

    const tick = () => {
      if (isCancelled) return;

      const fullList = phrasesRef.current;
      const targetPhrase = fullList[phraseIdx % fullList.length];

      if (!isDeleting) {
        if (currentStr.length < targetPhrase.length) {
          currentStr = targetPhrase.slice(0, currentStr.length + 1);
          setDisplayText(currentStr);
          timeoutId = setTimeout(tick, typingSpeed);
        } else {
          // Finished typing phrase, pause before backspacing
          isDeleting = true;
          timeoutId = setTimeout(tick, pauseDuration);
        }
      } else {
        if (currentStr.length > 0) {
          currentStr = targetPhrase.slice(0, currentStr.length - 1);
          setDisplayText(currentStr);
          timeoutId = setTimeout(tick, deletingSpeed);
        } else {
          // Finished deleting, proceed to next phrase
          isDeleting = false;
          phraseIdx = (phraseIdx + 1) % fullList.length;
          timeoutId = setTimeout(tick, 300);
        }
      }
    };

    timeoutId = setTimeout(tick, typingSpeed);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isReady, typingSpeed, deletingSpeed, pauseDuration]);

  return (
    <span className={`inline-block ${className || ""}`} style={{ minWidth: "1ch" }}>
      <span>{displayText}</span>
      <span
        aria-hidden="true"
        className={`inline-block font-mono ml-0.5 animate-pulse text-primary font-bold ${
          cursorClassName || ""
        }`}
      >
        |
      </span>
    </span>
  );
});
