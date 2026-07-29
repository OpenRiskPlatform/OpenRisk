#let navy = rgb("#101828")
#let blue = rgb("#175CD3")
#let blue-soft = rgb("#EFF8FF")
#let green = rgb("#067647")
#let green-soft = rgb("#ECFDF3")
#let amber = rgb("#B54708")
#let amber-soft = rgb("#FFFAEB")
#let red = rgb("#B42318")
#let gray = rgb("#475467")
#let rule = rgb("#D0D5DD")
#let surface = rgb("#F8FAFC")

#set page(
  paper: "a4",
  flipped: true,
  margin: (top: 17mm, bottom: 17mm, left: 18mm, right: 18mm),
  header: context [
    #set text(size: 7.5pt, fill: gray)
    #grid(
      columns: (1fr, auto),
      [OPENRISK / CORRECTIVE ACTION VERIFICATION],
      [CONTROLLED EVIDENCE],
    )
    #v(2mm)
    #line(length: 100%, stroke: 0.5pt + rule)
  ],
  footer: context [
    #line(length: 100%, stroke: 0.5pt + rule)
    #v(2mm)
    #set text(size: 7.5pt, fill: gray)
    #grid(
      columns: (1fr, auto),
      [OpenRiskPlatform],
      [#counter(page).display("1")],
    )
  ],
)
#set text(font: "DejaVu Sans", size: 9pt, fill: navy)
#set par(leading: 0.72em)
#set heading(numbering: none)
#show heading.where(level: 1): it => [
  #set text(size: 21pt, weight: "bold", fill: navy)
  #it.body
  #v(2mm)
]
#show heading.where(level: 2): it => [
  #set text(size: 13pt, weight: "bold", fill: navy)
  #it.body
  #v(1mm)
]

#let pill(label, tone: "green") = {
  let colors = if tone == "green" {
    (green-soft, green)
  } else if tone == "amber" {
    (amber-soft, amber)
  } else {
    (blue-soft, blue)
  }
  box(
    fill: colors.at(0),
    radius: 3pt,
    inset: (x: 6pt, y: 3pt),
    text(size: 7.5pt, weight: "bold", fill: colors.at(1), label),
  )
}

#let evidence-page(
  id,
  title,
  finding,
  commit,
  before,
  after,
  before-note,
  after-note,
) = [
  #pagebreak()
  #grid(
    columns: (1fr, auto),
    align: horizon,
    [
      #text(size: 8pt, weight: "bold", fill: blue)[#id]
      #v(1mm)
      #heading(level: 1)[#title]
    ],
    [#pill("VERIFIED")],
  )
  #block(
    width: 100%,
    fill: blue-soft,
    stroke: 0.5pt + rgb("#B2DDFF"),
    radius: 4pt,
    inset: 9pt,
  )[
    #text(weight: "bold", fill: blue)[Finding]  #finding
    #h(6mm)
    #text(size: 8pt, fill: gray)[Change #commit]
  ]
  #v(5mm)
  #grid(
    columns: (1fr, 1fr),
    gutter: 8mm,
    [
      #text(size: 8pt, weight: "bold", fill: red)[BEFORE / 6a7f581]
      #v(2mm)
      #block(
        width: 100%,
        height: 109mm,
        fill: white,
        stroke: 0.7pt + rule,
        radius: 3pt,
        inset: 3pt,
      )[
        #align(center + horizon)[#image(before, width: 100%, height: 102mm, fit: "contain")]
      ]
      #v(2mm)
      #text(size: 8pt, fill: gray)[#before-note]
    ],
    [
      #text(size: 8pt, weight: "bold", fill: green)[AFTER / e824ad8]
      #v(2mm)
      #block(
        width: 100%,
        height: 109mm,
        fill: white,
        stroke: 0.7pt + rule,
        radius: 3pt,
        inset: 3pt,
      )[
        #align(center + horizon)[#image(after, width: 100%, height: 102mm, fit: "contain")]
      ]
      #v(2mm)
      #text(size: 8pt, fill: gray)[#after-note]
    ],
  )
]

#let application-page(id, title, image-path, finding) = [
  #pagebreak()
  #grid(
    columns: (1fr, auto),
    align: horizon,
    [
      #text(size: 8pt, weight: "bold", fill: blue)[#id]
      #v(1mm)
      #heading(level: 1)[#title]
    ],
    [#pill("REAL APPLICATION", tone: "blue")],
  )
  #block(
    width: 100%,
    fill: green-soft,
    stroke: 0.5pt + rgb("#ABEFC6"),
    radius: 4pt,
    inset: 9pt,
  )[
    #text(weight: "bold", fill: green)[Runtime finding]  #finding
  ]
  #v(5mm)
  #block(
    width: 100%,
    height: 132mm,
    fill: white,
    stroke: 0.7pt + rule,
    radius: 3pt,
    inset: 3pt,
  )[
    #align(center + horizon)[
      #image(image-path, width: 100%, height: 125mm, fit: "contain")
    ]
  ]
]

