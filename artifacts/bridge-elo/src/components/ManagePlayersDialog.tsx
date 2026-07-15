import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  getListPlayersQueryKey,
  getGetEloHistoryQueryKey,
  useUpdatePlayer,
  useCreatePlayer,
} from "@workspace/api-client-react";
import type { Player } from "@workspace/api-client-react";
import { useBridgeData } from "@/hooks/use-bridge";
import { useToast } from "@/hooks/use-toast";

export function ManagePlayersDialog() {
  const [open, setOpen] = useState(false);
  const { players } = useBridgeData();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updatePlayer = useUpdatePlayer();
  const createPlayer = useCreatePlayer();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const sorted = [...players].sort((a, b) => a.sortOrder - b.sortOrder);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetEloHistoryQueryKey() });
  };

  const startEdit = (player: Player) => {
    setEditingId(player.id);
    setEditingName(player.name);
  };

  const commitRename = async (player: Player) => {
    const name = editingName.trim();
    if (!name || name === player.name) {
      setEditingId(null);
      return;
    }
    try {
      await updatePlayer.mutateAsync({ id: player.id, data: { name } });
      invalidate();
    } catch {
      toast({ title: "Rename failed", variant: "destructive" });
    }
    setEditingId(null);
  };

  const move = async (player: Player, direction: -1 | 1) => {
    const idx = sorted.findIndex((p) => p.id === player.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const other = sorted[swapIdx];

    try {
      await Promise.all([
        updatePlayer.mutateAsync({ id: player.id, data: { sortOrder: other.sortOrder } }),
        updatePlayer.mutateAsync({ id: other.id, data: { sortOrder: player.sortOrder } }),
      ]);
      invalidate();
    } catch {
      toast({ title: "Reorder failed", variant: "destructive" });
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setIsAdding(true);
    try {
      await createPlayer.mutateAsync({ data: { name } });
      invalidate();
      setNewName("");
    } catch {
      toast({ title: "Failed to add player", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" data-testid="button-manage-players">
          Manage Players
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Manage Players</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1 mt-2 max-h-80 overflow-y-auto">
          {sorted.map((player, idx) => (
            <div
              key={player.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 group"
            >
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => move(player, -1)}
                  disabled={idx === 0 || updatePlayer.isPending}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none text-xs"
                  aria-label="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => move(player, 1)}
                  disabled={idx === sorted.length - 1 || updatePlayer.isPending}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 leading-none text-xs"
                  aria-label="Move down"
                >
                  ▼
                </button>
              </div>

              {editingId === player.id ? (
                <Input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => commitRename(player)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(player);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="h-7 text-sm flex-1"
                  data-testid={`input-rename-${player.id}`}
                />
              ) : (
                <span
                  className="flex-1 text-sm cursor-pointer hover:underline"
                  onClick={() => startEdit(player)}
                  title="Click to rename"
                  data-testid={`player-name-${player.id}`}
                >
                  {player.name}
                </span>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleAdd} className="flex gap-2 mt-3 pt-3 border-t">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New player name"
            className="flex-1 h-8 text-sm"
            data-testid="input-new-player-name"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isAdding || !newName.trim()}
            data-testid="button-add-player-submit"
          >
            Add
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
