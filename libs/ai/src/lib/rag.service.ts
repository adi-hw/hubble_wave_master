import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LLMService, LLMChatMessage } from './llm.service';
import { VectorStoreService, SearchResult } from './vector-store.service';

export interface RAGContext {
  documents: SearchResult[];
  query: string;
}

export interface RAGResponse {
  answer: string;
  sources: Array<{
    sourceType: string;
    sourceId: string;
    title?: string;
    similarity: number;
  }>;
  context: RAGContext;
  modelUsed: string;
  totalDuration?: number;
}

export interface RAGOptions {
  maxDocuments?: number;
  similarityThreshold?: number;
  sourceTypes?: string[];
  systemPrompt?: string;
  temperature?: number;
  includeContext?: boolean;
}

const DEFAULT_SYSTEM_PROMPT = `You are AVA, the AI Virtual Assistant for HubbleWave, an enterprise operations platform.
You have access to the company's knowledge base, service catalog, and records.
Answer questions based on the provided context. If the context doesn't contain enough information, say so.
Be concise, professional, and helpful. Always cite your sources when possible.

Your personality:
- Friendly but professional
- Proactive in offering additional helpful information
- Clear and direct in your explanations
- Acknowledge when you don't have complete information`;

@Injectable()
export class RAGService {
  private readonly logger = new Logger(RAGService.name);

  constructor(
    private llmService: LLMService,
    private vectorStoreService: VectorStoreService
  ) {}

