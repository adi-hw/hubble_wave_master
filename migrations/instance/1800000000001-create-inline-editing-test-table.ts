import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create Inline Editing Test Table
 *
 * Creates a test collection with columns for each available field type
 * to facilitate testing of inline editing functionality.
 *
 * Also seeds 100 rows of test data.
 */
export class CreateInlineEditingTestTable1800000000001 implements MigrationInterface {
  name = 'CreateInlineEditingTestTable1800000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================================
    // STEP 1: Create the physical table
    // =========================================================================

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS inline_editing_test (
        id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,

        -- Text Fields
        text_field VARCHAR(255),
        long_text_field TEXT,
        email_field VARCHAR(255),
        url_field VARCHAR(512),
        phone_field VARCHAR(50),

        -- Number Fields
        integer_field INTEGER,
        decimal_field DECIMAL(15,2),
        currency_field DECIMAL(15,2),
        percent_field DECIMAL(5,2),

        -- Date/Time Fields
        date_field DATE,
        datetime_field TIMESTAMPTZ,
        time_field TIME,
        duration_field INTEGER, -- stored as minutes

        -- Boolean Field
        boolean_field BOOLEAN DEFAULT false,

        -- Choice Fields (stored as text)
        status_field VARCHAR(50),
        priority_field VARCHAR(50),

        -- Tags (stored as JSONB array)
        tags_field JSONB DEFAULT '[]',

        -- Progress (stored as integer 0-100)
        progress_field INTEGER DEFAULT 0,

        -- Reference Field (UUID to users table)
        assigned_user_id UUID,

        -- Metadata
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // =========================================================================
    // STEP 2: Create the collection definition
    // =========================================================================

    await queryRunner.query(`
      INSERT INTO collection_definitions (
        code, name, plural_name, description, icon,
        table_name, owner_type, is_system, is_active,
        sync_status, is_locked,
        created_at, updated_at
      ) VALUES (
        'inline_editing_test',
        'Inline Editing Test',
        'Inline Editing Tests',
        'Test collection for inline editing with all field types',
        'edit-3',
        'inline_editing_test',
        'custom',
        false,
        true,
        'synced',
        false,
        NOW(),
        NOW()
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        plural_name = EXCLUDED.plural_name,
        description = EXCLUDED.description,
        updated_at = NOW()
    `);

    // =========================================================================
    // STEP 3: Create property definitions
    // =========================================================================

    const collectionId = await this.getCollectionId(queryRunner, 'inline_editing_test');
    const usersCollectionId = await this.getCollectionId(queryRunner, 'users');

    const properties = [
      // ID field (auto-generated, not editable)
      { code: 'id', name: 'ID', propertyType: 'uuid', columnName: 'id', position: 0, isRequired: true, isEditable: false },

      // Text Fields
      { code: 'text_field', name: 'Text', propertyType: 'text', columnName: 'text_field', position: 1, isRequired: false, isEditable: true },
      { code: 'long_text_field', name: 'Long Text', propertyType: 'long_text', columnName: 'long_text_field', position: 2, isRequired: false, isEditable: true },
      { code: 'email_field', name: 'Email', propertyType: 'email', columnName: 'email_field', position: 3, isRequired: false, isEditable: true },
      { code: 'url_field', name: 'URL', propertyType: 'url', columnName: 'url_field', position: 4, isRequired: false, isEditable: true },
      { code: 'phone_field', name: 'Phone', propertyType: 'phone', columnName: 'phone_field', position: 5, isRequired: false, isEditable: true },

      // Number Fields
      { code: 'integer_field', name: 'Integer', propertyType: 'integer', columnName: 'integer_field', position: 6, isRequired: false, isEditable: true },
      { code: 'decimal_field', name: 'Decimal', propertyType: 'decimal', columnName: 'decimal_field', position: 7, isRequired: false, isEditable: true },
      { code: 'currency_field', name: 'Currency', propertyType: 'currency', columnName: 'currency_field', position: 8, isRequired: false, isEditable: true },
      { code: 'percent_field', name: 'Percent', propertyType: 'percentage', columnName: 'percent_field', position: 9, isRequired: false, isEditable: true },

      // Date/Time Fields
      { code: 'date_field', name: 'Date', propertyType: 'date', columnName: 'date_field', position: 10, isRequired: false, isEditable: true },
      { code: 'datetime_field', name: 'Date Time', propertyType: 'datetime', columnName: 'datetime_field', position: 11, isRequired: false, isEditable: true },
      { code: 'time_field', name: 'Time', propertyType: 'time', columnName: 'time_field', position: 12, isRequired: false, isEditable: true },
      { code: 'duration_field', name: 'Duration', propertyType: 'duration', columnName: 'duration_field', position: 13, isRequired: false, isEditable: true },

      // Boolean Field
      { code: 'boolean_field', name: 'Boolean', propertyType: 'boolean', columnName: 'boolean_field', position: 14, isRequired: false, isEditable: true },

      // Choice Fields
      {
        code: 'status_field',
        name: 'Status',
        propertyType: 'choice',
        columnName: 'status_field',
        position: 15,
        isRequired: false,
        isEditable: true,
        config: JSON.stringify({
          options: [
            { value: 'open', label: 'Open', color: '#3b82f6' },
            { value: 'in_progress', label: 'In Progress', color: '#f59e0b' },
            { value: 'completed', label: 'Completed', color: '#10b981' },
            { value: 'closed', label: 'Closed', color: '#6b7280' },
          ]
        })
      },
      {
        code: 'priority_field',
        name: 'Priority',
        propertyType: 'choice',
        columnName: 'priority_field',
        position: 16,
        isRequired: false,
        isEditable: true,
        config: JSON.stringify({
          options: [
            { value: 'critical', label: 'Critical', color: '#dc2626' },
            { value: 'high', label: 'High', color: '#f97316' },
            { value: 'medium', label: 'Medium', color: '#eab308' },
            { value: 'low', label: 'Low', color: '#22c55e' },
            { value: 'none', label: 'None', color: '#9ca3af' },
          ]
        })
      },

      // Tags Field
      { code: 'tags_field', name: 'Tags', propertyType: 'multi_choice', columnName: 'tags_field', position: 17, isRequired: false, isEditable: true },

      // Progress Field
      { code: 'progress_field', name: 'Progress', propertyType: 'percentage', columnName: 'progress_field', position: 18, isRequired: false, isEditable: true },

      // Reference Field
      {
        code: 'assigned_user_id',
        name: 'Assigned User',
        propertyType: 'user',
        columnName: 'assigned_user_id',
        position: 19,
        isRequired: false,
        isEditable: true,
        referenceCollectionId: usersCollectionId,
        referenceDisplayProperty: 'display_name'
      },

      // Metadata (not editable)
      { code: 'created_at', name: 'Created At', propertyType: 'datetime', columnName: 'created_at', position: 98, isRequired: true, isEditable: false },
      { code: 'updated_at', name: 'Updated At', propertyType: 'datetime', columnName: 'updated_at', position: 99, isRequired: true, isEditable: false },
    ];

    for (const prop of properties) {
      await this.createProperty(queryRunner, collectionId, prop);
    }

    // =========================================================================
    // STEP 4: Seed 100 rows of test data
    // =========================================================================

    await this.seedTestData(queryRunner);

    console.log('✅ Inline Editing Test table created with 100 test rows');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete property definitions
    await queryRunner.query(`
      DELETE FROM property_definitions
      WHERE collection_id = (SELECT id FROM collection_definitions WHERE code = 'inline_editing_test')
    `);

    // Delete collection definition
    await queryRunner.query(`
      DELETE FROM collection_definitions WHERE code = 'inline_editing_test'
    `);

    // Drop the physical table
    await queryRunner.query(`DROP TABLE IF EXISTS inline_editing_test`);

    console.log('✅ Inline Editing Test table removed');
  }

