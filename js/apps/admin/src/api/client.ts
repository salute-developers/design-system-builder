import createClient from "openapi-fetch";
import type { paths } from "./types.gen";

export const VITE_DB_SERVICE_API = import.meta.env.VITE_DB_SERVICE_API || "/api";

export const api = createClient<paths>({ baseUrl: VITE_DB_SERVICE_API });
