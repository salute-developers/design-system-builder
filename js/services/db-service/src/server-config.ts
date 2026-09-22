export type ServerEnvironment = Record<string, string | undefined>;

export const resolveServerHost = (environment: ServerEnvironment = process.env): string =>
  environment.DB_SERVICE_HOST?.trim() || "0.0.0.0";

export const resolveServerPort = (environment: ServerEnvironment = process.env): number => {
  const configuredPort = environment.PORT?.trim();
  return configuredPort ? Number.parseInt(configuredPort, 10) : 3008;
};
