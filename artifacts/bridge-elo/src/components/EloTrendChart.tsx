import React, { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useBridgeData } from "@/hooks/use-bridge";

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
];

export function EloTrendChart() {
  const { eloHistory } = useBridgeData();
  const [hiddenPlayers, setHiddenPlayers] = useState<Set<number>>(new Set());

  const players = eloHistory?.players ?? [];
  const snapshots = eloHistory?.snapshots ?? [];

  const chartData = useMemo(() => {
    return snapshots.map((snap) => {
      const point: Record<string, string | number> = {
        tournament: snap.label || `T${snap.sequenceIndex}`,
      };
      snap.elos.forEach((e) => {
        point[`player_${e.playerId}`] = e.elo;
      });
      return point;
    });
  }, [snapshots]);

  const togglePlayer = (playerId: number) => {
    setHiddenPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  if (!eloHistory || players.length === 0) {
    return (
      <div
        className="p-8 text-center text-muted-foreground"
        data-testid="empty-elo-chart"
      >
        No data available.
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div
        className="p-8 text-center text-muted-foreground"
        data-testid="empty-elo-chart"
      >
        No tournaments recorded yet.
      </div>
    );
  }

  const minElo = Math.min(
    ...snapshots.flatMap((s) => s.elos.map((e) => e.elo))
  );
  const maxElo = Math.max(
    ...snapshots.flatMap((s) => s.elos.map((e) => e.elo))
  );
  const padding = Math.max(50, (maxElo - minElo) * 0.1);
  const yMin = Math.floor((minElo - padding) / 50) * 50;
  const yMax = Math.ceil((maxElo + padding) / 50) * 50;

  return (
    <div className="flex flex-col gap-4" data-testid="elo-trend-chart">
      <div className="flex flex-wrap gap-2">
        {players.map((player, idx) => {
          const color = COLORS[idx % COLORS.length];
          const hidden = hiddenPlayers.has(player.id);
          return (
            <button
              key={player.id}
              onClick={() => togglePlayer(player.id)}
              data-testid={`toggle-player-${player.id}`}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all ${
                hidden
                  ? "opacity-40 bg-transparent border-muted-foreground/30 text-muted-foreground"
                  : "bg-card border-border text-foreground shadow-sm"
              }`}
            >
              <span
                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: hidden ? "#9ca3af" : color }}
              />
              {player.name}
            </button>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 24, left: 0, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="tournament"
            tick={{ fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              fontSize: "13px",
            }}
            formatter={(value: number, name: string) => [
              value.toFixed(1),
              name,
            ]}
          />
          {players.map((player, idx) => (
            <Line
              key={player.id}
              type="monotone"
              dataKey={`player_${player.id}`}
              name={player.name}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              hide={hiddenPlayers.has(player.id)}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
