import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from './customer.entity';

/**
 * Subscription status
 */
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'cancelled' | 'paused';

/**
 * Billing cycle
 */
export type BillingCycle = 'monthly' | 'quarterly' | 'annual';

/**
 * Subscription entity - represents a customer's billing subscription
 * Stored in Control Plane database (eam_control)
 */
@Entity('subscriptions')
@Index(['customerId'])
@Index(['status'])
@Index(['stripeSubscriptionId'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Customer this subscription belongs to */
  @Column({ name: 'customer_id', type: 'uuid' })
  customerId!: string;

  @ManyToOne(() => Customer, (customer) => customer.subscriptions)
  @JoinColumn({ name: 'customer_id' })
  customer?: Customer;

  // ─────────────────────────────────────────────────────────────────
  // Plan Information
  // ─────────────────────────────────────────────────────────────────

  /** Plan ID (e.g., 'professional', 'enterprise') */
  @Column({ name: 'plan_id', type: 'varchar', length: 50 })
  planId!: string;

  /** Plan name for display */
  @Column({ name: 'plan_name', type: 'varchar', length: 100 })
  planName!: string;

  /** Subscription status */
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: SubscriptionStatus;

  // ─────────────────────────────────────────────────────────────────
  // Billing Details
  // ─────────────────────────────────────────────────────────────────

  /** Monthly amount (or amount per billing cycle) */
  @Column({ name: 'amount', type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  /** Currency */
  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency!: string;

  /** Billing cycle */
  @Column({ name: 'billing_cycle', type: 'varchar', length: 20, default: 'monthly' })
  billingCycle!: BillingCycle;

  /** Discount percentage (if any) */
  @Column({ name: 'discount_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent!: number;

  // ─────────────────────────────────────────────────────────────────
  // Billing Period
  // ─────────────────────────────────────────────────────────────────

  /** Current billing period start */
  @Column({ name: 'current_period_start', type: 'timestamptz', nullable: true })
  currentPeriodStart?: Date | null;

  /** Current billing period end */
  @Column({ name: 'current_period_end', type: 'timestamptz', nullable: true })
  currentPeriodEnd?: Date | null;

  /** Trial end date (if trialing) */
  @Column({ name: 'trial_end', type: 'timestamptz', nullable: true })
  trialEnd?: Date | null;

  /** When subscription was cancelled (if cancelled) */
  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt?: Date | null;

  /** Cancel at period end (scheduled cancellation) */
  @Column({ name: 'cancel_at_period_end', type: 'boolean', default: false })
  cancelAtPeriodEnd!: boolean;

  // ─────────────────────────────────────────────────────────────────
  // External Integration (Stripe)
  // ─────────────────────────────────────────────────────────────────

  /** Stripe subscription ID */
  @Column({ name: 'stripe_subscription_id', type: 'varchar', length: 255, nullable: true })
  stripeSubscriptionId?: string | null;

  /** Stripe customer ID */
  @Column({ name: 'stripe_customer_id', type: 'varchar', length: 255, nullable: true })
  stripeCustomerId?: string | null;

  /** Stripe price ID */
  @Column({ name: 'stripe_price_id', type: 'varchar', length: 255, nullable: true })
  stripePriceId?: string | null;

  // ─────────────────────────────────────────────────────────────────
  // Metadata
  // ─────────────────────────────────────────────────────────────────

  /** Additional metadata */
  @Column({ type: 'jsonb', default: () => `'{}'` })
  metadata!: Record<string, unknown>;

  // ─────────────────────────────────────────────────────────────────
  // Audit Fields
  // ─────────────────────────────────────────────────────────────────

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
