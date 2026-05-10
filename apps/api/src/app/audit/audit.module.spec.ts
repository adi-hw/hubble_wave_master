import { AuditModule } from './audit.module';
import { RuntimeAnomalyService } from './index';

describe('AuditModule barrel', () => {
  it('exports AuditModule class', () => {
    expect(AuditModule).toBeDefined();
  });

  it('re-exports RuntimeAnomalyService from libs/instance-db', () => {
    expect(RuntimeAnomalyService).toBeDefined();
    expect(typeof RuntimeAnomalyService).toBe('function');
  });
});
