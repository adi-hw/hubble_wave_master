import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
}

interface UserPickerProps {
  value?: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
}

export const UserPicker: React.FC<UserPickerProps> = ({ value, onChange, required, disabled = false }) => {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    if (value && !selectedUser) {
      // Fetch initial user if value is present but no user selected (could be optimized to fetch specific user)
      // For now, we'll rely on search to populate options
    }
  }, [value, selectedUser]);

  const searchUsers = async (query: string) => {
    if (!query) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/identity/users?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to search users', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (search) searchUsers(search);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [search, token]);

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full p-2 border rounded bg-gray-50 border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder="Search users..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        required={required}
        disabled={disabled}
      />
      {loading && <div className="absolute right-2 top-2 text-gray-400">Loading...</div>}
      {users.length > 0 && search && (
        <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-60 overflow-auto">
          {users.map((user) => (
            <li
              key={user.id}
              className="p-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => {
                onChange(user.id);
                setSelectedUser(user);
                setSearch(user.displayName || user.username);
                setUsers([]);
              }}
            >
              <div className="font-medium">{user.displayName || user.username}</div>
              <div className="text-xs text-gray-500">{user.email}</div>
            </li>
          ))}
        </ul>
      )}
      {value && !search && (
          <div className="mt-1 text-sm text-gray-600">Selected ID: {value}</div>
      )}
    </div>
  );
};
