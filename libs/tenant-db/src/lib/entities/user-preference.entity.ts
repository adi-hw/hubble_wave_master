import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { TenantUser } from './tenant-user.entity';

@Entity('user_preferences')
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @OneToOne(() => TenantUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: TenantUser;

  // UI Preferences
  @Column({ type: 'varchar', length: 20, default: 'system' })
  theme!: 'light' | 'dark' | 'system';

  @Column({ name: 'sidebar_collapsed', type: 'boolean', default: false })
  sidebarCollapsed!: boolean;

  @Column({ name: 'default_list_page_size', type: 'int', default: 20 })
  defaultListPageSize!: number;

  @Column({ name: 'date_format', type: 'varchar', length: 20, default: 'YYYY-MM-DD' })
  dateFormat!: string;

  @Column({ name: 'time_format', type: 'varchar', length: 20, default: 'HH:mm' })
  timeFormat!: string;

  @Column({ name: 'number_format', type: 'varchar', length: 20, default: 'en-US' })
  numberFormat!: string;

  // Notification Preferences
  @Column({ name: 'email_notifications', type: 'boolean', default: true })
  emailNotifications!: boolean;

  @Column({ name: 'push_notifications', type: 'boolean', default: true })
  pushNotifications!: boolean;

  @Column({ name: 'in_app_notifications', type: 'boolean', default: true })
  inAppNotifications!: boolean;

  @Column({ name: 'notification_digest', type: 'varchar', length: 20, default: 'instant' })
  notificationDigest!: 'instant' | 'hourly' | 'daily' | 'weekly';

  // Module-specific preferences (extensible)
  @Column({ name: 'module_preferences', type: 'jsonb', default: () => `'{}'` })
  modulePreferences!: Record<string, unknown>;

  // Keyboard shortcuts
  @Column({ name: 'keyboard_shortcuts_enabled', type: 'boolean', default: true })
  keyboardShortcutsEnabled!: boolean;

  @Column({ name: 'custom_shortcuts', type: 'jsonb', default: () => `'{}'` })
  customShortcuts!: Record<string, string>;

  // Dashboard preferences
  @Column({ name: 'default_dashboard', type: 'varchar', length: 100, nullable: true })
  defaultDashboard?: string | null;

  @Column({ name: 'dashboard_layout', type: 'jsonb', default: () => `'{}'` })
  dashboardLayout!: Record<string, unknown>;

  // Audit timestamps
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
