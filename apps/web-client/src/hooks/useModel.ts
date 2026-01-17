import { useState, useEffect } from 'react';
import { getModelProperties, getModelLayout, ModelProperty, ModelLayout } from '../services/platform.service';

export const useModel = (collectionCode: string) => {
  const [properties, setProperties] = useState<ModelProperty[]>([]);
  const [layout, setLayout] = useState<ModelLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModel = async () => {
      try {
        setLoading(true);
        const [propertiesData, layoutData] = await Promise.all([
          getModelProperties(collectionCode),
          getModelLayout(collectionCode)
        ]);
        setProperties(propertiesData);
        setLayout(layoutData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load model');
      } finally {
        setLoading(false);
      }
    };

    fetchModel();
  }, [collectionCode]);

  return { properties, layout, loading, error };
};
