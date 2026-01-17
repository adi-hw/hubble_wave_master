import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'ldapts';
import { LdapConfig } from '@hubblewave/instance-db';

export interface LdapUser {
  username: string;
  email: string;
  displayName: string;
}

@Injectable()
export class LdapService {
  private readonly logger = new Logger(LdapService.name);
  /**
   * Test LDAP connection using bind credentials
   */
  async testConnection(config: LdapConfig): Promise<boolean> {
    const url = `${config.secure ? 'ldaps' : 'ldap'}://${config.host}:${config.port}`;
    const client = new Client({ url, timeout: 5000 }); // Default 5s timeout
    
    try {
      if (config.bindDn && config.bindPassword) {
        await client.bind(config.bindDn, config.bindPassword);
      }
      await client.unbind();
      return true;
    } catch (error) {
      this.logger.error('LDAP connection test failed', error);
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
    const url = `${config.secure ? 'ldaps' : 'ldap'}://${config.host}:${config.port}`;
    const client = new Client({ url, timeout: 5000 });

    try {
      // 1. Bind as service account to search for user
      if (config.bindDn && config.bindPassword) {
        await client.bind(config.bindDn, config.bindPassword);
      }

      // 2. Search for user with username filter
      // Replace {username} placeholder if present, otherwise assume it's just the filter string
      let filter = config.userSearchFilter || `(uid=${username})`;
      if (filter.includes('{username}')) {
        filter = filter.replace('{username}', username);
      }

      const { searchEntries } = await client.search(config.searchBase, {
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
        username: String(userEntry[config.usernameAttribute || 'uid'] || username),
        email: String(userEntry[config.emailAttribute || 'mail'] || ''),
        displayName: String(userEntry[config.fullNameAttribute || 'cn'] || username),
      };

      await client.unbind();
      return ldapUser;
    } catch (error) {
      this.logger.error('LDAP authentication failed', error);
      throw new Error('LDAP authentication failed');
    }
  }
}
