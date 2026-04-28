import React, { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getListPlayersQueryKey,
  getListTournamentsQueryKey,
  getGetEloHistoryQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

interface ParsedRanking {
  playerName: string;
  reverseRanking: number | null;
}

interface ParsedTournament {
  sequenceIndex: number;
  label: string | null;
  date: string | null;
  rankings: ParsedRanking[];
}

interface ParsedData {
  players: string[];
  tournaments: ParsedTournament[];
}

function parseCsvRow(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCsv(text: string): ParsedData | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return null;

  const header = parseCsvRow(lines[0]);
  const headerLower = header.map((h) => h.toLowerCase().trim());

  const hashIdx = headerLower.indexOf("#");
  const dateIdx = headerLower.indexOf("date");
  const nameIdx = headerLower.indexOf("name");

  if (hashIdx === -1) return null;

  const metaCols = new Set([hashIdx, dateIdx, nameIdx].filter((i) => i !== -1));
  const playerCols: Array<{ idx: number; name: string }> = [];
  for (let i = 0; i < header.length; i++) {
    if (!metaCols.has(i) && header[i].trim()) {
      playerCols.push({ idx: i, name: header[i].trim() });
    }
  }

  if (playerCols.length === 0) return null;

  const players = playerCols.map((p) => p.name);
  const tournaments: ParsedTournament[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]);
    const rawIndex = (cols[hashIdx] ?? "").trim().replace(/^T/i, "");
    const seqIndex = parseInt(rawIndex, 10);
    if (isNaN(seqIndex)) continue;

    const label = nameIdx !== -1 ? (cols[nameIdx] ?? "").trim() || null : null;
    const date = dateIdx !== -1 ? (cols[dateIdx] ?? "").trim() || null : null;

    const rankings: ParsedRanking[] = [];
    for (const pc of playerCols) {
      const val = (cols[pc.idx] ?? "").trim();
      const parsed = parseFloat(val);
      const reverseRanking =
        val === "" || val.toLowerCase() === "null"
          ? null
          : isNaN(parsed)
          ? null
          : parsed;
      rankings.push({ playerName: pc.name, reverseRanking });
    }

    tournaments.push({ sequenceIndex: seqIndex, label, date, rankings });
  }

  if (tournaments.length === 0) return null;
  return { players, tournaments };
}

export function ImportDialog() {
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedData | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setParseError("");
    setParsed(null);

    try {
      const text = await file.text();
      const result = parseCsv(text);
      if (!result) {
        setParseError(
          "Could not parse file. Make sure it was exported from Bridge ELO Tracker."
        );
      } else {
        setParsed(result);
      }
    } catch {
      setParseError("Failed to read file.");
    }
  };

  const handleImport = async () => {
    if (!parsed) return;
    setImporting(true);

    try {
      const resp = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournaments: parsed.tournaments }),
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || "Import failed");
      }

      const result = await resp.json();

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getListTournamentsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetEloHistoryQueryKey() }),
        queryClient.invalidateQueries({ queryKey: ["all-rankings"] }),
      ]);

      toast({
        title: "Import complete",
        description: `${result.tournamentsImported} tournaments and ${result.rankingsImported} rankings imported.${result.playersCreated > 0 ? ` ${result.playersCreated} new players created.` : ""}`,
      });

      setOpen(false);
      setParsed(null);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Import failed", description: message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) {
      setParsed(null);
      setFileName("");
      setParseError("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const participatingCount = parsed
    ? parsed.tournaments.filter((t) => t.rankings.length > 0).length
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-import">
          Import Data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Tournament Data</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          <p className="text-sm text-muted-foreground">
            Upload a CSV file previously exported from Bridge ELO Tracker. Tournaments that already
            exist in the database will not be overwritten.
          </p>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Select CSV file</label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-secondary/80 cursor-pointer"
              data-testid="input-import-file"
            />
            {fileName && !parseError && !parsed && (
              <p className="text-xs text-muted-foreground">Parsing {fileName}…</p>
            )}
            {parseError && (
              <p className="text-xs text-destructive">{parseError}</p>
            )}
          </div>

          {parsed && (
            <div className="rounded-md border bg-muted/40 p-4 flex flex-col gap-2 text-sm" data-testid="import-preview">
              <p className="font-semibold">Preview</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground">
                <span>Players found</span>
                <span className="font-mono font-medium text-foreground">{parsed.players.length}</span>
                <span>Tournaments found</span>
                <span className="font-mono font-medium text-foreground">{parsed.tournaments.length}</span>
                <span>With rankings</span>
                <span className="font-mono font-medium text-foreground">{participatingCount}</span>
              </div>
              <div className="mt-1">
                <span className="text-xs text-muted-foreground">Players: </span>
                <span className="text-xs">{parsed.players.join(", ")}</span>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={importing}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!parsed || importing}
              data-testid="button-confirm-import"
            >
              {importing ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
