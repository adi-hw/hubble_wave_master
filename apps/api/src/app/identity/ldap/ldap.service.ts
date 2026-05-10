import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'ldapts';
import { LdapConfig } from '@hubblewave/instance-db';
import { escapeLdapFilter } from './ldap-filter-escape';

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

      // 2. Search for user with username filter.
      //
      // F011 (W1 task 4): the username MUST be RFC 4515-escaped before
      // interpolation. Without escaping, a username like `*)(uid=*`
      // turns the filter into `(uid=*)(uid=*)` — a compound filter
      // that matches every entry, bypassing the user lookup. After
      // escape, the same input becomes `(uid=\2a\29\28uid=\2a)` —
      // a single literal-string assertion that finds nothing.
      const safeUsername = escapeLdapFilter(username);
      let filter = config.userSearchFilter || `(uid=${safeUsername})`;
      if (filter.includes('{username}')) {
        filter = filter.replace('{username}', safeUsername);
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
