import Foundation
import SwiftUI

struct NativeScanResultView: View {
  let detail: NativeScanDetail
  let plugins: [NativePlugin]
  let isRunning: Bool
  let advancedMode: Bool

  @State private var selectedResultKey: String?
  @State private var searchDetailsExpanded = false

  private var selectedResult: NativeScanResult? {
    if let selectedResultKey {
      return detail.results.first { resultKey($0) == selectedResultKey }
    }
    return detail.results.first
  }

  var body: some View {
    ScrollView {
      LazyVStack(alignment: .leading, spacing: 0) {
        header
          .padding(.bottom, 22)

        Divider()

        if advancedMode {
          inputSummary
            .padding(.vertical, 22)
          Divider()
        } else if !detail.inputs.isEmpty {
          VStack(alignment: .leading, spacing: 0) {
            Button {
              withAnimation(.easeInOut(duration: 0.16)) {
                searchDetailsExpanded.toggle()
              }
            } label: {
              HStack(spacing: 8) {
                Image(
                  systemName: searchDetailsExpanded
                    ? "chevron.down"
                    : "chevron.right"
                )
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                Text("Search details")
                  .font(.headline)
                  .foregroundStyle(.primary)
                Spacer()
                Text("\(detail.inputs.count) parameters")
                  .font(.caption)
                  .foregroundStyle(.secondary)
              }
              .padding(.vertical, 16)
              .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if searchDetailsExpanded {
              inputSummary
                .padding(.bottom, 18)
            }
          }
          Divider()
        }

        results
          .padding(.vertical, 24)
      }
      .padding(.horizontal, 36)
      .padding(.top, 28)
      .frame(maxWidth: 1040, alignment: .leading)
      .frame(maxWidth: .infinity)
    }
    .navigationTitle(detail.preview ?? "Untitled")
    .onAppear {
      if selectedResultKey == nil {
        selectedResultKey = detail.results.first.map(resultKey)
      }
    }
    .onChange(of: detail.results) { _, results in
      if let selectedResultKey,
        results.contains(where: { resultKey($0) == selectedResultKey })
      {
        return
      }
      selectedResultKey = results.first.map(resultKey)
    }
  }

  private var header: some View {
    HStack(alignment: .top, spacing: 18) {
      VStack(alignment: .leading, spacing: 6) {
        Text(detail.preview ?? "Untitled")
          .font(.title2.weight(.semibold))

        Text(advancedMode ? "Created \(detail.createdAt)" : "Investigation results")
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }

      Spacer()

      if isRunning {
        HStack(spacing: 8) {
          ProgressView()
            .controlSize(.small)
          Text("In progress")
        }
        .font(.subheadline)
        .foregroundStyle(.secondary)
      } else if hasFailures
        || ["failed", "error"].contains(detail.status.lowercased())
      {
        ScanStatusLabel(status: "Failed")
      }
    }
  }

  private var hasFailures: Bool {
    detail.results.contains { !$0.ok }
  }

  private var inputSummary: some View {
    VStack(alignment: .leading, spacing: 14) {
      if advancedMode {
        Text("Search parameters")
          .font(.headline)
      }

      LazyVGrid(
        columns: [GridItem(.adaptive(minimum: 240), spacing: 28)],
        alignment: .leading,
        spacing: 14
      ) {
        ForEach(Array(detail.inputs.enumerated()), id: \.offset) { _, input in
          VStack(alignment: .leading, spacing: 3) {
            Text(inputTitle(input))
              .font(.caption)
              .foregroundStyle(.secondary)
            Text(friendlyScalar(json: input.valueJson))
              .textSelection(.enabled)
          }
        }
      }
    }
  }

  @ViewBuilder
  private var results: some View {
    VStack(alignment: .leading, spacing: 18) {
      HStack(alignment: .firstTextBaseline) {
        VStack(alignment: .leading, spacing: 4) {
          Text("Results")
            .font(.headline)
          Text(
            isRunning
              ? "You can continue working while OpenRisk searches."
              : "\(detail.results.count) checks completed"
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }
        Spacer()
      }

      if !detail.results.isEmpty {
        resultTabs

        if let selectedResult {
          ResultOutput(
            result: selectedResult,
            advancedMode: advancedMode
          )
          .id(resultKey(selectedResult))
        }
      } else if isRunning {
        HStack(spacing: 10) {
          ProgressView()
            .controlSize(.small)
          Text("Waiting for results…")
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 20)
      } else {
        ContentUnavailableView(
          "No Results",
          systemImage: "doc.text.magnifyingglass",
          description: Text("This investigation did not return any results.")
        )
      }
    }
  }

  private var resultTabs: some View {
    ScrollView(.horizontal) {
      HStack(spacing: 20) {
        ForEach(detail.results, id: \.self) { result in
          let key = resultKey(result)
          Button {
            selectedResultKey = key
          } label: {
            VStack(spacing: 8) {
              HStack(spacing: 6) {
                if !result.ok {
                  Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
                }
                Text(resultTitle(result))
                  .lineLimit(1)
              }
              .foregroundStyle(.primary)

              Rectangle()
                .fill(
                  selectedResultKey == key
                    ? Color.accentColor
                    : Color.clear
                )
                .frame(height: 2)
            }
          }
          .buttonStyle(.plain)
        }
      }
    }
    .scrollIndicators(.hidden)
  }

  private func resultKey(_ result: NativeScanResult) -> String {
    "\(result.pluginId)::\(result.entrypointId)"
  }

  private func resultTitle(_ result: NativeScanResult) -> String {
    guard let plugin = plugins.first(where: { $0.id == result.pluginId }) else {
      return result.entrypointId
    }
    let entrypoint = plugin.entrypoints.first { $0.id == result.entrypointId }
    guard let entrypoint else {
      return plugin.name
    }
    return advancedMode
      ? "\(plugin.name) · \(entrypoint.name)"
      : entrypoint.name
  }

  private func inputTitle(_ input: NativeScanInput) -> String {
    plugins
      .first(where: { $0.id == input.pluginId })?
      .inputs
      .first(where: {
        $0.entrypointId == input.entrypointId && $0.name == input.fieldName
      })?
      .title ?? input.fieldName
  }

  private func friendlyScalar(json: String) -> String {
    guard
      let data = json.data(using: .utf8),
      let value = try? JSONSerialization.jsonObject(
        with: data,
        options: .fragmentsAllowed
      )
    else {
      return json
    }
    return officeScalar(value) ?? json
  }
}

private struct ScanStatusLabel: View {
  let status: String

  @ViewBuilder
  var body: some View {
    if let symbol {
      Label(title, systemImage: symbol)
        .font(.subheadline)
        .foregroundStyle(color)
    } else {
      Text(title)
        .font(.subheadline)
        .foregroundStyle(color)
    }
  }

  private var title: String {
    switch status.lowercased() {
    case "completed", "complete", "success":
      return "Completed"
    case "failed", "error":
      return "Failed"
    case "draft":
      return "Draft"
    case "running":
      return "In progress"
    default:
      return status
    }
  }

  private var symbol: String? {
    switch status.lowercased() {
    case "completed", "complete", "success":
      return nil
    case "failed", "error":
      return "exclamationmark.triangle.fill"
    case "draft":
      return "pencil"
    case "running":
      return "clock"
    default:
      return "questionmark.circle.fill"
    }
  }

  private var color: Color {
    switch status.lowercased() {
    case "failed", "error":
      return .red
    case "draft", "running":
      return .secondary
    case "completed", "complete", "success":
      return .secondary
    default:
      return .orange
    }
  }
}

private struct ResultOutput: View {
  let result: NativeScanResult
  let advancedMode: Bool

  @State private var searchText = ""

  private var decodedData: Any? {
    guard
      let json = result.dataJson,
      let data = json.data(using: .utf8)
    else {
      return nil
    }
    return try? JSONSerialization.jsonObject(
      with: data,
      options: .fragmentsAllowed
    )
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      if !result.ok {
        Label(
          result.error ?? "The check could not be completed.",
          systemImage: "exclamationmark.triangle.fill"
        )
        .foregroundStyle(.red)
        .padding(.vertical, 8)
      }

      if advancedMode {
        advancedOutput
      } else {
        officeOutput
      }
    }
  }

  @ViewBuilder
  private var officeOutput: some View {
    if let entities = decodedData as? [[String: Any]],
      entities.allSatisfy({ $0["$entity"] != nil })
    {
      if entities.allSatisfy({ ($0["$entity"] as? String) == "entity.riskTopic" }) {
        RiskTopicOfficeView(entities: entities)
      } else {
        OfficeEntityResultsView(
          entities: entities,
          searchText: $searchText
        )
      }
    } else if let decodedData {
      OfficeGenericResultView(value: decodedData)
    } else if result.ok {
      Text("No data returned")
        .foregroundStyle(.secondary)
    }
  }

  @ViewBuilder
  private var advancedOutput: some View {
    if let entities = decodedData as? [[String: Any]],
      entities.allSatisfy({ $0["$entity"] != nil })
    {
      LazyVStack(alignment: .leading, spacing: 0) {
        ForEach(Array(entities.enumerated()), id: \.offset) { index, entity in
          AdvancedEntityResultView(entity: entity)
          if index != entities.indices.last {
            Divider()
              .padding(.vertical, 20)
          }
        }
      }
    } else if let decodedData {
      JSONValueView(value: decodedData)
    } else if result.ok {
      Text("No data returned")
        .foregroundStyle(.secondary)
    }

    if !result.logs.isEmpty {
      DisclosureGroup("Technical log") {
        VStack(alignment: .leading, spacing: 6) {
          ForEach(Array(result.logs.enumerated()), id: \.offset) { _, log in
            Text(log)
              .font(.system(.caption, design: .monospaced))
              .textSelection(.enabled)
          }
        }
        .padding(.top, 8)
      }
      .foregroundStyle(.secondary)
    }
  }
}
