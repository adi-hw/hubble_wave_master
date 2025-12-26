import aiApi from './aiApi';

export interface AvaMessageRequest {
  message: string;
  context?: Record<string, unknown>;
}

export interface AvaMessageResponse {
  message: string;
  conversationId?: string;
}

export const avaService = {
  async sendMessage(payload: AvaMessageRequest): Promise<AvaMessageResponse> {
    const res = await aiApi.post<AvaMessageResponse>('/ava/chat', payload);
    return res.data;
  },
};
