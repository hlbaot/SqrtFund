"use client";
import { useTxAction } from "./useTxAction";
/** Compatibility for existing cancellation, wallet and multi-step approval UX. */
export function useTxFlow() { return useTxAction(); }
