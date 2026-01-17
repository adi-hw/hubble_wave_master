import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GeneratedDocumentation,
  DocumentationVersion,
  CollectionDefinition,
  DocArtifactType,
  DocContent,
} from '@hubblewave/instance-db';
import { LLMService } from '../llm.service';

const DOC_GENERATION_PROMPT = `You are a technical documentation writer for an enterprise platform.

Generate comprehensive, user-friendly documentation for the given artifact.

Your documentation should include:
1. A clear 1-2 sentence summary
2. Business purpose explaining why this exists
3. Property descriptions (if applicable)
4. Relationship explanations (if applicable)
5. API usage examples
6. Best practices and tips

Output ONLY valid JSON matching this structure:
{
  "summary": "Brief 1-2 sentence summary",
  "purpose": "Detailed business purpose explanation",
  "properties": [
    {
      "code": "property_code",
      "name": "Human Name",
      "type": "string",
      "description": "What this property stores and how it's used",
      "validValues": ["optional", "list", "of", "valid", "values"],
      "businessRules": ["optional list of business rules"]
    }
  ],
  "relationships": [
    {
      "direction": "incoming|outgoing",
      "relatedCollection": "collection_code",
      "relationship": "one-to-many|many-to-one|many-to-many",
      "viaProperty": "property_code"
    }
  ],
  "automationRules": [
    {
      "name": "Rule Name",
      "trigger": "on_create|on_update|on_delete",
      "description": "What this rule does",
      "affectedProperties": ["property1", "property2"]
    }
  ],
  "accessRules": [
    {
      "role": "Role Name",
      "permissions": ["read", "write", "delete"],
      "conditions": "optional conditions"
    }
  ],
  "apiExamples": {
    "list": "GET /api/collections/{code}/records",
    "get": "GET /api/collections/{code}/records/{id}",
    "create": "POST /api/collections/{code}/records",
    "update": "PUT /api/collections/{code}/records/{id}"
  }
}`;

@Injectable()
export class LivingDocsService {
  private readonly logger = new Logger(LivingDocsService.name);

  constructor(
    @InjectRepository(GeneratedDocumentation)
    private readonly docRepo: Repository<GeneratedDocumentation>,
    @InjectRepository(DocumentationVersion)
    private readonly versionRepo: Repository<DocumentationVersion>,
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>,
    private readonly llmService: LLMService,
  ) {}

  async generateForCollection(collectionId: string): Promise<GeneratedDocumentation> {
    const collection = await this.collectionRepo.findOneOrFail({
      where: { id: collectionId },
      relations: ['properties'],
    });

    const docContent = await this.generateCollectionDocs(collection);
    return this.saveDocumentation('collection', collectionId, collection.code, docContent);
  }

  async generateForArtifact(
    artifactType: DocArtifactType,
    artifactId: string,
    artifactCode: string,
    context: Record<string, unknown>,
  ): Promise<GeneratedDocumentation> {
    const docContent = await this.generateGenericDocs(artifactType, context);
    return this.saveDocumentation(artifactType, artifactId, artifactCode, docContent);
  }

  private async saveDocumentation(
    artifactType: DocArtifactType,
    artifactId: string,
    artifactCode: string | null,
    docContent: DocContent,
  ): Promise<GeneratedDocumentation> {
    let doc = await this.docRepo.findOne({
      where: { artifactType, artifactId },
    });

    if (doc) {
      await this.createVersion(doc);
      doc.documentation = docContent;
      doc.version += 1;
      doc.generatedAt = new Date();
      doc.searchText = this.buildSearchText(docContent);
    } else {
      doc = this.docRepo.create({
        artifactType,
        artifactId,
        artifactCode,
        documentation: docContent,
        searchText: this.buildSearchText(docContent),
      });
    }

    return this.docRepo.save(doc);
  }

  private async createVersion(doc: GeneratedDocumentation): Promise<DocumentationVersion> {
    const version = this.versionRepo.create({
      documentationId: doc.id,
      version: doc.version,
      content: doc.documentation,
      changeSummary: `Version ${doc.version} archived`,
    });
    return this.versionRepo.save(version);
  }

  private async generateCollectionDocs(collection: CollectionDefinition): Promise<DocContent> {
    const context = {
      name: collection.name,
      code: collection.code,
      description: collection.description,
      properties: collection.properties?.map(p => ({
        code: p.code,
        name: p.name,
        type: p.propertyType?.code ?? p.propertyTypeId,
        required: p.isRequired,
        unique: p.isUnique,
      })),
    };

    return this.generateGenericDocs('collection', context);
  }

