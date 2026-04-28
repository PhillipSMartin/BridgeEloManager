import React, { useState, useRef } from "react";
import * as XLSX from "xlsx";
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
  rankings: ParsedRanking[];
}

interface ParsedData {
  players: string[];
  tournaments: ParsedTournament[];
}

const PLAYER_COLUMNS_START = 1;
const PLAYER_COLUMNS_END = 10;
const WINS_COLUMNS_START = 11;

function parseSpreadsheet(workbook: XLSX.WorkBook): ParsedData | null {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return null;

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    defval: null,
  });

  if (rows.length < 2) return null;

  // Row 1 (index 1) has player names in columns 1-10
  const headerRow = rows[1] as (string | number | null)[];
  const players: string[] = [];
  for (let col = PLAYER_COLUMNS_START; col <= PLAYER_COLUMNS_END; col++) {
    const name = headerRow[col];
    if (typeof name === "string" && name.trim()) {
      players.push(name.trim());
    }
  }

  if (players.length === 0) return null;

  const tournaments: ParsedTournament[] = [];

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i] as (string | number | null)[];
    const index = row[0];
    if (typeof index !== "number") continue;

    const rankings: ParsedRanking[] = [];
    for (let j = 0; j < players.length; j++) {
      const winsCol = WINS_COLUMNS_START + j;
      const val = row[winsCol];
      if (val !== null && typeof val === "number") {
        rankings.push({ playerName: players[j], reverseRanking: val });
      }
    }

    tournaments.push({
      sequenceIndex: index,
      label: null,
      rankings,
    });
  }

  return { players, tournaments };
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
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) return null;

  const header = parseCsvRow(lines[0]).map((h) => h.toLowerCase());
  const tournamentIdx = header.indexOf("tournament");
  const playerIdx = header.indexOf("player");
  const rankingIdx = header.indexOf("reverseranking");

  if (tournamentIdx === -1 || playerIdx === -1 || rankingIdx === -1) return null;

  const playerSet = new Set<string>();
  const tournamentMap = new Map<
    number,
    { sequenceIndex: number; label: null; rankings: ParsedRanking[] }
  >();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvRow(lines[i]);
    const tIndex = parseInt(cols[tournamentIdx] ?? "", 10);
    const playerName = (cols[playerIdx] ?? "").trim();
    const rankingVal = (cols[rankingIdx] ?? "").trim();

    if (isNaN(tIndex) || !playerName) continue;

    playerSet.add(playerName);

    if (!tournamentMap.has(tIndex)) {
      tournamentMap.set(tIndex, { sequenceIndex: tIndex, label: null, rankings: [] });
    }

    const parsed = parseFloat(rankingVal);
    const reverseRanking = rankingVal === "" || rankingVal.toLowerCase() === "null" ? null : (isNaN(parsed) ? null : parsed);
    tournamentMap.get(tIndex)!.rankings.push({
      playerName,
      reverseRanking,
    });
  }

  if (tournamentMap.size === 0) return null;

  const tournaments = Array.from(tournamentMap.values()).sort(
    (a, b) => a.sequenceIndex - b.sequenceIndex
  );

  return { players: Array.from(playerSet), tournaments };
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
      if (file.name.endsWith(".csv") || file.type === "text/csv") {
        const text = await file.text();
        const result = parseCsv(text);
        if (!result) {
          setParseError(
            "Could not parse CSV. Expected columns: Tournament, Player, ReverseRanking"
          );
        } else {
          setParsed(result);
        }
      } else {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const result = parseSpreadsheet(workbook);
        if (!result) {
          setParseError("Could not parse spreadsheet. Make sure it matches the Bridge ELO format.");
        } else {
          setParsed(result);
        }
      }
    } catch (err) {
      setParseError("Failed to read file. Please check the file format.");
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
          <DialogTitle>Import Tournament History</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-2">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              Upload your Bridge ELO spreadsheet (.xlsx) or a CSV file to import historical
              tournament data. Existing tournaments will not be overwritten.
            </p>
            <p className="text-xs">
              <strong>Spreadsheet:</strong> must follow the Bridge ELO format — player names in row
              2 (columns B–K), wins per tournament in the same columns starting from row 3.
            </p>
            <p className="text-xs">
              <strong>CSV:</strong> requires columns named <code>Tournament</code>,{" "}
              <code>Player</code>, and <code>ReverseRanking</code> (one row per player per
              tournament).
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Select file</label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
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
