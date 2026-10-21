import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { BrowserRouter } from 'react-router-dom';
import { toApiError } from './api/errors';
import { AuthProvider } from './auth/AuthProvider';
import { ToastProvider } from './components/ui/Toaster';
import { AppRoutes } from './routes';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Don't retry client errors such as 404 or 403; retry transient failures once.
        retry: (failureCount, error) => {
          const status = toApiError(error).status;
          return failureCount < 1 && (status === 0 || status >= 500);
        },
      },
    },
  });
}

const queryClient = createQueryClient();

export default function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <AppRoutes />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}
