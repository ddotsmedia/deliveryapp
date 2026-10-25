import createClient from "openapi-fetch";

// Typed against packages/sdk/openapi.json once services/api emits it (Phase 3).
export type ApiPaths = Record<string, never>;

export function createApiClient(baseUrl: string, getToken?: () => string | null) {
  return createClient<ApiPaths>({
    baseUrl,
    fetch: (request) => {
      const token = getToken?.();
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      return fetch(request);
    },
  });
}
