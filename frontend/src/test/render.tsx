import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { ToastProvider } from '@/components/ui/Toaster';
import { AppRoutes } from '@/routes';

/** Shows the current location so tests can assert on navigation. */
function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function Providers({ children, route }: { children: ReactElement; route: string }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[route]}>
          <AuthProvider>
            <ToastProvider>
              {children}
              <LocationProbe />
            </ToastProvider>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

/** Render the whole route table at `route`. */
export function renderApp(route = '/') {
  return render(
    <Providers route={route}>
      <AppRoutes />
    </Providers>,
  );
}

/** Render one element at `path` inside the app providers. */
export function renderAt(element: ReactElement, path = '/', route = path) {
  return render(
    <Providers route={route}>
      <Routes>
        <Route path={path} element={element} />
        <Route path="*" element={null} />
      </Routes>
    </Providers>,
  );
}
