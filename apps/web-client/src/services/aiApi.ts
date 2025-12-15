import { createApiClient } from './api';

// Separate API client for AI service
// In development, use proxy path to avoid cross-origin cookie issues
const AI_API_URL = import.meta.env.VITE_AI_API_URL ?? '/api/ai';

const aiApi = createApiClient(AI_API_URL);

export default aiApi;
