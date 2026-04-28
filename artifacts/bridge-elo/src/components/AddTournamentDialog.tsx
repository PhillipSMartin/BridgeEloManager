import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useBridgeData } from "@/hooks/use-bridge";

export function AddTournamentDialog() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const { createTournament, isCreatingTournament } = useBridgeData();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createTournament(label.trim() || undefined);
    setLabel("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-tournament">Add Tournament</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Tournament</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-4">
          <Input 
            value={label} 
            onChange={e => setLabel(e.target.value)} 
            placeholder="Tournament Label (Optional)" 
            autoFocus
            data-testid="input-tournament-label"
          />
          <Button type="submit" disabled={isCreatingTournament} data-testid="button-submit-tournament">
            Start Tournament
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