// Cover
#set page(header: none, footer: none)
#v(14mm)
#grid(
  columns: (33mm, 1fr),
  gutter: 9mm,
  align: horizon,
  [
    #image("../../src-tauri/icons/icon.png", width: 31mm)
  ],
  [
    #text(size: 12pt, weight: "bold", fill: blue)[OPENRISK PLATFORM]
    #v(2mm)
    #text(size: 32pt, weight: "bold", fill: navy)[Corrective Action]
    #linebreak()
    #text(size: 32pt, weight: "bold", fill: navy)[Verification Dossier]
  ],
)
#v(11mm)
#block(width: 100%, height: 1.5pt, fill: blue)
#v(9mm)
#grid(
  columns: (1.8fr, 1fr),
  gutter: 18mm,
  [
    #text(size: 15pt, fill: gray)[
      Controlled before/after evidence and real desktop-application verification
      for the reported usability and result-presentation defects.
    ]
    #v(10mm)
    #grid(
      columns: (1fr, 1fr, 1fr),
      gutter: 5mm,
      block(fill: surface, radius: 4pt, inset: 10pt)[
        #text(size: 23pt, weight: "bold", fill: blue)[14/14]
        #linebreak()
        #text(size: 8pt, fill: gray)[Historical checks passed]
      ],
      block(fill: surface, radius: 4pt, inset: 10pt)[
        #text(size: 23pt, weight: "bold", fill: green)[3/3]
        #linebreak()
        #text(size: 8pt, fill: gray)[Tauri checks passed]
      ],
      block(fill: surface, radius: 4pt, inset: 10pt)[
        #text(size: 23pt, weight: "bold", fill: navy)[7]
        #linebreak()
        #text(size: 8pt, fill: gray)[Visual comparisons]
      ],
    )
  ],
  [
    #block(fill: navy, radius: 5pt, inset: 13pt)[
      #set text(fill: white)
      #text(size: 8pt, weight: "bold")[EVIDENCE RANGE]
      #v(3mm)
      #text(size: 9pt)[Baseline]
      #linebreak()
      #text(weight: "bold")[6a7f581]
      #v(3mm)
      #text(size: 9pt)[Fixed state]
      #linebreak()
      #text(weight: "bold")[e824ad8]
      #v(3mm)
      #text(size: 9pt)[Prepared]
      #linebreak()
      #text(weight: "bold")[28 July 2026]
    ]
  ],
)
#v(17mm)
#text(size: 8.5pt, fill: gray)[
  Evidence is generated from source-controlled historical revisions and a deterministic
  local verification plugin. Teacher-provided screenshots are not used as baseline material.
]

// Restore running header/footer.
#pagebreak()
#set page(
  header: context [
    #set text(size: 7.5pt, fill: gray)
    #grid(columns: (1fr, auto), [OPENRISK / CORRECTIVE ACTION VERIFICATION], [CONTROLLED EVIDENCE])
    #v(2mm)
    #line(length: 100%, stroke: 0.5pt + rule)
  ],
  footer: context [
    #line(length: 100%, stroke: 0.5pt + rule)
    #v(2mm)
    #set text(size: 7.5pt, fill: gray)
    #grid(columns: (1fr, auto), [OpenRiskPlatform], [#counter(page).display("1")])
  ],
)

= Executive Summary

The verification covers the corrective changes built on top of the release baseline.
Seven defects have controlled visual comparisons. Three representative workflows were
also exercised in the real Tauri application, including Rust persistence and plugin
execution. The report does not treat screenshots alone as runtime proof.