  private async getCollectionId(queryRunner: QueryRunner, code: string): Promise<string | null> {
    const result = await queryRunner.query(`
      SELECT id FROM collection_definitions WHERE code = $1 LIMIT 1
    `, [code]);
    return result[0]?.id ?? null;
  }

  private async createProperty(
    queryRunner: QueryRunner,
    collectionId: string,
    prop: {
      code: string;
      name: string;
      propertyType: string;
      columnName: string;
      position: number;
      isRequired: boolean;
      isEditable: boolean;
      config?: string;
      referenceCollectionId?: string | null;
      referenceDisplayProperty?: string;
    }
  ): Promise<void> {
    await queryRunner.query(`
      INSERT INTO property_definitions (
        collection_id, code, name,
        property_type_id, column_name,
        is_required, is_system, is_active, is_visible,
        owner_type, sync_status, is_locked,
        position, config,
        reference_collection_id, reference_display_property,
        created_at, updated_at
      )
      SELECT
        $1,
        $2,
        $3,
        pt.id,
        $4,
        $5,
        false,
        true,
        true,
        'custom',
        'synced',
        false,
        $6,
        $8::jsonb,
        $9,
        $10,
        NOW(),
        NOW()
      FROM property_types pt
      WHERE pt.code = $7
      ON CONFLICT (collection_id, code) DO UPDATE SET
        name = EXCLUDED.name,
        position = EXCLUDED.position,
        config = EXCLUDED.config,
        reference_collection_id = EXCLUDED.reference_collection_id,
        reference_display_property = EXCLUDED.reference_display_property,
        updated_at = NOW()
    `, [
      collectionId,
      prop.code,
      prop.name,
      prop.columnName,
      prop.isRequired,
      prop.position,
      prop.propertyType,
      prop.config ?? '{}',
      prop.referenceCollectionId ?? null,
      prop.referenceDisplayProperty ?? null,
    ]);
  }

