import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { Login } from '../pages/Login';
import { Unauthorized } from '../pages/Unauthorized';
import { HomePage } from '../pages/HomePage';
import { ModuleListPage } from '../pages/ModuleListPage';
import { ModuleRecordPage } from '../pages/ModuleRecordPage';
import { ModuleCreatePage } from '../pages/ModuleCreatePage';
import { SchemaList } from '../pages/studio/SchemaList';
import { SchemaEditor } from '../pages/studio/SchemaEditor';
import { NavigationBuilder } from '../pages/studio/NavigationBuilder';
import { AppShell } from '../components/layout/AppShell';
import { TableListPage } from '../features/tables/TableListPage';
import { TableDetailPage } from '../features/tables/TableDetailPage';
import { NewTablePage } from '../features/tables/NewTablePage';
import { FieldsTab } from '../features/tables/FieldsTab';
import { DataTab } from '../features/tables/DataTab';
import { AccessControlTab } from '../features/tables/AccessControlTab';
import { LayoutsTab, UsageTab } from '../features/tables/TabsPlaceholders';
import { ProtectedRoute } from '../routing/ProtectedRoute';

// Admin pages
import {
  AdminDashboardPage,
  ScriptsListPage,
  ScriptEditorPage,
  BusinessRulesListPage,
  BusinessRuleEditorPage,
  WorkflowsListPage,
  WorkflowEditorPage,
  ApprovalsListPage,
  ApprovalEditorPage,
  EventsListPage,
  EventEditorPage,
  NotificationsListPage,
  NotificationEditorPage,
  CustomizationsListPage,
  CustomizationDetailPage,
  PlatformConfigBrowser,
  UpgradeCenterPage,
  SettingsPage,
  ChangeHistoryPage,
} from '../features/admin';

const ShellRoute = () => (
  <ProtectedRoute>
    <AppShell />
  </ProtectedRoute>
);

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<ShellRoute />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/studio/schema" element={<SchemaList />} />
          <Route path="/studio/schema/new" element={<SchemaEditor />} />
          <Route path="/studio/schema/:tableName" element={<SchemaEditor />} />
          {/* Studio - Tables & Schema */}
          <Route
            path="/studio/tables"
            element={
              <ProtectedRoute roles="tenant_admin">
                <TableListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/tables/new"
            element={
              <ProtectedRoute roles="tenant_admin">
                <NewTablePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/tables/:tableCode"
            element={
              <ProtectedRoute roles="tenant_admin">
                <TableDetailPage />
              </ProtectedRoute>
            }
          >
            <Route path="fields" element={<FieldsTab />} />
            <Route path="data" element={<DataTab />} />
            <Route path="layouts" element={<LayoutsTab />} />
            <Route path="access" element={<AccessControlTab />} />
            <Route path="usage" element={<UsageTab />} />
          </Route>

          {/* Studio Dashboard */}
          <Route
            path="/studio"
            element={
              <ProtectedRoute roles="tenant_admin">
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Studio - Automation */}
          <Route
            path="/studio/scripts"
            element={
              <ProtectedRoute roles="tenant_admin">
                <ScriptsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/scripts/:id"
            element={
              <ProtectedRoute roles="tenant_admin">
                <ScriptEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/business-rules"
            element={
              <ProtectedRoute roles="tenant_admin">
                <BusinessRulesListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/business-rules/:id"
            element={
              <ProtectedRoute roles="tenant_admin">
                <BusinessRuleEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/workflows"
            element={
              <ProtectedRoute roles="tenant_admin">
                <WorkflowsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/workflows/:id"
            element={
              <ProtectedRoute roles="tenant_admin">
                <WorkflowEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/approvals"
            element={
              <ProtectedRoute roles="tenant_admin">
                <ApprovalsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/approvals/:id"
            element={
              <ProtectedRoute roles="tenant_admin">
                <ApprovalEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/events"
            element={
              <ProtectedRoute roles="tenant_admin">
                <EventsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/events/:id"
            element={
              <ProtectedRoute roles="tenant_admin">
                <EventEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/notifications"
            element={
              <ProtectedRoute roles="tenant_admin">
                <NotificationsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/notifications/:id"
            element={
              <ProtectedRoute roles="tenant_admin">
                <NotificationEditorPage />
              </ProtectedRoute>
            }
          />

          {/* Studio - Configuration */}
          <Route
            path="/studio/platform-config"
            element={
              <ProtectedRoute roles="tenant_admin">
                <PlatformConfigBrowser />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/customizations"
            element={
              <ProtectedRoute roles="tenant_admin">
                <CustomizationsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/customizations/:id"
            element={
              <ProtectedRoute roles="tenant_admin">
                <CustomizationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/settings"
            element={
              <ProtectedRoute roles="tenant_admin">
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/history"
            element={
              <ProtectedRoute roles="tenant_admin">
                <ChangeHistoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/upgrade"
            element={
              <ProtectedRoute roles="tenant_admin">
                <UpgradeCenterPage />
              </ProtectedRoute>
            }
          />

          {/* Studio - Navigation Builder */}
          <Route
            path="/studio/navigation"
            element={
              <ProtectedRoute roles="tenant_admin">
                <NavigationBuilder />
              </ProtectedRoute>
            }
          />

          {/* List view: /table.list */}
          <Route path="/:tableCode.list" element={<ModuleListPage />} />
          {/* Create: /table.form */}
          <Route path="/:tableCode.form" element={<ModuleCreatePage />} />
          {/* Record view/edit: /table.form/:id */}
          <Route path="/:tableCode.form/:id" element={<ModuleRecordPage />} />
        </Route>

        {/* Redirect root to default module list */}
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
