const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const apiConfig = {
  baseUrl: API_BASE_URL,
  endpoints: {
    designSystems: '/api/design-systems',
    components: '/admin-api/components',
    variations: '/admin-api/variations',
    tokens: '/admin-api/tokens',
    variationValues: '/api/variation-values',
  },
};

// TODO: endpoints could have a path parameter, so we need to handle that
// /api/design-systems/components/1/variations/1/tokens
// how to connect this to the actual endpoint? in backend? so we could reference it?
// Option 1: Shared Types Package
// Option 2: Update Current API Config
// Option 3: Code Generation (Advanced)

export const getApiUrl = (endpoint: keyof typeof apiConfig.endpoints) => {
  return `${apiConfig.baseUrl}${apiConfig.endpoints[endpoint]}`;
};