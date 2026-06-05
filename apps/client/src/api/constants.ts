export const ACCESS_KEY = 'auth.access_token';
export const REFRESH_KEY = 'auth.refresh_token';
export const EXPIRES_AT_KEY = 'auth.expires_at';

export const API_GATEWAY_URL = import.meta.env.VITE_API_GATEWAY_URL;
export const AUTH_URL = `${import.meta.env.VITE_API_GATEWAY_URL}/auth/token`;
export const LOGOUT_URL = `${import.meta.env.VITE_API_GATEWAY_URL}/auth/logout`;
export const PROJECTS_URL = `${import.meta.env.VITE_API_GATEWAY_URL}/api/projects`;
export const CLIENT_ID = `${import.meta.env.VITE_CLIENT_ID}`;
