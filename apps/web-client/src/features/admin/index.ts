// Admin Dashboard
export { AdminDashboardPage } from './pages/AdminDashboardPage';

// Users
export { UsersListPage, UserInvitePage, UserDetailPage } from './users';

// Groups
export { GroupsPage, GroupFormPage, GroupMembersPage, GroupRolesPage } from './groups';

// Roles & Permissions
export { RolesPage } from './roles';

// Collections (Schema Engine)
// CollectionsListPage removed - now using /collections.list via ListView
export {
  CollectionEditorPage,
  CollectionWizard,
} from './collections';
export * from './properties';

// Views
export { ViewsPage, FormLayoutPage, ListLayoutPage } from './views';

// UI Scripts (Client-side logic)
export { UIScriptsPage } from './scripts';

// Access Rules
export { AccessRulesPage } from './access/AccessRulesPage';

// Components
export { CustomizationBadge } from './components/CustomizationBadge';
export { ConfigCard } from './components/ConfigCard';
export { DiffViewer } from '../../components/ui/DiffViewer';
export { PageHeader, Breadcrumb } from './components/Breadcrumb';


// Enterprise Features (SSO, LDAP, Audit, Compliance)
export { SSOConfigPage, LDAPConfigPage, AuditLogViewer } from './enterprise';

// Audit Explorer
export { AuditExplorerPage } from '../audit';