#v(4mm)
#table(
  columns: (2.2fr, 0.9fr, 1.4fr),
  inset: 6pt,
  stroke: 0.4pt + rule,
  fill: (_, row) => if row == 0 { navy } else if calc.odd(row) { surface } else { white },
  table.header(
    [#text(fill: white, weight: "bold")[Reported area]],
    [#text(fill: white, weight: "bold")[Status]],
    [#text(fill: white, weight: "bold")[Primary evidence]],
  ),
  [Trial charge notification], [#pill("VERIFIED")], [Historical Playwright],
  [API token input border], [#pill("VERIFIED")], [Playwright + WebDriverIO],
  [Application bottom whitespace], [#pill("VERIFIED")], [Playwright + WebDriverIO],
  [PEP relative/associate status], [#pill("VERIFIED")], [Playwright + real plugin run],
  [Shared target for combined entrypoints], [#pill("VERIFIED")], [Historical Playwright],
  [Country selection usability], [#pill("VERIFIED")], [Playwright + WebDriverIO],
  [Adverse activity emphasis in PDF], [#pill("VERIFIED")], [Generated PDF comparison],
  [Windows taskbar icon contrast], [#pill("IMPLEMENTED", tone: "blue")], [Source assets; Windows retest required],
  [Multiple Adversea matches], [#pill("OPEN", tone: "amber")], [Provider-dependent observation],
)

#v(5mm)
== Scope Boundary

The historical comparison uses deterministic Tauri IPC fixtures to isolate frontend
behavior at two Git revisions. The application verification uses a real debug binary,
real SQLite project creation, real Rust commands, and the real plugin runtime. It avoids
external API calls so the evidence remains repeatable and does not consume credentials.

= Verification Method

#grid(
  columns: (1fr, 1fr),
  gutter: 8mm,
  block(fill: surface, radius: 4pt, inset: 10pt)[
    #text(size: 11pt, weight: "bold", fill: blue)[A / Historical reconstruction]
    #v(2mm)
    Baseline `6a7f581` and fixed state `e824ad8` were checked out into isolated
    worktrees. The same deterministic dataset and viewport were run against both.
    Playwright recorded screenshots, videos, traces, and generated PDF output.
    #v(3mm)
    #pill("14/14 PASSED")
  ],
  block(fill: surface, radius: 4pt, inset: 10pt)[
    #text(size: 11pt, weight: "bold", fill: green)[B / Desktop application]
    #v(2mm)
    WebDriverIO started `src-tauri/target-wdio/debug/openrisk` through the embedded
    Tauri WebDriver. A temporary project and local verification plugin exercised
    persistence, manifest loading, plugin execution, result rendering, and settings.
    #v(3mm)
    #pill("3/3 PASSED")
  ],
)

#v(6mm)
#table(
  columns: (1.1fr, 2.3fr),
  inset: 6pt,
  stroke: 0.4pt + rule,
  fill: (_, row) => if calc.even(row) { surface } else { white },
  [Capture theme], [Light, normalized consistently across all report screenshots],
  [Historical browser], [Chromium via Playwright 1.59.1],
  [Desktop WebView], [WebKitGTK 605.1.15 through WebDriverIO],
  [Desktop backend], [Tauri v2 application with the real Rust command layer],
  [Plugin execution], [Local deterministic TypeScript plugin, no network calls],
  [Artifacts], [PNG, WebM, Playwright HTML report, trace data, JSON runtime metrics, PDF],
)

#v(5mm)
The desktop test invoked `create_project`, `update_project_settings`,
`upsert_project_plugin_from_dir`, `set_plugin_enabled`, `set_plugin_setting`,
`create_scan`, `run_scan`, and `close_project`. This verifies more than a browser-only
render while keeping external services out of the test boundary.

#evidence-page(
  "EV-01",
  "Trial charge notification",
  [Trial-mode scans no longer display a misleading `0.10 EUR` charge notification.],
  [dd65257],
  "generated/before/trial-charge-notification.png",
  "generated/after/trial-charge-notification.png",
  [The baseline displays the charge toast even though trial mode is active.],
  [The same trial scenario completes without the paid-usage notification.],
)

#evidence-page(
  "EV-02",
  "API token input border",
  [The secret-setting input now has consistent left and right borders and a safe inset from its scroll viewport.],
  [9d29577],
  "generated/before/api-token-border.png",
  "generated/after/api-token-border.png",
  [The left edge appears clipped where the input meets the settings viewport.],
  [The full input outline is visible; the real-app test also confirms equal computed border widths.],
)

#evidence-page(
  "EV-03",
  "Application scroll containment",
  [Overflow is contained inside the scan workspace instead of scrolling the document and exposing an empty bottom region.],
  [3a412b0],
  "generated/before/document-scroll-containment.png",
  "generated/after/document-scroll-containment.png",
  [The document moves when the selected entrypoints exceed the available height.],
  [The application chrome remains fixed while the central workspace owns vertical scrolling.],
)

#evidence-page(
  "EV-04",
  "Shared target across entrypoints",
  [A value entered once for a shared field is propagated to every selected entrypoint that declares that field.],
  [cddc3a8],
  "generated/before/shared-entrypoint-target.png",
  "generated/after/shared-entrypoint-target.png",
  [Combined execution reports that `target` is missing for one selected entrypoint.],
  [The same combined selection completes without a required-target error.],
)

#evidence-page(
  "EV-05",
  "PEP relative and close associate",
  [The person card distinguishes a direct PEP from a PEP relative or close associate and shows the relationship in place.],
  [3284915],
  "generated/before/pep-rca-status.png",
  "generated/after/pep-rca-status.png",
  [RCA information is not represented as a prominent domain status.],
  [The card displays `PEP: RCA` and the related person with relationship.],
)

#evidence-page(
  "EV-06",
  "Human-friendly country selection",
  [ISO 3166-1 alpha-2 values are presented through an alphabetized, searchable list of English country names.],
  [d7d4269],
  "generated/before/country-selector.png",
  "generated/after/country-selector.png",
  [The user must interpret and scan raw country codes.],
  [The user searches readable names while the plugin still receives the strict ISO code.],
)

#evidence-page(
  "EV-07",
  "Adverse activity emphasis in PDF",
  [Confirmed adverse activity is visually emphasized in exported evidence, not only represented as a boolean row.],
  [a4739ce],
  "generated/before/adverse-activity-crop.png",
  "generated/after/adverse-activity-crop.png",
  [The positive finding is visually indistinguishable from ordinary properties.],
  [A red heading and `ADVERSE ACTIVITY DETECTED` banner make the hit immediately visible.],
)

#application-page(
  "APP-01",
  "RCA result in the real Tauri application",
  "generated/application/webdriverio-fixed-rca.png",
  [A scan produced by the real plugin runtime renders `PEP: RCA`, `Robert Fico`, and `spouse` in the person result card.],
)

#application-page(
  "APP-02",
  "Fixed workspace scrolling in WebKitGTK",
  "generated/application/webdriverio-fixed-scroll.png",
  [With seven entrypoints enabled, the document remains at `scrollY = 0`; the inner content region scrolls from 1169 px to 1866 px.],
)

