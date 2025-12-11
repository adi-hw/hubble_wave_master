-- Assumes model_table, model_field_type, model_field already exist.
-- Sample application table (matches ERD)
CREATE TABLE IF NOT EXISTS app_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text,
  status text,
  custom_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed canonical field types
INSERT INTO model_field_type (code, label, category, backend_type, ui_widget)
VALUES
  ('text', 'Text', 'primitive', 'text', 'text'),
  ('status', 'Status', 'choice', 'text', 'select'),
  ('json', 'JSON', 'primitive', 'jsonb', 'json')
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    category = EXCLUDED.category,
    backend_type = EXCLUDED.backend_type,
    ui_widget = EXCLUDED.ui_widget,
    updated_at = now();

DO $$
DECLARE
  v_asset_table_id uuid;
  v_text uuid;
  v_status uuid;
  v_json uuid;
BEGIN
  SELECT id INTO v_text FROM model_field_type WHERE code = 'text';
  SELECT id INTO v_status FROM model_field_type WHERE code = 'status';
  SELECT id INTO v_json FROM model_field_type WHERE code = 'json';

  INSERT INTO model_table (code, label, category, storage_schema, storage_table, flags)
  VALUES ('asset', 'Asset', 'application', 'public', 'app_asset', '{}'::jsonb)
  ON CONFLICT (code) DO UPDATE
  SET label = EXCLUDED.label,
      category = EXCLUDED.category,
      storage_schema = EXCLUDED.storage_schema,
      storage_table = EXCLUDED.storage_table,
      updated_at = now()
  RETURNING id INTO v_asset_table_id;

  -- Ensure fields align to app_asset columns
  INSERT INTO model_field (table_id, field_type_id, code, label, nullable, is_unique, storage_path, display_order)
  VALUES
    (v_asset_table_id, v_text, 'serial_number', 'Serial Number', false, true, 'serial_number', 1),
    (v_asset_table_id, v_status, 'status', 'Status', true, false, 'status', 2),
    (v_asset_table_id, v_json, 'custom_data', 'Custom Data', true, false, 'custom_data', 3)
  ON CONFLICT (table_id, code) DO UPDATE
  SET field_type_id = EXCLUDED.field_type_id,
      label = EXCLUDED.label,
      nullable = EXCLUDED.nullable,
      is_unique = EXCLUDED.is_unique,
      storage_path = EXCLUDED.storage_path,
      display_order = EXCLUDED.display_order,
      updated_at = now();
END $$;
