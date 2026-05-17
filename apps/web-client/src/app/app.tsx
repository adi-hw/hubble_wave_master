import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { Login } from '../pages/Login';
import { Unauthorized } from '../pages/Unauthorized';
import { HomePage } from '../pages/HomePage';
import { NavigationBuilder } from '../pages/studio/NavigationBuilder';
import { AppShell } from '../components/shell/AppShell';
import { ProtectedRoute } from '../routing/ProtectedRoute';

// Admin pages
import {
  AdminDashboardPage,
  UsersListPage,
  UserInvitePage,
  UserDetailPage,
  // CollectionsListPage removed - now using /collections.list via ListView
  CollectionEditorPage,
  CollectionWizard,
  PropertiesPage,
  // Views
  ViewsPage,
  FormLayoutPage,
  ListLayoutPage,
  // UI Scripts
  UIScriptsPage,
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
  // Audit Explorer
  AuditExplorerPage,
} from '../features/admin';

// App Studio — Application registry (Phase 0 Slice B) + TableBuilder shell (Phase 1 Slice A)
import {
  AppStudioHome,
  ApplicationDetailPage,
} from '../features/admin/applications';
import { TableBuilder } from './app-studio/table-builder';



// Data pages (Schema Engine runtime)
import { CollectionRecordPage } from '../features/data';

// Automation pages
import { AutomationsListPage } from '../features/automation/AutomationsListPage';
import { AutomationEditorPage } from '../features/automation/AutomationEditorPage';
import { AutomationLogsPage } from '../features/automation/AutomationLogsPage';

// Process Flow pages
import { ProcessFlowsListPage } from '../features/process-flow/ProcessFlowsListPage';
import { ProcessFlowEditorPage } from '../features/process-flow/ProcessFlowEditorPage';

// Workspace pages (Phase 5)
import { WorkspaceBuilder } from './app-studio/workspace-builder/WorkspaceBuilder';
import { WorkspacesListPage } from './app-studio/workspace-builder/WorkspacesListPage';
import { WorkspaceRenderer } from './workspace/WorkspaceRenderer';

// Change Packages (Phase 6)
import { ChangePackageManager } from './app-studio/change-packages/ChangePackageManager';
import { DecisionTableEditor } from './app-studio/decision-tables/DecisionTableEditor';
import { GuidedProcessEditor } from './app-studio/guided-processes/GuidedProcessEditor';
import { ChangePackageDiff } from './app-studio/change-packages/ChangePackageDiff';

// Integration pages
import { ApiExplorerPage } from '../features/integration/ApiExplorerPage';
import { WebhooksPage } from '../features/integration/WebhooksPage';
import { ImportExportPage } from '../features/integration/ImportExportPage';
import { IntegrationMarketplacePage } from '../features/integration/IntegrationMarketplacePage';
import { ConnectorManagerPage } from '../features/integration/ConnectorManagerPage';

import { ThemeCustomizerPage } from '../pages/ThemeCustomizer';
import { SettingsPage as UserSettingsPage } from '../pages/Settings';
import { SecuritySettingsPage } from '../pages/SecuritySettings';
import { ProfileSettingsPage } from '../pages/ProfileSettings';
import { VerifyEmailPage } from '../pages/VerifyEmail';
import { ResetPassword } from '../pages/ResetPassword';
import { MfaSetup } from '../pages/MfaSetup';
import { ListView } from '../pages/ListView';
import { DelegationsPage } from '../pages/Delegations';
import { NotFoundPage } from '../pages/NotFound';
import { NotificationCenterPage } from '../features/notifications';
import {
  OfferingsBrowsePage,
  OfferingSubmissionPage,
  MyWorkPage,
  WorkItemDetailPage,
} from '../features/experience';
import { PackCatalogPage } from '../features/packs';
import { AgentQueuesPage, WorkItemAgentDetailPage } from '../features/agent';
import { SearchStudioPage } from '../features/search';
import { DashboardStudioPage, DashboardViewerPage } from '../features/insights';
import { LocalizationStudioPage } from '../features/localization';

