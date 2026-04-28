import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useBridgeData } from "@/hooks/use-bridge";

type RankingEntry = { playerId: number; reverseRanking: number | null };
type AllRankings = Record<number, RankingEntry[]>;

export function ExportButton() {
  const { players, tournaments } = useBridgeData();

  const handleExport = useCallback(async () => {
    const allRankings: AllRankings = await fetch("/api/all-rankings").then((r) => r.json());

    const header = ["#", "Date", "Name", ...players.map((p) => p.name)];

    const rows = tournaments.map((t) => {
      const rankingsForT = allRankings[t.id] ?? [];
      const rankingByPlayer: Record<number, number | null> = {};
      for (const r of rankingsForT) {
        rankingByPlayer[r.playerId] = r.reverseRanking;
      }
      return [
        `T${t.sequenceIndex}`,
        t.date ?? "",
        t.label ?? "",
        ...players.map((p) => {
          const v = rankingByPlayer[p.id];
          return v !== null && v !== undefined ? String(v) : "";
        }),
      ];
    });

    const csvLines = [header, ...rows].map((row) =>
      row.map((cell) => {
        const s = String(cell);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      }).join(",")
    );

    const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bridge-elo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [players, tournaments]);

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={players.length === 0}>
      Export CSV
    </Button>
  );
}
