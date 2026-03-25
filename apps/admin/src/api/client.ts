import createClient from "openapi-fetch";
import type { paths } from "./types.gen";

export const API_BASE = import.meta.env.VITE_DS_REGISTRY_API || "/api";

export const api = createClient<paths>({ baseUrl: API_BASE });

// // GET /users — data типизирован как components["schemas"]["User"][]
// const { data, error } = await api.GET("/users");

// // GET /users/{id}
// const { data: user } = await api.GET("/users/{id}", {
//   params: { path: { id: userId } },
// });

// // POST /users
// const { data: created } = await api.POST("/users", {
//   body: { login: "alice", token: "secret" },
// });

// // PATCH /users/{id}
// await api.PATCH("/users/{id}", {
//   params: { path: { id: userId } },
//   body: { login: "new-name" },
// });

// // DELETE /users/{id}
// await api.DELETE("/users/{id}", {
//   params: { path: { id: userId } },
// });
