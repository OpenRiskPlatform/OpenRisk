const LOCKED_PROJECT_ERROR_PREFIX = "PROJECT_LOCKED:";
const LEGACY_PROJECT_ERROR_PREFIX = "PROJECT_LEGACY:";
const OUTDATED_PROJECT_ERROR_PREFIX = "PROJECT_OUTDATED:";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function isLockedProjectError(error: unknown): boolean {
  return errorMessage(error).startsWith(LOCKED_PROJECT_ERROR_PREFIX);
}

export function projectOpenError(error: unknown): string {
  const message = errorMessage(error);

  if (message.startsWith(LEGACY_PROJECT_ERROR_PREFIX)) {
    return "This project was created by an unsupported OpenRisk version.";
  }

  if (message.startsWith(OUTDATED_PROJECT_ERROR_PREFIX)) {
    const version = message
      .slice(OUTDATED_PROJECT_ERROR_PREFIX.length)
      .replace(/:.*$/, "");
    return `Project schema version ${version} is no longer supported.`;
  }

  return message;
}
