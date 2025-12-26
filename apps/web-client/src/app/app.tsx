import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { Login } from '../pages/Login';
import { Unauthorized } from '../pages/Unauthorized';
import { HomePage } from '../pages/HomePage';
import { NavigationBuilder } from '../pages/studio/NavigationBuilder';
import { AppShellV2 } from '../components/shell/AppShellV2';
import { ProtectedRoute } from '../routing/ProtectedRoute';

// Admin pages
import {
  AdminDashboardPage,
  UsersListPage,
  UserInvitePage,
  UserDetailPage,
  CollectionsListPage,
  CollectionEditorPage,
  CollectionWizard,
  PropertiesPage,
  // Groups
  GroupsPage,
  GroupFormPage,
  GroupMembersPage,
  GroupRolesPage,
  // Roles & Permissions
  RolesPage,
  // Access Rules
  AccessRulesPage,
  // Enterprise Features
  SSOConfigPage,
  LDAPConfigPage,
  AuditLogViewer,
} from '../features/admin';



// Data pages (Schema Engine runtime)
import { CollectionRecordPage } from '../features/data';

import { ThemeCustomizerPage } from '../pages/ThemeCustomizer';
import { SettingsPage as UserSettingsPage } from '../pages/Settings';
import { SecuritySettingsPage } from '../pages/SecuritySettings';
import { ProfileSettingsPage } from '../pages/ProfileSettings';
import { VerifyEmailPage } from '../pages/VerifyEmail';
import { ResetPassword } from '../pages/ResetPassword';
import { MfaSetup } from '../pages/MfaSetup';
import { ListView } from '../pages/ListView';

const ShellRoute = () => (
  <ProtectedRoute>
    <AppShellV2 />
  </ProtectedRoute>
);

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ShellRoute />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<HomePage />} />

          {/* Studio Dashboard */}
          <Route
            path="/studio"
            element={
              <ProtectedRoute roles="admin">
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Studio - User Management */}
          <Route
            path="/studio/users"
            element={
              <ProtectedRoute roles="admin">
                <UsersListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/users/invite"
            element={
              <ProtectedRoute roles="admin">
                <UserInvitePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/users/:id"
            element={
              <ProtectedRoute roles="admin">
                <UserDetailPage />
              </ProtectedRoute>
            }
          />

          {/* Studio - Groups Management */}
          <Route
            path="/studio/groups"
            element={
              <ProtectedRoute roles="admin">
                <GroupsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/groups/new"
            element={
              <ProtectedRoute roles="admin">
                <GroupFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/groups/:id/edit"
            element={
              <ProtectedRoute roles="admin">
                <GroupFormPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/groups/:id/members"
            element={
              <ProtectedRoute roles="admin">
                <GroupMembersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/groups/:id/roles"
            element={
              <ProtectedRoute roles="admin">
                <GroupRolesPage />
              </ProtectedRoute>
            }
          />

          {/* Studio - Roles & Permissions */}
          <Route
            path="/studio/roles"
            element={
              <ProtectedRoute roles="admin">
                <RolesPage />
              </ProtectedRoute>
            }
          />


          {/* Studio - Collections (Schema Engine) */}
          <Route
            path="/studio/collections"
            element={
              <ProtectedRoute roles="admin">
                <CollectionsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/collections/new"
            element={
              <ProtectedRoute roles="admin">
                <CollectionWizard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/collections/:id"
            element={
              <ProtectedRoute roles="admin">
                <CollectionEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/collections/:id/access"
            element={
              <ProtectedRoute roles="admin">
                <AccessRulesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/studio/collections/:id/properties"
            element={
              <ProtectedRoute roles="admin">
                <PropertiesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/collections/:id/properties/:propertyId"
            element={
              <ProtectedRoute roles="admin">
                <PropertiesPage />
              </ProtectedRoute>
            }
          />

          {/* Studio - Standalone Properties List */}
          <Route
            path="/studio/properties"
            element={
              <ProtectedRoute roles="admin">
                <PropertiesPage />
              </ProtectedRoute>
            }
          />


          {/* Admin - Enterprise Features */}
          <Route
            path="/studio/sso"
            element={
              <ProtectedRoute roles="admin">
                <SSOConfigPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/ldap"
            element={
              <ProtectedRoute roles="admin">
                <LDAPConfigPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/audit"
            element={
              <ProtectedRoute roles="admin">
                <AuditLogViewer />
              </ProtectedRoute>
            }
          />



          {/* ListView - ServiceNow-style URL pattern (e.g., /work_orders.list) */}
          <Route path="/:collectionCode.list" element={<ListView />} />
          {/* Record detail page (e.g., /work_orders/123) */}
          <Route path="/:collectionCode/:recordId" element={<CollectionRecordPage />} />

          {/* User Settings */}
          <Route path="/settings" element={<UserSettingsPage />} />
          <Route path="/settings/profile" element={<ProfileSettingsPage />} />
          <Route path="/settings/themes" element={<ThemeCustomizerPage />} />
          <Route path="/settings/security" element={<SecuritySettingsPage />} />
          <Route path="/settings/mfa-setup" element={<MfaSetup />} />

          {/* Studio - Navigation */}
          <Route
            path="/studio/navigation"
            element={
              <ProtectedRoute roles="admin">
                <NavigationBuilder />
              </ProtectedRoute>
            }
          />

        </Route>

        {/* Redirect root to default module list */}
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
