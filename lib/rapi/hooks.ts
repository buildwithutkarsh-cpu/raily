"use client";

/* ══════════════════════════════════════════════════════════════
   RAPI — TanStack Query Hooks
   ══════════════════════════════════════════════════════════════ */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "./endpoints";
import type { RapiResponse } from "./client";

/* ─── Query Key Factory ────────────────────────────────────── */

export const rapiKeys = {
  all: ["rapi"] as const,
  stations: (query: string) => ["rapi", "stations", query] as const,
  trains: (from: string, to: string, date?: string) =>
    ["rapi", "trains", from, to, date] as const,
  trainInfo: (trainNumber: string) => ["rapi", "trainInfo", trainNumber] as const,
  liveStatus: (trainNumber: string, date?: string) =>
    ["rapi", "live", trainNumber, date] as const,
  availability: (trainNumber: string, from: string, to: string, date: string) =>
    ["rapi", "availability", trainNumber, from, to, date] as const,
  fare: (trainNumber: string, from: string, to: string, date: string) =>
    ["rapi", "fare", trainNumber, from, to, date] as const,
  pnr: (pnr: string) => ["rapi", "pnr", pnr] as const,
  health: ["rapi", "health"] as const,
  cache: ["rapi", "cache"] as const,
};

/* ─── Station Search ───────────────────────────────────────── */

export function useStations(query: string) {
  return useQuery({
    queryKey: rapiKeys.stations(query),
    queryFn: () => api.searchStations(query),
    enabled: query.length >= 1,
    staleTime: 60_000 * 60, // 1 hour — stations rarely change
    retry: 1,
  });
}

/* ─── Train Search ─────────────────────────────────────────── */

export function useTrainSearch(from: string, to: string, date?: string) {
  return useQuery({
    queryKey: rapiKeys.trains(from, to, date),
    queryFn: () => api.searchTrains(from, to, date),
    enabled: from.length >= 2 && to.length >= 2,
    staleTime: 60_000 * 10, // 10 min — schedules change infrequently
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  });
}

/* ─── Train Info ───────────────────────────────────────────── */

export function useTrainInfo(trainNumber: string) {
  return useQuery({
    queryKey: rapiKeys.trainInfo(trainNumber),
    queryFn: () => api.getTrainInfo(trainNumber),
    enabled: trainNumber.length >= 4,
    staleTime: 60_000 * 60 * 24, // 24 hours — routes are static
    retry: 2,
  });
}

/* ─── Live Status ──────────────────────────────────────────── */

export function useLiveStatus(trainNumber: string, date?: string) {
  return useQuery({
    queryKey: rapiKeys.liveStatus(trainNumber, date),
    queryFn: () => api.getLiveStatus(trainNumber, date),
    enabled: trainNumber.length >= 4,
    staleTime: 60_000 * 2, // 2 min — live status changes frequently
    refetchInterval: 60_000 * 2, // Auto-refresh every 2 min
    retry: 2,
  });
}

/* ─── Seat Availability ────────────────────────────────────── */

export function useAvailability(
  trainNumber: string,
  from: string,
  to: string,
  date: string
) {
  return useQuery({
    queryKey: rapiKeys.availability(trainNumber, from, to, date),
    queryFn: () => api.getAvailability(trainNumber, from, to, date),
    enabled: trainNumber.length >= 4 && from.length >= 2 && to.length >= 2 && date.length > 0,
    staleTime: 60_000 * 2, // 2 min — availability changes frequently
    retry: 2,
  });
}

/* ─── Fare ─────────────────────────────────────────────────── */

export function useFare(
  trainNumber: string,
  from: string,
  to: string,
  date: string
) {
  return useQuery({
    queryKey: rapiKeys.fare(trainNumber, from, to, date),
    queryFn: () => api.getFare(trainNumber, from, to, date),
    enabled: trainNumber.length >= 4 && from.length >= 2 && to.length >= 2 && date.length > 0,
    staleTime: 60_000 * 5, // 5 min
    retry: 2,
  });
}

/* ─── PNR Status ───────────────────────────────────────────── */

export function usePNRStatus(pnr: string) {
  return useQuery({
    queryKey: rapiKeys.pnr(pnr),
    queryFn: () => api.getPNRStatus(pnr),
    enabled: pnr.length === 10 && /^\d{10}$/.test(pnr),
    staleTime: 60_000 * 3, // 3 min — PNR can change
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  });
}

/* ─── Health ────────────────────────────────────────────────── */

export function useRapiHealth() {
  return useQuery({
    queryKey: rapiKeys.health,
    queryFn: () => api.getHealth(),
    staleTime: 60_000 * 5,
    retry: 1,
  });
}

/* ─── Invalidation Helpers ─────────────────────────────────── */

export function useInvalidateRapi() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: rapiKeys.all }),
    invalidateTrains: (from: string, to: string, date?: string) =>
      queryClient.invalidateQueries({ queryKey: rapiKeys.trains(from, to, date) }),
    invalidateLiveStatus: (trainNumber: string) =>
      queryClient.invalidateQueries({ queryKey: rapiKeys.liveStatus(trainNumber) }),
    invalidatePNR: (pnr: string) =>
      queryClient.invalidateQueries({ queryKey: rapiKeys.pnr(pnr) }),
  };
}