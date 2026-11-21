"use client";
import { useTxAction } from "./useTxAction";
/** Tương thích UX huỷ, ví và approval nhiều bước hiện có. */
export function useTxFlow() { return useTxAction(); }
