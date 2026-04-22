import { resolveSubgraphUrl, type ChainId } from './config';

export class SubgraphError extends Error {
  constructor(
    message: string,
    readonly chain: ChainId,
    readonly details?: unknown
  ) {
    super(`[${chain}] ${message}`);
    this.name = 'SubgraphError';
  }
}

interface GqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function gqlRequest<T>(
  chain: ChainId,
  query: string,
  variables: Record<string, unknown> = {},
  signal?: AbortSignal
): Promise<T> {
  const url = resolveSubgraphUrl(chain);

  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  };
  if (signal !== undefined) init.signal = signal;

  const res = await fetch(url, init);
  if (!res.ok) {
    throw new SubgraphError(`HTTP ${res.status} ${res.statusText}`, chain);
  }

  const json = (await res.json()) as GqlResponse<T>;
  if (json.errors !== undefined && json.errors.length > 0) {
    throw new SubgraphError(json.errors.map((e) => e.message).join('; '), chain, json.errors);
  }
  if (json.data === undefined) {
    throw new SubgraphError('Empty GraphQL response', chain);
  }
  return json.data;
}
