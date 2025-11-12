const API_CONFIG = {
  baseUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001',
  endpoints: {
    designSystems: '/api/design-systems',
    variationValues: '/api/variation-values',
    components: '/api/components',
  },
  adminEndpoints: {
    components: '/admin-api/components',
    variations: '/admin-api/variations',
    tokens: '/admin-api/tokens',
    'props-api': '/admin-api/props-api',
  },
};

export function getApiUrl(endpoint: keyof typeof API_CONFIG.endpoints): string {
  return `${API_CONFIG.baseUrl}${API_CONFIG.endpoints[endpoint]}`;
}

export function getAdminApiUrl(endpoint: keyof typeof API_CONFIG.adminEndpoints): string {
  return `${API_CONFIG.baseUrl}${API_CONFIG.adminEndpoints[endpoint]}`;
}

// TODO: endpoints could have a path parameter, so we need to handle that
// /api/design-systems/components/1/variations/1/tokens
// how to connect this to the actual endpoint? in backend? so we could reference it?
// Option 1: Shared Types Package
// Option 2: Update Current API Config
// Option 3: Code Generation (Advanced)
