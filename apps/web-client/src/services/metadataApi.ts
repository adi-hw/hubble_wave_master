import { createApiClient } from './api';

// Separate API client for metadata service
// In development, use proxy path to avoid cross-origin cookie issues
const METADATA_API_URL = import.meta.env.VITE_METADATA_API_URL ?? '/api/metadata';

const metadataApi = createApiClient(METADATA_API_URL);

export default metadataApi;
