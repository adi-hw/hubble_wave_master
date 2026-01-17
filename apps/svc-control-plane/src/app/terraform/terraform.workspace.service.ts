import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Instance } from '@hubblewave/control-plane-db';

export interface TerraformWorkspaceIdentity {
  instanceName: string;
  namespace: string;
  databaseName: string;
  domain: string;
}

export interface TerraformWorkspaceRequest {
  instance: Instance;
  customerCode: string;
  customerName: string;
  licenseKey?: string | null;
  workspace?: string;
}

export interface TerraformWorkspaceResult {
  workspace: string;
  directory: string;
  identity: TerraformWorkspaceIdentity;
}

@Injectable()
export class TerraformWorkspaceService {
  private readonly workspacesRoot: string;
  private readonly modulesRoot: string;

  constructor(private readonly config: ConfigService) {
    this.workspacesRoot = this.config.get<string>(
      'TERRAFORM_WORKSPACES_ROOT',
      join(process.cwd(), 'terraform', 'workspaces')
    );
    this.modulesRoot = this.config.get<string>(
      'TERRAFORM_MODULES_ROOT',
      join(process.cwd(), 'terraform', 'modules')
    );
  }

  buildIdentity(customerCode: string, environment: string): TerraformWorkspaceIdentity {
    const rootDomain = this.requireConfig('INSTANCE_ROOT_DOMAIN');
    if (rootDomain !== 'hubblewave.com') {
      throw new Error('INSTANCE_ROOT_DOMAIN must be hubblewave.com');
    }

    const instanceName = `${customerCode}-${environment}`;
    return {
      instanceName,
      namespace: `hw-${instanceName}`,
      databaseName: `hw_${instanceName.replace(/-/g, '_')}`,
      domain: `${customerCode}.${environment}.${rootDomain}`,
    };
  }

