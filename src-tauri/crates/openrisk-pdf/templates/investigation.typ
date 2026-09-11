#let payload = json("report.json")
#let report = payload.report

#let ink = rgb("#1E1E1E")
#let muted = rgb("#666666")
#let rule = rgb("#B8B8B8")
#let light-rule = rgb("#DDDDDD")

#set document(
  title: payload.brandName + " Investigation Report - " + report.scan.title,
  author: payload.brandName,
  description: "Investigation results for " + report.project.name,
  date: auto,
)
#set text(
  font: "Noto Sans",
  size: 9.5pt,
  fill: ink,
  lang: report.locale.split("-").first(),
  fallback: false,
)
#set par(leading: 0.58em, justify: false)
#show heading.where(level: 1): it => {
  block(
    breakable: false,
    above: 0pt,
    below: 10pt,
  )[
    #text(size: 14pt, weight: 650)[#it.body]
    #v(4pt)
    #line(length: 100%, stroke: 0.8pt + ink)
  ]
}

#show heading.where(level: 2): it => {
  block(
    breakable: false,
    above: 0pt,
    below: 8pt,
  )[
    #text(size: 11pt, weight: 650)[#it.body]
    #v(3pt)
    #line(length: 100%, stroke: 0.45pt + rule)
  ]
}

#set page(
  paper: "a4",
  margin: (top: 22mm, bottom: 18mm, left: 22mm, right: 18mm),
  header: context {
    if counter(page).get().first() > 1 {
      grid(
        columns: (1fr, auto),
        align: (left, right),
        if payload.brandLogoPath != none {
          image(payload.brandLogoPath, width: 28mm, alt: payload.brandName)
        } else {
          text(size: 7.5pt, weight: 600)[OPENRISK]
        },
        text(size: 7.5pt, fill: muted)[Investigation Report],
      )
      v(4pt)
      line(length: 100%, stroke: 0.5pt + rule)
    }
  },
  footer: context {
    line(length: 100%, stroke: 0.5pt + rule)
    v(4pt)
    grid(
      columns: (1fr, auto),
      if payload.brandLogoPath != none {
        image(payload.brandLogoPath, width: 22mm, alt: payload.brandName)
      } else {
        text(size: 7pt, fill: muted)[OpenRisk]
      },
      text(size: 7pt, fill: muted)[Page #counter(page).display("1 / 1", both: true)],
    )
  },
)

#let scalar(value) = {
  let kind = type(value)
  value == none or kind == str or kind == int or kind == float or kind == bool
}

#let typed-value(value) = (
  type(value) == dictionary and "$type" in value and "value" in value
)

#let unwrap(value) = if typed-value(value) {
  value.at("value")
} else {
  value
}

#let primitive(value) = {
  if value == none {
    [null]
  } else if type(value) == bool {
    if value { [true] } else { [false] }
  } else {
    str(value)
  }
}

#let key-value-table(rows, compact: false) = {
  let cells = ()
  let cell-inset = (top: 2pt, bottom: 2pt, left: 0pt, right: 0pt)

  for row in rows {
    cells.push(table.cell(
      align: left + horizon,
      inset: cell-inset + (right: 9pt),
    )[
      #text(
        size: if compact { 7.6pt } else { 8.4pt },
        fill: muted,
      )[#row.at("key")]
    ])
    cells.push(table.cell(
      align: left + horizon,
      inset: cell-inset,
    )[
      #text(size: if compact { 7.6pt } else { 8.7pt })[#row.at("value")]
    ])
  }

  block(
    width: if compact { 100% } else { 80% },
    breakable: true,
    above: 0pt,
    below: 0pt,
  )[
    #table(
      columns: (34%, 66%),
      rows: auto,
      column-gutter: 0pt,
      row-gutter: 0pt,
      inset: 0pt,
      align: left + horizon,
      stroke: (x, y) => (bottom: 0.3pt + light-rule),
      ..cells,
    )
  ]
}

