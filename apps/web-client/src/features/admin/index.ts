// Admin Dashboard
export { AdminDashboardPage } from './pages/AdminDashboardPage';

// Users
export { UsersListPage, UserInvitePage, UserDetailPage } from './users';

// Collections (Schema Engine)
export {
  CollectionsListPage,
  CollectionEditorPage,
  PropertiesListPage,
  PropertyEditorPage,
} from './collections';

// Views (Views Engine)
export { ViewsListPage, ViewEditorPage } from './views';

// Scripts
export { ScriptsListPage } from './scripts/ScriptsListPage';
export { ScriptEditorPage } from './scripts/ScriptEditorPage';

// Business Rules (legacy)
export { BusinessRulesListPage } from './business-rules/BusinessRulesListPage';
export { BusinessRuleEditorPage } from './business-rules/BusinessRuleEditorPage';

// Workflows (legacy)
export { WorkflowsListPage } from './workflows/WorkflowsListPage';
export { WorkflowEditorPage } from './workflows/WorkflowEditorPage';

// Automations (modern UI)
export { BusinessRulesPage, WorkflowsPage, WorkflowRunsPage } from './automations';

// Integrations
export { IntegrationsPage } from './integrations';

// Analytics
export { AnalyticsDashboard } from './analytics';

// Modules
export { ModulesPage } from './modules';

// Reports
export { ReportsPage } from './reports';

// Approvals
export { ApprovalsListPage } from './approvals/ApprovalsListPage';
export { ApprovalEditorPage } from './approvals/ApprovalEditorPage';

// Events
export { EventsListPage } from './events/EventsListPage';
export { EventEditorPage } from './events/EventEditorPage';

// Notifications
export { NotificationsListPage } from './notifications/NotificationsListPage';
export { NotificationEditorPage } from './notifications/NotificationEditorPage';

// Customizations
export { CustomizationsListPage } from './customizations/CustomizationsListPage';
export { CustomizationDetailPage } from './customizations/CustomizationDetailPage';

// Settings
export { SettingsPage } from './settings/SettingsPage';

// History
export { ChangeHistoryPage } from './history/ChangeHistoryPage';

// Platform Config
export { PlatformConfigBrowser } from './platform-config/PlatformConfigBrowser';

// Upgrade
export { UpgradeCenterPage } from './upgrade/UpgradeCenterPage';

// Enterprise Features (SSO, Audit, Compliance)
export { SSOConfigPage, AuditLogViewer, ComplianceDashboard } from './enterprise';

// Commitments (SLA/OLA)
export { CommitmentsListPage, CommitmentEditorPage } from './commitments';

// Import/Export & Connections
export { ImportPage, ExportPage, ConnectionsPage } from './import-export';

// AVA Governance (Audit Trail & Permissions)
export { AVAAuditTrailPage, AVAPermissionsPage } from './ava-governance';

// Components
export { CustomizationBadge } from './components/CustomizationBadge';
export { ConfigCard } from './components/ConfigCard';
export { DiffViewer } from '../../components/ui/DiffViewer';
export { PageHeader, Breadcrumb } from './components/Breadcrumb';
export { ScriptEditor } from './components/ScriptEditor';
export { WorkflowDesigner } from './components/WorkflowDesigner';
