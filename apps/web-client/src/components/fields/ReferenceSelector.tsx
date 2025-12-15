import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';

interface ReferenceSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  required?: boolean;
  referenceTable: string; // The table to search in
  disabled?: boolean;
  error?: boolean;
}

export const ReferenceSelector: React.FC<ReferenceSelectorProps> = ({
  value,
  onChange,
  required,
  referenceTable,
  disabled = false,
}) => {
  const { token } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  const searchRecords = async (query: string) => {
    if (!query) return;
    setLoading(true);
    try {
      // Assuming we can search by a generic 'q' param or we filter by specific fields
      // For now, let's assume the backend supports a generic 'q' param we added
      const response = await fetch(`/api/data/${referenceTable}?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRecords(data);
      }
    } catch (error) {
      console.error('Failed to search records', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (search) searchRecords(search);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [search, token, referenceTable]);

  return (
    <div className="relative">
      <input
        type="text"
        className="input w-full"
        placeholder={`Search ${referenceTable}...`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        required={required}
        disabled={disabled}
      />
      {loading && (
        <div
          className="absolute right-2 top-2 text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          Loading...
        </div>
      )}
      {records.length > 0 && search && (
        <ul
          className="absolute z-10 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-auto"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
          }}
        >
          {records.map((record) => (
            <li
              key={record.id}
              className="p-2 cursor-pointer transition-colors"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onClick={() => {
                onChange(record.id);
                setSearch(record.attributes?.name || record.id);
                setRecords([]);
              }}
            >
              <div className="font-medium">
                {record.attributes?.name || record.attributes?.title || record.id}
              </div>
            </li>
          ))}
        </ul>
      )}
      {value && !search && (
        <div className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Selected ID: {value}
        </div>
      )}
    </div>
  );
};
