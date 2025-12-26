import { Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme/theme';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
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
  SettingsPage,
} from './pages';

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
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
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/new" element={<CustomerCreatePage />} />
            <Route path="customers/:id" element={<CustomerDetailPage />} />
            <Route path="instances" element={<InstancesPage />} />
            <Route path="instances/new" element={<InstanceCreatePage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="terraform" element={<TerraformPage />} />
            <Route path="metrics" element={<MetricsPage />} />
            <Route path="licenses" element={<LicensesPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
