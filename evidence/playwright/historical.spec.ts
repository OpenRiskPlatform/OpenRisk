import { expect, test, type Page, type TestInfo } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import {
  installTauriMock,
  invokedCalls,
  PROJECT_DIRECTORY,
} from "./fixture";

const generatedRoot = path.resolve(
  import.meta.dirname,
  "../teacher-report/generated",
);

function version(testInfo: TestInfo): "before" | "after" {
  return testInfo.project.name === "before" ? "before" : "after";
}

function evidencePath(testInfo: TestInfo, name: string): string {
  return path.join(generatedRoot, version(testInfo), `${name}.png`);
}

async function openProject(
  page: Page,
  testInfo: TestInfo,
  scanId?: string,
): Promise<void> {
  await installTauriMock(page);
  const query = new URLSearchParams({ dir: PROJECT_DIRECTORY });
  if (scanId) query.set("scan", scanId);
  await page.goto(`/scans?${query.toString()}`);
  await expect(page.getByRole("heading", { name: "New Scan" })).toBeVisible();
  await fs.mkdir(path.dirname(evidencePath(testInfo, "placeholder")), {
    recursive: true,
  });
}

async function selectPlugin(page: Page, name: string): Promise<void> {
  await page.getByRole("button", { name: new RegExp(name, "i") }).first().click();
}

async function setEntrypoint(
  page: Page,
  entrypointName: string,
): Promise<void> {
  const label = page.getByText(entrypointName, { exact: true }).first();
  await label.click();
}

