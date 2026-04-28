import React, { useState, useEffect, useRef } from "react";
import type { Player, Tournament } from "@workspace/api-client-react";
import { useBridgeData, useTournamentRankingsData } from "@/hooks/use-bridge";
import { Input } from "@/components/ui/input";

export function RankingsTab() {
  const { players, tournaments } = useBridgeData();
  
  if (players.length === 0) {
    return <div className="p-8 text-center text-muted-foreground" data-testid="empty-rankings">No players added yet.</div>;
  }
  
  if (tournaments.length === 0) {
    return <div className="p-8 text-center text-muted-foreground" data-testid="empty-tournaments">No tournaments added yet.</div>;
  }

  return (
    <div className="w-full overflow-x-auto border rounded-md bg-card">
      <table className="w-full text-sm text-left">
        <thead className="bg-muted text-muted-foreground text-xs uppercase font-mono">
          <tr>
            <th className="px-4 py-3 border-b sticky left-0 bg-muted z-10 font-semibold w-32">Tournament</th>
            {players.map(p => (
              <th key={p.id} className="px-4 py-3 border-b font-semibold min-w-24 text-center">{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {tournaments.map((t) => (
            <TournamentRow key={t.id} tournament={t} players={players} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TournamentRow({ tournament, players }: { tournament: Tournament; players: Player[] }) {
  const { rankings, upsertRankings } = useTournamentRankingsData(tournament.id);
  const [localVals, setLocalVals] = useState<Record<number, string>>({});

  useEffect(() => {
    const newVals: Record<number, string> = {};
    for (const r of rankings) {
      newVals[r.playerId] = r.reverseRanking !== null ? String(r.reverseRanking) : "";
    }
    setLocalVals(newVals);
  }, [rankings]);

  const handleChange = (playerId: number, val: string) => {
    setLocalVals(prev => ({ ...prev, [playerId]: val }));
  };

  const handleBlur = async (playerId: number) => {
    const val = localVals[playerId];
    const num = val && val.trim() !== "" ? Number(val) : null;
    
    const existing = rankings.find(r => r.playerId === playerId);
    if (existing?.reverseRanking === num) return;

    const payload = players.map(p => {
      if (p.id === playerId) return { playerId: p.id, reverseRanking: num };
      const current = localVals[p.id];
      return {
        playerId: p.id,
        reverseRanking: current && current.trim() !== "" ? Number(current) : null
      };
    });

    await upsertRankings({ rankings: payload });
  };

  return (
    <tr className="hover:bg-muted/50 transition-colors">
      <td className="px-4 py-2 sticky left-0 bg-card z-10 font-mono font-medium border-r shadow-[1px_0_0_0_hsl(var(--border))]">
        {tournament.label || `T${tournament.sequenceIndex}`}
      </td>
      {players.map(p => (
        <td key={p.id} className="px-2 py-1 border-r last:border-r-0">
          <Input
            value={localVals[p.id] ?? ""}
            onChange={e => handleChange(p.id, e.target.value)}
            onBlur={() => handleBlur(p.id)}
            className="w-full text-center h-8 font-mono bg-transparent border-transparent hover:border-input focus:bg-background"
            placeholder="-"
            data-testid={`input-ranking-${tournament.id}-${p.id}`}
          />
        </td>
      ))}
    </tr>
  );
}
