import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from '@/layouts/PublicLayout';
import { LoadingState } from '@/components/StateBlocks';
import { AdminAuthProvider } from '@/features/auth/AdminAuthContext';

const HomePage = lazy(() =>
  import('@/pages/public/HomePage').then((m) => ({ default: m.HomePage })),
);
const ProductsPage = lazy(() =>
  import('@/pages/public/ProductsPage').then((m) => ({ default: m.ProductsPage })),
);
const ProductDetailPage = lazy(() =>
  import('@/pages/public/ProductDetailPage').then((m) => ({
    default: m.ProductDetailPage,
  })),
);
const TransparencyPage = lazy(() =>
  import('@/pages/public/TransparencyPage').then((m) => ({
    default: m.TransparencyPage,
  })),
);

const AdminLayout = lazy(() =>
  import('@/layouts/AdminLayout').then((m) => ({ default: m.AdminLayout })),
);
const AdminLoginPage = lazy(() =>
  import('@/pages/admin/AdminLoginPage').then((m) => ({
    default: m.AdminLoginPage,
  })),
);
const AdminDashboardPage = lazy(() =>
  import('@/pages/admin/AdminDashboardPage').then((m) => ({
    default: m.AdminDashboardPage,
  })),
);
const AdminProductsPage = lazy(() =>
  import('@/pages/admin/AdminProductsPage').then((m) => ({
    default: m.AdminProductsPage,
  })),
);
const AdminDonationsPage = lazy(() =>
  import('@/pages/admin/AdminDonationsPage').then((m) => ({
    default: m.AdminDonationsPage,
  })),
);
const AdminExpensesPage = lazy(() =>
  import('@/pages/admin/AdminExpensesPage').then((m) => ({
    default: m.AdminExpensesPage,
  })),
);
const AdminCompanionsPage = lazy(() =>
  import('@/pages/admin/AdminCompanionsPage').then((m) => ({
    default: m.AdminCompanionsPage,
  })),
);
const AdminAuditLogsPage = lazy(() =>
  import('@/pages/admin/AdminAuditLogsPage').then((m) => ({
    default: m.AdminAuditLogsPage,
  })),
);
const AdminTrashPage = lazy(() =>
  import('@/pages/admin/AdminTrashPage').then((m) => ({
    default: m.AdminTrashPage,
  })),
);

export function AppRouter() {
  return (
    <BrowserRouter>
      <Suspense fallback={<LoadingState minHeight="50vh" label="Đang tải trang..." />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<HomePage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/:id" element={<ProductDetailPage />} />
            <Route path="transparency" element={<TransparencyPage />} />
          </Route>

          <Route
            path="admin/login"
            element={
              <AdminAuthProvider>
                <AdminLoginPage />
              </AdminAuthProvider>
            }
          />
          <Route
            path="admin"
            element={
              <AdminAuthProvider>
                <AdminLayout />
              </AdminAuthProvider>
            }
          >
            <Route index element={<AdminDashboardPage />} />
            <Route path="products" element={<AdminProductsPage />} />
            <Route path="donations" element={<AdminDonationsPage />} />
            <Route path="expenses" element={<AdminExpensesPage />} />
            <Route path="companions" element={<AdminCompanionsPage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
            <Route path="trash" element={<AdminTrashPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
