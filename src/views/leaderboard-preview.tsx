"use client";

import { useState } from "react";
import { useLocale } from "@/lib/context/locale";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { Container } from "@/components/layout/Container";
import { RoundsList, type ViewState } from "@/components/rounds/RoundsList";
import { RoundHeader } from "@/components/leaderboard/RoundHeader";
import { Leaderboard } from "@/components/leaderboard/Leaderboard";
import type { LeaderboardProject, RoundPhase, RoundSummary } from "@/components/leaderboard/model";

// Fixtures belong only to this development preview and are never imported by real pages.
const account = "0x1111111111111111111111111111111111111111";
const roundIds = ["0x2222222222222222222222222222222222222222", "0x3333333333333333333333333333333333333333", "0x4444444444444444444444444444444444444444", "0x5555555555555555555555555555555555555555"];
type PreviewCase = "many" | "empty" | "one" | "two" | "ties" | "final" | "loading" | "error" | "upcoming" | "no-rounds";

export function LeaderboardPreview() {
  const { t } = useLocale();
  const c = t.competition;
  const [mode, setMode] = useState<PreviewCase>("many");
  const [selected, setSelected] = useState(roundIds[1]);
  const [admin, setAdmin] = useState(false);
  const phases: RoundPhase[] = ["closed", mode === "final" ? "finalized" : mode === "upcoming" ? "upcoming" : "open", "finalized", "upcoming"];
  const rounds: RoundSummary[] = roundIds.map((id, index) => ({
    id, number: index + 1, title: c.fixtureRound, name: c.fixtureRound, description: "", sponsorName: "", matchingPool: 1000000.000001,
    totalDonated: 1250000.123456, totalSupporters: 6289, projectCount: 12,
    startTime: phases[index] === "upcoming" ? "2030-01-01T00:00:00Z" : "2026-01-01T00:00:00Z", endTime: phases[index] === "open" || phases[index] === "upcoming" ? "2030-02-01T00:00:00Z" : "2026-10-01T00:00:00Z",
    status: phases[index] === "upcoming" ? "open" : phases[index] as RoundSummary["status"], phase: phases[index],
  }));
  const baseRound = rounds.find(item => item.id === selected) ?? rounds[1];
  const count = mode === "empty" ? 0 : mode === "one" ? 1 : mode === "two" ? 2 : mode === "ties" ? 4 : 12;
  const projects: LeaderboardProject[] = Array.from({ length: count }, (_, index) => ({
    id: String(index + 1), roundId: baseRound.id, name: `${c.fixtureName} ${index + 1}`, shortDescription: "", description: "", contactUrl: "", category: "technology", ownerAddress: index === 0 ? account : roundIds[index % roundIds.length],
    supporterCount: mode === "ties" ? [100, 84, 84, 0][index] : index === 0 ? 125046 : index < 8 ? 125046 - index * 12000 : 0,
    totalDonated: index === 2 ? 2000000.123456 : index === 0 ? 1000000.000001 : index > 7 ? 0 : 123456.123456 / (index + 1),
    estimatedMatching: index > 7 ? 0 : index === 1 ? 300000 : 250000 / (index + 1), finalMatching: index > 7 ? 0 : index === 1 ? 280000 : 240000 / (index + 1),
    status: "approved", supportedByWallet: index === 1,
  }));
  const round = { ...baseRound, projectCount: projects.length, totalDonated: projects.reduce((sum, p) => sum + p.totalDonated, 0), totalSupporters: projects.reduce((sum, p) => sum + p.supporterCount, 0) };
  const previewRounds = rounds.map(item => item.id === round.id ? round : item);
  const state: ViewState = mode === "loading" ? "loading" : mode === "error" ? "error" : "ready";
  const cases: { key: PreviewCase; label: string }[] = [
    { key: "many", label: c.previewNormal }, { key: "empty", label: c.previewEmpty }, { key: "one", label: c.previewOne }, { key: "two", label: c.previewTwo }, { key: "ties", label: c.previewTies }, { key: "final", label: c.previewFinal }, { key: "loading", label: c.previewLoading }, { key: "error", label: c.previewError }, { key: "upcoming", label: c.previewUpcoming }, { key: "no-rounds", label: c.noRounds },
  ];
  return <Container className="competition-page min-w-0 space-y-12 py-8">
    <div className="flex flex-wrap items-center gap-3 border border-line bg-bg p-4"><h1 className="mr-auto font-semibold">{c.preview}</h1><select aria-label={c.previewState} value={mode} onChange={event => { setMode(event.target.value as PreviewCase); setSelected(roundIds[1]); }} className="competition-focus min-h-11 max-w-full border border-line bg-surface px-3 text-xs">{cases.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select><button className="competition-action" onClick={() => setAdmin(value => !value)} aria-pressed={admin}>{c.admin}</button><LanguageToggle /></div>
    <RoundsList rounds={mode === "no-rounds" ? [] : previewRounds} state={state} isAdmin={admin} onRetry={() => setMode("many")} />
    <div className="space-y-8"><RoundHeader round={round} choices={rounds.map(item => ({ id: item.id, number: item.number, phase: item.phase }))} onRoundChange={setSelected} /><Leaderboard projects={projects} roundId={round.id} pool={round.matchingPool} finalized={round.phase === "finalized"} state={state} isAdmin={admin} wallet={account} onRetry={() => setMode("many")} /></div>
  </Container>;
}