#let key-value-row(key, value, compact: false) = key-value-table(
  ((key: key, value: value),),
  compact: compact,
)

#let value-view(value, depth: 0) = {
  if typed-value(value) {
    value-view(value.at("value"), depth: depth)
  } else if scalar(value) {
    primitive(value)
  } else if type(value) == array {
    if value.len() == 0 {
      [[]]
    } else if value.all(item => scalar(unwrap(item))) {
      value.map(item => primitive(unwrap(item))).join([; ])
    } else {
      for (index, item) in value.enumerate() {
        if index > 0 {
          v(3pt)
        }
        block(
          breakable: true,
          inset: (left: if depth > 0 { 7pt } else { 0pt }),
        )[
          #if value.len() > 1 {
            text(size: 7pt, fill: muted)[Item #(index + 1)]
            linebreak()
          }
          #value-view(item, depth: depth + 1)
        ]
      }
    }
  } else if type(value) == dictionary {
    for (key, nested) in value.pairs() {
      key-value-row(key, value-view(nested, depth: depth + 1), compact: depth > 0)
    }
  } else {
    str(value)
  }
}

#let extra-view(extra) = {
  let unwrapped = unwrap(extra)
  if type(unwrapped) == array {
    for item in unwrapped {
      let item = unwrap(item)
      if type(item) == dictionary and "key" in item and "value" in item {
        key-value-row(str(unwrap(item.at("key"))), value-view(item.at("value")))
      } else {
        value-view(item)
      }
    }
  } else if type(unwrapped) == dictionary {
    for (key, value) in unwrapped.pairs() {
      key-value-row(key, value-view(value))
    }
  } else {
    value-view(unwrapped)
  }
}

#let source-row(source, index) = block(
  breakable: false,
  inset: (y: 2pt),
)[
  #if type(source) == dictionary {
    let name = source.at("name", default: "Source")
    let target = source.at("source", default: "")
    grid(
      columns: (18pt, 1fr),
      [#(index + 1).],
      [
        #text(weight: 600)[#name]
        #if target != "" {
          linebreak()
          if type(target) == str and (target.starts-with("https://") or target.starts-with("http://")) {
            link(target)[#target]
          } else {
            [#target]
          }
        }
      ],
    )
  } else {
    grid(columns: (18pt, 1fr), [#(index + 1).], value-view(source))
  }
]

#let source-list(sources) = {
  if type(sources) == array and sources.len() > 0 {
    v(7pt)
    block(breakable: false)[
      #text(size: 8.5pt, weight: 650)[SOURCES]
      #v(3pt)
      #source-row(sources.first(), 0)
    ]
    for (index, source) in sources.slice(1).enumerate() {
      source-row(source, index + 1)
    }
  }
}

#let entity-view(entity, index) = {
  let rows = ()
  let loose-extra = ()
  let props = entity.at("$props", default: none)
  if type(props) == dictionary {
    for (key, value) in props.pairs() {
      rows.push((key: key, value: value-view(value)))
    }
  }

  if "$extra" in entity {
    let extra = unwrap(entity.at("$extra"))
    if type(extra) == array {
      for item in extra {
        let item = unwrap(item)
        if type(item) == dictionary and "key" in item and "value" in item {
          rows.push((
            key: str(unwrap(item.at("key"))),
            value: value-view(item.at("value")),
          ))
        } else {
          loose-extra.push(item)
        }
      }
    } else if type(extra) == dictionary {
      for (key, value) in extra.pairs() {
        rows.push((key: key, value: value-view(value)))
      }
    } else {
      loose-extra.push(extra)
    }
  }

  let internal = ("$modelVersion", "$entity", "$id", "$props", "$extra", "$sources")
  for (key, value) in entity.pairs() {
    if key not in internal {
      rows.push((key: key, value: value-view(value)))
    }
  }

  let sources = entity.at("$sources", default: none)
  let source-count = if type(sources) == array { sources.len() } else { 0 }
  let keep-together = rows.len() <= 10 and loose-extra.len() == 0 and source-count <= 3

  block(
    breakable: not keep-together,
    above: 0pt,
    below: 8pt,
  )[
    #heading(level: 2)[Result #(index + 1)]
    #if rows.len() > 0 {
      key-value-table(rows)
    }

    #for item in loose-extra {
      value-view(item)
    }

    #source-list(sources)
  ]
}

