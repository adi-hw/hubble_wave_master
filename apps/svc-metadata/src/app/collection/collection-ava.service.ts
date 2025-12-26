/**
 * Sprint 1.1: Collections — AVA Integration Service
 *
 * This service provides AI-powered assistance for collection management:
 * - Suggesting collection names, codes, icons based on user input
 * - Analyzing imported files to detect schema structure
 * - Finding similar existing collections to prevent duplicates
 * - Answering natural language questions about collections
 *
 * AVA integration points:
 * 1. Collection naming suggestions (real-time as user types)
 * 2. Import analysis (when user uploads CSV/Excel/JSON)
 * 3. Schema design assistance (conversational)
 * 4. Duplicate detection (proactive warnings)
 *
 * @module CollectionAvaService
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { CollectionDefinition } from '@hubblewave/instance-db';

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Suggestion for a single field when naming a collection.
 */
export interface FieldSuggestion {
  field: string;
  value: string | number | boolean;
  confidence: number; // 0-1
  explanation?: string;
}

/**
 * Result of analyzing a collection name input.
 */
export interface NamingSuggestionResult {
  suggestions: FieldSuggestion[];
  similarCollections: Array<{
    id: string;
    code: string;
    label: string;
    matchScore: number;
  }>;
  warnings: string[];
}

/**
 * Detected property from import analysis.
 */
export interface DetectedProperty {
  sourceColumn: string;
  suggestedCode: string;
  suggestedLabel: string;
  suggestedType: PropertyType;
  nullable: boolean;
  unique: boolean;
  sampleValues: string[];
  confidence: number;
  referenceCandidate?: {
    collectionCode: string;
    collectionLabel: string;
    matchScore: number;
  };
}

/**
 * Supported property types for detection.
 */
export type PropertyType =
  | 'text'
  | 'longtext'
  | 'number'
  | 'decimal'
  | 'currency'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'time'
  | 'email'
  | 'url'
  | 'phone'
  | 'choice'
  | 'reference'
  | 'json';

/**
 * Result of analyzing an import file.
 */
export interface ImportAnalysisResult {
  suggestedName: string;
  suggestedCode: string;
  rowCount: number;
  columnCount: number;
  properties: DetectedProperty[];
  warnings: string[];
  avaInsights: string; // Natural language summary
}

/**
 * Parsed row from import file.
 */
interface ParsedRow {
  [key: string]: string | number | boolean | null;
}

// ============================================================================
// Icon & Color Mappings
// ============================================================================

/**
 * Keyword to icon mappings for intelligent icon suggestions.
 * These are common patterns based on collection semantics.
 */
const ICON_MAPPINGS: Record<string, string[]> = {
  Building: [
    'vendor',
    'supplier',
    'company',
    'organization',
    'office',
    'branch',
    'location',
    'building',
  ],
  Users: ['user', 'employee', 'staff', 'team', 'member', 'person', 'people', 'contact'],
  Package: ['asset', 'equipment', 'inventory', 'stock', 'item', 'product', 'part'],
  FileText: ['document', 'file', 'report', 'contract', 'agreement', 'form', 'record'],
  Briefcase: ['project', 'portfolio', 'case', 'engagement', 'deal', 'opportunity'],
  Calendar: ['event', 'schedule', 'appointment', 'meeting', 'booking', 'reservation'],
  ShoppingCart: ['order', 'purchase', 'sale', 'transaction', 'invoice', 'receipt'],
  Wrench: ['maintenance', 'repair', 'service', 'work', 'task', 'job', 'ticket'],
  Shield: ['security', 'access', 'permission', 'policy', 'compliance', 'audit'],
  Truck: ['shipment', 'delivery', 'logistics', 'transport', 'fleet', 'vehicle'],
  Mail: ['email', 'message', 'notification', 'communication', 'correspondence'],
  DollarSign: ['payment', 'expense', 'budget', 'cost', 'price', 'fee', 'charge'],
  Heart: ['health', 'patient', 'medical', 'clinical', 'care', 'treatment'],
  GraduationCap: ['training', 'course', 'certification', 'education', 'learning'],
  AlertTriangle: ['incident', 'issue', 'problem', 'alert', 'warning', 'risk'],
  CheckSquare: ['checklist', 'inspection', 'audit', 'review', 'assessment'],
  Clock: ['timesheet', 'time', 'duration', 'period', 'shift', 'hours'],
  Map: ['location', 'site', 'region', 'area', 'zone', 'territory'],
  Tag: ['category', 'tag', 'label', 'type', 'classification'],
  Settings: ['configuration', 'setting', 'preference', 'option', 'parameter'],
};