// Phase 7: Revolutionary Features
import {
  PredictiveOpsDashboard,
  NLQueryPage,
  AIReportsPage,
  DigitalTwinsPage,
  SelfHealingDashboard,
  LivingDocsPage,
  AgileDevPage,
  AppBuilderPage,
  UpgradeAssistantPage,
} from '../features/phase7';

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

          {/* App Studio — Application registry */}
          <Route
            path="/studio/apps"
            element={
              <ProtectedRoute roles="admin">
                <AppStudioHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/apps/:id"
            element={
              <ProtectedRoute roles="admin">
                <ApplicationDetailPage />
              </ProtectedRoute>
            }
          />

          {/* Phase 1 Slice A — TableBuilder shell at /studio/c/:code/:tab.
              Canonical Studio entry per ADR-11; supersedes the Slice-B
              redirector. Tab content adapts existing pages via
              useStudioCollectionId(); id-based routes below remain
              for deep-editor surfaces and bookmarked direct links. */}
          {/* App Studio tab shell accepts admin role OR any of the
              per-feature metadata.* edit slugs (ADR-12). The shell
              itself negotiates per-tab availability via TAB_REGISTRY's
              getTabAvailability — a delegated user with only
              metadata:form:manage lands on the shell and sees Forms
              enabled while other tabs render disabled. */}
          <Route
            path="/studio/c/:code"
            element={
              <ProtectedRoute
                anyPermission={[
                  'metadata:collection:manage',
                  'metadata:property:manage',
                  'metadata:form:manage',
                  'metadata:policy:manage',
                  'metadata:flow:manage',
                  'metadata:collection:read',
                ]}
              >
                <TableBuilder />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/c/:code/:tab"
            element={
              <ProtectedRoute
                anyPermission={[
                  'metadata:collection:manage',
                  'metadata:property:manage',
                  'metadata:form:manage',
                  'metadata:policy:manage',
                  'metadata:flow:manage',
                  'metadata:collection:read',
                ]}
              >
                <TableBuilder />
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
            element={<Navigate to="/collections.list" replace />}
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

          {/* Studio - Collection Views */}
          <Route
            path="/studio/collections/:id/views"
            element={
              <ProtectedRoute roles="admin">
                <ViewsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/collections/:id/form-layout"
            element={
              <ProtectedRoute roles="admin">
                <FormLayoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/collections/:id/list-layout"
            element={
              <ProtectedRoute roles="admin">
                <ListLayoutPage />
              </ProtectedRoute>
            }
          />

          {/* Studio - Collection UI Scripts */}
          <Route
            path="/studio/collections/:id/scripts"
            element={
              <ProtectedRoute roles="admin">
                <UIScriptsPage />
              </ProtectedRoute>
            }
          />

          {/* Studio - Collection Automations */}
          <Route
            path="/studio/collections/:id/automations"
            element={
              <ProtectedRoute anyPermission={['metadata:collection:read', 'metadata:flow:manage']}>
                <AutomationsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/collections/:id/automations/new"
            element={
              <ProtectedRoute permissions="metadata:flow:manage">
                <AutomationEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/collections/:id/automations/:automationId"
            element={
              <ProtectedRoute permissions="metadata:flow:manage">
                <AutomationEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/collections/:id/automation-logs"
            element={
              <ProtectedRoute anyPermission={['metadata:collection:read', 'metadata:flow:manage']}>
                <AutomationLogsPage />
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

          {/* Audit Explorer */}
          <Route
            path="/admin/audit"
            element={
              <ProtectedRoute roles="admin">
                <AuditExplorerPage />
              </ProtectedRoute>
            }
          />

          {/* Automation Routes */}
          <Route
            path="/automation"
            element={
              <ProtectedRoute roles="admin">
                <AutomationsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/automation/new"
            element={
              <ProtectedRoute roles="admin">
                <AutomationEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/automation/:id"
            element={
              <ProtectedRoute roles="admin">
                <AutomationEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/automation/logs"
            element={
              <ProtectedRoute roles="admin">
                <AutomationLogsPage />
              </ProtectedRoute>
            }
          />

          {/* Process Flow Routes */}
          <Route
            path="/process-flows"
            element={
              <ProtectedRoute anyPermission={['metadata:collection:read', 'metadata:flow:manage']}>
                <ProcessFlowsListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/process-flows/new"
            element={
              <ProtectedRoute permissions="metadata:flow:manage">
                <ProcessFlowEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/process-flows/:id"
            element={
              <ProtectedRoute permissions="metadata:flow:manage">
                <ProcessFlowEditorPage />
              </ProtectedRoute>
            }
          />

          {/* Decision Table Editor (§15.1 visual editor — deferred slice resolved) */}
          <Route
            path="/decision-tables/new"
            element={
              <ProtectedRoute permissions="metadata:flow:manage">
                <DecisionTableEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/decision-tables/:id"
            element={
              <ProtectedRoute permissions="metadata:flow:manage">
                <DecisionTableEditor />
              </ProtectedRoute>
            }
          />

          {/* Guided Process Editor (§15.1 visual editor — deferred slice resolved) */}
          <Route
            path="/guided-processes/new"
            element={
              <ProtectedRoute permissions="metadata:flow:manage">
                <GuidedProcessEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/guided-processes/:id"
            element={
              <ProtectedRoute permissions="metadata:flow:manage">
                <GuidedProcessEditor />
              </ProtectedRoute>
            }
          />

          {/* Workspace Builder (Phase 5) — list + per-workspace canvas
              under the canonical /studio/* prefix (consistent with the
              rest of App Studio). */}
          <Route
            path="/studio/workspaces"
            element={
              <ProtectedRoute permissions="metadata:workspace:manage">
                <WorkspacesListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/workspaces/:workspaceId"
            element={
              <ProtectedRoute permissions="metadata:workspace:manage">
                <WorkspaceBuilder />
              </ProtectedRoute>
            }
          />

          {/* Workspace Runtime (Phase 5) */}
          <Route
            path="/workspace/:wsCode"
            element={
              <ProtectedRoute>
                <WorkspaceRenderer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workspace/:wsCode/record/:collectionCode/:recordId"
            element={
              <ProtectedRoute>
                <WorkspaceRenderer />
              </ProtectedRoute>
            }
          />

          {/* Change Packages (Phase 6) */}
          <Route
            path="/app-studio/change-packages"
            element={
              <ProtectedRoute permissions="metadata:change_package:manage">
                <ChangePackageManager />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app-studio/change-packages/:id"
            element={
              <ProtectedRoute permissions="metadata:change_package:manage">
                <ChangePackageDiff />
              </ProtectedRoute>
            }
          />

          {/* Integration Routes */}
          <Route
            path="/integrations/api"
            element={
              <ProtectedRoute roles="admin">
                <ApiExplorerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/integrations/webhooks"
            element={
              <ProtectedRoute roles="admin">
                <WebhooksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/integrations/import-export"
            element={
              <ProtectedRoute roles="admin">
                <ImportExportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/integrations/marketplace"
            element={
              <ProtectedRoute roles="admin">
                <IntegrationMarketplacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/connectors"
            element={
              <ProtectedRoute roles="admin">
                <ConnectorManagerPage />
              </ProtectedRoute>
            }
          />

          {/* Experience Hub */}
          <Route path="/experience" element={<Navigate to="/experience/offerings" replace />} />
          <Route path="/experience/offerings" element={<OfferingsBrowsePage />} />
          <Route path="/experience/offerings/:offeringId" element={<OfferingSubmissionPage />} />
          <Route path="/experience/my-work" element={<MyWorkPage />} />
          <Route path="/experience/work/:workItemId" element={<WorkItemDetailPage />} />

          {/* Agent Console */}
          <Route path="/agent/queues" element={<AgentQueuesPage />} />
          <Route path="/agent/queues/:queueCode" element={<AgentQueuesPage />} />
          <Route path="/agent/work/:workItemId" element={<WorkItemAgentDetailPage />} />

          {/* ListView - ServiceNow-style URL pattern (e.g., /work_orders.list) */}
          <Route path="/:collectionCode.list" element={<ListView />} />
          {/* Record detail page (e.g., /work_orders/123) */}
          <Route path="/:collectionCode/:recordId" element={<CollectionRecordPage />} />

          {/* Notifications */}
          <Route path="/notifications" element={<NotificationCenterPage />} />

          {/* User Settings */}
          <Route path="/settings" element={<UserSettingsPage />} />
          <Route path="/settings/profile" element={<ProfileSettingsPage />} />
          <Route path="/settings/themes" element={<ThemeCustomizerPage />} />
          <Route path="/settings/security" element={<SecuritySettingsPage />} />
          <Route path="/settings/mfa-setup" element={<MfaSetup />} />
          <Route path="/settings/delegations" element={<DelegationsPage />} />

          {/* Studio - Navigation */}
          <Route
            path="/studio/navigation"
            element={
              <ProtectedRoute roles="admin">
                <NavigationBuilder />
              </ProtectedRoute>
            }
          />

          <Route
            path="/studio/packs"
            element={
              <ProtectedRoute roles="admin">
                <PackCatalogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/search"
            element={
              <ProtectedRoute roles="admin">
                <SearchStudioPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/dashboards"
            element={
              <ProtectedRoute roles="admin">
                <DashboardStudioPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/studio/localization"
            element={
              <ProtectedRoute roles="admin">
                <LocalizationStudioPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/insights/dashboards/:code"
            element={
              <ProtectedRoute>
                <DashboardViewerPage />
              </ProtectedRoute>
            }
          />

          {/* Phase 7: Revolutionary AI Features */}
          <Route
            path="/ai/predictive-ops"
            element={
              <ProtectedRoute roles="admin">
                <PredictiveOpsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai/query"
            element={
              <ProtectedRoute>
                <NLQueryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai/reports"
            element={
              <ProtectedRoute>
                <AIReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai/digital-twins"
            element={
              <ProtectedRoute roles="admin">
                <DigitalTwinsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai/self-healing"
            element={
              <ProtectedRoute roles="admin">
                <SelfHealingDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai/docs"
            element={
              <ProtectedRoute>
                <LivingDocsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai/agile"
            element={
              <ProtectedRoute roles="admin">
                <AgileDevPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai/app-builder"
            element={
              <ProtectedRoute roles="admin">
                <AppBuilderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai/upgrade"
            element={
              <ProtectedRoute roles="admin">
                <UpgradeAssistantPage />
              </ProtectedRoute>
            }
          />

        </Route>

        {/* Error/Fallback Routes */}
        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
