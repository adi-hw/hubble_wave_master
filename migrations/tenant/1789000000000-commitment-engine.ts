import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommitmentEngine1789000000000 implements MigrationInterface {
  name = 'CommitmentEngine1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Business Schedule table
    await queryRunner.query(`
      CREATE TABLE business_schedule (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        timezone VARCHAR(50) DEFAULT 'UTC',
        working_hours JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_business_schedule_name ON business_schedule(name)`);
    await queryRunner.query(`CREATE INDEX idx_business_schedule_active ON business_schedule(is_active)`);

    // Holiday Calendar table
    await queryRunner.query(`
      CREATE TABLE holiday_calendar (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        region VARCHAR(50),
        country_code VARCHAR(10),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_holiday_calendar_active ON holiday_calendar(is_active)`);

    // Holiday table
    await queryRunner.query(`
      CREATE TABLE holiday (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        calendar_id UUID NOT NULL REFERENCES holiday_calendar(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        date DATE NOT NULL,
        end_date DATE,
        is_recurring BOOLEAN DEFAULT false,
        recurrence_pattern VARCHAR(20),
        recurrence_config JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_holiday_calendar_id ON holiday(calendar_id)`);
    await queryRunner.query(`CREATE INDEX idx_holiday_date ON holiday(date)`);

    // Commitment Definition table
    await queryRunner.query(`
      CREATE TABLE commitment_definition (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        description TEXT,
        type VARCHAR(20) DEFAULT 'sla',
        collection_code VARCHAR(100),
        applicable_conditions JSONB,
        trigger_type VARCHAR(50) DEFAULT 'on_create',
        trigger_config JSONB,
        stop_condition VARCHAR(50) DEFAULT 'on_resolution',
        stop_config JSONB,
        pause_conditions JSONB,
        target_minutes INT DEFAULT 0,
        use_business_hours BOOLEAN DEFAULT true,
        business_schedule_id UUID REFERENCES business_schedule(id),
        holiday_calendar_id UUID REFERENCES holiday_calendar(id),
        warning_threshold_percent INT DEFAULT 75,
        warning_actions JSONB DEFAULT '[]',
        breach_actions JSONB DEFAULT '[]',
        priority INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_by UUID,
        updated_by UUID,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_commitment_def_name ON commitment_definition(name)`);
    await queryRunner.query(`CREATE INDEX idx_commitment_def_collection ON commitment_definition(collection_code)`);
    await queryRunner.query(`CREATE INDEX idx_commitment_def_active ON commitment_definition(is_active)`);
    await queryRunner.query(`CREATE INDEX idx_commitment_def_type ON commitment_definition(type)`);

    // Commitment Tracker table
    await queryRunner.query(`
      CREATE TABLE commitment_tracker (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        commitment_definition_id UUID NOT NULL REFERENCES commitment_definition(id) ON DELETE CASCADE,
        collection_code VARCHAR(100) NOT NULL,
        record_id UUID NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        started_at TIMESTAMPTZ NOT NULL,
        target_at TIMESTAMPTZ NOT NULL,
        warning_at TIMESTAMPTZ,
        paused_at TIMESTAMPTZ,
        total_paused_minutes INT DEFAULT 0,
        completed_at TIMESTAMPTZ,
        actual_minutes INT,
        percentage_used DECIMAL(5,2),
        warning_sent BOOLEAN DEFAULT false,
        warning_sent_at TIMESTAMPTZ,
        breached BOOLEAN DEFAULT false,
        breached_at TIMESTAMPTZ,
        history JSONB DEFAULT '[]',
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_commitment_tracker_def ON commitment_tracker(commitment_definition_id)`);
    await queryRunner.query(`CREATE INDEX idx_commitment_tracker_collection ON commitment_tracker(collection_code)`);
    await queryRunner.query(`CREATE INDEX idx_commitment_tracker_record ON commitment_tracker(record_id)`);
    await queryRunner.query(`CREATE INDEX idx_commitment_tracker_status ON commitment_tracker(status)`);
    await queryRunner.query(`CREATE INDEX idx_commitment_tracker_target ON commitment_tracker(target_at)`);
    await queryRunner.query(`CREATE INDEX idx_commitment_tracker_breached ON commitment_tracker(breached) WHERE breached = true`);

    // Commitment Metrics table
    await queryRunner.query(`
      CREATE TABLE commitment_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        commitment_definition_id UUID NOT NULL REFERENCES commitment_definition(id) ON DELETE CASCADE,
        period_date DATE NOT NULL,
        period_type VARCHAR(20) DEFAULT 'daily',
        total_tracked INT DEFAULT 0,
        met_count INT DEFAULT 0,
        breached_count INT DEFAULT 0,
        warning_count INT DEFAULT 0,
        cancelled_count INT DEFAULT 0,
        compliance_rate DECIMAL(5,2),
        avg_resolution_minutes DECIMAL(10,2),
        avg_percentage_used DECIMAL(10,2),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(commitment_definition_id, period_date, period_type)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_commitment_metrics_def ON commitment_metrics(commitment_definition_id)`);
    await queryRunner.query(`CREATE INDEX idx_commitment_metrics_date ON commitment_metrics(period_date)`);

    // Insert default business schedule
    await queryRunner.query(`
      INSERT INTO business_schedule (name, code, description, timezone, working_hours, is_default) VALUES
      ('Standard Business Hours', 'standard_business', '9 AM to 5 PM, Monday to Friday', 'UTC', '{
        "monday": {"start": "09:00", "end": "17:00", "enabled": true},
        "tuesday": {"start": "09:00", "end": "17:00", "enabled": true},
        "wednesday": {"start": "09:00", "end": "17:00", "enabled": true},
        "thursday": {"start": "09:00", "end": "17:00", "enabled": true},
        "friday": {"start": "09:00", "end": "17:00", "enabled": true},
        "saturday": {"start": "09:00", "end": "17:00", "enabled": false},
        "sunday": {"start": "09:00", "end": "17:00", "enabled": false}
      }', true),
      ('24/7 Support', '24_7_support', 'Round the clock coverage', 'UTC', '{
        "monday": {"start": "00:00", "end": "23:59", "enabled": true},
        "tuesday": {"start": "00:00", "end": "23:59", "enabled": true},
        "wednesday": {"start": "00:00", "end": "23:59", "enabled": true},
        "thursday": {"start": "00:00", "end": "23:59", "enabled": true},
        "friday": {"start": "00:00", "end": "23:59", "enabled": true},
        "saturday": {"start": "00:00", "end": "23:59", "enabled": true},
        "sunday": {"start": "00:00", "end": "23:59", "enabled": true}
      }', false),
      ('Extended Hours', 'extended_hours', '8 AM to 8 PM, Monday to Saturday', 'UTC', '{
        "monday": {"start": "08:00", "end": "20:00", "enabled": true},
        "tuesday": {"start": "08:00", "end": "20:00", "enabled": true},
        "wednesday": {"start": "08:00", "end": "20:00", "enabled": true},
        "thursday": {"start": "08:00", "end": "20:00", "enabled": true},
        "friday": {"start": "08:00", "end": "20:00", "enabled": true},
        "saturday": {"start": "08:00", "end": "20:00", "enabled": true},
        "sunday": {"start": "08:00", "end": "20:00", "enabled": false}
      }', false)
    `);

    // Insert default US holiday calendar
    await queryRunner.query(`
      INSERT INTO holiday_calendar (name, code, description, region, country_code) VALUES
      ('US Federal Holidays', 'us_federal', 'United States Federal Holidays', 'North America', 'US')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS commitment_metrics`);
    await queryRunner.query(`DROP TABLE IF EXISTS commitment_tracker`);
    await queryRunner.query(`DROP TABLE IF EXISTS commitment_definition`);
    await queryRunner.query(`DROP TABLE IF EXISTS holiday`);
    await queryRunner.query(`DROP TABLE IF EXISTS holiday_calendar`);
    await queryRunner.query(`DROP TABLE IF EXISTS business_schedule`);
  }
}
