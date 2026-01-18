import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed Default Admin User
 *
 * Creates a default admin user for initial platform access.
 * Password: Admin123!
 *
 * SECURITY: Change this password immediately after first login.
 */
export class SeedAdminUser1818000000000 implements MigrationInterface {
  name = 'SeedAdminUser1818000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if admin user already exists
    const existingUser = await queryRunner.query(
      `SELECT id FROM users WHERE email = 'admin@hubblewave.local' LIMIT 1`
    );

    if (existingUser && existingUser.length > 0) {
      console.log('Admin user already exists, skipping seed');
      return;
    }

    // Create admin user with argon2id hashed password (Admin123!)
    const userId = await queryRunner.query(`
      INSERT INTO users (
        id,
        email,
        password_hash,
        display_name,
        first_name,
        last_name,
        status,
        created_at,
        updated_at
      ) VALUES (
        uuid_generate_v4(),
        'admin@hubblewave.local',
        '$argon2id$v=19$m=65536,t=3,p=4$ZxEYofTmSU9iIOAiVEhpsg$Khn+/pGs2S0craJOoTBhIAxn5dwfRlUd9G75qEZey2o',
        'System Administrator',
        'Admin',
        'User',
        'active',
        NOW(),
        NOW()
      )
      RETURNING id
    `);

    const adminUserId = userId[0]?.id;
    if (!adminUserId) {
      throw new Error('Failed to create admin user');
    }

    // Check if admin role exists
    const adminRole = await queryRunner.query(
      `SELECT id FROM roles WHERE code = 'admin' OR name = 'Admin' LIMIT 1`
    );

    if (adminRole && adminRole.length > 0) {
      // Assign admin role to user
      await queryRunner.query(`
        INSERT INTO user_roles (id, user_id, role_id, created_at)
        VALUES (uuid_generate_v4(), '${adminUserId}', '${adminRole[0].id}', NOW())
        ON CONFLICT DO NOTHING
      `);
    }

    console.log('Admin user created: admin@hubblewave.local');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM user_roles WHERE user_id IN (SELECT id FROM users WHERE email = 'admin@hubblewave.local')`
    );
    await queryRunner.query(
      `DELETE FROM users WHERE email = 'admin@hubblewave.local'`
    );
  }
}
