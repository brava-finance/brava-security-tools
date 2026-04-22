import { useQuery } from '@tanstack/react-query';

import type { ChainId } from '../lib/config';
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
