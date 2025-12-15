import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
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
  UsersListPage,
  UserInvitePage,
  UserDetailPage,
  CollectionsListPage,
  CollectionEditorPage,
  PropertiesListPage,
  PropertyEditorPage,
  ViewsListPage,
  ViewEditorPage,
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
  // Modern Automations UI
  BusinessRulesPage,
  WorkflowsPage,
  WorkflowRunsPage,
  // Integrations
  IntegrationsPage,
  // Analytics
  AnalyticsDashboard,
  // Modules
  ModulesPage,
  // Reports
  ReportsPage,
  // Enterprise Features
  SSOConfigPage,
  AuditLogViewer,
  ComplianceDashboard,
  // Commitments (SLA/OLA)
  CommitmentsListPage,
  CommitmentEditorPage,
  // Import/Export
  ImportPage,
  ExportPage,
  ConnectionsPage,
  // AVA Governance
  AVAAuditTrailPage,
  AVAPermissionsPage,
} from '../features/admin';

// Data pages (Schema Engine runtime)
import { CollectionListPage, CollectionRecordPage } from '../features/data';

// Service Portal pages
import {
  ServicePortalHome,
  ServiceCatalog,
  MyItemsPage,
  KnowledgeBase,
} from '../features/portal';

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

          {/* Studio - User Management */}
          <Route
            path="/studio/users"
            element={
              <ProtectedRoute roles="tenant_admin">
                <UsersListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/users/invite"
            element={
              <ProtectedRoute roles="tenant_admin">
                <UserInvitePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/users/:id"
            element={
              <ProtectedRoute roles="tenant_admin">
                <UserDetailPage />
              </ProtectedRoute>
            }
          />

          {/* Studio - Collections (Schema Engine) */}
          <Route
            path="/studio/collections"
            element={
              <ProtectedRoute roles="tenant_admin">
                <CollectionsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/collections/new"
            element={
              <ProtectedRoute roles="tenant_admin">
                <CollectionEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/collections/:id"
            element={
              <ProtectedRoute roles="tenant_admin">
                <CollectionEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/collections/:id/properties"
            element={
              <ProtectedRoute roles="tenant_admin">
                <PropertiesListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/collections/:id/properties/:propertyId"
            element={
              <ProtectedRoute roles="tenant_admin">
                <PropertyEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/collections/:collectionId/views"
            element={
              <ProtectedRoute roles="tenant_admin">
                <ViewsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/collections/:collectionId/views/:viewId"
            element={
              <ProtectedRoute roles="tenant_admin">
                <ViewEditorPage />
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
            path="/studio/scripts/new"
            element={
              <ProtectedRoute roles="tenant_admin">
                <ScriptEditorPage />
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
            path="/studio/business-rules/new"
            element={
              <ProtectedRoute roles="tenant_admin">
                <BusinessRuleEditorPage />
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
            path="/studio/workflows/new"
            element={
              <ProtectedRoute roles="tenant_admin">
                <WorkflowEditorPage />
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
            path="/studio/approvals/new"
            element={
              <ProtectedRoute roles="tenant_admin">
                <ApprovalEditorPage />
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
            path="/studio/events/new"
            element={
              <ProtectedRoute roles="tenant_admin">
                <EventEditorPage />
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
            path="/studio/notifications/new"
            element={
              <ProtectedRoute roles="tenant_admin">
                <NotificationEditorPage />
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
            path="/studio/customizations/new"
            element={
              <ProtectedRoute roles="tenant_admin">
                <CustomizationDetailPage />
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

          {/* Studio - Standalone Properties List */}
          <Route
            path="/studio/properties"
            element={
              <ProtectedRoute roles="tenant_admin">
                <PropertiesListPage />
              </ProtectedRoute>
            }
          />

          {/* Studio - Standalone Views List */}
          <Route
            path="/studio/views"
            element={
              <ProtectedRoute roles="tenant_admin">
                <ViewsListPage />
              </ProtectedRoute>
            }
          />

          {/* Studio - Commitments (SLA/OLA) */}
          <Route
            path="/studio/commitments"
            element={
              <ProtectedRoute roles="tenant_admin">
                <CommitmentsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/commitments/new"
            element={
              <ProtectedRoute roles="tenant_admin">
                <CommitmentEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/commitments/:id"
            element={
              <ProtectedRoute roles="tenant_admin">
                <CommitmentEditorPage />
              </ProtectedRoute>
            }
          />

          {/* Studio - Import/Export & Connections */}
          <Route
            path="/studio/import"
            element={
              <ProtectedRoute roles="tenant_admin">
                <ImportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/export"
            element={
              <ProtectedRoute roles="tenant_admin">
                <ExportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/connections"
            element={
              <ProtectedRoute roles="tenant_admin">
                <ConnectionsPage />
              </ProtectedRoute>
            }
          />

          {/* Admin - Automations (Modern UI) */}
          <Route
            path="/admin/automations/rules"
            element={
              <ProtectedRoute roles="tenant_admin">
                <BusinessRulesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/automations/rules/new"
            element={
              <ProtectedRoute roles="tenant_admin">
                <BusinessRuleEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/automations/rules/:id"
            element={
              <ProtectedRoute roles="tenant_admin">
                <BusinessRuleEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/automations/workflows"
            element={
              <ProtectedRoute roles="tenant_admin">
                <WorkflowsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/automations/workflows/new"
            element={
              <ProtectedRoute roles="tenant_admin">
                <WorkflowEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/automations/workflows/:id"
            element={
              <ProtectedRoute roles="tenant_admin">
                <WorkflowEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/automations/runs"
            element={
              <ProtectedRoute roles="tenant_admin">
                <WorkflowRunsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/automations/runs/:id"
            element={
              <ProtectedRoute roles="tenant_admin">
                <WorkflowRunsPage />
              </ProtectedRoute>
            }
          />

          {/* Admin - Integrations */}
          <Route
            path="/admin/integrations"
            element={
              <ProtectedRoute roles="tenant_admin">
                <IntegrationsPage />
              </ProtectedRoute>
            }
          />

          {/* Admin - Analytics */}
          <Route
            path="/admin/analytics"
            element={
              <ProtectedRoute roles="tenant_admin">
                <AnalyticsDashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin - Modules */}
          <Route
            path="/admin/modules"
            element={
              <ProtectedRoute roles="tenant_admin">
                <ModulesPage />
              </ProtectedRoute>
            }
          />

          {/* Admin - Reports */}
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoute roles="tenant_admin">
                <ReportsPage />
              </ProtectedRoute>
            }
          />

          {/* Admin - AVA Governance */}
          <Route
            path="/admin/ava/permissions"
            element={
              <ProtectedRoute roles="tenant_admin">
                <AVAPermissionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ava/audit"
            element={
              <ProtectedRoute roles="tenant_admin">
                <AVAAuditTrailPage />
              </ProtectedRoute>
            }
          />

          {/* Admin - Enterprise Features */}
          <Route
            path="/admin/enterprise/audit"
            element={
              <ProtectedRoute roles="tenant_admin">
                <AuditLogViewer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/enterprise/compliance"
            element={
              <ProtectedRoute roles="tenant_admin">
                <ComplianceDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/enterprise/sso"
            element={
              <ProtectedRoute roles="tenant_admin">
                <SSOConfigPage />
              </ProtectedRoute>
            }
          />

          {/* Data Engine - Collection Data Pages */}
          <Route path="/data/:collectionCode" element={<CollectionListPage />} />
          <Route path="/data/:collectionCode/:recordId" element={<CollectionRecordPage />} />

          {/* Service Portal - End User Self-Service */}
          <Route path="/portal" element={<ServicePortalHome />} />
          <Route path="/portal/catalog" element={<ServiceCatalog />} />
          <Route path="/portal/catalog/:itemId" element={<ServiceCatalog />} />
          <Route path="/portal/my-items" element={<MyItemsPage />} />
          <Route path="/portal/requests/:requestId" element={<MyItemsPage />} />
          <Route path="/portal/knowledge" element={<KnowledgeBase />} />
          <Route path="/portal/knowledge/:articleId" element={<KnowledgeBase />} />

          {/* Legacy: List view: /table.list */}
          <Route path="/:tableCode.list" element={<ModuleListPage />} />
          {/* Legacy: Create: /table.form */}
          <Route path="/:tableCode.form" element={<ModuleCreatePage />} />
          {/* Legacy: Record view/edit: /table.form/:id */}
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
