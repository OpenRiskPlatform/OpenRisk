// Shared by the build wrapper and release discovery so package names agree
// with the configuration seen by tauri-action during artifact discovery.
export function applicationTauriConfig(config) {
  if (config.application === undefined) return {};
  const app = config.application;
  if (!app || typeof app !== "object" || Array.isArray(app)) {
    throw new Error("Build config application must be an object.");
  }
  for (const key of Object.keys(app)) {
    if (!["productName", "identifier", "binaryName"].includes(key)) {
      throw new Error(`Unknown application property: ${key}`);
    }
  }
  if (
    typeof app.productName !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/.test(app.productName) ||
    app.productName.trim() !== app.productName
  ) {
    throw new Error(
      "application.productName must be a non-empty portable package name.",
    );
  }
  if (
    typeof app.identifier !== "string" ||
    !/^[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z][A-Za-z0-9-]*)+$/.test(app.identifier)
  ) {
    throw new Error(
      "application.identifier must be a reverse-domain identifier.",
    );
  }
  if (
    typeof app.binaryName !== "string" ||
    !/^[a-z][a-z0-9-]*$/.test(app.binaryName)
  ) {
    throw new Error(
      "application.binaryName must be a lowercase executable name without an extension.",
    );
  }
  return {
    productName: app.productName,
    identifier: app.identifier,
    mainBinaryName: app.binaryName,
  };
}
