import React, { useState, useEffect, useCallback, useRef } from "react";
import type { Player, Tournament } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getGetEloHistoryQueryKey,
  getListTournamentsQueryKey,
  useUpsertTournamentRankings,
  useCreateTournament,
  useUpdateTournament,
} from "@workspace/api-client-react";
import { useBridgeData } from "@/hooks/use-bridge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const NEW_NAME_SENTINEL = "__new__";

interface LabelCellProps {
  value: string;
  existingLabels: string[];
  onChange: (val: string) => void;
  onCommit: (val: string) => void;
  placeholder?: string;
  testId?: string;
}

function LabelCell({ value, existingLabels, onChange, onCommit, placeholder = "Optional name", testId }: LabelCellProps) {
  const isKnown = existingLabels.includes(value);
  const [mode, setMode] = useState<"select" | "custom">(
    value !== "" && !isKnown ? "custom" : "select"
  );

  const selectValue = mode === "custom" ? NEW_NAME_SENTINEL : (value || "");

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const chosen = e.target.value;
    if (chosen === NEW_NAME_SENTINEL) {
      setMode("custom");
      onChange("");
    } else {
      setMode("select");
      onChange(chosen);
      onCommit(chosen);
    }
  };

  const handleInputBlur = () => {
    onCommit(value);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setMode("select");
      onChange("");
      onCommit("");
    }
  };

  const baseSelectClass =
    "h-8 w-full rounded-md border border-transparent bg-transparent px-2 text-xs hover:border-input focus:border-input focus:outline-none focus:ring-0 cursor-pointer";

  if (mode === "custom") {
    return (
      <Input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder}
        className="h-8 bg-transparent border-transparent hover:border-input focus:bg-background text-xs"
        data-testid={testId}
      />
    );
  }

  return (
    <select
      value={selectValue}
      onChange={handleSelectChange}
      className={baseSelectClass}
      data-testid={testId}
    >
      <option value="">— {placeholder} —</option>
      {existingLabels.map((label) => (
        <option key={label} value={label}>{label}</option>
      ))}
      <option value={NEW_NAME_SENTINEL}>New name…</option>
    </select>
  );
}

type RankingEntry = { playerId: number; reverseRanking: number | null };
type AllRankings = Record<number, RankingEntry[]>;

const ALL_RANKINGS_KEY = ["all-rankings"] as const;

function fetchAllRankings(): Promise<AllRankings> {
  return fetch("/api/all-rankings").then((r) => r.json());
}

