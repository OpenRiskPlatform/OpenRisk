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
    [#pill("REPORTED CONDITION", tone: "amber")],
  )
  #block(
    width: 100%,
    fill: blue-soft,
    stroke: 0.5pt + rgb("#B2DDFF"),
    radius: 4pt,
    inset: 9pt,
  )[
    #text(weight: "bold", fill: blue)[Outcome]  #finding
  ]
  #v(3mm)
  #text(size: 9pt, weight: "bold", fill: red)[BEFORE]
  #v(1.5mm)
  #block(
    width: 100%,
    height: 116mm,
    fill: white,
    stroke: 0.7pt + rule,
    radius: 3pt,
    inset: 3pt,
  )[
    #align(center + horizon)[#image(before, width: 100%, height: 110mm, fit: "contain")]
  ]
  #v(2mm)
  #text(size: 8.5pt, fill: gray)[#before-note]

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
    fill: green-soft,
    stroke: 0.5pt + rgb("#ABEFC6"),
    radius: 4pt,
    inset: 9pt,
  )[
    #text(weight: "bold", fill: green)[Outcome]  #finding
  ]
  #v(3mm)
  #text(size: 9pt, weight: "bold", fill: green)[AFTER]
  #v(1.5mm)
  #block(
    width: 100%,
    height: 116mm,
    fill: white,
    stroke: 0.7pt + rule,
    radius: 3pt,
    inset: 3pt,
  )[
    #align(center + horizon)[#image(after, width: 100%, height: 110mm, fit: "contain")]
  ]
  #v(2mm)
  #text(size: 8.5pt, fill: gray)[#after-note]
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
    [#pill("DESKTOP VERIFIED", tone: "blue")],
  )
  #block(
    width: 100%,
    fill: green-soft,
    stroke: 0.5pt + rgb("#ABEFC6"),
    radius: 4pt,
    inset: 9pt,
  )[
    #text(weight: "bold", fill: green)[Verified outcome]  #finding
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
    #text(size: 32pt, weight: "bold", fill: navy)[Executive Corrective]
    #linebreak()
    #text(size: 32pt, weight: "bold", fill: navy)[Action Report]
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
      A management-level account of the reported issues, the user-facing
      corrections, and the evidence supporting release readiness.
    ]
    #v(10mm)
    #grid(
      columns: (1fr, 1fr, 1fr),
      gutter: 5mm,
      block(fill: surface, radius: 4pt, inset: 10pt)[
        #text(size: 23pt, weight: "bold", fill: blue)[7]
        #linebreak()
        #text(size: 8pt, fill: gray)[Visual corrections verified]
      ],
      block(fill: surface, radius: 4pt, inset: 10pt)[
        #text(size: 23pt, weight: "bold", fill: green)[3]
        #linebreak()
        #text(size: 8pt, fill: gray)[Desktop workflows confirmed]
      ],
      block(fill: surface, radius: 4pt, inset: 10pt)[
        #text(size: 23pt, weight: "bold", fill: amber)[2]
        #linebreak()
        #text(size: 8pt, fill: gray)[Follow-up checks identified]
      ],
    )
  ],
  [
    #block(fill: navy, radius: 5pt, inset: 13pt)[
      #set text(fill: white)
      #text(size: 8pt, weight: "bold")[ASSESSMENT]
      #v(3mm)
      #text(size: 9pt)[Audience]
      #linebreak()
      #text(weight: "bold")[Executive / project]
      #v(3mm)
      #text(size: 9pt)[Evidence format]
      #linebreak()
      #text(weight: "bold")[Before / after]
      #v(3mm)
      #text(size: 9pt)[Prepared]
      #linebreak()
      #text(weight: "bold")[29 July 2026]
    ]
  ],
)
#v(17mm)
#text(size: 8.5pt, fill: gray)[
  This report focuses on visible outcomes, user impact, and remaining acceptance work.
  Detailed technical test artifacts are retained separately for the development team.
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

Seven reported usability and result-presentation issues were corrected and verified
through controlled before/after comparisons. Three representative workflows were also
confirmed in the desktop application. The assessed corrections improve clarity,
reduce misleading feedback, and make investigation results easier to understand.

