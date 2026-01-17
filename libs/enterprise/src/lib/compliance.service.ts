import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ComplianceFrameworkConfig,
  DataClassificationPolicy,
  DLPPolicy,
  DLPIncident,
  ConsentRecord,
  DataSubjectRequest,
  ComplianceFramework,
  DataClassificationLevel,
  EnforcementAction,
} from '@hubblewave/instance-db';

export interface ClassificationResult {
  level: DataClassificationLevel;
  matchedRules: Array<{
    ruleId: string;
    ruleName: string;
    reason: string;
  }>;
  action: EnforcementAction;
}

export interface DLPScanResult {
  passed: boolean;
  violations: Array<{
    policyId: string;
    policyName: string;
    ruleId: string;
    ruleName: string;
    matchedPatterns: string[];
    severity: string;
    action: EnforcementAction;
  }>;
  incidentIds: string[];
}

export interface ConsentStatus {
  purposeId: string;
  purposeName: string;
  hasConsent: boolean;
  consentGiven?: boolean;
  effectiveAt?: Date;
  expiresAt?: Date;
  method?: string;
}

@Injectable()
export class ComplianceService {

  // ============ Framework Management ============

  /**
   * Get all compliance frameworks
   */
  async getFrameworks(
    dataSource: DataSource
  ): Promise<ComplianceFrameworkConfig[]> {
    const repo = dataSource.getRepository(ComplianceFrameworkConfig);
    return repo.find({ order: { framework: 'ASC' } });
  }

  /**
   * Get enabled frameworks
   */
  async getEnabledFrameworks(
    dataSource: DataSource
  ): Promise<ComplianceFrameworkConfig[]> {
    const repo = dataSource.getRepository(ComplianceFrameworkConfig);
    return repo.find({ where: { isEnabled: true } });
  }

  /**
   * Enable/configure a compliance framework
   */
  async configureFramework(
    dataSource: DataSource,
    framework: ComplianceFramework,
    config: Partial<ComplianceFrameworkConfig>
  ): Promise<ComplianceFrameworkConfig> {
    const repo = dataSource.getRepository(ComplianceFrameworkConfig);
    let existing = await repo.findOne({ where: { framework } });

    if (existing) {
      await repo.update(existing.id, config);
      return repo.findOneOrFail({ where: { id: existing.id } });
    }

    const newConfig = repo.create({
      framework,
      name: this.getFrameworkName(framework),
      ...config,
    });
    return repo.save(newConfig);
  }

  // ============ Data Classification ============

  /**
   * Classify data based on policies
   */
  async classifyData(
    dataSource: DataSource,
    context: {
      collectionCode?: string;
      propertyName?: string;
      value?: string;
      dataType?: string;
      tags?: string[];
    }
  ): Promise<ClassificationResult> {
    const repo = dataSource.getRepository(DataClassificationPolicy);
    const policies = await repo.find({
      where: { status: 'active' },
      order: { priority: 'DESC' },
    });

    let highestLevel: DataClassificationLevel = 'public';
    const matchedRules: ClassificationResult['matchedRules'] = [];
    let action: EnforcementAction = 'log';

    for (const policy of policies) {
      for (const rule of policy.rules) {
        let matches = false;
        let reason = '';

        // Check collection patterns
        if (rule.conditions.collectionPatterns?.length && context.collectionCode) {
          for (const pattern of rule.conditions.collectionPatterns) {
            if (new RegExp(pattern, 'i').test(context.collectionCode)) {
              matches = true;
              reason = `Collection matches pattern: ${pattern}`;
              break;
            }
          }
        }

        // Check property patterns
        if (rule.conditions.fieldPatterns?.length && context.propertyName) {
          for (const pattern of rule.conditions.fieldPatterns) {
            if (new RegExp(pattern, 'i').test(context.propertyName)) {
              matches = true;
              reason = `Property matches pattern: ${pattern}`;
              break;
            }
          }
        }

        // Check value patterns
        if (rule.conditions.valuePatterns?.length && context.value) {
          for (const pattern of rule.conditions.valuePatterns) {
            if (new RegExp(pattern, 'i').test(context.value)) {
              matches = true;
              reason = `Value matches pattern: ${pattern}`;
              break;
            }
          }
        }

        // Check data types
        if (rule.conditions.dataTypes?.length && context.dataType) {
          if (rule.conditions.dataTypes.includes(context.dataType)) {
            matches = true;
            reason = `Data type: ${context.dataType}`;
          }
        }

        // Check tags
        if (rule.conditions.tags?.length && context.tags?.length) {
          const matchingTags = rule.conditions.tags.filter((t) =>
            context.tags?.includes(t)
          );
          if (matchingTags.length > 0) {
            matches = true;
            reason = `Tags: ${matchingTags.join(', ')}`;
          }
        }

        if (matches) {
          matchedRules.push({
            ruleId: rule.id,
            ruleName: rule.name,
            reason,
          });

          // Update highest classification level
          if (this.compareClassificationLevel(rule.classificationLevel, highestLevel) > 0) {
            highestLevel = rule.classificationLevel;
            action = rule.action;
          }
        }
      }
    }

    return {
      level: highestLevel,
      matchedRules,
      action,
    };
  }