/**
 * Category to color mappings for visual consistency.
 */
const COLOR_MAPPINGS: Record<string, string> = {
  Core: '#7c3aed', // Violet (primary)
  Custom: '#14b8a6', // Teal (accent)
  Procurement: '#8b5cf6', // Purple
  Finance: '#22c55e', // Green
  HR: '#f59e0b', // Amber
  Operations: '#3b82f6', // Blue
  Security: '#ef4444', // Red
  default: '#64748b', // Slate
};

/**
 * Common category keywords for classification.
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Core: ['user', 'role', 'permission', 'setting', 'configuration'],
  Procurement: ['vendor', 'supplier', 'purchase', 'contract', 'procurement'],
  Finance: ['invoice', 'payment', 'expense', 'budget', 'cost', 'price'],
  HR: ['employee', 'staff', 'training', 'timesheet', 'leave', 'payroll'],
  Operations: ['asset', 'equipment', 'maintenance', 'work', 'task', 'schedule'],
  Security: ['incident', 'audit', 'compliance', 'risk', 'access'],
};

// ============================================================================
// Service Implementation
// ============================================================================

@Injectable()
export class CollectionAvaService {
  private readonly logger = new Logger(CollectionAvaService.name);

  constructor(
    @InjectRepository(CollectionDefinition)
    private readonly collectionRepo: Repository<CollectionDefinition>
  ) {}

  // --------------------------------------------------------------------------
  // Naming Suggestions
  // --------------------------------------------------------------------------

  /**
   * Generate intelligent suggestions based on collection name input.
   *
   * This is called in real-time as the user types in the name field.
   * We debounce on the frontend (500ms) to avoid excessive calls.
   *
   * @param input - The user's input (e.g., "Vendors", "Customer Orders")
   * @returns Suggestions for code, plural, icon, color, category + warnings
   */
  async suggestFromName(input: string): Promise<NamingSuggestionResult> {
    if (!input || input.trim().length < 2) {
      return { suggestions: [], similarCollections: [], warnings: [] };
    }

    const normalizedInput = input.trim();
    const lowerInput = normalizedInput.toLowerCase();
    const words = lowerInput.split(/[\s_-]+/);

    const suggestions: FieldSuggestion[] = [];
    const warnings: string[] = [];

    // 1. Suggest code (convert to snake_case, lowercase)
    const suggestedCode = this.generateCode(normalizedInput);
    suggestions.push({
      field: 'code',
      value: suggestedCode,
      confidence: 0.95,
      explanation: 'Generated from collection name',
    });

    // 2. Suggest plural (simple English pluralization)
    const suggestedPlural = this.pluralize(normalizedInput);
    suggestions.push({
      field: 'labelPlural',
      value: suggestedPlural,
      confidence: this.isPluralConfident(normalizedInput) ? 0.95 : 0.75,
      explanation: 'Auto-pluralized from name',
    });

    // 3. Suggest icon based on keywords
    const iconSuggestion = this.suggestIcon(words);
    suggestions.push({
      field: 'icon',
      value: iconSuggestion.icon,
      confidence: iconSuggestion.confidence,
      explanation: iconSuggestion.reason,
    });

    // 4. Suggest category based on keywords
    const categorySuggestion = this.suggestCategory(words);
    if (categorySuggestion) {
      suggestions.push({
        field: 'category',
        value: categorySuggestion.category,
        confidence: categorySuggestion.confidence,
        explanation: `Matches ${categorySuggestion.category} patterns`,
      });

      // 5. Suggest color based on category
      const color = COLOR_MAPPINGS[categorySuggestion.category] || COLOR_MAPPINGS.default;
      suggestions.push({
        field: 'color',
        value: color,
        confidence: categorySuggestion.confidence * 0.9,
        explanation: `Default color for ${categorySuggestion.category}`,
      });
    } else {
      // Default color
      suggestions.push({
        field: 'color',
        value: COLOR_MAPPINGS.default,
        confidence: 0.6,
        explanation: 'Default color',
      });
    }

    // 6. Find similar existing collections
    const similarCollections = await this.findSimilarCollections(normalizedInput, words);

    // Add warnings for potential issues
    if (similarCollections.length > 0 && similarCollections[0].matchScore > 0.8) {
      warnings.push(
        `A very similar collection "${similarCollections[0].label}" already exists. ` +
          `Consider using the existing collection or choosing a more distinct name.`
      );
    }

    // Check for reserved words
    const reserved = ['system', 'admin', 'user', 'collection', 'property'];
    if (reserved.includes(suggestedCode)) {
      warnings.push(`The code "${suggestedCode}" is reserved. Please choose a different name.`);
    }

    return { suggestions, similarCollections, warnings };
  }

  /**
   * Generate a valid code from a collection name.
   * Converts "Customer Orders" → "customer_order"
   */
  private generateCode(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .trim()
      .replace(/\s+/g, '_') // Spaces to underscores
      .replace(/_+/g, '_') // Collapse multiple underscores
      .replace(/s$/, '') // Remove trailing 's' (de-pluralize)
      .substring(0, 50); // Limit length
  }

  /**
   * Simple English pluralization.
   */
  private pluralize(word: string): string {
    const trimmed = word.trim();

    // Already plural
    if (trimmed.endsWith('s') && !trimmed.endsWith('ss')) {
      return trimmed;
    }

    // Special cases
    if (trimmed.endsWith('y') && !this.isVowel(trimmed.charAt(trimmed.length - 2))) {
      return trimmed.slice(0, -1) + 'ies';
    }
    if (
      trimmed.endsWith('s') ||
      trimmed.endsWith('x') ||
      trimmed.endsWith('ch') ||
      trimmed.endsWith('sh')
    ) {
      return trimmed + 'es';
    }

    return trimmed + 's';
  }

  private isVowel(char: string): boolean {
    return ['a', 'e', 'i', 'o', 'u'].includes(char.toLowerCase());
  }

  private isPluralConfident(word: string): boolean {
    // Some words are harder to pluralize correctly
    const irregulars = ['person', 'child', 'foot', 'tooth', 'mouse', 'man', 'woman'];
    return !irregulars.some((i) => word.toLowerCase().includes(i));
  }

  /**
   * Suggest an icon based on collection name keywords.
   */
  private suggestIcon(words: string[]): { icon: string; confidence: number; reason: string } {
    for (const [icon, keywords] of Object.entries(ICON_MAPPINGS)) {
      for (const keyword of keywords) {
        if (words.some((w) => w.includes(keyword) || keyword.includes(w))) {
          return {
            icon,
            confidence: 0.85,
            reason: `Matches keyword "${keyword}"`,
          };
        }
      }
    }

    return {
      icon: 'Layers',
      confidence: 0.5,
      reason: 'Default icon (no keyword match)',
    };
  }

  /**
   * Suggest a category based on collection name keywords.
   */
  private suggestCategory(words: string[]): { category: string; confidence: number } | null {
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      for (const keyword of keywords) {
        if (words.some((w) => w.includes(keyword) || keyword.includes(w))) {
          return { category, confidence: 0.8 };
        }
      }
    }
    return null;
  }

  /**
   * Find existing collections that are similar to the input.
   */
  private async findSimilarCollections(
    name: string,
    words: string[]
  ): Promise<Array<{ id: string; code: string; label: string; matchScore: number }>> {
    // Search by partial match on name and code
    const candidates = await this.collectionRepo.find({
      where: [
        { name: ILike(`%${name}%`) },
        { code: ILike(`%${words[0]}%`) },
      ],
      take: 10,
    });

    // Calculate match scores
    const scored = candidates.map((c) => ({
      id: c.id,
      code: c.code,
      label: c.name,
      matchScore: this.calculateSimilarity(name.toLowerCase(), c.name.toLowerCase()),
    }));

    // Sort by score and return top matches
    return scored
      .filter((s) => s.matchScore > 0.3)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 5);
  }

  // Basic stubs to satisfy callers
  async getNamingSuggestions(input: string): Promise<NamingSuggestionResult> {
    const words = input.trim().split(/\s+/).filter(Boolean);
    const similar = await this.findSimilarCollections(input, words.length ? words : ['']);
    return {
      suggestions: [],
      similarCollections: similar,
      warnings: similar.length ? ['Similar collections found'] : [],
    };
  }

  async analyzeImportStructure(
    source: 'csv' | 'json' | 'xlsx',
    headers: string[],
    rows: Record<string, unknown>[],
  ): Promise<ImportAnalysisResult> {
    return {
      suggestedName: headers[0] || 'ImportedData',
      suggestedCode: (headers[0] || 'imported_data').toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      rowCount: rows.length,
      columnCount: headers.length,
      properties: [],
      warnings: [],
      avaInsights: `Analyzed ${rows.length} rows from ${source}`,
    };
  }

  /**
   * Calculate string similarity using Levenshtein distance.
   */
  private calculateSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length === 0 || b.length === 0) return 0;

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const distance = matrix[b.length][a.length];
    const maxLength = Math.max(a.length, b.length);
    return 1 - distance / maxLength;
  }

  // --------------------------------------------------------------------------
  // Import Analysis
  // --------------------------------------------------------------------------

  /**
   * Analyze an imported file to detect schema structure.
   *
   * This examines the headers and sample data to suggest:
   * - Property names and types
   * - Required/nullable fields
   * - Unique constraints
   * - Potential references to existing collections
   *
   * @param source - File type ('csv', 'json', 'xlsx')
   * @param headers - Column headers from the file
   * @param sampleRows - First N rows of data (typically 100)
   * @returns Analysis result with property suggestions
   */
  async analyzeImport(
    source: 'csv' | 'json' | 'xlsx',
    headers: string[],
    sampleRows: ParsedRow[]
  ): Promise<ImportAnalysisResult> {
    this.logger.debug(
      `Analyzing import: ${headers.length} columns, ${sampleRows.length} rows, source: ${source}`
    );

    const properties: DetectedProperty[] = [];
    const warnings: string[] = [];

    // Get existing collections for reference detection
    const existingCollections = await this.getExistingCollections();

    // Analyze each column
    for (const header of headers) {
      const columnValues = sampleRows.map((row) => row[header]);
      const property = await this.analyzeColumn(header, columnValues, existingCollections);
      properties.push(property);
    }

    // Suggest collection name from filename or first column
    const suggestedName = this.suggestCollectionName(headers);
    const suggestedCode = this.generateCode(suggestedName);

    // Check for potential issues
    const hasIdColumn = properties.some(
      (p) => p.suggestedCode === 'id' || p.suggestedCode.endsWith('_id')
    );
    if (!hasIdColumn) {
      warnings.push('No ID column detected. A unique identifier will be generated automatically.');
    }

    const duplicateHeaders = this.findDuplicates(headers);
    if (duplicateHeaders.length > 0) {
      warnings.push(`Duplicate column headers found: ${duplicateHeaders.join(', ')}`);
    }

    // Generate natural language summary
    const avaInsights = this.generateInsightsSummary(headers.length, sampleRows.length, properties);

    return {
      suggestedName,
      suggestedCode,
      rowCount: sampleRows.length,
      columnCount: headers.length,
      properties,
      warnings,
      avaInsights,
    };
  }

  /**
   * Analyze a single column to detect its type and characteristics.
   */
  private async analyzeColumn(
    header: string,
    values: (string | number | boolean | null)[],
    existingCollections: Array<{ code: string; label: string }>
  ): Promise<DetectedProperty> {
    // Clean and filter values
    const nonNullValues = values.filter((v) => v !== null && v !== '' && v !== undefined);
    const nullable = nonNullValues.length < values.length * 0.9; // >10% null = nullable

    // Check uniqueness
    const uniqueValues = new Set(nonNullValues.map(String));
    const unique = uniqueValues.size === nonNullValues.length && nonNullValues.length > 10;

    // Detect type
    const typeAnalysis = this.detectType(header, nonNullValues);

    // Check for reference to existing collection
    let referenceCandidate: DetectedProperty['referenceCandidate'] | undefined;
    if (typeAnalysis.type === 'text' && uniqueValues.size < 50) {
      referenceCandidate = this.findReferenceCandidate(
        header,
        Array.from(uniqueValues),
        existingCollections
      );
    }

    // Generate code and label
    const suggestedCode = this.generatePropertyCode(header);
    const suggestedLabel = this.generatePropertyLabel(header);

    return {
      sourceColumn: header,
      suggestedCode,
      suggestedLabel,
      suggestedType: referenceCandidate ? 'reference' : typeAnalysis.type,
      nullable,
      unique,
      sampleValues: Array.from(uniqueValues).slice(0, 5).map(String),
      confidence: typeAnalysis.confidence,
      referenceCandidate,
    };
  }

  /**
   * Detect the property type from column header and values.
   */
  private detectType(
    header: string,
    values: (string | number | boolean | null)[]
  ): { type: PropertyType; confidence: number } {
    const headerLower = header.toLowerCase();
    const sampleValues = values.slice(0, 100).map(String);

    // Check header patterns first
    if (headerLower.includes('email') || headerLower.includes('e-mail')) {
      return { type: 'email', confidence: 0.9 };
    }
    if (
      headerLower.includes('phone') ||
      headerLower.includes('tel') ||
      headerLower.includes('mobile')
    ) {
      return { type: 'phone', confidence: 0.85 };
    }
    if (
      headerLower.includes('url') ||
      headerLower.includes('website') ||
      headerLower.includes('link')
    ) {
      return { type: 'url', confidence: 0.85 };
    }
    if (
      headerLower.includes('price') ||
      headerLower.includes('cost') ||
      headerLower.includes('amount') ||
      headerLower.includes('fee')
    ) {
      return { type: 'currency', confidence: 0.85 };
    }
    if (
      headerLower.includes('date') ||
      headerLower.includes('_at') ||
      headerLower.includes('_on')
    ) {
      // Check if it also has time component
      const hasTime = sampleValues.some((v) => /\d{1,2}:\d{2}/.test(v));
      return { type: hasTime ? 'datetime' : 'date', confidence: 0.85 };
    }
    if (
      headerLower.includes('description') ||
      headerLower.includes('notes') ||
      headerLower.includes('comment') ||
      headerLower.includes('detail')
    ) {
      return { type: 'longtext', confidence: 0.8 };
    }

    // Analyze values
    const patterns = this.analyzeValuePatterns(sampleValues);

    if (patterns.allBoolean) return { type: 'boolean', confidence: 0.95 };
    if (patterns.allInteger) return { type: 'number', confidence: 0.9 };
    if (patterns.allDecimal) return { type: 'decimal', confidence: 0.9 };
    if (patterns.allDate) return { type: 'date', confidence: 0.85 };
    if (patterns.allDateTime) return { type: 'datetime', confidence: 0.85 };
    if (patterns.allEmail) return { type: 'email', confidence: 0.9 };
    if (patterns.allUrl) return { type: 'url', confidence: 0.9 };
    if (patterns.fewDistinctValues) return { type: 'choice', confidence: 0.75 };
    if (patterns.longText) return { type: 'longtext', confidence: 0.7 };

    return { type: 'text', confidence: 0.6 };
  }

  /**
   * Analyze patterns in sample values.
   */
  private analyzeValuePatterns(values: string[]): {
    allBoolean: boolean;
    allInteger: boolean;
    allDecimal: boolean;
    allDate: boolean;
    allDateTime: boolean;
    allEmail: boolean;
    allUrl: boolean;
    fewDistinctValues: boolean;
    longText: boolean;
  } {
    const nonEmpty = values.filter((v) => v.trim().length > 0);
    if (nonEmpty.length === 0) {
      return {
        allBoolean: false,
        allInteger: false,
        allDecimal: false,
        allDate: false,
        allDateTime: false,
        allEmail: false,
        allUrl: false,
        fewDistinctValues: false,
        longText: false,
      };
    }

    const booleanValues = ['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'];
    const allBoolean = nonEmpty.every((v) => booleanValues.includes(v.toLowerCase()));

    const allInteger = nonEmpty.every((v) => /^-?\d+$/.test(v.trim()));
    const allDecimal = nonEmpty.every((v) => /^-?\d+\.?\d*$/.test(v.trim()));

    // Date patterns: YYYY-MM-DD, MM/DD/YYYY, DD-Mon-YYYY
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{1,2}\/\d{1,2}\/\d{2,4}$/,
      /^\d{1,2}-\w{3}-\d{2,4}$/,
    ];
    const allDate = nonEmpty.every((v) => datePatterns.some((p) => p.test(v.trim())));

    // DateTime patterns
    const allDateTime = nonEmpty.every((v) => /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v.trim()));

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const allEmail = nonEmpty.every((v) => emailRegex.test(v.trim()));

    const urlRegex = /^https?:\/\//i;
    const allUrl = nonEmpty.every((v) => urlRegex.test(v.trim()));

    const uniqueValues = new Set(nonEmpty);
    const fewDistinctValues = uniqueValues.size <= 10 && uniqueValues.size < nonEmpty.length * 0.1;

    const avgLength = nonEmpty.reduce((sum, v) => sum + v.length, 0) / nonEmpty.length;
    const longText = avgLength > 100;

    return {
      allBoolean,
      allInteger,
      allDecimal,
      allDate,
      allDateTime,
      allEmail,
      allUrl,
      fewDistinctValues,
      longText,
    };
  }

  /**
   * Check if column values might reference an existing collection.
   */
  private findReferenceCandidate(
    header: string,
    _values: string[],
    existingCollections: Array<{ code: string; label: string }>
  ): DetectedProperty['referenceCandidate'] | undefined {
    const headerLower = header.toLowerCase();

    // Look for columns that might be foreign keys
    for (const collection of existingCollections) {
      const codeLower = collection.code.toLowerCase();
      const labelLower = collection.label.toLowerCase();

      // Check if header contains collection name
      if (
        headerLower.includes(codeLower) ||
        headerLower.includes(labelLower) ||
        headerLower === `${codeLower}_id` ||
        headerLower === codeLower
      ) {
        return {
          collectionCode: collection.code,
          collectionLabel: collection.label,
          matchScore: 0.8,
        };
      }
    }

    return undefined;
  }

  /**
   * Get existing collections for reference detection.
   */
  private async getExistingCollections(): Promise<Array<{ code: string; label: string }>> {
    const collections = await this.collectionRepo.find({
      select: ['code', 'name'],
    });
    return collections.map((c) => ({ code: c.code, label: c.name }));
  }

  /**
   * Generate a property code from column header.
   */
  private generatePropertyCode(header: string): string {
    return header
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }

  /**
   * Generate a property label from column header.
   */
  private generatePropertyLabel(header: string): string {
    return header
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase to spaces
      .replace(/\b\w/g, (c) => c.toUpperCase()) // Title Case
      .trim();
  }

  /**
   * Suggest collection name from file headers.
   */
  private suggestCollectionName(headers: string[]): string {
    // Look for common ID column patterns to infer entity name
    const idColumns = headers.filter(
      (h) => h.toLowerCase().endsWith('_id') || h.toLowerCase() === 'id'
    );

    if (idColumns.length > 0 && idColumns[0].toLowerCase() !== 'id') {
      // Extract entity name from "entity_id" → "Entity"
      const entityName = idColumns[0]
        .replace(/_id$/i, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
      return this.pluralize(entityName);
    }

    return 'New Collection';
  }

  private findDuplicates(arr: string[]): string[] {
    const seen = new Set();
    const duplicates = new Set<string>();
    for (const item of arr) {
      if (seen.has(item)) {
        duplicates.add(item);
      }
      seen.add(item);
    }
    return Array.from(duplicates);
  }

  private generateInsightsSummary(
    colCount: number,
    rowCount: number,
    properties: DetectedProperty[]
  ): string {
    const refCount = properties.filter((p) => p.suggestedType === 'reference').length;
    const choiceCount = properties.filter((p) => p.suggestedType === 'choice').length;
    const dateCount = properties.filter((p) =>
      ['date', 'datetime'].includes(p.suggestedType)
    ).length;

    let summary = `Analyzed ${rowCount} rows and ${colCount} columns. `;
    summary += `Detected schema with `;

    const parts = [];
    if (refCount > 0) parts.push(`${refCount} references`);
    if (choiceCount > 0) parts.push(`${choiceCount} choice lists`);
    if (dateCount > 0) parts.push(`${dateCount} date fields`);

    if (parts.length > 0) {
      summary += parts.join(', ') + '.';
    } else {
      summary += 'standard text and number fields.';
    }

    return summary;
  }
}
