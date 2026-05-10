import { DbModule } from './db.module';
import { withAudit } from './index';

describe('DbModule barrel', () => {
  it('exports DbModule class', () => {
    expect(DbModule).toBeDefined();
  });

  it('re-exports withAudit transaction helper from libs/instance-db', () => {
    expect(withAudit).toBeDefined();
    expect(typeof withAudit).toBe('function');
  });
});
