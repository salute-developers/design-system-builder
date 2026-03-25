import createClient from "openapi-fetch";
import type { paths } from "./types.gen";

export const VITE_DS_REGISTRY_API = import.meta.env.VITE_DS_REGISTRY_API || "/api";

export const api = createClient<paths>({ baseUrl: VITE_DS_REGISTRY_API });
