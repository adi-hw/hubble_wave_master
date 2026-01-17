/**
 * Semantic Search Service
 * HubbleWave Platform
 *
 * Client for the AI-powered semantic search API.
 * Uses Ollama in development and vLLM in production.
 */

import axios from 'axios';
import { getStoredToken } from './token';

const aiApi = axios.create({
  baseURL: import.meta.env.VITE_AI_API_URL || 'http://localhost:3005/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth interceptor
aiApi.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface SearchResult {
  sourceType: string;
  sourceId: string;
  content: string;
  similarity: number;
  metadata?: Record<string, unknown>;
}

export interface SemanticSearchResponse {
  results: SearchResult[];
}

export interface RAGResponse {
  answer: string;
  sources: Array<{
    sourceType: string;
    sourceId: string;
    title?: string;
    similarity: number;
  }>;
  modelUsed: string;
  totalDuration?: number;
}

export interface GlobalSearchResult {
  type: 'record' | 'knowledge' | 'catalog' | 'user' | 'collection';
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  icon?: string;
  url?: string;
  relevance: number;
  metadata?: Record<string, unknown>;
}

export const searchService = {
  /**
   * Semantic search across all indexed content
   */
  semanticSearch: async (
    query: string,
    options?: {
      limit?: number;
      threshold?: number;
      sourceTypes?: string[];
    }
  ): Promise<SemanticSearchResponse> => {
    const response = await aiApi.post('/embeddings/search', {
      query,
      limit: options?.limit || 10,
      threshold: options?.threshold || 0.5,
      sourceTypes: options?.sourceTypes,
    });
    return response.data;
  },

  /**
   * RAG query - get AI-generated answer with sources
   */
  ragQuery: async (
    question: string,
    options?: {
      maxDocuments?: number;
      similarityThreshold?: number;
      sourceTypes?: string[];
    }
  ): Promise<RAGResponse> => {
    const response = await aiApi.post('/chat/rag', {
      question,
      options,
    });
    return response.data;
  },

  /**
   * Global search across all content types
   * Combines semantic search with traditional search
   */
  globalSearch: async (
    query: string,
    options?: {
      limit?: number;
      types?: string[];
    }
  ): Promise<GlobalSearchResult[]> => {
    if (!query.trim()) {
      return [];
    }

    try {
      // Try semantic search first
      const semanticResults = await searchService.semanticSearch(query, {
        limit: options?.limit || 10,
        sourceTypes: options?.types,
      });

      // Transform results to GlobalSearchResult format
      return semanticResults.results.map((result) => ({
        type: mapSourceType(result.sourceType),
        id: result.sourceId,
        title: extractTitle(result),
        subtitle: result.sourceType,
        description: truncate(result.content, 150),
        url: buildUrl(result.sourceType, result.sourceId),
        relevance: result.similarity,
        metadata: result.metadata,
      }));
    } catch {
      // Fall back to empty results if AI service unavailable
      console.warn('Semantic search unavailable, returning empty results');
      return [];
    }
  },

  /**
   * Get search suggestions based on partial query
   */
  getSuggestions: async (
    query: string,
    limit = 5
  ): Promise<string[]> => {
    if (!query.trim() || query.length < 2) {
      return [];
    }

    try {
      const response = await aiApi.get('/embeddings/suggestions', {
        params: { query, limit },
      });
      return response.data.suggestions || [];
    } catch {
      return [];
    }
  },

  /**
   * Get embedding stats
   */
  getStats: async (): Promise<{
    documentCounts: Record<string, number>;
    totalDocuments: number;
    queueEnabled: boolean;
    queueStats?: Record<string, unknown>;
  }> => {
    const response = await aiApi.get('/embeddings/stats');
    return response.data;
  },

  /**
   * Check if AI/search service is available
   */
  isAvailable: async (): Promise<boolean> => {
    try {
      const response = await aiApi.get('/health');
      return response.status === 200;
    } catch {
      return false;
    }
  },
};

// Helper functions
function mapSourceType(
  sourceType: string
): 'record' | 'knowledge' | 'catalog' | 'user' | 'collection' {
  switch (sourceType) {
    case 'knowledge_article':
      return 'knowledge';
    case 'catalog_item':
      return 'catalog';
    case 'user':
      return 'user';
    case 'collection':
      return 'collection';
    default:
      return 'record';
  }
}

function extractTitle(result: SearchResult): string {
  const metadata = result.metadata || {};
  return (
    (metadata['title'] as string) ||
    (metadata['label'] as string) ||
    (metadata['displayValue'] as string) ||
    (metadata['name'] as string) ||
    `${result.sourceType}/${result.sourceId}`
  );
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function buildUrl(sourceType: string, sourceId: string): string {
  switch (sourceType) {
    case 'knowledge_article':
      return `/knowledge/${sourceId}`;
    case 'catalog_item':
      return `/catalog/${sourceId}`;
    case 'user':
      return `/admin/users/${sourceId}`;
    case 'collection':
      return `/admin/collections/${sourceId}`;
    default:
      // For records, sourceId is typically "collectionName:recordId"
      if (sourceId.includes(':')) {
        const [collection, id] = sourceId.split(':');
        return `/data/${collection}/${id}`;
      }
      return `/data/${sourceId}`;
  }
}

export default searchService;
