function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const vertexConfig = {
  projectId: requireEnv("GOOGLE_CLOUD_PROJECT_ID"),
  location: requireEnv("GOOGLE_CLOUD_LOCATION"),
  credentialsPath: requireEnv("GOOGLE_APPLICATION_CREDENTIALS"),
} as const;