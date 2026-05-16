import { MigrationInterface, QueryRunner } from 'typeorm';

export class Baseline0000000000000 implements MigrationInterface {
  name = 'Baseline0000000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extensions
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;`);

    // Sequences
    await queryRunner.query(`CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;`);

    // Tables
    await queryRunner.query(`CREATE TABLE public.control_plane_audit_log (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    customer_id uuid,
    instance_id uuid,
    action character varying(100) NOT NULL,
    resource_type character varying(50),
    resource_id uuid,
    result character varying(20) DEFAULT 'success'::character varying NOT NULL,
    error_message text,
    old_values jsonb,
    new_values jsonb,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    ip_address character varying(45),
    user_agent text,
    request_id character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.control_plane_users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(320) NOT NULL,
    display_name character varying(255) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    password_hash character varying(255),
    role character varying(50) DEFAULT 'readonly'::character varying NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    mfa_enabled boolean DEFAULT false NOT NULL,
    mfa_secret character varying(255),
    mfa_backup_codes jsonb,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    password_changed_at timestamp with time zone,
    last_login_at timestamp with time zone,
    last_login_ip character varying(45),
    last_activity_at timestamp with time zone,
    avatar_url character varying(500),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.customers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    tier character varying(20) DEFAULT 'professional'::character varying NOT NULL,
    contract_start date,
    contract_end date,
    contract_value numeric(12,2),
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    mrr integer DEFAULT 0 NOT NULL,
    primary_contact_name character varying(255),
    primary_contact_email character varying(320),
    primary_contact_phone character varying(50),
    technical_contact_email character varying(320),
    billing_email character varying(320),
    address_line1 character varying(255),
    address_line2 character varying(255),
    city character varying(100),
    state character varying(100),
    postal_code character varying(20),
    country character varying(100),
    max_users integer,
    max_assets integer,
    max_storage_gb integer,
    max_instances integer DEFAULT 3 NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    feature_flags jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    notes text,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    total_users integer DEFAULT 0 NOT NULL,
    total_assets integer DEFAULT 0 NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.global_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    scope character varying(40) DEFAULT 'global'::character varying NOT NULL,
    platform_name character varying(255) NOT NULL,
    maintenance_mode boolean DEFAULT false NOT NULL,
    public_signup boolean DEFAULT false NOT NULL,
    default_trial_days integer DEFAULT 14 NOT NULL,
    support_email character varying(320) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.instance_metrics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    instance_id uuid NOT NULL,
    recorded_at timestamp with time zone DEFAULT now() NOT NULL,
    active_users integer,
    total_users integer,
    total_assets integer,
    api_requests_1h integer,
    db_connections integer,
    storage_bytes bigint,
    avg_response_time_ms numeric(10,2),
    p95_response_time_ms numeric(10,2),
    p99_response_time_ms numeric(10,2),
    error_rate numeric(5,4),
    cpu_percent numeric(5,2),
    memory_percent numeric(5,2),
    disk_percent numeric(5,2),
    network_io_bytes bigint,
    db_size_bytes bigint,
    db_queries_1h integer,
    slow_queries_1h integer
);`);
    await queryRunner.query(`CREATE TABLE public.instances (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    customer_id uuid NOT NULL,
    environment character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    health character varying(20) DEFAULT 'unknown'::character varying NOT NULL,
    domain character varying(255),
    custom_domain character varying(255),
    ssl_status character varying(50),
    region character varying(50) NOT NULL,
    version character varying(50) NOT NULL,
    resource_tier character varying(20) DEFAULT 'standard'::character varying NOT NULL,
    database_name character varying(100) NOT NULL,
    database_host character varying(255),
    database_port integer DEFAULT 5432 NOT NULL,
    k8s_namespace character varying(100),
    k8s_cluster character varying(100),
    terraform_workspace character varying(100),
    last_health_check timestamp with time zone,
    health_details jsonb DEFAULT '{}'::jsonb NOT NULL,
    resource_metrics jsonb DEFAULT '{}'::jsonb NOT NULL,
    provisioning_started_at timestamp with time zone,
    provisioning_completed_at timestamp with time zone,
    last_deployed_at timestamp with time zone,
    last_deployed_version character varying(50),
    error_message text,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    feature_flags jsonb DEFAULT '[]'::jsonb NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    maintenance_window character varying(100),
    next_maintenance timestamp with time zone,
    backup_retention_days integer DEFAULT 30 NOT NULL,
    last_backup_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    gpu_enabled boolean DEFAULT false NOT NULL,
    gpu_instance_type character varying(50),
    huggingface_token character varying(500),
    vllm_model character varying(200),
    CONSTRAINT instances_resource_tier_check CHECK (((resource_tier)::text = ANY ((ARRAY['standard'::character varying, 'professional'::character varying, 'enterprise'::character varying, 'enterprise_gpu'::character varying])::text[])))
);`);
    await queryRunner.query(`CREATE TABLE public.licenses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    customer_id uuid NOT NULL,
    instance_id uuid,
    license_key character varying(500) NOT NULL,
    license_type character varying(50) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    features jsonb DEFAULT '[]'::jsonb NOT NULL,
    max_users integer,
    max_assets integer,
    signature character varying(500),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    revoked_at timestamp with time zone,
    revoked_by uuid,
    revoke_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.pack_registry (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(200) NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    publisher character varying(120) NOT NULL,
    license character varying(120),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.pack_releases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    pack_id uuid NOT NULL,
    release_id character varying(50) NOT NULL,
    manifest_revision integer DEFAULT 1 NOT NULL,
    manifest jsonb NOT NULL,
    dependencies jsonb,
    compatibility jsonb,
    assets jsonb NOT NULL,
    artifact_bucket character varying(255) NOT NULL,
    artifact_key character varying(500) NOT NULL,
    artifact_sha256 character varying(64) NOT NULL,
    signature text NOT NULL,
    signature_key_id character varying(200) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_installable_by_client boolean DEFAULT false NOT NULL,
    CONSTRAINT chk_pack_release_id_format CHECK (((release_id)::text ~ '^[0-9]{8}\.[0-9]{3,}$'::text)),
    CONSTRAINT chk_pack_release_sha256 CHECK (((artifact_sha256)::text ~ '^[a-f0-9]{64}$'::text))
);`);
    await queryRunner.query(`CREATE TABLE public.refresh_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    token_hash character varying(128) NOT NULL,
    family uuid NOT NULL,
    user_id uuid NOT NULL,
    issued_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    revoke_reason character varying(64),
    replaced_by uuid,
    ip_address character varying(45),
    user_agent text
);`);
    await queryRunner.query(`CREATE TABLE public.revoked_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    jti character varying(64) NOT NULL,
    user_id uuid NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone DEFAULT now() NOT NULL,
    ip_address character varying(45),
    user_agent text
);`);
    await queryRunner.query(`CREATE TABLE public.subscriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    customer_id uuid NOT NULL,
    plan_id character varying(50) NOT NULL,
    plan_name character varying(100) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    billing_cycle character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    trial_end timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancel_at_period_end boolean DEFAULT false NOT NULL,
    stripe_subscription_id character varying(255),
    stripe_customer_id character varying(255),
    stripe_price_id character varying(255),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);
    await queryRunner.query(`CREATE TABLE public.terraform_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    instance_id uuid NOT NULL,
    customer_code character varying(50) NOT NULL,
    environment character varying(50) NOT NULL,
    operation character varying(50) NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    workspace character varying(100),
    plan_output text,
    plan jsonb,
    output_lines jsonb,
    output jsonb DEFAULT '[]'::jsonb NOT NULL,
    error_message text,
    exit_code integer,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    triggered_by uuid,
    cancelled_by uuid,
    duration integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);`);

    // Indexes
    await queryRunner.query(`CREATE INDEX idx_audit_action ON public.control_plane_audit_log USING btree (action);`);
    await queryRunner.query(`CREATE INDEX idx_audit_created_at ON public.control_plane_audit_log USING btree (created_at);`);
    await queryRunner.query(`CREATE INDEX idx_audit_customer_id ON public.control_plane_audit_log USING btree (customer_id);`);
    await queryRunner.query(`CREATE INDEX idx_audit_instance_id ON public.control_plane_audit_log USING btree (instance_id);`);
    await queryRunner.query(`CREATE INDEX idx_audit_user_id ON public.control_plane_audit_log USING btree (user_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_control_plane_users_email ON public.control_plane_users USING btree (email);`);
    await queryRunner.query(`CREATE INDEX idx_control_plane_users_role ON public.control_plane_users USING btree (role);`);
    await queryRunner.query(`CREATE INDEX idx_control_plane_users_status ON public.control_plane_users USING btree (status);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_customers_code ON public.customers USING btree (code);`);
    await queryRunner.query(`CREATE INDEX idx_customers_status ON public.customers USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_customers_tier ON public.customers USING btree (tier);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_global_settings_scope ON public.global_settings USING btree (scope);`);
    await queryRunner.query(`CREATE INDEX idx_instance_metrics_instance_recorded ON public.instance_metrics USING btree (instance_id, recorded_at);`);
    await queryRunner.query(`CREATE INDEX idx_instance_metrics_recorded_at ON public.instance_metrics USING btree (recorded_at);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_instances_customer_env_unique ON public.instances USING btree (customer_id, environment);`);
    await queryRunner.query(`CREATE INDEX idx_instances_customer_id ON public.instances USING btree (customer_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_instances_domain_unique ON public.instances USING btree (domain) WHERE (domain IS NOT NULL);`);
    await queryRunner.query(`CREATE INDEX idx_instances_environment ON public.instances USING btree (environment);`);
    await queryRunner.query(`CREATE INDEX idx_instances_health ON public.instances USING btree (health);`);
    await queryRunner.query(`CREATE INDEX idx_instances_region ON public.instances USING btree (region);`);
    await queryRunner.query(`CREATE INDEX idx_instances_status ON public.instances USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_licenses_customer_id ON public.licenses USING btree (customer_id);`);
    await queryRunner.query(`CREATE INDEX idx_licenses_expires_at ON public.licenses USING btree (expires_at);`);
    await queryRunner.query(`CREATE INDEX idx_licenses_instance_id ON public.licenses USING btree (instance_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_licenses_license_key ON public.licenses USING btree (license_key);`);
    await queryRunner.query(`CREATE INDEX idx_licenses_status ON public.licenses USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_pack_registry_publisher ON public.pack_registry USING btree (publisher);`);
    await queryRunner.query(`CREATE INDEX idx_pack_releases_active ON public.pack_releases USING btree (is_active);`);
    await queryRunner.query(`CREATE INDEX idx_pack_releases_installable ON public.pack_releases USING btree (is_installable_by_client);`);
    await queryRunner.query(`CREATE INDEX idx_pack_releases_pack_id ON public.pack_releases USING btree (pack_id);`);
    await queryRunner.query(`CREATE INDEX idx_pack_releases_release_id ON public.pack_releases USING btree (release_id);`);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_expires_at ON public.refresh_tokens USING btree (expires_at);`);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_family ON public.refresh_tokens USING btree (family);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_refresh_tokens_token_hash ON public.refresh_tokens USING btree (token_hash);`);
    await queryRunner.query(`CREATE INDEX idx_refresh_tokens_user_id ON public.refresh_tokens USING btree (user_id);`);
    await queryRunner.query(`CREATE INDEX idx_revoked_tokens_expires_at ON public.revoked_tokens USING btree (expires_at);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_revoked_tokens_jti ON public.revoked_tokens USING btree (jti);`);
    await queryRunner.query(`CREATE INDEX idx_subscriptions_customer_id ON public.subscriptions USING btree (customer_id);`);
    await queryRunner.query(`CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);`);
    await queryRunner.query(`CREATE INDEX idx_subscriptions_stripe_id ON public.subscriptions USING btree (stripe_subscription_id);`);
    await queryRunner.query(`CREATE INDEX idx_terraform_jobs_customer_created ON public.terraform_jobs USING btree (customer_code, created_at);`);
    await queryRunner.query(`CREATE INDEX idx_terraform_jobs_instance_created ON public.terraform_jobs USING btree (instance_id, created_at);`);
    await queryRunner.query(`CREATE INDEX idx_terraform_jobs_status ON public.terraform_jobs USING btree (status);`);

    // Constraints
    await queryRunner.query(`ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);`);
    await queryRunner.query(`ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.control_plane_audit_log
    ADD CONSTRAINT control_plane_audit_log_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.control_plane_users
    ADD CONSTRAINT control_plane_users_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.global_settings
    ADD CONSTRAINT global_settings_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.instance_metrics
    ADD CONSTRAINT instance_metrics_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.pack_registry
    ADD CONSTRAINT pack_registry_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.pack_releases
    ADD CONSTRAINT pack_releases_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.revoked_tokens
    ADD CONSTRAINT revoked_tokens_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.terraform_jobs
    ADD CONSTRAINT terraform_jobs_pkey PRIMARY KEY (id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.pack_registry
    ADD CONSTRAINT uq_pack_registry_code UNIQUE (code);`);
    await queryRunner.query(`ALTER TABLE ONLY public.pack_releases
    ADD CONSTRAINT uq_pack_releases_pack_release UNIQUE (pack_id, release_id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.pack_registry
    ADD CONSTRAINT fk_pack_registry_created_by FOREIGN KEY (created_by) REFERENCES public.control_plane_users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY public.pack_registry
    ADD CONSTRAINT fk_pack_registry_updated_by FOREIGN KEY (updated_by) REFERENCES public.control_plane_users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY public.pack_releases
    ADD CONSTRAINT fk_pack_releases_created_by FOREIGN KEY (created_by) REFERENCES public.control_plane_users(id) ON DELETE SET NULL;`);
    await queryRunner.query(`ALTER TABLE ONLY public.instance_metrics
    ADD CONSTRAINT instance_metrics_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.instances(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY public.instances
    ADD CONSTRAINT instances_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.licenses
    ADD CONSTRAINT licenses_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.instances(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.pack_releases
    ADD CONSTRAINT pack_releases_pack_id_fkey FOREIGN KEY (pack_id) REFERENCES public.pack_registry(id) ON DELETE CASCADE;`);
    await queryRunner.query(`ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);`);
    await queryRunner.query(`ALTER TABLE ONLY public.terraform_jobs
    ADD CONSTRAINT terraform_jobs_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.instances(id) ON DELETE CASCADE;`);

    // Comments
    await queryRunner.query(`COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';`);
    await queryRunner.query(`COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';`);
    await queryRunner.query(`COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';`);

  }

  public async down(): Promise<void> {
    throw new Error('Baseline migration is forward-only');
  }
}
