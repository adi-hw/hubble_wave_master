import axios from 'axios';
export type BreakGlassReasonCode = 'emergency' | 'audit' | 'legal' | 'security' | 'other';

export type BreakGlassStatus =
  | 'initiated'
  | 'mfa_pending'
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'expired'
  | 'revoked'
  | 'rejected'
  | 'cancelled';

export interface CollectionAccessRule {
  id: string;
  collectionId: string;
  code: string;
  name: string;
  description: string | null;
  principalType: string;
  principalId: string | null;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  condition: any | null;
  priority: number;
  stopProcessing: boolean;
  isActive: boolean;
  activeFrom: Date | null;
  activeUntil: Date | null;
  isSystem: boolean;
  inheritedFromId: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface PropertyAccessRule {
  id: string;
  propertyId: string;
  collectionId: string;
  code: string | null;
  name: string | null;
  principalType: string;
  principalId: string | null;
  canRead: boolean;
  canWrite: boolean;
  condition: any | null;
  maskValue: string | null;
  maskPattern: string | null;
  isPhi: boolean;
  phiAccessRequiresBreakGlass: boolean;
  priority: number;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BreakGlassSession {
  id: string;
  userId: string;
  userEmail: string | null;
  collectionId: string;
  collectionCode: string | null;
  recordId: string | null;
  reasonCode: BreakGlassReasonCode;
  justification: string;
  requiresApproval: boolean;
  approvedBy: string | null;
  approvedAt: Date | null;
  approvalNotes: string | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  grantedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedBy: string | null;
  revokeReason: string | null;
  mfaVerified: boolean;
  mfaMethod: string | null;
  mfaVerifiedAt: Date | null;
  status: BreakGlassStatus;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const API_URL = '/api/access';

// We might need to copy these types if we can't import directly from backend libs in frontend
// due to nx boundary constraints. For now assuming shared libs or re-defining interface.
export interface AccessCondition {
  property: string;
  operator: string;
  value: any;
}

export interface AccessConditionGroup {
  and?: (AccessCondition | AccessConditionGroup)[];
  or?: (AccessCondition | AccessConditionGroup)[];
}

export type PrincipalType = 'user' | 'team' | 'role' | 'organization';

export interface CreateRuleDto {
  collectionId: string;
  principalType: PrincipalType;
  principalId?: string; // Optional for 'everyone' logic if we supported it, but strictly we usually need ID
  canRead?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
  condition?: AccessCondition | AccessConditionGroup;
  priority?: number;
}

export interface AccessApi {
  // Rules
  getCollectionRules(collectionId: string): Promise<CollectionAccessRule[]>;
  createCollectionRule(collectionId: string, rule: CreateRuleDto): Promise<CollectionAccessRule>;
  updateCollectionRule(ruleId: string, updates: Partial<CreateRuleDto>): Promise<CollectionAccessRule>;
  deleteCollectionRule(ruleId: string): Promise<void>;

  // Break Glass
  requestBreakGlass(collectionId: string, reasonCode: string, justification: string, recordId?: string): Promise<BreakGlassSession>;
  checkBreakGlassSession(collectionId: string, recordId?: string): Promise<BreakGlassSession | null>;
}

class AccessApiClient implements AccessApi {
  async getCollectionRules(collectionId: string): Promise<CollectionAccessRule[]> {
    const response = await axios.get(`${API_URL}/collections/${collectionId}/rules`);
    return response.data;
  }

  async createCollectionRule(collectionId: string, rule: CreateRuleDto): Promise<CollectionAccessRule> {
    const response = await axios.post(`${API_URL}/collections/${collectionId}/rules`, rule);
    return response.data;
  }

  async updateCollectionRule(ruleId: string, updates: Partial<CreateRuleDto>): Promise<CollectionAccessRule> {
    const response = await axios.put(`${API_URL}/rules/${ruleId}`, updates);
    return response.data;
  }

  async deleteCollectionRule(ruleId: string): Promise<void> {
    await axios.delete(`${API_URL}/rules/${ruleId}`);
  }

  async requestBreakGlass(
    collectionId: string, 
    reasonCode: string, 
    justification: string, 
    recordId?: string
  ): Promise<BreakGlassSession> {
    const response = await axios.post(`${API_URL}/break-glass`, {
      collectionId,
      reasonCode,
      justification,
      recordId
    });
    return response.data;
  }

  async checkBreakGlassSession(collectionId: string, recordId?: string): Promise<BreakGlassSession | null> {
    const params = new URLSearchParams();
    if(recordId) params.append('recordId', recordId);
    
    try {
      const response = await axios.get(`${API_URL}/break-glass/${collectionId}/active`, { params });
      return response.data;
    } catch (e) {
      return null;
    }
  }
}

export const accessApi = new AccessApiClient();
