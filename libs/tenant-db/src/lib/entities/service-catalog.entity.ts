import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  DeleteDateColumn,
} from 'typeorm';

/**
 * Service Category - Groups catalog items
 */
@Entity('service_categories')
export class ServiceCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  parentId!: string | null;

  @Column({ length: 100 })
  @Index()
  code!: string;

  @Column({ length: 200 })
  label!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ length: 50, nullable: true })
  icon!: string | null;

  @Column({ length: 7, nullable: true })
  color!: string | null;

  @Column({ length: 500, nullable: true })
  image!: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'simple-array', nullable: true })
  roleIds!: string[] | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}

/**
 * Catalog Item - A service that can be requested
 */
@Entity('catalog_items')
export class CatalogItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  categoryId!: string | null;

  @Column({ length: 100 })
  @Index()
  code!: string;

  @Column({ length: 200 })
  label!: string;

  @Column({ type: 'text', nullable: true })
  shortDescription!: string | null;

  @Column({ type: 'text', nullable: true })
  fullDescription!: string | null;

  @Column({ length: 50, nullable: true })
  icon!: string | null;

  @Column({ length: 7, nullable: true })
  color!: string | null;

  @Column({ length: 500, nullable: true })
  image!: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isFeatured!: boolean;

  @Column({ default: false })
  isPopular!: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price!: number | null;

  @Column({ length: 50, nullable: true })
  deliveryTime!: string | null;

  @Column({ type: 'simple-array', nullable: true })
  tags!: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  roleIds!: string[] | null;

  @Column({ type: 'uuid', nullable: true })
  formLayoutId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  workflowId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  targetCollectionId!: string | null;

  @Column({ type: 'json', nullable: true })
  defaultValues!: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  fulfillmentConfig!: FulfillmentConfig | null;

  @Column({ type: 'int', default: 0 })
  requestCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}

export interface FulfillmentConfig {
  type: 'manual' | 'automatic' | 'workflow';
  assignmentGroup?: string;
  assignee?: string;
  slaId?: string;
  autoApprove?: boolean;
  approvalRequired?: boolean;
  approvalWorkflowId?: string;
}

/**
 * Service Request - A submitted request from the catalog
 */
@Entity('service_requests')
export class ServiceRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ length: 50 })
  @Index()
  number!: string;

  @Column({ type: 'uuid' })
  @Index()
  catalogItemId!: string;

  @Column({ type: 'uuid' })
  @Index()
  requestedBy!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  requestedFor!: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'draft',
  })
  @Index()
  status!: 'draft' | 'submitted' | 'pending_approval' | 'approved' | 'rejected' | 'in_progress' | 'fulfilled' | 'closed' | 'cancelled';

  @Column({
    type: 'varchar',
    length: 20,
    default: 'medium',
  })
  priority!: 'low' | 'medium' | 'high' | 'critical';

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'json', nullable: true })
  formData!: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  assignmentGroup!: string | null;

  @Column({ type: 'uuid', nullable: true })
  assignedTo!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  dueDate!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  approvedBy!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  fulfilledAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  fulfilledBy!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  closedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  closureNotes!: string | null;

  @Column({ type: 'uuid', nullable: true })
  linkedRecordId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  workflowRunId!: string | null;

  @Column({ type: 'json', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

/**
 * Request Item - Line items within a request (for multi-item requests)
 */
@Entity('request_items')
export class RequestItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'uuid' })
  @Index()
  requestId!: string;

  @Column({ type: 'uuid' })
  catalogItemId!: string;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'pending',
  })
  status!: 'pending' | 'in_progress' | 'fulfilled' | 'cancelled';

  @Column({ type: 'json', nullable: true })
  formData!: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  fulfilledAt!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  fulfilledBy!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

/**
 * Knowledge Article - Self-service knowledge base
 */
@Entity('knowledge_articles')
export class KnowledgeArticle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  categoryId!: string | null;

  @Column({ length: 100 })
  @Index()
  number!: string;

  @Column({ length: 500 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  summary!: string | null;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'draft',
  })
  @Index()
  status!: 'draft' | 'review' | 'published' | 'retired';

  @Column({
    type: 'varchar',
    length: 50,
    default: 'article',
  })
  articleType!: 'article' | 'faq' | 'how_to' | 'troubleshooting' | 'policy' | 'announcement';

  @Column({ type: 'simple-array', nullable: true })
  tags!: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  keywords!: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  roleIds!: string[] | null;

  @Column({ default: false })
  isPublic!: boolean;

  @Column({ default: false })
  isFeatured!: boolean;

  @Column({ type: 'uuid', nullable: true })
  authorId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  reviewerId!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt!: Date | null;

  @Column({ type: 'int', default: 0 })
  viewCount!: number;

  @Column({ type: 'int', default: 0 })
  helpfulCount!: number;

  @Column({ type: 'int', default: 0 })
  notHelpfulCount!: number;

  @Column({ type: 'simple-array', nullable: true })
  relatedArticleIds!: string[] | null;

  @Column({ type: 'simple-array', nullable: true })
  attachmentIds!: string[] | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}

/**
 * Knowledge Category - Groups knowledge articles
 */
@Entity('knowledge_categories')
export class KnowledgeCategory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  parentId!: string | null;

  @Column({ length: 100 })
  @Index()
  code!: string;

  @Column({ length: 200 })
  label!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ length: 50, nullable: true })
  icon!: string | null;

  @Column({ length: 7, nullable: true })
  color!: string | null;

  @Column({ type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'simple-array', nullable: true })
  roleIds!: string[] | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

/**
 * Article Feedback - User feedback on articles
 */
@Entity('article_feedback')
export class ArticleFeedback {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  @Index()
  tenantId!: string;

  @Column({ type: 'uuid' })
  @Index()
  articleId!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ default: false })
  isHelpful!: boolean;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ type: 'int', nullable: true })
  rating!: number | null;

  @CreateDateColumn()
  createdAt!: Date;
}

/**
 * Announcement - System-wide or targeted announcements
 */
@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  tenantId!: string | null;

  @Column({ length: 500 })
  title!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'info',
  })
  announcementType!: 'info' | 'warning' | 'critical' | 'maintenance' | 'feature';

  @Column({
    type: 'varchar',
    length: 50,
    default: 'draft',
  })
  status!: 'draft' | 'scheduled' | 'active' | 'expired';

  @Column({ type: 'timestamp', nullable: true })
  startDate!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endDate!: Date | null;

  @Column({ default: false })
  isDismissible!: boolean;

  @Column({ default: false })
  showOnLogin!: boolean;

  @Column({ default: false })
  showOnPortal!: boolean;

  @Column({ type: 'simple-array', nullable: true })
  targetRoleIds!: string[] | null;

  @Column({ type: 'uuid', nullable: true })
  authorId!: string | null;

  @Column({ type: 'int', default: 0 })
  viewCount!: number;

  @Column({ type: 'int', default: 0 })
  dismissCount!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
