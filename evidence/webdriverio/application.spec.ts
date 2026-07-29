import { browser, expect } from "@wdio/globals";
import fs from "node:fs/promises";
import path from "node:path";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const generatedRoot = path.join(
  repositoryRoot,
  "evidence/teacher-report/generated/application",
);
const projectPath = "/tmp/openrisk-wdio-verification.orproj";
const pluginPath = path.join(
  repositoryRoot,
  "evidence/fixtures/verification-plugin",
);

let scanId = "";

async function invoke<T>(
  command: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  return browser.tauri.execute(
    (
      { core }: { core: { invoke: <R>(name: string, data: unknown) => Promise<R> } },
      commandName: string,
      commandArgs: Record<string, unknown>,
    ) => core.invoke<T>(commandName, commandArgs),
    command,
    args,
  );
}

async function navigateWithinApp(routeScanId?: string): Promise<void> {
  const query = new URLSearchParams({ dir: projectPath });
  if (routeScanId) query.set("scan", routeScanId);
  await browser.execute((href: string) => {
    window.history.pushState({}, "", href);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, `/scans?${query.toString()}`);
}

async function waitForText(text: string): Promise<void> {
  await browser.waitUntil(
    () =>
      browser.execute(
        (expected: string) => document.body.innerText.includes(expected),
        text,
      ),
    { timeout: 20_000, timeoutMsg: `Page did not display "${text}"` },
  );
}

async function waitForSelector(selector: string): Promise<void> {
  await browser.waitUntil(
    () =>
      browser.execute(
        (expected: string) => Boolean(document.querySelector(expected)),
        selector,
      ),
    { timeout: 20_000, timeoutMsg: `Page did not render "${selector}"` },
  );
}

async function normalizeLightTheme(): Promise<void> {
  await browser.execute(() => {
    const root = document.documentElement;
    root.classList.remove(
      "dark",
      "theme-ocean",
      "theme-forest",
      "theme-midnight",
      "theme-monokai",
      "theme-angine",
    );
    root.classList.add("light");
    root.style.colorScheme = "light";
  });
}

async function clickContaining(
  selector: string,
  text: string,
): Promise<void> {
  const clicked = await browser.execute(
    (candidateSelector: string, expected: string) => {
      const candidate = [...document.querySelectorAll<HTMLElement>(candidateSelector)]
        .find((element) => element.innerText.includes(expected));
      candidate?.click();
      return Boolean(candidate);
    },
    selector,
    text,
  );
  expect(clicked).toBe(true);
}

async function prepareRealProject(): Promise<void> {
  await Promise.all([
    fs.rm(projectPath, { force: true }),
    fs.rm(`${projectPath}-shm`, { force: true }),
    fs.rm(`${projectPath}-wal`, { force: true }),
  ]);

  await invoke("create_project", {
    name: "OpenRisk Application Verification",
    projectPath,
  });
  await invoke("update_project_settings", {
    name: null,
    theme: "light",
    advancedMode: null,
  });
  await invoke("upsert_project_plugin_from_dir", { pluginDir: pluginPath });
  await invoke("set_plugin_enabled", {
    pluginId: "verification-plugin",
    enabled: true,
  });
  await invoke("set_plugin_setting", {
    pluginId: "verification-plugin",
    settingName: "api_token",
    value: { type: "string", value: "deterministic-secret-token" },
  });

  const created = await invoke<{ id: string }>("create_scan", {
    preview: "Svetlana Ficová",
  });
  scanId = created.id;
  await invoke("run_scan", {
    scanId,
    selectedPlugins: [
      {
        pluginId: "verification-plugin",
        entrypointId: "pep-rca",
      },
    ],
    inputs: [
      {
        pluginId: "verification-plugin",
        entrypointId: "pep-rca",
        fieldName: "target",
        value: { type: "string", value: "Svetlana Ficová" },
      },
    ],
  });
  await invoke("close_project");
}

describe("fixed Tauri application evidence", () => {
  before(async () => {
    await fs.mkdir(generatedRoot, { recursive: true });
    await browser.tauri.switchWindow("main");
    await prepareRealProject();
  });

  it("renders fixed RCA status from the real backend and plugin runtime", async () => {
    await navigateWithinApp(scanId);
    await waitForText("PEP: RCA");

    const state = await browser.execute(() => ({
      href: window.location.href,
      title: document.title,
      rcaVisible: document.body.innerText.includes("PEP: RCA"),
      relativeVisible: document.body.innerText.includes("Robert Fico"),
    }));
    expect(state.rcaVisible).toBe(true);
    expect(state.relativeVisible).toBe(true);
    await normalizeLightTheme();
    await browser.execute(() => {
      const badge = [...document.querySelectorAll<HTMLElement>("*")]
        .find((element) => (element.textContent ?? "").trim() === "PEP: RCA");
      badge?.scrollIntoView({ block: "center" });
    });
    await browser.saveScreenshot(
      path.join(generatedRoot, "webdriverio-fixed-rca.png"),
    );
  });

  it("keeps the document fixed while the scan content scrolls", async () => {
    await normalizeLightTheme();
    for (const entrypoint of [
      "PEP & Sanctions",
      "Country Screening",
      "Topic Report",
      "Social Media",
      "Unit Analysis",
      "RPO",
      "Entity Recognition",
    ]) {
      await clickContaining("label", entrypoint);
    }

    const dimensions = await browser.execute(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      const scrollRegion = document.querySelector<HTMLElement>(
        "main .overflow-y-auto",
      );
      return {
        innerHeight: window.innerHeight,
        scrollY: window.scrollY,
        bodyScrollHeight: document.body.scrollHeight,
        documentScrollHeight: document.documentElement.scrollHeight,
        contentClientHeight: scrollRegion?.clientHeight ?? null,
        contentScrollHeight: scrollRegion?.scrollHeight ?? null,
      };
    });

    expect(dimensions.scrollY).toBe(0);
    expect(
      dimensions.documentScrollHeight - dimensions.innerHeight,
    ).toBeLessThanOrEqual(
      1,
    );
    expect(dimensions.contentScrollHeight ?? 0).toBeGreaterThan(
      dimensions.contentClientHeight ?? Number.MAX_SAFE_INTEGER,
    );
    await browser.saveScreenshot(
      path.join(generatedRoot, "webdriverio-fixed-scroll.png"),
    );

    await fs.writeFile(
      path.join(generatedRoot, "webdriverio-verification.json"),
      JSON.stringify(
        {
          testedBinary: "src-tauri/target-wdio/debug/openrisk",
          browser: "WebKitGTK 605.1.15",
          project: projectPath,
          pluginFixture: "evidence/fixtures/verification-plugin",
          realBackendCommands: [
            "create_project",
            "update_project_settings",
            "upsert_project_plugin_from_dir",
            "set_plugin_enabled",
            "set_plugin_setting",
            "create_scan",
            "run_scan",
            "close_project",
          ],
          documentScroll: dimensions,
          checks: {
            actualTauriWebView: true,
            actualRustBackend: true,
            actualPluginRuntime: true,
            pepRcaBadgeVisible: true,
            documentScrollContained: true,
          },
        },
        null,
        2,
      ),
    );
  });

  it("renders a searchable country control and masked secret setting", async () => {
    await normalizeLightTheme();
    const countryOpened = await browser.execute(() => {
      const trigger = document.querySelector<HTMLElement>('[role="combobox"]');
      trigger?.click();
      return Boolean(trigger);
    });
    expect(countryOpened).toBe(true);
    await waitForSelector('input[placeholder="Search countries"]');

    await browser.execute(() => {
      const search = document.querySelector<HTMLInputElement>(
        'input[placeholder="Search countries"]',
      );
      if (!search) return;
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
      setter?.call(search, "slov");
      search.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await waitForText("Slovakia");
    await browser.saveScreenshot(
      path.join(generatedRoot, "webdriverio-fixed-country.png"),
    );

    await browser.keys(["Escape"]);
    await browser.execute(() => {
      window.dispatchEvent(new CustomEvent("openrisk:open-settings"));
    });
    await waitForText("Enabled Plugins");
    await clickContaining('[role="dialog"] button', "Verification Plugin");
    await waitForText("Deterministic secret");

    const inputGeometry = await browser.execute(() => {
      const input = document.querySelector<HTMLInputElement>(
        'input[type="password"]',
      );
      if (!input) return null;
      const style = getComputedStyle(input);
      const rect = input.getBoundingClientRect();
      const scrollViewport = input.closest<HTMLElement>(".overflow-y-auto");
      const viewportRect = scrollViewport?.getBoundingClientRect();
      return {
        type: input.type,
        valueLength: input.value.length,
        borderLeftWidth: style.borderLeftWidth,
        borderRightWidth: style.borderRightWidth,
        leftInset: viewportRect ? rect.left - viewportRect.left : null,
      };
    });

    expect(inputGeometry).not.toBeNull();
    expect(inputGeometry?.type).toBe("password");
    expect(inputGeometry?.valueLength).toBeGreaterThan(0);
    expect(inputGeometry?.borderLeftWidth).toBe(
      inputGeometry?.borderRightWidth,
    );
    expect(inputGeometry?.leftInset ?? 0).toBeGreaterThan(0);
    await normalizeLightTheme();
    await browser.saveScreenshot(
      path.join(generatedRoot, "webdriverio-fixed-secret-setting.png"),
    );
  });
});