test.describe("historical bugfix evidence", () => {
  test("secret input border", async ({ page }, testInfo) => {
    await openProject(page, testInfo);
    await page.getByRole("button", { name: "Settings" }).first().click();
    await page.getByRole("button", { name: "OpenSanctions" }).click();

    const input = page.getByLabel("API Token").or(page.locator('input[type="password"]')).first();
    await expect(input).toBeVisible();
    await input.fill("••••••••••••••••");

    const metrics = await input.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const parent = element.parentElement?.getBoundingClientRect();
      return {
        borderLeftWidth: style.borderLeftWidth,
        borderRightWidth: style.borderRightWidth,
        left: rect.left,
        parentLeft: parent?.left ?? null,
      };
    });
    await testInfo.attach("input-border-metrics", {
      body: JSON.stringify(metrics, null, 2),
      contentType: "application/json",
    });
    await page.getByRole("dialog").screenshot({
      path: evidencePath(testInfo, "api-token-border"),
      animations: "disabled",
    });
  });

  test("document scroll containment", async ({ page }, testInfo) => {
    await openProject(page, testInfo);
    await selectPlugin(page, "Adversea");

    for (const entrypoint of [
      "PEP & Sanctions",
      "Unit Analysis",
      "Topic Report",
      "Social Media",
      "RPO",
      "Debtors",
      "Entity Recognition",
    ]) {
      await setEntrypoint(page, entrypoint);
    }

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(200);
    const dimensions = await page.evaluate(() => ({
      innerHeight: window.innerHeight,
      scrollY: window.scrollY,
      bodyScrollHeight: document.body.scrollHeight,
      documentScrollHeight: document.documentElement.scrollHeight,
    }));
    await testInfo.attach("document-scroll-metrics", {
      body: JSON.stringify(dimensions, null, 2),
      contentType: "application/json",
    });
    await page.screenshot({
      path: evidencePath(testInfo, "document-scroll-containment"),
      fullPage: false,
      animations: "disabled",
    });

    if (version(testInfo) === "after") {
      expect(dimensions.scrollY).toBe(0);
      expect(dimensions.documentScrollHeight).toBeLessThanOrEqual(
        dimensions.innerHeight,
      );
    } else {
      expect(dimensions.documentScrollHeight).toBeGreaterThan(
        dimensions.innerHeight,
      );
    }
  });

  test("trial charge notification", async ({ page }, testInfo) => {
    await openProject(page, testInfo);
    await selectPlugin(page, "OpenSanctions");
    await page.getByPlaceholder("Target").fill("Robert Fico");
    await page.getByRole("button", { name: "Run Scan" }).click();
    await expect(page.getByText("Robert Fico", { exact: true }).last()).toBeVisible();

    const chargeToast = page.getByText(/0\.10 EUR used/i);
    if (version(testInfo) === "before") {
      await expect(chargeToast).toBeVisible();
    } else {
      await expect(chargeToast).toHaveCount(0);
    }
    await page.screenshot({
      path: evidencePath(testInfo, "trial-charge-notification"),
      fullPage: false,
      animations: "disabled",
    });
  });

  test("shared target reaches every selected entrypoint", async ({
    page,
  }, testInfo) => {
    await openProject(page, testInfo);
    await selectPlugin(page, "Adversea");
    await setEntrypoint(page, "PEP & Sanctions");
    await page.getByPlaceholder("Target").first().fill("Svetlana Ficová");
    await setEntrypoint(page, "Unit Analysis");

    const countryButton = page.getByRole("combobox").last();
    if (await countryButton.isVisible()) {
      await countryButton.click();
      const slovakia = page.getByText(/Slovakia|SK/, { exact: false }).last();
      await slovakia.click();
    }

    await page.getByRole("button", { name: "Run Scan" }).click();
    await expect(page.getByText(/Results/).first()).toBeVisible();
    const inputError = page.getByText("Input 'target' is required.", {
      exact: true,
    });

    const calls = await invokedCalls(page);
    const runCall = calls.find((call) => call.command === "run_scan");
    await testInfo.attach("run-scan-inputs", {
      body: JSON.stringify(runCall?.args ?? null, null, 2),
      contentType: "application/json",
    });

    if (version(testInfo) === "before") {
      await expect(inputError).toBeVisible();
    } else {
      await expect(inputError).toHaveCount(0);
    }
    await page.screenshot({
      path: evidencePath(testInfo, "shared-entrypoint-target"),
      fullPage: false,
      animations: "disabled",
    });
  });

  test("PEP RCA status", async ({ page }, testInfo) => {
    await openProject(page, testInfo, "rca-scan");
    await expect(page.getByText("Svetlana Ficová", { exact: true }).last()).toBeVisible();
    const badge = page.getByText("PEP: RCA", { exact: true });
    if (version(testInfo) === "after") {
      await expect(badge).toBeVisible();
    } else {
      await expect(badge).toHaveCount(0);
    }
    await page.locator("#project-results-section").screenshot({
      path: evidencePath(testInfo, "pep-rca-status"),
      animations: "disabled",
    });
  });

  test("human-friendly country selection", async ({ page }, testInfo) => {
    await openProject(page, testInfo);
    await selectPlugin(page, "Adversea");
    await setEntrypoint(page, "Unit Analysis");

    const countryControl = page.getByRole("combobox").last();
    await expect(countryControl).toBeVisible();
    await countryControl.click();

    const search = page.getByPlaceholder("Search countries");
    if (version(testInfo) === "after") {
      await expect(search).toBeVisible();
      await search.fill("slov");
      await expect(page.getByText("Slovakia", { exact: true })).toBeVisible();
    } else {
      await expect(search).toHaveCount(0);
      await expect(page.getByText("SK", { exact: true }).last()).toBeVisible();
    }
    await page.screenshot({
      path: evidencePath(testInfo, "country-selector"),
      fullPage: false,
      animations: "disabled",
    });
  });

  test("adverse PDF rendering fixture is available", async ({
    page,
  }, testInfo) => {
    await openProject(page, testInfo, "media-scan");
    await expect(
      page.getByText("Investigative article with a confirmed adverse signal", {
        exact: true,
      }),
    ).toBeVisible();

    const pdfBytes = await page.evaluate(async () => {
      const module = await import("/src/utils/exportPdf.ts");
      const fixtureState = (
        window as typeof window & {
          __OPENRISK_EVIDENCE__: {
            calls: Array<{ command: string; args: Record<string, unknown> }>;
          };
        }
      ).__OPENRISK_EVIDENCE__;
      void fixtureState;
      const scan = {
        id: "media-scan",
        status: "Completed",
        preview: "Adverse media evidence",
        createdAt: "2026-06-19T10:00:00Z",
        selectedPlugins: [
          { pluginId: "adversea", entrypointId: "topic-report" },
        ],
        inputs: [
          {
            pluginId: "adversea",
            entrypointId: "topic-report",
            fieldName: "query",
            value: { type: "string", value: "Svetlana Ficová" },
          },
        ],
        results: [
          {
            pluginId: "adversea",
            pluginRevisionId: null,
            entrypointId: "topic-report",
            output: {
              ok: true,
              dataJson: JSON.stringify([
                {
                  $modelVersion: "0.0.3",
                  $entity: "entity.mediaMention",
                  $id: "adverse-media-evidence",
                  $props: {
                    name: [{ $type: "string", value: "Svetlana Ficová" }],
                    title: [
                      {
                        $type: "string",
                        value:
                          "Investigative article with a confirmed adverse signal",
                      },
                    ],
                    adverseActivityDetected: [
                      { $type: "boolean", value: true },
                    ],
                    analysis: [
                      {
                        $type: "string",
                        value:
                          "The screening result contains a confirmed adverse activity signal that requires review.",
                      },
                    ],
                  },
                },
              ]),
              error: null,
              logs: [],
            },
          },
        ],
      };
      const doc = await module.buildScanPdfDoc({
        detail: scan,
        scanTitle: "Adverse media evidence",
        performedAt: "19/06/2026, 12:00",
        pluginNameById: { adversea: "Adversea" },
      });
      return Array.from(new Uint8Array(doc.output("arraybuffer")));
    });

    const pdfPath = path.join(
      generatedRoot,
      version(testInfo),
      "adverse-activity.pdf",
    );
    await fs.writeFile(pdfPath, Buffer.from(pdfBytes));
    await testInfo.attach("adverse-activity-pdf", {
      path: pdfPath,
      contentType: "application/pdf",
    });
  });
});
