import React from "react";
import { AddPlayerDialog } from "@/components/AddPlayerDialog";
import { ImportDialog } from "@/components/ImportDialog";
import { ExportButton } from "@/components/ExportButton";
import { RankingsTab } from "@/components/RankingsTab";
import { EloScoresTab } from "@/components/EloScoresTab";
import { EloTrendChart } from "@/components/EloTrendChart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBridgeData } from "@/hooks/use-bridge";

export default function Home() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      <header className="w-full max-w-5xl mx-auto px-4 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center text-primary-foreground font-bold font-mono shadow-sm">
            B
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">Bridge ELO Tracker</h1>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton />
          <ImportDialog />
          <AddPlayerDialog />
        </div>
      </header>

      <main className="w-full max-w-5xl mx-auto px-4 pb-12 flex-1 flex flex-col">
        <Tabs defaultValue="rankings" className="w-full flex-1 flex flex-col">
          <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent mb-6">
            <TabsTrigger 
              value="rankings" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 font-medium"
              data-testid="tab-rankings"
            >
              Rankings Input
            </TabsTrigger>
            <TabsTrigger 
              value="elo" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 font-medium"
              data-testid="tab-elo"
            >
              ELO Scores
            </TabsTrigger>
            <TabsTrigger 
              value="trends" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2 font-medium"
              data-testid="tab-trends"
            >
              ELO Trends
            </TabsTrigger>
          </TabsList>
          
          <div className="bg-card rounded-lg shadow-sm border p-4 flex-1">
            <TabsContent value="rankings" className="mt-0 h-full">
              <RankingsTab />
            </TabsContent>
            <TabsContent value="elo" className="mt-0 h-full">
              <EloScoresTab />
            </TabsContent>
            <TabsContent value="trends" className="mt-0 h-full">
              <EloTrendChart />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
