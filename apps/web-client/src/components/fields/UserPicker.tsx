import React, { useState, useEffect } from 'react';
import { useAuth } from '../../auth/AuthContext';

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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    if (value && !selectedUser) {
      // Fetch initial user if value is present but no user selected
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
        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-muted border-border min-h-[44px]"
        placeholder="Search users..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        required={required}
        disabled={disabled}
        role="combobox"
        aria-label="Search for users"
        aria-expanded={users.length > 0 && search ? true : false}
        aria-autocomplete="list"
        aria-controls="user-list"
      />
      {loading && (
        <div className="absolute right-2 top-2 text-muted-foreground">
          Loading...
        </div>
      )}
      {users.length > 0 && search && (
        <ul
          id="user-list"
          className="absolute z-10 w-full mt-1 border rounded shadow-lg max-h-60 overflow-auto bg-card border-border"
          role="listbox"
        >
          {users.map((user, index) => (
            <li
              key={user.id}
              className={`p-2 cursor-pointer min-h-[44px] flex flex-col justify-center ${hoveredIndex === index ? 'bg-accent' : 'bg-transparent'}`}
              onClick={() => {
                onChange(user.id);
                setSelectedUser(user);
                setSearch(user.displayName || user.username);
                setUsers([]);
              }}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              role="option"
              aria-selected={value === user.id}
            >
              <div className="font-medium">{user.displayName || user.username}</div>
              <div className="text-xs text-muted-foreground">
                {user.email}
              </div>
            </li>
          ))}
        </ul>
      )}
      {value && !search && (
          <div className="mt-1 text-sm text-muted-foreground">
            Selected ID: {value}
          </div>
      )}
    </div>
  );
};
