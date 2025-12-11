import api from './api';

export type ConfigScope = 'system' | 'tenant' | 'app';
export type ConfigType = 'string' | 'boolean' | 'number' | 'json' | 'list';

export interface ConfigSetting {
  id: string;
  scope: ConfigScope;
  tenantId: string | null;
  category: string;
  key: string;
  type: ConfigType;
  value: any;
  version: number;
}

export const configSettingsService = {
  list: async (scope: ConfigScope): Promise<ConfigSetting[]> => {
    const res = await api.get<ConfigSetting[]>(`/config/${scope}`);
    return res.data;
  },
  set: async (scope: ConfigScope, body: { key: string; value: any; category: string; type: ConfigType }) => {
    const res = await api.post<ConfigSetting>(`/config/${scope}`, body);
    return res.data;
  },
};
