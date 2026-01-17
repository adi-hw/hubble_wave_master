import { Injectable } from '@nestjs/common';

/**
 * Model registry service providing collection metadata for build-time compatibility.
 * Returns lightweight metadata structures for schema-driven operations.
 */
@Injectable()
export class ModelRegistryService {
  async getCollection(collectionCode: string): Promise<{
    collectionCode: string;
    label: string;
    storageTable: string;
    storageSchema: string;
    category: string;
    isSystem: boolean;
  }> {
    return {
      collectionCode,
      label: this.formatName(collectionCode),
      storageTable: collectionCode,
      storageSchema: 'public',
      category: 'application',
      isSystem: false,
    };
  }

  async getProperties(collectionCode: string, _roles?: string[]): Promise<any[]> {
    return [
      {
        code: 'id',
        label: 'ID',
        type: 'uuid',
        backendType: 'uuid',
        uiWidget: 'text',
        storagePath: `column:${collectionCode}.id`,
        nullable: false,
        isUnique: true,
        defaultValue: null,
        config: {},
        validators: {},
        isInternal: false,
        isSystem: true,
        showInForms: false,
        showInLists: false,
        displayOrder: 0,
      },
    ];
  }

  async getLayout(_collectionCode: string): Promise<any> {
    return {};
  }

  clearCache() {
    // Cache clearing is handled at the repository level
  }

  private formatName(value: string): string {
    return value
      .replace(/^app_/, '')
      .split('_')
      .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ''))
      .join(' ')
      .trim();
  }
}
