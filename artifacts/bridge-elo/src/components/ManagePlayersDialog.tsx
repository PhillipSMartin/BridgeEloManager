import React, { useState, useRef } from "react";
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

  const [localOrder, setLocalOrder] = useState<Player[] | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const sorted = localOrder ?? [...players].sort((a, b) => a.sortOrder - b.sortOrder);

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

  const handleDragStart = (idx: number) => {
    dragIndexRef.current = idx;
    if (!localOrder) setLocalOrder(sorted);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIndexRef.current === null || dragIndexRef.current === idx) return;
    setDragOverIndex(idx);
    const next = [...(localOrder ?? sorted)];
    const [moved] = next.splice(dragIndexRef.current, 1);
    next.splice(idx, 0, moved);
    dragIndexRef.current = idx;
    setLocalOrder(next);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverIndex(null);
    dragIndexRef.current = null;

    if (!localOrder) return;

    const updates = localOrder
      .map((p, i) => ({ id: p.id, sortOrder: i, oldOrder: p.sortOrder }))
      .filter((u) => u.sortOrder !== u.oldOrder);

    if (updates.length === 0) {
      setLocalOrder(null);
      return;
    }

    try {
      await Promise.all(
        updates.map((u) => updatePlayer.mutateAsync({ id: u.id, data: { sortOrder: u.sortOrder } }))
      );
      invalidate();
    } catch {
      toast({ title: "Reorder failed", variant: "destructive" });
      setLocalOrder(null);
    }
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    dragIndexRef.current = null;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setIsAdding(true);
    try {
      await createPlayer.mutateAsync({ data: { name } });
      setLocalOrder(null);
      invalidate();
      setNewName("");
    } catch {
      toast({ title: "Failed to add player", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  const handleOpenChange = (val: boolean) => {
    setOpen(val);
    if (!val) setLocalOrder(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors ${
                dragOverIndex === idx
                  ? "bg-primary/10 border border-primary/30"
                  : "hover:bg-muted/50 border border-transparent"
              }`}
            >
              <span
                className="text-muted-foreground cursor-grab active:cursor-grabbing select-none text-base leading-none px-0.5"
                aria-label="Drag to reorder"
              >
                ⠿
              </span>

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
