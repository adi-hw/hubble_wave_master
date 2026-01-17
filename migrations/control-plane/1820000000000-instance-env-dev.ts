import { MigrationInterface, QueryRunner } from 'typeorm';

export class InstanceEnvDev1820000000000 implements MigrationInterface {
  name = 'InstanceEnvDev1820000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE instances
      SET environment = 'dev'
      WHERE environment = 'development';
    `);
    await queryRunner.query(`
      UPDATE terraform_jobs
      SET environment = 'dev'
      WHERE environment = 'development';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE instances
      SET environment = 'development'
      WHERE environment = 'dev';
    `);
    await queryRunner.query(`
      UPDATE terraform_jobs
      SET environment = 'development'
      WHERE environment = 'dev';
    `);
  }
}