  /**
   * Perform RAG query - retrieve relevant documents and generate answer
   */
  async query(
    dataSource: DataSource,
    question: string,
    options: RAGOptions = {}
  ): Promise<RAGResponse> {
    const {
      maxDocuments = 5,
      similarityThreshold = 0.6,
      sourceTypes,
      systemPrompt = DEFAULT_SYSTEM_PROMPT,
      temperature = 0.7,
      includeContext = true,
    } = options;

    // Step 1: Retrieve relevant documents
    const documents = await this.vectorStoreService.search(dataSource, question, {
      limit: maxDocuments,
      threshold: similarityThreshold,
      sourceTypes,
    });

    this.logger.debug(
      `Retrieved ${documents.length} documents for query: "${question.substring(0, 50)}..."`
    );

    // Step 2: Build context from retrieved documents
    const contextText = this.buildContextText(documents);

    // Step 3: Generate answer using LLM
    const messages: LLMChatMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: this.buildPrompt(question, contextText),
      },
    ];

    const response = await this.llmService.chat(messages, { temperature });

    // Step 4: Extract and format sources
    const sources = documents.map((doc) => ({
      sourceType: doc.sourceType,
      sourceId: doc.sourceId,
      title: this.extractTitle(doc),
      similarity: doc.similarity,
    }));

    return {
      answer: response.content,
      sources,
      context: includeContext ? { documents, query: question } : { documents: [], query: question },
      modelUsed: response.model,
      totalDuration: response.duration,
    };
  }

  /**
   * Stream RAG response for real-time UI updates
   */
  async *queryStream(
    dataSource: DataSource,
    question: string,
    options: RAGOptions = {}
  ): AsyncGenerator<{ type: 'chunk' | 'sources' | 'done'; data: unknown }> {
    const {
      maxDocuments = 5,
      similarityThreshold = 0.6,
      sourceTypes,
      systemPrompt = DEFAULT_SYSTEM_PROMPT,
      temperature = 0.7,
    } = options;

    // Retrieve documents first
    const documents = await this.vectorStoreService.search(dataSource, question, {
      limit: maxDocuments,
      threshold: similarityThreshold,
      sourceTypes,
    });

    // Yield sources immediately so UI can show them
    const sources = documents.map((doc) => ({
      sourceType: doc.sourceType,
      sourceId: doc.sourceId,
      title: this.extractTitle(doc),
      similarity: doc.similarity,
    }));
    yield { type: 'sources', data: sources };

    // Build context and prompt
    const contextText = this.buildContextText(documents);
    const messages: LLMChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: this.buildPrompt(question, contextText) },
    ];

    // Stream the response
    for await (const chunk of this.llmService.chatStream(messages, { temperature })) {
      if (chunk.content) {
        yield { type: 'chunk', data: chunk.content };
      }
      if (chunk.done) {
        yield { type: 'done', data: { totalDuration: chunk.duration } };
      }
    }
  }

  /**
   * Conversational RAG with chat history
   */
  async chat(
    dataSource: DataSource,
    messages: LLMChatMessage[],
    options: RAGOptions = {}
  ): Promise<RAGResponse> {
    const {
      maxDocuments = 5,
      similarityThreshold = 0.6,
      sourceTypes,
      systemPrompt = DEFAULT_SYSTEM_PROMPT,
      temperature = 0.7,
    } = options;

    // Get the last user message for retrieval
    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === 'user');

    if (!lastUserMessage) {
      throw new Error('No user message found in chat history');
    }

    // Retrieve relevant documents based on the last question
    const documents = await this.vectorStoreService.search(
      dataSource,
      lastUserMessage.content,
      {
        limit: maxDocuments,
        threshold: similarityThreshold,
        sourceTypes,
      }
    );

    // Build context
    const contextText = this.buildContextText(documents);

    // Inject context into the conversation
    const augmentedMessages: LLMChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(0, -1), // All messages except the last
      {
        role: 'user',
        content: this.buildPrompt(lastUserMessage.content, contextText),
      },
    ];

    const response = await this.llmService.chat(augmentedMessages, { temperature });

    const sources = documents.map((doc) => ({
      sourceType: doc.sourceType,
      sourceId: doc.sourceId,
      title: this.extractTitle(doc),
      similarity: doc.similarity,
    }));

    return {
      answer: response.content,
      sources,
      context: { documents, query: lastUserMessage.content },
      modelUsed: response.model,
      totalDuration: response.duration,
    };
  }

  /**
   * Simple completion without RAG (for general questions)
   */
  async complete(
    prompt: string,
    systemPrompt?: string,
    temperature = 0.7
  ): Promise<string> {
    return this.llmService.complete(
      prompt,
      systemPrompt || 'You are AVA, a helpful AI assistant for the HubbleWave enterprise operations platform.',
      { temperature }
    );
  }

  /**
   * Summarize text content
   */
  async summarize(
    text: string,
    maxLength = 200,
    style: 'brief' | 'detailed' | 'bullet' = 'brief'
  ): Promise<string> {
    const styleInstructions = {
      brief: 'Provide a brief 1-2 sentence summary.',
      detailed: 'Provide a comprehensive summary covering all key points.',
      bullet: 'Provide a summary as bullet points.',
    };

    const prompt = `${styleInstructions[style]}
Keep the summary under ${maxLength} words.

Text to summarize:
${text}

Summary:`;

    return this.llmService.complete(prompt, 'You are a text summarization assistant.');
  }

  /**
   * Extract key entities from text
   */
  async extractEntities(
    text: string,
    entityTypes: string[] = ['person', 'organization', 'location', 'date', 'product']
  ): Promise<Record<string, string[]>> {
    const prompt = `Extract the following entity types from the text: ${entityTypes.join(', ')}.
Return as JSON with entity types as keys and arrays of found entities as values.
If no entities of a type are found, return an empty array for that type.

Text:
${text}

JSON Response:`;

    const response = await this.llmService.complete(
      prompt,
      'You are an entity extraction assistant. Always respond with valid JSON.'
    );

    try {
      // Try to parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      this.logger.warn('Failed to parse entity extraction response');
    }

    // Return empty result on failure
    return Object.fromEntries(entityTypes.map((t) => [t, []]));
  }

  /**
   * Generate suggestions based on context
   */
  async generateSuggestions(
    dataSource: DataSource,
    context: string,
    type: 'next_action' | 'related_content' | 'similar_issues',
    limit = 3
  ): Promise<string[]> {
    // First, find related documents
    const documents = await this.vectorStoreService.search(dataSource, context, {
      limit: 5,
      threshold: 0.5,
    });

    const docContext = documents
      .map((d) => `- ${this.extractTitle(d)}: ${d.content.substring(0, 200)}`)
      .join('\n');

    const typePrompts = {
      next_action: `Based on the context and related content, suggest ${limit} logical next actions the user might want to take.`,
      related_content: `Based on the context, suggest ${limit} related articles or resources that might be helpful.`,
      similar_issues: `Based on the context, identify ${limit} similar issues or topics that might be relevant.`,
    };

    const prompt = `${typePrompts[type]}

User's current context:
${context}

Related content:
${docContext}

Provide exactly ${limit} suggestions as a numbered list:`;

    const response = await this.llmService.complete(prompt);

    // Parse numbered list
    const lines = response.split('\n').filter((line) => /^\d+\./.test(line.trim()));
    return lines.map((line) => line.replace(/^\d+\.\s*/, '').trim()).slice(0, limit);
  }

  private buildContextText(documents: SearchResult[]): string {
    if (documents.length === 0) {
      return 'No relevant documents found.';
    }

    return documents
      .map((doc, index) => {
        const title = this.extractTitle(doc);
        return `[${index + 1}] ${title}\n${doc.content}`;
      })
      .join('\n\n---\n\n');
  }

  private buildPrompt(question: string, context: string): string {
    return `Based on the following context, answer the user's question.
If the context doesn't contain enough information to answer fully, acknowledge what you can answer and what is missing.

Context:
${context}

Question: ${question}

Answer:`;
  }

  private extractTitle(doc: SearchResult): string {
    const metadata = doc.metadata || {};
    return (
      (metadata['title'] as string) ||
      (metadata['label'] as string) ||
      (metadata['displayValue'] as string) ||
      `${doc.sourceType}/${doc.sourceId}`
    );
  }
}
