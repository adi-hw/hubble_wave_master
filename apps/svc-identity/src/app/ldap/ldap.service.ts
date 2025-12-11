import { Injectable } from '@nestjs/common';
import { Client } from 'ldapts';
import { LdapConfig } from '@eam-platform/platform-db';

export interface LdapUser {
  username: string;
  email: string;
  displayName: string;
}

@Injectable()
export class LdapService {
  /**
   * Test LDAP connection using bind credentials
   */
  async testConnection(config: LdapConfig): Promise<boolean> {
    const client = new Client({ url: config.host, timeout: config.timeoutMs });
    
    try {
      await client.bind(config.bindDn, config.bindPassword);
      await client.unbind();
      return true;
    } catch (error) {
      console.error('LDAP connection test failed:', error);
      return false;
    }
  }

  /**
   * Authenticate user against LDAP directory
   */
  async authenticate(
    config: LdapConfig,
    username: string,
    password: string
  ): Promise<LdapUser> {
    const client = new Client({ url: config.host, timeout: config.timeoutMs });

    try {
      // 1. Bind as service account to search for user
      await client.bind(config.bindDn, config.bindPassword);

      // 2. Search for user with username filter
      const filter = config.userFilter.replace('{username}', username);
      const { searchEntries } = await client.search(config.userBaseDn, {
        scope: 'sub',
        filter,
      });

      if (searchEntries.length !== 1) {
        throw new Error('User not found or not unique in LDAP');
      }

      const userEntry = searchEntries[0];
      const userDn = userEntry.dn as string;

      // 3. Attempt user bind with provided password
      await client.bind(userDn, password);

      // 4. Extract user attributes
      const ldapUser: LdapUser = {
        username: String(userEntry[config.mapUsernameAttr] || username),
        email: String(userEntry[config.mapEmailAttr] || ''),
        displayName: String(userEntry[config.mapDisplayNameAttr] || username),
      };

      await client.unbind();
      return ldapUser;
    } catch (error) {
      console.error('LDAP authentication failed:', error);
      throw new Error('LDAP authentication failed');
    }
  }
}