#let result-block(title, body) = block(
  breakable: false,
  above: 0pt,
  below: 8pt,
)[
  #heading(level: 2)[#title]
  #body
]

#let execution-output(execution) = {
  if not execution.ok {
    result-block("Result 1", key-value-row("Status", [Failed]))
  } else {
    let data = execution.at("data", default: none)
    if data == none {
      result-block("Result 1", [No result data.])
    } else if type(data) == array and data.all(item =>
      type(item) == dictionary and "$entity" in item and "$id" in item
    ) {
      if data.len() == 0 {
        result-block("Result 1", [No result data.])
      } else {
        for (index, entity) in data.enumerate() {
          entity-view(entity, index)
        }
      }
    } else if type(data) == dictionary and "$entity" in data and "$id" in data {
      entity-view(data, 0)
    } else {
      result-block("Result 1", value-view(data))
    }
  }
}

#let execution-inputs(execution) = {
  report.inputs.filter(input => {
    if execution.entrypointId != "" and input.entrypointId != "" {
      input.entrypointId == execution.entrypointId and (
        execution.pluginId == "" or input.pluginId == execution.pluginId
      )
    } else {
      true
    }
  })
}

#let input-data(execution) = {
  let rows = ()
  let seen = ()
  for input in execution-inputs(execution) {
    let signature = input.fieldName + repr(input.value)
    if signature not in seen {
      seen.push(signature)
      rows.push((key: input.fieldName, value: value-view(input.value)))
    }
  }
  rows
}

// Plain institutional masthead, optionally replaced for a white-label build.
#if payload.brandLogoPath != none {
  image(payload.brandLogoPath, width: 42mm, alt: payload.brandName)
} else {
  text(size: 9pt, weight: 650, tracking: 0.08em)[OPENRISK]
}
#v(4pt)
#line(length: 100%, stroke: 1pt + ink)
#v(18pt)
#text(size: 19pt, weight: 650)[INVESTIGATION REPORT]
#v(16pt)

#key-value-row("Project", report.project.name)
#key-value-row("Investigation", report.scan.title)
#key-value-row("Date", report.scan.createdAt)
#key-value-row("Status", report.scan.status)
#if report.project.audit != none {
  key-value-row("Reference", report.project.audit)
}

#if report.includeSearchDetails and not report.includeResults {
  text(size: 8.5pt, weight: 650)[INPUT DATA]
  v(3pt)
  if report.inputs.len() == 0 {
    [No input data.]
  } else {
    let rows = ()
    let seen = ()
    for input in report.inputs {
      let signature = input.fieldName + repr(input.value)
      if signature not in seen {
        seen.push(signature)
        rows.push((key: input.fieldName, value: value-view(input.value)))
      }
    }
    key-value-table(rows)
  }
}

#if report.includeResults {
  v(18pt)
  if report.executions.len() == 0 {
    [No result data.]
  } else {
    for (index, execution) in report.executions.enumerate() {
      if index > 0 {
        pagebreak()
      }
      heading(level: 1)[#execution.entrypointName]
      if report.includeSearchDetails {
        let rows = input-data(execution)
        text(size: 8.5pt, weight: 650)[INPUT DATA]
        v(3pt)
        if rows.len() == 0 {
          [No input data.]
        } else {
          key-value-table(rows)
        }
        v(8pt)
      }
      execution-output(execution)
    }
  }
}
