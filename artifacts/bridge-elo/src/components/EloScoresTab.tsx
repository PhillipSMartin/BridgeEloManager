import React from "react";
import { useBridgeData } from "@/hooks/use-bridge";

export function EloScoresTab() {
  const { eloHistory } = useBridgeData();

  if (!eloHistory || !eloHistory.players.length) {
    return <div className="p-8 text-center text-muted-foreground" data-testid="empty-elo">No data available.</div>;
  }

  return (
    <div className="w-full overflow-x-auto border rounded-md bg-card">
      <table className="w-full text-sm text-left">
        <thead className="bg-muted text-muted-foreground text-xs uppercase font-mono">
          <tr>
            <th className="px-4 py-3 border-b sticky left-0 bg-muted z-10 font-semibold w-32">Tournament</th>
            {eloHistory.players.map(p => (
              <th key={p.id} className="px-4 py-3 border-b font-semibold min-w-24 text-center">{p.name}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {eloHistory.snapshots.slice(-5).map((snap) => (
            <tr key={snap.tournamentId} className="hover:bg-muted/50 transition-colors">
              <td className="px-4 py-3 sticky left-0 bg-card z-10 font-mono font-medium border-r shadow-[1px_0_0_0_hsl(var(--border))]">
                {snap.label || `T${snap.sequenceIndex}`}
              </td>
              {eloHistory.players.map(p => {
                const eloRow = snap.elos.find(e => e.playerId === p.id);
                return (
                  <td key={p.id} className="px-4 py-3 text-center border-r last:border-r-0 font-mono text-primary font-medium" data-testid={`text-elo-${snap.tournamentId}-${p.id}`}>
                    {eloRow ? eloRow.elo.toFixed(1) : "-"}
                  </td>
                );
              })}
            </tr>
          ))}
          {eloHistory.snapshots.length === 0 && (
            <tr>
              <td colSpan={eloHistory.players.length + 1} className="px-4 py-8 text-center text-muted-foreground">
                No tournaments recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
