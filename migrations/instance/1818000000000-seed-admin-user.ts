import { MigrationInterface, QueryRunner } from 'typeorm';
import * as argon2 from 'argon2';

/**
 * Seed Default Admin User
 *
 * Creates the bootstrap admin user for initial platform access. The password
 * MUST be supplied via the DEFAULT_ADMIN_PASSWORD environment variable; the
 * migration aborts otherwise. The password is hashed with argon2id at
 * migration time — no static hashes or plaintext are baked into source.
 *
 * Operators MUST rotate the bootstrap password after first login. See
 * SECRETS_ROTATION.md for the full rotation procedure.
 */
export class SeedAdminUser1818000000000 implements MigrationInterface {
  name = 'SeedAdminUser1818000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if admin user already exists
    const existingUser = await queryRunner.query(
      `SELECT id FROM users WHERE email = $1 LIMIT 1`,
      ['admin@hubblewave.local']
    );

    if (existingUser && existingUser.length > 0) {
      console.log('Admin user already exists, skipping seed');
      return;
    }

    const bootstrapPassword = process.env.DEFAULT_ADMIN_PASSWORD;
    if (!bootstrapPassword) {
      throw new Error(
        'DEFAULT_ADMIN_PASSWORD environment variable is required to seed the bootstrap admin user. ' +
          'Provide a password of 12+ characters; rotate after first login per SECRETS_ROTATION.md.'
      );
    }
    if (bootstrapPassword.length < 12) {
      throw new Error('DEFAULT_ADMIN_PASSWORD must be at least 12 characters.');
    }

    const passwordHash = await argon2.hash(bootstrapPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const userIdRows = await queryRunner.query(
      `INSERT INTO users (
        id, email, password_hash, display_name, first_name, last_name,
        status, is_admin, email_verified, created_at, updated_at
      ) VALUES (
        uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW()
      ) RETURNING id`,
      [
        'admin@hubblewave.local',
        passwordHash,
        'System Administrator',
        'Admin',
        'User',
        'active',
        true,
        true,
      ]
    );

    const adminUserId = userIdRows[0]?.id;
    if (!adminUserId) {
      throw new Error('Failed to create admin user');
    }

    // Assign admin role created by the prior seed-admin-role migration.
    const adminRole = await queryRunner.query(
      `SELECT id FROM roles WHERE code = $1 LIMIT 1`,
      ['admin']
    );

    if (adminRole && adminRole.length > 0) {
      await queryRunner.query(
        `INSERT INTO user_roles (id, user_id, role_id, source, created_at)
         VALUES (uuid_generate_v4(), $1, $2, 'direct', NOW())
         ON CONFLICT DO NOTHING`,
        [adminUserId, adminRole[0].id]
      );
      console.log('Admin role assigned to admin user');
    } else {
      console.warn('Admin role not found - user created without role assignment');
    }

    console.log('Admin user created: admin@hubblewave.local (rotate password after first login)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email = $1)`,
      ['admin@hubblewave.local']
    );
    await queryRunner.query(
      `DELETE FROM users WHERE email = $1`,
      ['admin@hubblewave.local']
    );
  }
}
