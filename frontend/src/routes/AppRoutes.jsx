import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PageLoader } from '../components/common/PageLoader';

const HomePage = lazy(() => import('../pages/HomePage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const ProductListingPage = lazy(() => import('../pages/ProductListingPage'));
const ProductDetailPage = lazy(() => import('../pages/ProductDetailPage'));
const CartPage = lazy(() => import('../pages/CartPage'));
const CheckoutPage = lazy(() => import('../pages/CheckoutPage'));

function ProtectedRoute({ children }) {
  const { user, booting } = useAuth();
  if (booting) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/products" element={<ProductListingPage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}
