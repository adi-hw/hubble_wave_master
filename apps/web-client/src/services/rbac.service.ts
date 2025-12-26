import api from './api';

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
}

export interface Group {
  id: string;
  name: string;
  description?: string;
}

export const rbacService = {
  listRoles: async (): Promise<Role[]> => {
    const res = await api.get<Role[]>('/rbac/roles');
    return res.data;
  },
  createRole: async (body: { name: string; description?: string; permissions?: string[] }) => {
    const res = await api.post<Role>('/rbac/roles', body);
    return res.data;
  },
  listGroups: async (): Promise<Group[]> => {
    const res = await api.get<Group[]>('/rbac/groups');
    return res.data;
  },
  createGroup: async (body: { name: string; description?: string }) => {
    const res = await api.post<Group>('/rbac/groups', body);
    return res.data;
  },
  assignRoleToGroup: async (groupId: string, roleId: string) => {
    await api.post(`/rbac/groups/${groupId}/roles/${roleId}`);
  },
  addUserToGroup: async (groupId: string, userId: string) => {
    await api.post(`/rbac/groups/${groupId}/users/${userId}`);
  },
};
