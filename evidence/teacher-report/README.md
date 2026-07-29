# OpenRisk Corrective Action Verification

The compiled report is `OpenRisk-Corrective-Action-Verification.pdf`.

## Reproduce

```bash
PLAYWRIGHT_BROWSERS_PATH=/home/ms/.local/share/playwright-browsers \
  npm run evidence:historical

npm run evidence:webdriver

, typst compile --root . \
  evidence/teacher-report/report.typ \
  evidence/teacher-report/OpenRisk-Corrective-Action-Verification.pdf
```

The Playwright run compares baseline `6a7f581` with fixed state `e824ad8`.
Its setup step creates or validates detached worktrees under `/tmp` and installs
their dependencies when needed.
WebDriverIO builds and starts an evidence-only Tauri binary, creates a disposable
project, installs the local verification plugin, and exercises the real backend
and plugin runtime. All report screenshots are captured in light mode.

Additional recordings and traces are available in:

- `generated/playwright-html/index.html`
- `generated/playwright-results/`
- `generated/application/webdriverio-verification.json`
