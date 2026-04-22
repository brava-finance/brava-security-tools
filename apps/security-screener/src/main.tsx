import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';

import './globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Subgraph data only advances with new blocks; 30s feels live enough
      // without hammering the gateway from every open tab.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
});

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('#root element missing from index.html');
}

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