  async ensureWorkspace(request: TerraformWorkspaceRequest): Promise<TerraformWorkspaceResult> {
    const workspaceName = this.normalizeWorkspaceName(
      request.workspace || `${request.customerCode}-${request.instance.environment}`
    );
    const workspaceDir = join(this.workspacesRoot, workspaceName);
    await fs.mkdir(workspaceDir, { recursive: true });

    const identity = this.buildIdentity(request.customerCode, request.instance.environment);
    const existing = await this.workspaceFilesPresent(workspaceDir);
    if (!request.licenseKey && existing) {
      return { workspace: workspaceName, directory: workspaceDir, identity };
    }
    if (!request.licenseKey) {
      throw new Error('licenseKey is required to create a Terraform workspace');
    }

    const stateBucket = this.requireConfig('INSTANCE_TERRAFORM_STATE_BUCKET');
    const stateRegion = this.config.get<string>('INSTANCE_TERRAFORM_STATE_REGION')
      || this.config.get<string>('AWS_REGION');
    const lockTable = this.requireConfig('INSTANCE_TERRAFORM_LOCK_TABLE');
    const statePrefix = this.config.get<string>('INSTANCE_TERRAFORM_STATE_PREFIX', 'instances');
    const normalizedPrefix = statePrefix.replace(/\/+$/, '');
    const stateKey = `${normalizedPrefix}/${workspaceName}/terraform.tfstate`;

    const awsRegion = this.config.get<string>('INSTANCE_AWS_REGION')
      || this.config.get<string>('AWS_REGION');
    const dbHost = this.requireConfig('INSTANCE_DB_HOST');
    const dbPort = this.requireNumber('INSTANCE_DB_PORT', 5432);
    const dbAdminHost = this.config.get<string>('INSTANCE_DB_ADMIN_HOST') || dbHost;
    const dbAdminUser = this.requireConfig('INSTANCE_DB_ADMIN_USERNAME');
    const dbAdminPassword = this.requireConfig('INSTANCE_DB_ADMIN_PASSWORD');
    const dbAdminSslmode = this.config.get<string>('INSTANCE_DB_ADMIN_SSLMODE', 'require');
    const redisHost = this.requireConfig('INSTANCE_REDIS_HOST');
    const redisPort = this.requireNumber('INSTANCE_REDIS_PORT', 6379);
    const cloudflareZoneId = this.requireConfig('INSTANCE_CLOUDFLARE_ZONE_ID');
    const ingressHostname = this.requireConfig('INSTANCE_INGRESS_HOSTNAME');
    const eksOidcProviderArn = this.requireConfig('INSTANCE_EKS_OIDC_PROVIDER_ARN');
    const eksOidcProviderHost = this.requireConfig('INSTANCE_EKS_OIDC_PROVIDER_HOST');

    if (!awsRegion) {
      throw new Error('INSTANCE_AWS_REGION or AWS_REGION must be set');
    }
    if (!stateRegion) {
      throw new Error('INSTANCE_TERRAFORM_STATE_REGION or AWS_REGION must be set');
    }
    if (!request.instance.version) {
      throw new Error('instance version is required for provisioning');
    }

    const moduleSource = `${this.modulesRoot.replace(/\\\\/g, '/')}/customer-instance`;
    const hclString = (value: string) => JSON.stringify(value);
    const mainTf = `module "instance" {
  source = ${hclString(moduleSource)}

  instance_id = ${hclString(request.instance.id)}
  customer_code = ${hclString(request.customerCode)}
  customer_name = ${hclString(request.customerName)}
  environment = ${hclString(request.instance.environment)}
  license_key = ${hclString(request.licenseKey)}
  resource_tier = ${hclString(request.instance.resourceTier || 'standard')}
  platform_release_id = ${hclString(request.instance.version)}
  db_host = ${hclString(dbHost)}
  db_port = ${dbPort}
  redis_host = ${hclString(redisHost)}
  redis_port = ${redisPort}
  aws_region = ${hclString(awsRegion)}
  root_domain = ${hclString('hubblewave.com')}
  cloudflare_zone_id = ${hclString(cloudflareZoneId)}
  instance_ingress_hostname = ${hclString(ingressHostname)}
  eks_oidc_provider_arn = ${hclString(eksOidcProviderArn)}
  eks_oidc_provider_host = ${hclString(eksOidcProviderHost)}
}
`;

    const providersTf = `terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = ">= 2.23.0"
    }
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = ">= 1.21.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = ">= 4.0.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5.0"
    }
  }
}

provider "aws" {
  region = ${hclString(awsRegion)}
}

provider "kubernetes" {
  host                   = "https://kubernetes.default.svc"
  token                  = file("/var/run/secrets/kubernetes.io/serviceaccount/token")
  cluster_ca_certificate = file("/var/run/secrets/kubernetes.io/serviceaccount/ca.crt")
  load_config_file       = false
}

provider "cloudflare" {}

provider "postgresql" {
  host      = ${hclString(dbAdminHost)}
  port      = ${dbPort}
  username  = ${hclString(dbAdminUser)}
  password  = ${hclString(dbAdminPassword)}
  sslmode   = ${hclString(dbAdminSslmode)}
  superuser = false
}
`;

    const backendTf = `terraform {
  backend "s3" {
    bucket         = ${hclString(stateBucket)}
    key            = ${hclString(stateKey)}
    region         = ${hclString(stateRegion)}
    dynamodb_table = ${hclString(lockTable)}
    encrypt        = true
  }
}
`;

    await this.writeFileIfChanged(join(workspaceDir, 'main.tf'), mainTf);
    await this.writeFileIfChanged(join(workspaceDir, 'providers.tf'), providersTf);
    await this.writeFileIfChanged(join(workspaceDir, 'backend.tf'), backendTf);

    return { workspace: workspaceName, directory: workspaceDir, identity };
  }

  private normalizeWorkspaceName(value: string): string {
    const name = value.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(name)) {
      throw new Error('workspace name must be lowercase alphanumeric with dashes');
    }
    return name;
  }

  private requireConfig(key: string): string {
    const value = this.config.get<string>(key);
    if (!value || !value.trim()) {
      throw new Error(`${key} must be set`);
    }
    return value.trim();
  }

  private requireNumber(key: string, fallback: number): number {
    const raw = this.config.get<string>(key);
    if (!raw) {
      return fallback;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${key} must be a valid number`);
    }
    return parsed;
  }

  private async writeFileIfChanged(path: string, contents: string): Promise<void> {
    try {
      const existing = await fs.readFile(path, 'utf8');
      if (existing === contents) {
        return;
      }
    } catch (error: any) {
      if (error?.code !== 'ENOENT') {
        throw error;
      }
    }
    await fs.writeFile(path, contents, 'utf8');
  }

  private async workspaceFilesPresent(workspaceDir: string): Promise<boolean> {
    const files = ['main.tf', 'providers.tf', 'backend.tf'];
    for (const file of files) {
      try {
        await fs.access(join(workspaceDir, file));
      } catch {
        return false;
      }
    }
    return true;
  }
}
