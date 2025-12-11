import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';
import * as dotenv from 'dotenv';

dotenv.config();

async function seedAcmeTenant() {
  console.log('Seeding acme tenant...\n');

  const {
    Tenant,
    UserAccount,
    Role,
    UserRoleAssignment,
    TenantUserMembership,
    platformEntities,
  } = await import('../libs/platform-db/src/index');

  const platformDataSource = new DataSource({
    type: 'postgres',
    host: process.env.PLATFORM_DB_HOST || 'localhost',
    port: parseInt(process.env.PLATFORM_DB_PORT || '5432'),
    username: process.env.PLATFORM_DB_USER || 'admin',
    password: process.env.PLATFORM_DB_PASSWORD || 'password',
    database: process.env.PLATFORM_DB_NAME || 'eam_global',
    entities: platformEntities,
    synchronize: false,
  });

  await platformDataSource.initialize();
  console.log('Connected to platform DB');

  const tenantRepo = platformDataSource.getRepository(Tenant);
  let tenant = await tenantRepo.findOne({ where: { slug: 'acme' } });

  if (!tenant) {
    tenant = tenantRepo.create({
      slug: 'acme',
      name: 'Acme Corporation',
      dbHost: process.env.TENANT_DB_HOST || 'localhost',
      dbPort: process.env.TENANT_DB_PORT ? parseInt(process.env.TENANT_DB_PORT) : undefined,
      dbName: process.env.TENANT_DB_NAME || 'eam_tenant_acme',
      dbUser: process.env.TENANT_DB_USER || 'admin',
      dbPasswordEnc: process.env.TENANT_DB_PASSWORD || 'password',
      status: 'ACTIVE',
    });
    await tenantRepo.save(tenant);
    console.log('Created acme tenant in platform DB');
  } else {
    console.log('Acme tenant already exists');
  }

  const userRepo = platformDataSource.getRepository(UserAccount);
  const roleRepo = platformDataSource.getRepository(Role);
  const assignmentRepo = platformDataSource.getRepository(UserRoleAssignment);
  const membershipRepo = platformDataSource.getRepository(TenantUserMembership);

  // Create admin role
  let adminRole = await roleRepo.findOne({ where: { name: 'admin', tenantId: tenant.id } });
  if (!adminRole) {
    adminRole = roleRepo.create({
      name: 'admin',
      slug: 'admin',
      tenantId: tenant.id,
      description: 'System Administrator',
    });
    await roleRepo.save(adminRole);
    console.log('Created admin role');
  }

  // Create tenant_admin role
  let tenantAdminRole = await roleRepo.findOne({ where: { name: 'tenant_admin', tenantId: tenant.id } });
  if (!tenantAdminRole) {
    tenantAdminRole = roleRepo.create({
      name: 'tenant_admin',
      slug: 'tenant_admin',
      tenantId: tenant.id,
      description: 'Tenant Administrator',
    });
    await roleRepo.save(tenantAdminRole);
    console.log('Created tenant_admin role');
  }

  // Create admin user
  let adminUser = await userRepo.findOne({ where: { primaryEmail: 'admin@acme.com' } });
  if (!adminUser) {
    const passwordHash = await argon2.hash('password');
    adminUser = userRepo.create({
      primaryEmail: 'admin@acme.com',
      displayName: 'System Administrator',
      passwordHash,
      status: 'ACTIVE',
    });
    await userRepo.save(adminUser);
    console.log('Created admin user (email: admin@acme.com, password: password)');
  } else {
    console.log('Admin user already exists');
  }

  // Create tenant membership (required for login!)
  let membership = await membershipRepo.findOne({
    where: { tenantId: tenant.id, userId: adminUser.id },
  });
  if (!membership) {
    membership = membershipRepo.create({
      tenantId: tenant.id,
      userId: adminUser.id,
      status: 'ACTIVE',
      isTenantAdmin: true,
    });
    await membershipRepo.save(membership);
    console.log('Created tenant membership for admin user');
  } else {
    console.log('Tenant membership already exists');
  }

  // Assign admin role to user via membership
  const existingAssignment = await assignmentRepo.findOne({
    where: { tenantUserMembershipId: membership.id, roleId: adminRole.id },
  });

  if (!existingAssignment) {
    const assignment = assignmentRepo.create({
      tenantUserMembershipId: membership.id,
      roleId: adminRole.id,
    });
    await assignmentRepo.save(assignment);
    console.log('Assigned admin role to admin user');
  } else {
    console.log('Role assignment already exists');
  }

  // Assign tenant_admin role to user
  const existingTenantAdminAssignment = await assignmentRepo.findOne({
    where: { tenantUserMembershipId: membership.id, roleId: tenantAdminRole.id },
  });

  if (!existingTenantAdminAssignment) {
    const tenantAdminAssignment = assignmentRepo.create({
      tenantUserMembershipId: membership.id,
      roleId: tenantAdminRole.id,
    });
    await assignmentRepo.save(tenantAdminAssignment);
    console.log('Assigned tenant_admin role to admin user');
  } else {
    console.log('Tenant admin role assignment already exists');
  }

  await platformDataSource.destroy();

  console.log('\n✅ Seeding complete!');
  console.log('\nTest Credentials:');
  console.log('   Tenant: acme');
  console.log('   Email: admin@acme.com');
  console.log('   Password: password');
}

seedAcmeTenant().catch((error) => {
  console.error('Error during seeding:', error);
  process.exit(1);
});