  private async generateGenericDocs(
    artifactType: string,
    context: Record<string, unknown>,
  ): Promise<DocContent> {
    const response = await this.llmService.complete(
      `Generate documentation for this ${artifactType}:\n\n${JSON.stringify(context, null, 2)}`,
      DOC_GENERATION_PROMPT,
    );

    try {
      return JSON.parse(response);
    } catch {
      this.logger.warn(`Failed to parse documentation response for ${artifactType}`);
      return {
        summary: `Documentation for ${artifactType}`,
        purpose: 'Auto-generated documentation',
      };
    }
  }

  private buildSearchText(doc: DocContent): string {
    const parts = [doc.summary, doc.purpose];
    if (doc.properties) {
      parts.push(...doc.properties.map(p => `${p.name} ${p.description}`));
    }
    return parts.filter(Boolean).join(' ');
  }

  async getDocumentation(artifactType: DocArtifactType, artifactId: string): Promise<GeneratedDocumentation | null> {
    return this.docRepo.findOne({
      where: { artifactType, artifactId },
      relations: ['versions'],
    });
  }

  async getDocumentationByCode(artifactType: DocArtifactType, artifactCode: string): Promise<GeneratedDocumentation | null> {
    return this.docRepo.findOne({
      where: { artifactType, artifactCode },
      relations: ['versions'],
    });
  }

  async search(query: string, limit = 20): Promise<GeneratedDocumentation[]> {
    return this.docRepo
      .createQueryBuilder('doc')
      .where(`to_tsvector('english', doc.search_text) @@ plainto_tsquery('english', :query)`, { query })
      .orderBy('doc.generatedAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async regenerateAll(): Promise<number> {
    const collections = await this.collectionRepo.find();
    let count = 0;

    for (const collection of collections) {
      await this.generateForCollection(collection.id);
      count++;
    }

    return count;
  }

  async exportToMarkdown(artifactType: DocArtifactType, artifactId: string): Promise<string> {
    const doc = await this.docRepo.findOneOrFail({
      where: { artifactType, artifactId },
    });

    return this.convertToMarkdown(doc.documentation, doc.artifactCode);
  }

  private convertToMarkdown(doc: DocContent, title?: string | null): string {
    let md = `# ${title || doc.summary}\n\n`;
    md += `${doc.summary}\n\n`;
    md += `## Purpose\n\n${doc.purpose}\n\n`;

    if (doc.properties?.length) {
      md += `## Properties\n\n`;
      md += '| Property | Type | Description |\n';
      md += '|----------|------|-------------|\n';
      for (const prop of doc.properties) {
        md += `| ${prop.name} | ${prop.type} | ${prop.description} |\n`;
      }
      md += '\n';
    }

    if (doc.relationships?.length) {
      md += `## Relationships\n\n`;
      for (const rel of doc.relationships) {
        md += `- **${rel.direction === 'incoming' ? 'From' : 'To'} ${rel.relatedCollection}**: `;
        md += `${rel.relationship} via \`${rel.viaProperty}\`\n`;
      }
      md += '\n';
    }

    if (doc.automationRules?.length) {
      md += `## Automation Rules\n\n`;
      for (const rule of doc.automationRules) {
        md += `### ${rule.name}\n`;
        md += `- **Trigger:** ${rule.trigger}\n`;
        md += `- **Description:** ${rule.description}\n`;
        if (rule.affectedProperties?.length) {
          md += `- **Affects:** ${rule.affectedProperties.join(', ')}\n`;
        }
        md += '\n';
      }
    }

    if (doc.apiExamples) {
      md += `## API Examples\n\n`;
      md += `### List Records\n\`\`\`\n${doc.apiExamples.list}\n\`\`\`\n\n`;
      md += `### Get Record\n\`\`\`\n${doc.apiExamples.get}\n\`\`\`\n\n`;
      md += `### Create Record\n\`\`\`\n${doc.apiExamples.create}\n\`\`\`\n\n`;
      md += `### Update Record\n\`\`\`\n${doc.apiExamples.update}\n\`\`\`\n\n`;
    }

    return md;
  }

  async getVersionHistory(documentationId: string): Promise<DocumentationVersion[]> {
    return this.versionRepo.find({
      where: { documentationId },
      order: { version: 'DESC' },
    });
  }

  async deleteDocumentation(artifactType: DocArtifactType, artifactId: string): Promise<void> {
    await this.docRepo.delete({ artifactType, artifactId });
  }
}