  // ============ DLP ============

  /**
   * Scan content against DLP policies
   */
  async scanContent(
    dataSource: DataSource,
    content: string,
    context: {
      userId?: string;
      userEmail?: string;
      contentType: string;
      resourceType?: string;
      resourceId?: string;
      resourceName?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<DLPScanResult> {
    const repo = dataSource.getRepository(DLPPolicy);
    const policies = await repo.find({
      where: { status: 'active' },
      order: { priority: 'DESC' },
    });

    const violations: DLPScanResult['violations'] = [];
    const incidentIds: string[] = [];

    for (const policy of policies) {
      // Check if content type is in scope
      if (!policy.contentTypes.includes(context.contentType)) {
        continue;
      }

      // Check target collections
      if (
        policy.targetCollections?.length &&
        context.resourceType &&
        !policy.targetCollections.includes(context.resourceType)
      ) {
        continue;
      }

      // Check excluded users
      if (context.userId && policy.excludedUsers?.includes(context.userId)) {
        continue;
      }

      // Run detection rules
      for (const rule of policy.detectionRules) {
        const matches = this.runDetectionRule(rule, content);

        if (matches.length > 0) {
          violations.push({
            policyId: policy.id,
            policyName: policy.name,
            ruleId: rule.id,
            ruleName: rule.name,
            matchedPatterns: matches,
            severity: this.determineSeverity(policy, matches.length),
            action: policy.primaryAction,
          });

          // Create incident
          if (policy.primaryAction !== 'log') {
            const incident = await this.createIncident(dataSource, {
              policyId: policy.id,
              policyName: policy.name,
              severity: this.determineSeverity(policy, matches.length),
              userId: context.userId,
              userEmail: context.userEmail,
              action: context.contentType,
              resourceType: context.resourceType,
              resourceId: context.resourceId,
              resourceName: context.resourceName,
              detectionDetails: {
                ruleId: rule.id,
                ruleName: rule.name,
                matchedPatterns: matches,
                sampleContent: this.redactSample(content, matches),
              },
              actionTaken: policy.primaryAction,
              wasBlocked: policy.primaryAction === 'block',
              ipAddress: context.ipAddress,
              userAgent: context.userAgent,
            });
            incidentIds.push(incident.id);
          }
        }
      }
    }

    return {
      passed: violations.filter((v) => v.action === 'block').length === 0,
      violations,
      incidentIds,
    };
  }

  /**
   * Create DLP incident
   */
  private async createIncident(
    dataSource: DataSource,
    data: Partial<DLPIncident>
  ): Promise<DLPIncident> {
    const repo = dataSource.getRepository(DLPIncident);
    const incident = repo.create(data);
    return repo.save(incident);
  }

  /**
   * Get DLP incidents
   */
  async getIncidents(
    dataSource: DataSource,
    options: {
      status?: string[];
      severity?: string[];
      policyId?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ incidents: DLPIncident[]; total: number }> {
    const repo = dataSource.getRepository(DLPIncident);
    const qb = repo.createQueryBuilder('incident');

    if (options.status?.length) {
      qb.andWhere('incident.status IN (:...status)', { status: options.status });
    }

    if (options.severity?.length) {
      qb.andWhere('incident.severity IN (:...severity)', {
        severity: options.severity,
      });
    }

    if (options.policyId) {
      qb.andWhere('incident.policyId = :policyId', {
        policyId: options.policyId,
      });
    }

    if (options.userId) {
      qb.andWhere('incident.userId = :userId', { userId: options.userId });
    }

    if (options.startDate) {
      qb.andWhere('incident.createdAt >= :startDate', {
        startDate: options.startDate,
      });
    }

    if (options.endDate) {
      qb.andWhere('incident.createdAt <= :endDate', {
        endDate: options.endDate,
      });
    }

    qb.orderBy('incident.createdAt', 'DESC');

    const total = await qb.getCount();

    if (options.offset) qb.skip(options.offset);
    if (options.limit) qb.take(options.limit);

    const incidents = await qb.getMany();
    return { incidents, total };
  }

  // ============ Consent Management ============

  /**
   * Record user consent
   */
  async recordConsent(
    dataSource: DataSource,
    data: {
      userId: string;
      userEmail?: string;
      purposeId: string;
      purposeName: string;
      purposeDescription?: string;
      consentGiven: boolean;
      consentMethod: string;
      consentSource: string;
      consentText?: string;
      consentVersion?: string;
      expiresAt?: Date;
      legalBasis?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<ConsentRecord> {
    const repo = dataSource.getRepository(ConsentRecord);

    // Check for existing consent for this purpose
    const existing = await repo.findOne({
      where: { userId: data.userId, purposeId: data.purposeId },
    });

    if (existing) {
      // Update existing consent
      await repo.update(existing.id, {
        consentGiven: data.consentGiven,
        consentMethod: data.consentMethod,
        consentSource: data.consentSource,
        consentText: data.consentText,
        consentVersion: data.consentVersion,
        effectiveAt: new Date(),
        expiresAt: data.expiresAt,
        withdrawnAt: data.consentGiven ? undefined : new Date(),
        withdrawalReason: data.consentGiven ? undefined : 'User opted out',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });
      return repo.findOneOrFail({ where: { id: existing.id } });
    }

    const record = repo.create({
      ...data,
      effectiveAt: new Date(),
    });
    return repo.save(record);
  }

  /**
   * Get consent status for a user
   */
  async getConsentStatus(
    dataSource: DataSource,
    userId: string,
    purposeIds?: string[]
  ): Promise<ConsentStatus[]> {
    const repo = dataSource.getRepository(ConsentRecord);
    const qb = repo.createQueryBuilder('consent');

    qb.where('consent.userId = :userId', { userId });

    if (purposeIds?.length) {
      qb.andWhere('consent.purposeId IN (:...purposeIds)', { purposeIds });
    }

    const records = await qb.getMany();

    return records.map((r) => ({
      purposeId: r.purposeId,
      purposeName: r.purposeName,
      hasConsent: r.consentGiven && (!r.expiresAt || r.expiresAt > new Date()),
      consentGiven: r.consentGiven,
      effectiveAt: r.effectiveAt,
      expiresAt: r.expiresAt ?? undefined,
      method: r.consentMethod,
    }));
  }

  /**
   * Withdraw consent
   */
  async withdrawConsent(
    dataSource: DataSource,
    userId: string,
    purposeId: string,
    reason?: string
  ): Promise<void> {
    const repo = dataSource.getRepository(ConsentRecord);
    await repo.update(
      { userId, purposeId },
      {
        consentGiven: false,
        withdrawnAt: new Date(),
        withdrawalReason: reason,
      }
    );
  }

  // ============ Data Subject Requests ============

  /**
   * Create a data subject request
   */
  async createDSR(
    dataSource: DataSource,
    data: {
      subjectEmail: string;
      subjectName?: string;
      userId?: string;
      requestType: DataSubjectRequest['requestType'];
      description?: string;
    }
  ): Promise<DataSubjectRequest> {
    const repo = dataSource.getRepository(DataSubjectRequest);

    // Generate request number
    const count = await repo.count();
    const requestNumber = `DSR-${Date.now().toString(36).toUpperCase()}-${(count + 1)
      .toString()
      .padStart(4, '0')}`;

    // Calculate due date (30 days for GDPR)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const request = repo.create({
      requestNumber,
      subjectEmail: data.subjectEmail,
      subjectName: data.subjectName,
      userId: data.userId,
      requestType: data.requestType,
      description: data.description,
      status: 'pending',
      dueDate,
      history: [
        {
          action: 'created',
          timestamp: new Date().toISOString(),
          notes: 'Request submitted',
        },
      ],
    });

    return repo.save(request);
  }

  /**
   * Update DSR status
   */
  async updateDSRStatus(
    dataSource: DataSource,
    requestId: string,
    status: DataSubjectRequest['status'],
    userId?: string,
    notes?: string
  ): Promise<DataSubjectRequest> {
    const repo = dataSource.getRepository(DataSubjectRequest);
    const request = await repo.findOneOrFail({ where: { id: requestId } });

    request.status = status;
    request.history.push({
      action: `status_changed_to_${status}`,
      timestamp: new Date().toISOString(),
      userId,
      notes,
    });

    if (status === 'completed') {
      request.completedAt = new Date();
    }

    return repo.save(request);
  }

  /**
   * Get DSR list
   */
  async getDSRs(
    dataSource: DataSource,
    options: {
      status?: string[];
      requestType?: string[];
      subjectEmail?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ requests: DataSubjectRequest[]; total: number }> {
    const repo = dataSource.getRepository(DataSubjectRequest);
    const qb = repo.createQueryBuilder('dsr');

    if (options.status?.length) {
      qb.andWhere('dsr.status IN (:...status)', { status: options.status });
    }

    if (options.requestType?.length) {
      qb.andWhere('dsr.requestType IN (:...requestType)', {
        requestType: options.requestType,
      });
    }

    if (options.subjectEmail) {
      qb.andWhere('dsr.subjectEmail = :email', { email: options.subjectEmail });
    }

    qb.orderBy('dsr.createdAt', 'DESC');

    const total = await qb.getCount();

    if (options.offset) qb.skip(options.offset);
    if (options.limit) qb.take(options.limit);

    const requests = await qb.getMany();
    return { requests, total };
  }

  // ============ Helper Methods ============

  private getFrameworkName(framework: ComplianceFramework): string {
    const names: Record<ComplianceFramework, string> = {
      gdpr: 'General Data Protection Regulation (GDPR)',
      hipaa: 'Health Insurance Portability and Accountability Act (HIPAA)',
      sox: 'Sarbanes-Oxley Act (SOX)',
      pci_dss: 'Payment Card Industry Data Security Standard (PCI DSS)',
      iso_27001: 'ISO/IEC 27001 Information Security',
      nist: 'NIST Cybersecurity Framework',
      fedramp: 'Federal Risk and Authorization Management Program (FedRAMP)',
      ccpa: 'California Consumer Privacy Act (CCPA)',
      custom: 'Custom Framework',
    };
    return names[framework] || framework;
  }

  private compareClassificationLevel(
    a: DataClassificationLevel,
    b: DataClassificationLevel
  ): number {
    const order: DataClassificationLevel[] = [
      'public',
      'internal',
      'confidential',
      'restricted',
      'top_secret',
    ];
    return order.indexOf(a) - order.indexOf(b);
  }

  private runDetectionRule(
    rule: DLPPolicy['detectionRules'][0],
    content: string
  ): string[] {
    const matches: string[] = [];

    if (rule.type === 'pattern' && rule.config.patterns) {
      for (const pattern of rule.config.patterns) {
        const regex = new RegExp(pattern, 'gi');
        const found = content.match(regex);
        if (found) {
          matches.push(...found.slice(0, 3)); // Limit matches
        }
      }
    }

    if (rule.type === 'keyword' && rule.config.keywords) {
      for (const keyword of rule.config.keywords) {
        if (content.toLowerCase().includes(keyword.toLowerCase())) {
          matches.push(keyword);
        }
      }
    }

    return matches;
  }

  private determineSeverity(
    _policy: DLPPolicy,
    matchCount: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (matchCount >= 10) return 'critical';
    if (matchCount >= 5) return 'high';
    if (matchCount >= 2) return 'medium';
    return 'low';
  }

  private redactSample(content: string, matches: string[]): string {
    let sample = content.substring(0, 200);
    for (const match of matches) {
      sample = sample.replace(new RegExp(match, 'gi'), '[REDACTED]');
    }
    return sample + (content.length > 200 ? '...' : '');
  }
}
