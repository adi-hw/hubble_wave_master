// Admin Dashboard
export { AdminDashboardPage } from './pages/AdminDashboardPage';

// Users
export { UsersListPage, UserInvitePage, UserDetailPage } from './users';

// Groups
export { GroupsPage, GroupFormPage, GroupMembersPage, GroupRolesPage } from './groups';

// Roles & Permissions
export { RolesPage } from './roles';

// Collections (Schema Engine)
export {
  CollectionsListPage,
  CollectionEditorPage,
  CollectionWizard,
} from './collections';
export * from './properties';



// Access Rules
export { AccessRulesPage } from './access/AccessRulesPage';

// Components
export { CustomizationBadge } from './components/CustomizationBadge';
export { ConfigCard } from './components/ConfigCard';
export { DiffViewer } from '../../components/ui/DiffViewer';
export { PageHeader, Breadcrumb } from './components/Breadcrumb';


// Enterprise Features (SSO, LDAP, Audit, Compliance)
export { SSOConfigPage, LDAPConfigPage, AuditLogViewer } from './enterprise';