  private async seedTestData(queryRunner: QueryRunner): Promise<void> {
    const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Edward', 'Fiona', 'George', 'Hannah', 'Ivan', 'Julia'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
    const domains = ['example.com', 'test.org', 'demo.net', 'sample.io', 'mock.dev'];
    const statuses = ['open', 'in_progress', 'completed', 'closed'];
    const priorities = ['critical', 'high', 'medium', 'low', 'none'];
    const tagOptions = ['urgent', 'bug', 'feature', 'enhancement', 'documentation', 'testing', 'review', 'backend', 'frontend', 'api'];

    for (let i = 1; i <= 100; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const domain = domains[Math.floor(Math.random() * domains.length)];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const priority = priorities[Math.floor(Math.random() * priorities.length)];

      // Random subset of tags
      const numTags = Math.floor(Math.random() * 4);
      const shuffledTags = [...tagOptions].sort(() => Math.random() - 0.5);
      const tags = JSON.stringify(shuffledTags.slice(0, numTags));

      // Random dates within last year
      const baseDate = new Date();
      const randomDays = Math.floor(Math.random() * 365);
      const date = new Date(baseDate.getTime() - randomDays * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      const datetimeStr = date.toISOString();

      // Random time
      const hours = Math.floor(Math.random() * 24).toString().padStart(2, '0');
      const minutes = Math.floor(Math.random() * 60).toString().padStart(2, '0');
      const timeStr = `${hours}:${minutes}:00`;

      // Duration in minutes (0 to 8 hours)
      const duration = Math.floor(Math.random() * 480);

      // Progress (0-100)
      const progress = Math.floor(Math.random() * 101);

      // Number values
      const integer = Math.floor(Math.random() * 10000);
      const decimal = (Math.random() * 1000).toFixed(2);
      const currency = (Math.random() * 5000).toFixed(2);
      const percent = (Math.random() * 100).toFixed(2);

      await queryRunner.query(`
        INSERT INTO inline_editing_test (
          text_field, long_text_field, email_field, url_field, phone_field,
          integer_field, decimal_field, currency_field, percent_field,
          date_field, datetime_field, time_field, duration_field,
          boolean_field, status_field, priority_field,
          tags_field, progress_field,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16,
          $17::jsonb, $18,
          NOW(), NOW()
        )
      `, [
        `${firstName} ${lastName} - Item ${i}`,
        `This is a longer text description for test item ${i}. It contains multiple sentences to demonstrate the long text field. Created by ${firstName} ${lastName}.`,
        `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`,
        `https://www.${domain}/item/${i}`,
        `+1-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 9000 + 1000)}`,
        integer,
        decimal,
        currency,
        percent,
        dateStr,
        datetimeStr,
        timeStr,
        duration,
        Math.random() > 0.5,
        status,
        priority,
        tags,
        progress,
      ]);
    }
  }
}
