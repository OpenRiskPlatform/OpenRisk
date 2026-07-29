#let ink = rgb("#111111")
#let muted = rgb("#555555")
#let rule = rgb("#B8B8B8")

#set page(
  paper: "a4",
  flipped: true,
  margin: (top: 17mm, bottom: 17mm, left: 18mm, right: 18mm),
  header: context [
    #set text(size: 7.5pt, fill: muted)
    #grid(
      columns: (1fr, auto),
      [OPENRISK],
      [OPRAVY NAHLÁSENÝCH PROBLÉMOV],
    )
    #v(2mm)
    #line(length: 100%, stroke: 0.5pt + rule)
  ],
  footer: context [
    #line(length: 100%, stroke: 0.5pt + rule)
    #v(2mm)
    #set text(size: 7.5pt, fill: muted)
    #grid(
      columns: (1fr, auto),
      [OpenRiskPlatform],
      [#counter(page).display("1")],
    )
  ],
)

#set text(font: "DejaVu Sans", size: 9pt, fill: ink)
#set heading(numbering: none)
#show heading.where(level: 1): it => [
  #set text(size: 21pt, weight: "bold", fill: ink)
  #it.body
]

#let screenshot-page(title, state, image-path) = [
  #heading(level: 1)[#title]
  #v(4mm)
  #text(size: 9pt, weight: "bold", fill: ink)[#state]
  #v(2mm)
  #block(
    width: 100%,
    height: 142mm,
    fill: white,
    stroke: 0.7pt + rule,
    inset: 3pt,
  )[
    #align(center + horizon)[
      #image(image-path, width: 100%, height: 136mm, fit: "contain")
    ]
  ]
]

#let comparison(title, before, after, first: false) = [
  #if not first {
    pagebreak()
  }
  #screenshot-page(title, "PRED OPRAVOU", before)
  #pagebreak()
  #screenshot-page(title, "PO OPRAVE", after)
]

// Titulná strana
#set page(header: none, footer: none)
#align(center + horizon)[
  #text(size: 14pt, weight: "bold", fill: ink)[OPENRISK PLATFORM]
  #v(8mm)
  #text(size: 34pt, weight: "bold", fill: ink)[
    Opravy nahlásených problémov
  ]
  #v(8mm)
  #line(length: 72mm, stroke: 1pt + ink)
]

#pagebreak()
#set page(
  header: context [
    #set text(size: 7.5pt, fill: muted)
    #grid(
      columns: (1fr, auto),
      [OPENRISK],
      [OPRAVY NAHLÁSENÝCH PROBLÉMOV],
    )
    #v(2mm)
    #line(length: 100%, stroke: 0.5pt + rule)
  ],
  footer: context [
    #line(length: 100%, stroke: 0.5pt + rule)
    #v(2mm)
    #set text(size: 7.5pt, fill: muted)
    #grid(
      columns: (1fr, auto),
      [OpenRiskPlatform],
      [#counter(page).display("1")],
    )
  ],
)

#comparison(
  "OpenSanctions počas TRIAL zobrazuje cenu 0,10 EUR",
  "generated/before/trial-charge-notification.png",
  "generated/after/trial-charge-notification.png",
  first: true,
)

#comparison(
  "Orezaný ľavý okraj pri pridávaní API kľúča",
  "generated/before/api-token-border.png",
  "generated/after/api-token-border.png",
)

#comparison(
  "Prázdny priestor naspodku aplikácie",
  "generated/before/document-scroll-containment.png",
  "generated/after/document-scroll-containment.png",
)

#comparison(
  "Adversea Unit Analysis + PEP/Sanctions: „target is required“",
  "generated/before/shared-entrypoint-target.png",
  "generated/after/shared-entrypoint-target.png",
)

#comparison(
  "Svetlana Ficová: chýbajúce označenie PEP:RCA",
  "generated/before/pep-rca-status.png",
  "generated/after/pep-rca-status.png",
)

#comparison(
  "Adversea: neprehľadný výber krajiny",
  "generated/before/country-selector.png",
  "generated/after/country-selector.png",
)

#comparison(
  "Svetlana Ficová: zvýraznenie TRUE nálezu v PDF",
  "generated/before/adverse-activity-crop.png",
  "generated/after/adverse-activity-crop.png",
)
