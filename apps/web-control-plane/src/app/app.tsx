import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
import { AuthRole } from './services/auth';
import {
  LoginPage,
  DashboardPage,
  CustomersPage,
  CustomerCreatePage,
  CustomerDetailPage,
  InstancesPage,
  InstanceCreatePage,
  AuditPage,
  TerraformPage,
  MetricsPage,
  LicensesPage,
  PacksPage,
  RecoveryPage,
  SettingsPage,
} from './pages';

// Roles permitted to access platform-administration surfaces. Operators and
// viewers are bounced back to the dashboard if they navigate here directly.
const ADMIN_ROLES: AuthRole[] = ['super_admin', 'admin'];

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route
            path="customers"
            element={
              <ProtectedRoute requiredRole={ADMIN_ROLES}>
                <CustomersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="customers/new"
            element={
              <ProtectedRoute requiredRole={ADMIN_ROLES}>
                <CustomerCreatePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="customers/:id"
            element={
              <ProtectedRoute requiredRole={ADMIN_ROLES}>
                <CustomerDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="instances"
            element={
              <ProtectedRoute requiredRole={ADMIN_ROLES}>
                <InstancesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="instances/new"
            element={
              <ProtectedRoute requiredRole={ADMIN_ROLES}>
                <InstanceCreatePage />
              </ProtectedRoute>
            }
          />
          <Route path="audit" element={<AuditPage />} />
          <Route path="terraform" element={<TerraformPage />} />
          <Route path="metrics" element={<MetricsPage />} />
          <Route
            path="licenses"
            element={
              <ProtectedRoute requiredRole={ADMIN_ROLES}>
                <LicensesPage />
              </ProtectedRoute>
            }
          />
          <Route path="packs" element={<PacksPage />} />
          <Route
            path="recovery"
            element={
              <ProtectedRoute requiredRole={ADMIN_ROLES}>
                <RecoveryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="settings"
            element={
              <ProtectedRoute requiredRole={ADMIN_ROLES}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
