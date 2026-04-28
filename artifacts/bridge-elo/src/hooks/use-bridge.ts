import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPlayers,
  getListPlayersQueryKey,
  useCreatePlayer,
  useListTournaments,
  getListTournamentsQueryKey,
  useCreateTournament,
  useGetEloHistory,
  getGetEloHistoryQueryKey,
  useGetTournamentRankings,
  getGetTournamentRankingsQueryKey,
  useUpsertTournamentRankings,
} from "@workspace/api-client-react";

export function useBridgeData() {
  const queryClient = useQueryClient();

  const { data: players, isLoading: isLoadingPlayers } = useListPlayers();
  const { data: tournaments, isLoading: isLoadingTournaments } = useListTournaments();
  const { data: eloHistory, isLoading: isLoadingElo } = useGetEloHistory();

  const createPlayer = useCreatePlayer();
  const createTournament = useCreateTournament();

  const handleCreatePlayer = async (name: string) => {
    await createPlayer.mutateAsync({ data: { name } });
    queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetEloHistoryQueryKey() });
  };

  const handleCreateTournament = async (label?: string) => {
    await createTournament.mutateAsync({ data: { label } });
    queryClient.invalidateQueries({ queryKey: getListTournamentsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetEloHistoryQueryKey() });
  };

  return {
    players: players || [],
    tournaments: tournaments || [],
    eloHistory,
    isLoading: isLoadingPlayers || isLoadingTournaments || isLoadingElo,
    createPlayer: handleCreatePlayer,
    createTournament: handleCreateTournament,
    isCreatingPlayer: createPlayer.isPending,
    isCreatingTournament: createTournament.isPending,
  };
}

export function useTournamentRankingsData(tournamentId: number) {
  const queryClient = useQueryClient();
  const { data: rankings, isLoading } = useGetTournamentRankings(tournamentId, {
    query: { enabled: !!tournamentId, queryKey: getGetTournamentRankingsQueryKey(tournamentId) }
  });
  
  const upsertRankings = useUpsertTournamentRankings();

  const handleUpsert = async (data: { rankings: Array<{ playerId: number, reverseRanking: number | null }> }) => {
    await upsertRankings.mutateAsync({ id: tournamentId, data });
    queryClient.invalidateQueries({ queryKey: getGetTournamentRankingsQueryKey(tournamentId) });
    queryClient.invalidateQueries({ queryKey: getGetEloHistoryQueryKey() });
  };

  return {
    rankings: rankings || [],
    isLoading,
    upsertRankings: handleUpsert,
  };
}
