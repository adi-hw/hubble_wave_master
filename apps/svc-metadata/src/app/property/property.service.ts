import { Injectable } from '@nestjs/common';

export interface CreatePropertyDto {
  code: string;
  label?: string;
  dataType?: string;
  isRequired?: boolean;
}

export interface UpdatePropertyDto extends Partial<CreatePropertyDto> {}

@Injectable()
export class PropertyService {
  async listProperties(collectionId: string, options?: { includeSystem?: boolean }) {
    return {
      data: [],
      meta: { collectionId, includeSystem: !!options?.includeSystem },
    };
  }

  async getPropertyByCode(collectionId: string, code: string) {
    return { id: `${collectionId}-${code}`, collectionId, code, label: code } as any;
  }

  async isCodeAvailable(_collectionId: string, _code: string) {
    return true;
  }

  async getProperty(id: string): Promise<any> {
    return { id, code: 'placeholder', label: 'Placeholder' };
  }

  async createProperty(collectionId: string, dto: CreatePropertyDto, userId?: string, _audit?: any) {
    return { id: 'property-new', collectionId, createdBy: userId, ...dto };
  }

  async bulkCreateProperties(
    collectionId: string,
    properties: CreatePropertyDto[],
    userId?: string,
    _stopOnError?: boolean,
    _audit?: any,
  ) {
    return properties.map((p, index) => ({
      id: `property-${index}`,
      collectionId,
      createdBy: userId,
      ...p,
    }));
  }

  async reorderProperties(
    _collectionId: string,
    order: Array<{ id: string; displayOrder: number }>,
    _userId?: string,
    _audit?: any,
  ) {
    return { success: true, order };
  }

  async updateProperty(id: string, dto: UpdatePropertyDto, userId?: string, _audit?: any) {
    return { id, updatedBy: userId, ...dto };
  }

  async deleteProperty(id: string, _force?: boolean, _userId?: string, _audit?: any) {
    return { id, deleted: true };
  }
}
