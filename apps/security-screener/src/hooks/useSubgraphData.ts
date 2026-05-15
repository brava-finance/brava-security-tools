import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { chainsForView, type ChainId, type ViewId } from '../lib/config';
import { gqlRequest } from '../lib/graphql';
import {
  DASHBOARD_QUERY,
  DIVERGENCE_QUERY,
  type DashboardResponse,
  type DivergenceResponse,
} from '../lib/queries';

const DEFAULT_PAGE = 500;

export function useDashboardData(chain: ChainId, first: number = DEFAULT_PAGE) {
  return useQuery({
    queryKey: ['dashboard', chain, first],
    queryFn: ({ signal }) =>
      gqlRequest<DashboardResponse>(chain, DASHBOARD_QUERY, { first }, signal),
  });
}

export function useDivergenceData(chain: ChainId, first: number = DEFAULT_PAGE) {
  return useQuery({
    queryKey: ['divergence', chain, first],
    queryFn: ({ signal }) =>
      gqlRequest<DivergenceResponse>(chain, DIVERGENCE_QUERY, { first }, signal),
  });
}

// ---- Multi-chain hooks ----------------------------------------------------
//
// The `All chains` top-level view needs to fetch every chain in parallel and
// expose a single consolidated `{ data: ChainResult[] }` shape so sections can
// uniformly render per-chain rows. Fetches are deduplicated by react-query so
// switching between `all` and a single chain re-uses cached responses.

export interface ChainResult<T> {
  chain: ChainId;
  data: T;
}

export interface MultiChainQueryResult<T> {
  // Entries only contain chains whose fetch resolved successfully. If every
  // chain errored, callers still see `chains === []` but the aggregate
  // `error` is set.
  chains: Array<ChainResult<T>>;
  isLoading: boolean;
  // First non-null error we saw. Partial failures still populate `chains`
  // for every chain that did succeed.
  error: unknown;
  // True when at least one chain is still loading but we already have at
  // least one successful response. Surface to users so they know the merged
  // view is incomplete.
  isPartial: boolean;
  // Latest `dataUpdatedAt` (ms epoch) across all successful chain queries.
  // Undefined while every chain is still in-flight for the first time.
  dataUpdatedAt: number | undefined;
}

export function useMultiDashboardData(
  view: ViewId,
  first: number = DEFAULT_PAGE
): MultiChainQueryResult<DashboardResponse> {
  const chains = chainsForView(view);
  const results = useQueries({
    queries: chains.map((chain) => ({
      queryKey: ['dashboard', chain, first],
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        gqlRequest<DashboardResponse>(chain, DASHBOARD_QUERY, { first }, signal),
    })),
  });
  return useMemo(() => combineQueries(chains, results), [chains, results]);
}

export function useMultiDivergenceData(
  view: ViewId,
  first: number = DEFAULT_PAGE
): MultiChainQueryResult<DivergenceResponse> {
  const chains = chainsForView(view);
  const results = useQueries({
    queries: chains.map((chain) => ({
      queryKey: ['divergence', chain, first],
      queryFn: ({ signal }: { signal?: AbortSignal }) =>
        gqlRequest<DivergenceResponse>(chain, DIVERGENCE_QUERY, { first }, signal),
    })),
  });
  return useMemo(() => combineQueries(chains, results), [chains, results]);
}

interface QueryLike<T> {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
  dataUpdatedAt?: number;
}

function combineQueries<T>(
  chains: ChainId[],
  results: Array<QueryLike<T>>
): MultiChainQueryResult<T> {
  const merged: Array<ChainResult<T>> = [];
  let firstError: unknown = null;
  let anyLoading = false;
  let latestUpdatedAt: number | undefined;
  for (let i = 0; i < chains.length; i++) {
    const r = results[i];
    if (r === undefined) continue;
    if (r.isLoading) anyLoading = true;
    if (r.error !== null && r.error !== undefined && firstError === null) firstError = r.error;
    if (r.data !== undefined) merged.push({ chain: chains[i] as ChainId, data: r.data });
    if (r.dataUpdatedAt !== undefined && r.dataUpdatedAt > 0) {
      // Track the *oldest* successful response — the merged view is only as
      // fresh as its staler half. If a single chain hasn't responded yet we
      // still record what we have so the UI can advertise partial freshness.
      if (latestUpdatedAt === undefined || r.dataUpdatedAt < latestUpdatedAt) {
        latestUpdatedAt = r.dataUpdatedAt;
      }
    }
  }
  const hasAny = merged.length > 0;
  return {
    chains: merged,
    isLoading: !hasAny && anyLoading,
    error: firstError,
    isPartial: hasAny && anyLoading,
    dataUpdatedAt: latestUpdatedAt,
  };
}