export function RankingsTab() {
  const { players, tournaments } = useBridgeData();
  const queryClient = useQueryClient();
  const { data: allRankings } = useQuery<AllRankings>({
    queryKey: ALL_RANKINGS_KEY,
    queryFn: fetchAllRankings,
  });

  const upsertMutation = useUpsertTournamentRankings();
  const createTournament = useCreateTournament();

  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});
  const [draftValues, setDraftValues] = useState<Record<number, string>>({});
  const [draftLabel, setDraftLabel] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const draftRowRef = useRef<HTMLTableRowElement>(null);
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (!allRankings) return;
    const next: Record<string, string> = {};
    for (const [tid, rows] of Object.entries(allRankings)) {
      for (const r of rows) {
        next[`${tid}:${r.playerId}`] = r.reverseRanking !== null ? String(r.reverseRanking) : "";
      }
    }
    setLocalEdits(next);
  }, [allRankings]);

  useEffect(() => {
    if (!hasScrolled.current && tournaments.length > 0 && draftRowRef.current) {
      draftRowRef.current.scrollIntoView({ block: "nearest" });
      hasScrolled.current = true;
    }
  }, [tournaments]);

  const handleChange = useCallback((tournamentId: number, playerId: number, val: string) => {
    setLocalEdits((prev) => ({ ...prev, [`${tournamentId}:${playerId}`]: val }));
  }, []);

  const handleBlur = useCallback(async (tournamentId: number, playerId: number) => {
    const key = `${tournamentId}:${playerId}`;
    const val = localEdits[key] ?? "";
    const num = val.trim() !== "" ? Number(val) : null;

    const stored = allRankings?.[tournamentId]?.find((r) => r.playerId === playerId);
    if ((stored?.reverseRanking ?? null) === num) return;

    const payload = players.map((p) => {
      if (p.id === playerId) return { playerId: p.id, reverseRanking: num };
      const cur = localEdits[`${tournamentId}:${p.id}`] ?? "";
      return { playerId: p.id, reverseRanking: cur.trim() !== "" ? Number(cur) : null };
    });

    await upsertMutation.mutateAsync({ id: tournamentId, data: { rankings: payload } });
    queryClient.invalidateQueries({ queryKey: ALL_RANKINGS_KEY });
    queryClient.invalidateQueries({ queryKey: getGetEloHistoryQueryKey() });
  }, [localEdits, allRankings, players, upsertMutation, queryClient]);

  const handleDraftChange = useCallback((playerId: number, val: string) => {
    setDraftValues((prev) => ({ ...prev, [playerId]: val }));
  }, []);

  const handleSaveDraft = useCallback(async () => {
    const hasAnyValue = players.some((p) => (draftValues[p.id] ?? "").trim() !== "");
    if (!hasAnyValue) return;

    setIsSaving(true);
    try {
      const newTournament = await createTournament.mutateAsync({
        data: {
          label: draftLabel.trim() || null,
          date: draftDate.trim() || null,
        },
      });
      const payload = players.map((p) => {
        const v = draftValues[p.id] ?? "";
        return { playerId: p.id, reverseRanking: v.trim() !== "" ? Number(v) : null };
      });
      await upsertMutation.mutateAsync({ id: newTournament.id, data: { rankings: payload } });

      setDraftValues({});
      setDraftLabel("");
      setDraftDate("");
      hasScrolled.current = false;

      await queryClient.invalidateQueries({ queryKey: getListTournamentsQueryKey() });
      await queryClient.invalidateQueries({ queryKey: ALL_RANKINGS_KEY });
      await queryClient.invalidateQueries({ queryKey: getGetEloHistoryQueryKey() });
    } finally {
      setIsSaving(false);
    }
  }, [draftValues, draftLabel, draftDate, players, createTournament, upsertMutation, queryClient]);

  if (players.length === 0) {
    return <div className="p-8 text-center text-muted-foreground" data-testid="empty-rankings">No players added yet.</div>;
  }

  const nextIndex = tournaments.length > 0
    ? Math.max(...tournaments.map((t) => t.sequenceIndex)) + 1
    : 1;

  const existingLabels = Array.from(
    new Set(tournaments.map((t) => t.label).filter((l): l is string => !!l))
  ).sort((a, b) => a.localeCompare(b));

  const hasDraftValues = players.some((p) => (draftValues[p.id] ?? "").trim() !== "");

  return (
    <div className="flex flex-col gap-3">
      <div className="w-full overflow-x-auto overflow-y-auto max-h-[65vh] border rounded-md bg-card">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted text-muted-foreground text-xs uppercase font-mono sticky top-0 z-20">
            <tr>
              <th className="px-4 py-3 border-b sticky left-0 bg-muted z-10 font-semibold w-24">#</th>
              <th className="px-4 py-3 border-b font-semibold min-w-28">Date</th>
              <th className="px-4 py-3 border-b font-semibold min-w-36">Name</th>
              {players.map((p) => (
                <th key={p.id} className="px-4 py-3 border-b font-semibold min-w-24 text-center">{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {tournaments.map((t) => (
              <TournamentRow
                key={t.id}
                tournament={t}
                players={players}
                localEdits={localEdits}
                existingLabels={existingLabels}
                onChange={handleChange}
                onBlur={handleBlur}
              />
            ))}
            <tr ref={draftRowRef} className="bg-primary/5 border-t-2 border-primary/20">
              <td className="px-4 py-2 sticky left-0 bg-primary/5 z-10 font-mono font-medium border-r text-muted-foreground">
                T{nextIndex}
              </td>
              <td className="px-2 py-1 border-r">
                <Input
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="h-8 font-mono bg-transparent border-transparent hover:border-input focus:bg-background text-xs"
                  data-testid="input-draft-date"
                />
              </td>
              <td className="px-2 py-1 border-r">
                <LabelCell
                  value={draftLabel}
                  existingLabels={existingLabels}
                  onChange={setDraftLabel}
                  onCommit={setDraftLabel}
                  testId="input-draft-label"
                />
              </td>
              {players.map((p) => (
                <td key={p.id} className="px-2 py-1 border-r last:border-r-0">
                  <Input
                    value={draftValues[p.id] ?? ""}
                    onChange={(e) => handleDraftChange(p.id, e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && hasDraftValues && handleSaveDraft()}
                    className="w-full text-center h-8 font-mono bg-transparent border-transparent hover:border-input focus:bg-background"
                    placeholder="-"
                    data-testid={`input-draft-${p.id}`}
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 px-1">
        <Button
          size="sm"
          disabled={!hasDraftValues || isSaving}
          onClick={handleSaveDraft}
          data-testid="btn-save-draft"
        >
          {isSaving ? "Saving…" : `Save T${nextIndex}`}
        </Button>
        {hasDraftValues && (
          <p className="text-xs text-muted-foreground">
            Press Save or hit Enter in any cell to record T{nextIndex} and recalculate ELOs.
          </p>
        )}
      </div>
    </div>
  );
}

interface TournamentRowProps {
  tournament: Tournament;
  players: Player[];
  localEdits: Record<string, string>;
  existingLabels: string[];
  onChange: (tournamentId: number, playerId: number, val: string) => void;
  onBlur: (tournamentId: number, playerId: number) => void;
}

function TournamentRow({ tournament, players, localEdits, existingLabels, onChange, onBlur }: TournamentRowProps) {
  const queryClient = useQueryClient();
  const updateTournament = useUpdateTournament();
  const [localDate, setLocalDate] = useState(tournament.date ?? "");
  const [localLabel, setLocalLabel] = useState(tournament.label ?? "");

  const handleMetaBlur = useCallback(async (field: "date" | "label", value: string) => {
    const normalized = value.trim() || null;
    const current = field === "date" ? (tournament.date ?? null) : (tournament.label ?? null);
    if (normalized === current) return;
    await updateTournament.mutateAsync({ id: tournament.id, data: { [field]: normalized } });
    queryClient.invalidateQueries({ queryKey: getListTournamentsQueryKey() });
  }, [tournament.id, tournament.date, tournament.label, updateTournament, queryClient]);

  return (
    <tr className="hover:bg-muted/50 transition-colors">
      <td className="px-4 py-2 sticky left-0 bg-card z-10 font-mono font-medium border-r shadow-[1px_0_0_0_hsl(var(--border))]">
        {`T${tournament.sequenceIndex}`}
      </td>
      <td className="px-2 py-1 border-r min-w-28">
        <Input
          type="date"
          value={localDate}
          onChange={(e) => setLocalDate(e.target.value)}
          onBlur={() => handleMetaBlur("date", localDate)}
          className="h-8 font-mono bg-transparent border-transparent hover:border-input focus:bg-background text-xs"
          data-testid={`input-date-${tournament.id}`}
        />
      </td>
      <td className="px-2 py-1 border-r min-w-36">
        <LabelCell
          value={localLabel}
          existingLabels={existingLabels}
          onChange={setLocalLabel}
          onCommit={(val) => handleMetaBlur("label", val)}
          testId={`input-label-${tournament.id}`}
        />
      </td>
      {players.map((p) => {
        const key = `${tournament.id}:${p.id}`;
        return (
          <td key={p.id} className="px-2 py-1 border-r last:border-r-0">
            <Input
              value={localEdits[key] ?? ""}
              onChange={(e) => onChange(tournament.id, p.id, e.target.value)}
              onBlur={() => onBlur(tournament.id, p.id)}
              className="w-full text-center h-8 font-mono bg-transparent border-transparent hover:border-input focus:bg-background"
              placeholder="-"
              data-testid={`input-ranking-${tournament.id}-${p.id}`}
            />
          </td>
        );
      })}
    </tr>
  );
}
