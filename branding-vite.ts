import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const virtualModuleId = "virtual:openrisk-branding";
const resolvedVirtualModuleId = `\0${virtualModuleId}`;

function requiredEnvironmentValue(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required when custom branding is enabled.`);
  }
  return value;
}

function availablePluginIds(): string[] {
  const configured = process.env.OPENRISK_AVAILABLE_PLUGINS?.trim();
  if (!configured) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(configured);
  } catch (error) {
    throw new Error(
      `OPENRISK_AVAILABLE_PLUGINS must be a JSON array: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (
    !Array.isArray(parsed) ||
    parsed.some(
      (pluginId) =>
        typeof pluginId !== "string" ||
        !/^[A-Za-z0-9._-]+$/.test(pluginId),
    )
  ) {
    throw new Error(
      "OPENRISK_AVAILABLE_PLUGINS must contain only valid plugin IDs.",
    );
  }
  return parsed;
}

export function brandingPlugin(): Plugin {
  const customBranding = process.env.OPENRISK_CUSTOM_BRANDING === "1";
  const configuredAvailablePluginIds = availablePluginIds();

  return {
    name: "openrisk-branding",
    resolveId(id) {
      return id === virtualModuleId ? resolvedVirtualModuleId : undefined;
    },
    load(id) {
      if (id !== resolvedVirtualModuleId) {
        return undefined;
      }

      if (!customBranding) {
        return [
          "export const customBranding = false;",
          'export const brandName = "OpenRisk";',
          "export const logoUrl = null;",
          `export const availablePluginIds = ${JSON.stringify(configuredAvailablePluginIds)};`,
        ].join("\n");
      }

      const brandName = requiredEnvironmentValue("OPENRISK_BRAND_NAME");
      const configuredLogo = requiredEnvironmentValue("OPENRISK_BRAND_LOGO");
      const logoPath = path.resolve(configuredLogo);
      if (!fs.existsSync(logoPath)) {
        throw new Error(`Custom brand logo does not exist: ${logoPath}`);
      }

      return [
        `import logoUrl from ${JSON.stringify(logoPath)};`,
        "export const customBranding = true;",
        `export const brandName = ${JSON.stringify(brandName)};`,
        `export const availablePluginIds = ${JSON.stringify(configuredAvailablePluginIds)};`,
        "export { logoUrl };",
      ].join("\n");
    },
  };
}