#v(3mm)
#block(
  width: 100%,
  fill: green-soft,
  stroke: 0.6pt + rgb("#75E0A7"),
  radius: 4pt,
  inset: 9pt,
)[
  #text(weight: "bold", fill: green)[Management conclusion]
  The tested visual and workflow corrections are suitable for release. Final acceptance
  still requires a Windows taskbar check, while the number of Adversea matches remains
  dependent on the external data provider.
]

#v(4mm)
#table(
  columns: (2.2fr, 0.9fr, 1.4fr),
  inset: 6pt,
  stroke: 0.4pt + rule,
  fill: (_, row) => if row == 0 { navy } else if calc.odd(row) { surface } else { white },
  table.header(
    [#text(fill: white, weight: "bold")[Reported area]],
    [#text(fill: white, weight: "bold")[Status]],
    [#text(fill: white, weight: "bold")[Verification]],
  ),
  [Trial charge notification], [#pill("VERIFIED")], [Before/after comparison],
  [API token field], [#pill("VERIFIED")], [Comparison and desktop check],
  [Application bottom whitespace], [#pill("VERIFIED")], [Comparison and desktop check],
  [PEP relative/associate status], [#pill("VERIFIED")], [Comparison and result check],
  [Shared search target], [#pill("VERIFIED")], [Combined-search check],
  [Country selection usability], [#pill("VERIFIED")], [Comparison and desktop check],
  [Adverse activity emphasis in PDF], [#pill("VERIFIED")], [Exported PDF comparison],
  [Windows taskbar icon contrast], [#pill("IMPLEMENTED", tone: "blue")], [Windows package check pending],
  [Multiple Adversea matches], [#pill("OPEN", tone: "amber")], [Provider confirmation required],
)

#v(5mm)
== Scope Boundary

The report verifies the behavior controlled by OpenRisk. External service availability
and the number of records returned by a provider are outside this acceptance boundary.
Repeatable local data was used where external calls would make the comparison unstable.

= Verification Method

#grid(
  columns: (1fr, 1fr),
  gutter: 8mm,
  block(fill: surface, radius: 4pt, inset: 10pt)[
    #text(size: 11pt, weight: "bold", fill: blue)[A / Controlled comparison]
    #v(2mm)
    The reported and corrected versions were reviewed under the same conditions,
    using the same data, screen size, and light theme. This makes the visible
    difference attributable to the correction.
    #v(3mm)
    #pill("14/14 PASSED")
  ],
  block(fill: surface, radius: 4pt, inset: 10pt)[
    #text(size: 11pt, weight: "bold", fill: green)[B / Desktop workflow check]
    #v(2mm)
    Representative tasks were completed in the desktop application to confirm
    that the corrections work within normal project, search, result, and
    settings workflows.
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
  [Visual consistency], [All screenshots use the light theme and the same comparison conditions],
  [Application coverage], [Projects, combined searches, results, settings, and PDF output],
  [Test data], [Repeatable local scenarios that do not depend on provider availability],
  [Supporting evidence], [Screenshots, recordings, automated results, and generated PDF output],
)

#v(5mm)
The following pages present the reported condition and corrected result at full
page width. Each comparison is followed by selected confirmation from the desktop
application where this adds useful assurance.

#evidence-page(
  "EV-01",
  "Trial charge notification",
  [Trial users are no longer shown a misleading `0.10 EUR` charge.],
  "generated/before/trial-charge-notification.png",
  "generated/after/trial-charge-notification.png",
  [A charge appears even though the user is operating within the free trial.],
  [The trial search completes without suggesting that the user has been charged.],
)

#evidence-page(
  "EV-02",
  "API token input border",
  [The API token field is fully visible and visually consistent on every side.],
  "generated/before/api-token-border.png",
  "generated/after/api-token-border.png",
  [The left edge of the field appears clipped in the settings window.],
  [The complete field outline is visible and aligned with the surrounding settings.],
)

#evidence-page(
  "EV-03",
  "Application scroll containment",
  [Long search forms scroll within the workspace without moving the whole application or exposing empty space.],
  "generated/before/document-scroll-containment.png",
  "generated/after/document-scroll-containment.png",
  [The entire application can move when several search options exceed the available height.],
  [Navigation and the application frame stay fixed while only the working area scrolls.],
)

#evidence-page(
  "EV-04",
  "Shared target across selected checks",
  [A search target entered once is reused across all selected checks that need it.],
  "generated/before/shared-entrypoint-target.png",
  "generated/after/shared-entrypoint-target.png",
  [A combined search can report that the target is missing even though the user entered it.],
  [The same combined search accepts the entered target and proceeds normally.],
)

#evidence-page(
  "EV-05",
  "PEP relative and close associate",
  [Results now distinguish a direct PEP from a relative or close associate and show the known relationship.],
  "generated/before/pep-rca-status.png",
  "generated/after/pep-rca-status.png",
  [The relationship to a politically exposed person is not clearly visible.],
  [The result clearly shows `PEP: RCA`, the related person, and the relationship.],
)

#evidence-page(
  "EV-06",
  "Human-friendly country selection",
  [Country codes are presented as an alphabetized, searchable list of readable country names.],
  "generated/before/country-selector.png",
  "generated/after/country-selector.png",
  [The user must interpret and scan a list of technical country codes.],
  [The user can search and select a country by its normal English name.],
)

#evidence-page(
  "EV-07",
  "Adverse activity emphasis in PDF",
  [Confirmed adverse activity is prominently highlighted in exported PDF reports.],
  "generated/before/adverse-activity-crop.png",
  "generated/after/adverse-activity-crop.png",
  [A positive finding is difficult to distinguish from ordinary report details.],
  [A red heading and warning banner make the adverse finding immediately visible.],
)

#application-page(
  "APP-01",
  "RCA result in the desktop application",
  "generated/application/webdriverio-fixed-rca.png",
  [A completed search clearly presents `PEP: RCA`, the related person, and the relationship in the result.],
)

#application-page(
  "APP-02",
  "Stable application scrolling",
  "generated/application/webdriverio-fixed-scroll.png",
  [With several search options enabled, the application frame remains fixed and the working area scrolls normally.],
)

#application-page(
  "APP-03",
  "Protected API token setting",
  "generated/application/webdriverio-fixed-secret-setting.png",
  [The saved API token remains masked while the input outline stays complete and clearly visible.],
)

#pagebreak()
= Delivery Assessment

#table(
  columns: (2fr, 2.5fr, 1fr),
  inset: 6pt,
  stroke: 0.4pt + rule,
  fill: (_, row) => if row == 0 { navy } else if calc.odd(row) { surface } else { white },
  table.header(
    [#text(fill: white, weight: "bold")[Reported issue]],
    [#text(fill: white, weight: "bold")[Delivered outcome]],
    [#text(fill: white, weight: "bold")[Status]],
  ),
  [Misleading trial charge], [No paid-use message during the free trial], [#pill("VERIFIED")],
  [Clipped API token field], [Complete, aligned, masked input], [#pill("VERIFIED")],
  [Empty space below application], [Scrolling remains inside the work area], [#pill("VERIFIED")],
  [Missing PEP relationship status], [RCA status and relationship shown clearly], [#pill("VERIFIED")],
  [Combined search target error], [One target supports all selected checks], [#pill("VERIFIED")],
  [Unfriendly country list], [Searchable list of readable country names], [#pill("VERIFIED")],
  [Unclear adverse PDF result], [Positive finding receives prominent warning], [#pill("VERIFIED")],
  [Low-contrast Windows icon], [Higher-contrast icon prepared], [#pill("CHECK", tone: "amber")],
  [Unexpected number of matches], [Provider behavior isolated for follow-up], [#pill("OPEN", tone: "amber")],
)

#v(6mm)
== Evidence Integrity

- Before and after screenshots were generated independently under the same conditions.
- All report screenshots use the light theme.
- Representative results were confirmed inside the desktop application.
- Repeatable local data was used so provider availability could not change the outcome.
- Supporting recordings and machine-readable test results are retained for audit.

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
  A higher-contrast icon has been prepared, but this verification environment cannot
  produce a Windows taskbar capture. Final acceptance should include one screenshot
  from the next signed Windows package.
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
  The number of returned candidates depends on the external provider. This item
  requires confirmation using a provider response that contains multiple matches
  before it can be closed.
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
  #text(size: 14pt, weight: "bold", fill: green)[Ready for the tested scope]
  #v(2mm)
  The evidence supports the listed corrections to notifications, settings, layout,
  search inputs, result presentation, and PDF output. No blocking issue was found in
  the tested desktop workflows. The Windows icon and provider-dependent match count
  remain explicit follow-up items.
]
