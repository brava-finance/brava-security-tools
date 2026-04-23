import { resolveGraphApiKey, resolveSubgraphUrl, type ChainId } from './config';

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
  const apiKey = resolveGraphApiKey();

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // Graph Studio endpoints accept anonymous reads, so only send the
  // Authorization header when a key is actually configured. This keeps local
  // dev against the docker-compose graph-node or against Studio working
  // without a key.
  if (apiKey.length > 0) headers.Authorization = `Bearer ${apiKey}`;

  const init: RequestInit = {
    method: 'POST',
    headers,
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
