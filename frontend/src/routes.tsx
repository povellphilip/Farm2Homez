import { BarChart3, ClipboardList, Inbox, LayoutDashboard, Package, Settings, ShieldCheck, Sprout, Tags, Users, ScrollText, ShoppingBag } from 'lucide-react';
import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { RequireRole } from './auth/RequireRole';
import { PortalLayout, PublicLayout, type PortalNavItem } from './components/layout/Layouts';
import { PageLoader } from './components/ui/Feedback';
import { NotFoundPage } from './pages/public/StatusPages';

const HomePage = lazy(() => import('./pages/public/HomePage'));
const CatalogPage = lazy(() => import('./pages/public/CatalogPage'));
const ProductPage = lazy(() => import('./pages/public/ProductPage'));
const FarmDirectoryPage = lazy(() => import('./pages/public/FarmPages').then((m) => ({ default: m.FarmDirectoryPage })));
const FarmProfilePage = lazy(() => import('./pages/public/FarmPages').then((m) => ({ default: m.FarmProfilePage })));
const AboutPage = lazy(() => import('./pages/public/InfoPages').then((m) => ({ default: m.AboutPage })));
const FaqPage = lazy(() => import('./pages/public/InfoPages').then((m) => ({ default: m.FaqPage })));
const ContactPage = lazy(() => import('./pages/public/InfoPages').then((m) => ({ default: m.ContactPage })));
const PrivacyPage = lazy(() => import('./pages/public/InfoPages').then((m) => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/public/InfoPages').then((m) => ({ default: m.TermsPage })));
const SignInChooserPage = lazy(() => import('./pages/public/InfoPages').then((m) => ({ default: m.SignInChooserPage })));

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const ConsumerRegisterPage = lazy(() => import('./pages/auth/RegisterPages').then((m) => ({ default: m.ConsumerRegisterPage })));
const ProducerRegisterPage = lazy(() => import('./pages/auth/RegisterPages').then((m) => ({ default: m.ProducerRegisterPage })));
const VerifyEmailPage = lazy(() => import('./pages/auth/RecoveryPages').then((m) => ({ default: m.VerifyEmailPage })));
const ForgotPasswordPage = lazy(() => import('./pages/auth/RecoveryPages').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./pages/auth/RecoveryPages').then((m) => ({ default: m.ResetPasswordPage })));

const consumer = () => import('./pages/consumer/AccountPages');
const CartPage = lazy(() => import('./pages/consumer/CartPage'));
const CheckoutPage = lazy(() => import('./pages/consumer/CheckoutPage'));
const ConsumerAccountLayout = lazy(() => consumer().then((m) => ({ default: m.ConsumerAccountLayout })));
const ConsumerDashboardPage = lazy(() => consumer().then((m) => ({ default: m.ConsumerDashboardPage })));
const ConsumerOrdersPage = lazy(() => consumer().then((m) => ({ default: m.ConsumerOrdersPage })));
const ConsumerOrderDetailPage = lazy(() => consumer().then((m) => ({ default: m.ConsumerOrderDetailPage })));
const FavoritesPage = lazy(() => consumer().then((m) => ({ default: m.FavoritesPage })));
const AddressesPage = lazy(() => consumer().then((m) => ({ default: m.AddressesPage })));
const MessagesPage = lazy(() => consumer().then((m) => ({ default: m.MessagesPage })));
const ConsumerSettingsPage = lazy(() => consumer().then((m) => ({ default: m.ConsumerSettingsPage })));

const producer = () => import('./pages/producer/ProducerPages');
const ProducerDashboardPage = lazy(() => producer().then((m) => ({ default: m.ProducerDashboardPage })));
const ProducerProductsPage = lazy(() => producer().then((m) => ({ default: m.ProducerProductsPage })));
const ProductEditorPage = lazy(() => import('./pages/producer/ProductEditorPage'));
const ProducerOrdersPage = lazy(() => producer().then((m) => ({ default: m.ProducerOrdersPage })));
const ProducerOrderDetailPage = lazy(() => producer().then((m) => ({ default: m.ProducerOrderDetailPage })));
const ProducerInquiriesPage = lazy(() => producer().then((m) => ({ default: m.ProducerInquiriesPage })));
const FarmProfileEditorPage = lazy(() => producer().then((m) => ({ default: m.FarmProfileEditorPage })));
const ProducerSettingsPage = lazy(() => producer().then((m) => ({ default: m.ProducerSettingsPage })));
const VerificationBanner = lazy(() => producer().then((m) => ({ default: m.VerificationBanner })));

const admin = () => import('./pages/admin/AdminPages');
const AdminDashboardPage = lazy(() => admin().then((m) => ({ default: m.AdminDashboardPage })));
const AdminProducersPage = lazy(() => admin().then((m) => ({ default: m.AdminProducersPage })));
const AdminUsersPage = lazy(() => admin().then((m) => ({ default: m.AdminUsersPage })));
const AdminProductsPage = lazy(() => admin().then((m) => ({ default: m.AdminProductsPage })));
const AdminOrdersPage = lazy(() => admin().then((m) => ({ default: m.AdminOrdersPage })));
const AdminOrderDetailPage = lazy(() => admin().then((m) => ({ default: m.AdminOrderDetailPage })));
const AdminInquiriesPage = lazy(() => admin().then((m) => ({ default: m.AdminInquiriesPage })));
const AdminCategoriesPage = lazy(() => admin().then((m) => ({ default: m.AdminCategoriesPage })));
const AdminAuditLogPage = lazy(() => admin().then((m) => ({ default: m.AdminAuditLogPage })));

const PRODUCER_NAV: PortalNavItem[] = [
  { to: '/producer/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/producer/products', label: 'Products', icon: Package },
  { to: '/producer/orders', label: 'Orders', icon: ClipboardList },
  { to: '/producer/inquiries', label: 'Inquiries', icon: Inbox },
  { to: '/producer/farm', label: 'Farm profile', icon: Sprout },
  { to: '/producer/settings', label: 'Account', icon: Settings },
];

const ADMIN_NAV: PortalNavItem[] = [
  { to: '/admin/dashboard', label: 'Overview', icon: BarChart3 },
  { to: '/admin/producers', label: 'Producers', icon: ShieldCheck },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/products', label: 'Listings', icon: Package },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/admin/inquiries', label: 'Inquiries', icon: Inbox },
  { to: '/admin/categories', label: 'Categories', icon: Tags },
  { to: '/admin/audit-log', label: 'Audit log', icon: ScrollText },
];

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="products" element={<CatalogPage />} />
          <Route path="products/:slug" element={<ProductPage />} />
          <Route path="categories/:slug" element={<CatalogPage />} />
          <Route path="farms" element={<FarmDirectoryPage />} />
          <Route path="farms/:slug" element={<FarmProfilePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="faq" element={<FaqPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="signin" element={<SignInChooserPage />} />

          <Route path="cart" element={<RequireRole role="CONSUMER"><CartPage /></RequireRole>} />
          <Route path="checkout" element={<RequireRole role="CONSUMER"><CheckoutPage /></RequireRole>} />
          <Route path="consumer" element={<RequireRole role="CONSUMER"><ConsumerAccountLayout /></RequireRole>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ConsumerDashboardPage />} />
            <Route path="orders" element={<ConsumerOrdersPage />} />
            <Route path="orders/:number" element={<ConsumerOrderDetailPage />} />
            <Route path="favorites" element={<FavoritesPage />} />
            <Route path="addresses" element={<AddressesPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="settings" element={<ConsumerSettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route path="consumer/login" element={<LoginPage portal="consumer" />} />
        <Route path="consumer/register" element={<ConsumerRegisterPage />} />
        <Route path="producer/login" element={<LoginPage portal="producer" />} />
        <Route path="producer/register" element={<ProducerRegisterPage />} />
        <Route path="admin/login" element={<LoginPage portal="admin" />} />
        <Route path="verify-email" element={<VerifyEmailPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />

        <Route
          path="producer"
          element={
            <RequireRole role="PRODUCER">
              <PortalLayout title="Farm dashboard" nav={PRODUCER_NAV} banner={<Suspense fallback={null}><VerificationBanner /></Suspense>} />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<ProducerDashboardPage />} />
          <Route path="products" element={<ProducerProductsPage />} />
          <Route path="products/new" element={<ProductEditorPage />} />
          <Route path="products/:id" element={<ProductEditorPage />} />
          <Route path="orders" element={<ProducerOrdersPage />} />
          <Route path="orders/:id" element={<ProducerOrderDetailPage />} />
          <Route path="inquiries" element={<ProducerInquiriesPage />} />
          <Route path="farm" element={<FarmProfileEditorPage />} />
          <Route path="settings" element={<ProducerSettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        <Route
          path="admin"
          element={
            <RequireRole role="ADMIN">
              <PortalLayout title="Administration" nav={ADMIN_NAV} tone="charcoal" />
            </RequireRole>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="producers" element={<AdminProducersPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="orders/:number" element={<AdminOrderDetailPage />} />
          <Route path="inquiries" element={<AdminInquiriesPage />} />
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="audit-log" element={<AdminAuditLogPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
