export interface Config {
  backend: {
    baseUrl: string;
    timeout: number;
  };
  output: {
    directory: string;
    saveTimestamped: boolean;
    saveLatest: boolean;
    saveSummary: boolean;
  };
  endpoints: {
    components: string;
    designSystems: string;
    variationValues: string;
  };
}

export const defaultConfig: Config = {
  backend: {
    baseUrl: 'http://localhost:3001',
    timeout: 30000, // 30 seconds
  },
  output: {
    directory: 'data',
    saveTimestamped: true,
    saveLatest: true,
    saveSummary: true,
  },
  endpoints: {
    components: '/api/components/available',
    designSystems: '/api/design-systems',
    variationValues: '/api/variation-values',
  },
};

export function loadConfig(): Config {
  // You can extend this to load from environment variables or config files
  const envBaseUrl = process.env.BACKEND_BASE_URL;
  const envTimeout = process.env.BACKEND_TIMEOUT;
  
  return {
    ...defaultConfig,
    backend: {
      ...defaultConfig.backend,
      baseUrl: envBaseUrl || defaultConfig.backend.baseUrl,
      timeout: envTimeout ? parseInt(envTimeout) : defaultConfig.backend.timeout,
    },
  };
}
