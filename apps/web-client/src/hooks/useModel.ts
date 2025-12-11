import { useState, useEffect } from 'react';
import { getModelFields, getModelLayout, ModelField, ModelLayout } from '../services/platform.service';

export const useModel = (tableCode: string) => {
  const [fields, setFields] = useState<ModelField[]>([]);
  const [layout, setLayout] = useState<ModelLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModel = async () => {
      try {
        setLoading(true);
        const [fieldsData, layoutData] = await Promise.all([
          getModelFields(tableCode),
          getModelLayout(tableCode)
        ]);
        setFields(fieldsData);
        setLayout(layoutData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load model');
      } finally {
        setLoading(false);
      }
    };

    fetchModel();
  }, [tableCode]);

  return { fields, layout, loading, error };
};
