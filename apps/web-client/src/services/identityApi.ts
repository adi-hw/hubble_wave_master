import { createApiClient } from './api';

// Separate API client for identity service
// In development, use proxy path to avoid cross-origin cookie issues
const IDENTITY_API_URL = import.meta.env.VITE_IDENTITY_API_URL ?? '/api/identity';

const identityApi = createApiClient(IDENTITY_API_URL);

export default identityApi;
