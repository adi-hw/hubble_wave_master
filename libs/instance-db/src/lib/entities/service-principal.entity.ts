import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * `service_principals` — service-to-service identity registry per
 * canon §29.7.
 *
 * One row per service that is allowed to mint a HubbleWave service
 * token. The mint endpoint (`POST /internal/service-token`) looks up
 * the principal at issue time and:
 *   - rejects when the row is absent or `active = false`,
 *   - rejects when the requested `audience` is not in
 *     `allowed_audiences`,
 *   - copies `allowed_scopes` verbatim into the issued token's
 *     `scope` claim.
 *
 * Service principals are seeded by migration — they are not user-
 * editable through the UI. Adding a principal is an architectural
 * decision (a new cross-process call surface exists), not a
 * runtime operation.
 */
@Entity('service_principals')
@Index('idx_service_principals_k8s_sa', ['k8sServiceAccount'], {
  where: '"active" = true AND "k8s_service_account" IS NOT NULL',
})
export class ServicePrincipal {
  @PrimaryColumn({ name: 'service_id', type: 'text' })
  serviceId!: string;

  @Column({ name: 'display_name', type: 'text' })
  displayName!: string;

  /**
   * Services this principal is allowed to call (i.e. valid values for
   * the `audience` field of `POST /internal/service-token`). The mint
   * endpoint rejects every other audience with a 403 per canon §29.7.
   */
  @Column({ name: 'allowed_audiences', type: 'text', array: true })
  allowedAudiences!: string[];

  /**
   * `<collection>:<action>` permission strings that ARE the issued
   * service token's `scope` claim. The receiving service authorizes
   * the call against these scopes — service tokens carry no roles,
   * no permissions, and no `security_stamp` per canon §29.6 +
   * §29.7.
   */
  @Column({ name: 'allowed_scopes', type: 'text', array: true })
  allowedScopes!: string[];

  /**
   * Kubernetes ServiceAccount the principal binds to in production
   * deployments. `system:serviceaccount:<namespace>:<sa-name>` is the
   * format returned by the K8s TokenReview API in
   * `status.user.username`. NULL means "dev-only principal" — those
   * authenticate via `JWT_BOOTSTRAP_SECRET` + `X-Service-Id` header
   * instead of K8s SA attestation.
   */
  @Column({ name: 'k8s_service_account', type: 'text', nullable: true })
  k8sServiceAccount?: string | null;

  /**
   * Kill-switch. An inactive row cannot mint a token even when the
   * bootstrap mechanism otherwise succeeds. Operators flip this to
   * `false` to revoke a service identity without dropping the row
   * (preserving the audit trail of who was previously allowed to
   * call what).
   */
  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