#application-page(
  "APP-03",
  "Masked secret setting in the real application",
  "generated/application/webdriverio-fixed-secret-setting.png",
  [The backend-provided `secret` metadata renders a populated password input with symmetric borders and a positive left inset.],
)

#pagebreak()
= Traceability

#table(
  columns: (1fr, 1.7fr, 2.6fr),
  inset: 6pt,
  stroke: 0.4pt + rule,
  fill: (_, row) => if row == 0 { navy } else if calc.odd(row) { surface } else { white },
  table.header(
    [#text(fill: white, weight: "bold")[Commit]],
    [#text(fill: white, weight: "bold")[Change]],
    [#text(fill: white, weight: "bold")[Verification]],
  ),
  [3a412b0], [Prevent document scrolling], [EV-03, APP-02],
  [9d29577], [Preserve settings input border], [EV-02, APP-03],
  [3284915], [Display PEP RCA status], [EV-05, APP-01],
  [dd65257], [Suppress trial charge toast], [EV-01],
  [cddc3a8], [Propagate shared entrypoint inputs], [EV-04],
  [264ad05], [Improve taskbar icon contrast], [Source review; Windows runtime pending],
  [d7d4269], [Searchable country select], [EV-06, application control check],
  [a4739ce], [Highlight adverse activity in PDF], [EV-07],
  [e824ad8], [Persist draft inputs], [Supporting scan-state reliability change],
)

#v(6mm)
== Evidence Integrity

- Historical screenshots were generated from the two identified Git revisions using the same fixture.
- All report screenshots use the light theme.
- The real application verification created a disposable project at `/tmp/openrisk-wdio-verification.orproj`.
- The test plugin is checked in under `evidence/fixtures/verification-plugin` and performs no HTTP requests.
- Machine-readable runtime measurements are stored in `generated/application/webdriverio-verification.json`.
- Playwright videos and the self-contained HTML report are retained under `generated/playwright-results` and `generated/playwright-html`.

#v(5mm)
== Limitations and Remaining Work

#block(
  width: 100%,
  fill: amber-soft,
  stroke: 0.6pt + rgb("#FEDF89"),
  radius: 4pt,
  inset: 10pt,
)[
  #text(weight: "bold", fill: amber)[Windows taskbar icon]
  #linebreak()
  The icon assets changed in commit `264ad05`, but this NixOS verification host cannot
  produce a Windows taskbar capture. Final acceptance should include one screenshot from
  the next signed Windows package.
]

#v(4mm)
#block(
  width: 100%,
  fill: amber-soft,
  stroke: 0.6pt + rgb("#FEDF89"),
  radius: 4pt,
  inset: 10pt,
)[
  #text(weight: "bold", fill: amber)[Multiple Adversea matches]
  #linebreak()
  This observation is not represented as a completed corrective action in the tested
  change range. The number of returned candidates depends on the external endpoint
  response and requires a provider-backed contract test or confirmed multi-result API
  fixture before it can be closed.
]

#v(6mm)
== Result

#block(
  width: 100%,
  fill: green-soft,
  stroke: 0.7pt + rgb("#75E0A7"),
  radius: 5pt,
  inset: 12pt,
)[
  #text(size: 14pt, weight: "bold", fill: green)[Verification passed]
  #v(2mm)
  The reproducible historical suite passed `14/14` checks and the real Tauri application
  suite passed `3/3` checks. The evidence supports the listed frontend, result-display,
  PDF, settings, and layout corrections, subject to the two explicitly stated
  platform/provider limitations.
]
