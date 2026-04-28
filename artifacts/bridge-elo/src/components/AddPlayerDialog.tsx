import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useBridgeData } from "@/hooks/use-bridge";

export function AddPlayerDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { createPlayer, isCreatingPlayer } = useBridgeData();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createPlayer(name.trim());
    setName("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" data-testid="button-add-player">Add Player</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Player</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
          <Input 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="Player Name" 
            autoFocus
            data-testid="input-player-name"
          />
          <Button type="submit" disabled={isCreatingPlayer || !name.trim()} data-testid="button-submit-player">
            Save Player
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
