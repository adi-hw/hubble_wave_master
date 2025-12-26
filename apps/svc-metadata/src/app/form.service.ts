import { Injectable } from '@nestjs/common';

@Injectable()
export class FormService {
  async listForms() {
    return [];
  }
  async createForm(input: any) {
    return { id: 'form', ...input };
  }

  async getForm(id: string) {
    return { id };
  }

  async publishDraft(formId: string, schema: any, createdBy?: string) {
    return { formId, schema, createdBy };
  }
}
