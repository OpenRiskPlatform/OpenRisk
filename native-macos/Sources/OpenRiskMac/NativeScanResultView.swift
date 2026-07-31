import Foundation
import SwiftUI

struct NativeScanResultView: View {
    let detail: NativeScanDetail
    let plugins: [NativePlugin]
    let isRunning: Bool

    @AppStorage("openrisk.native.resultsAdvancedMode")
    private var advancedMode = false
    @State private var selectedResultKey: String?

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
                    DisclosureGroup("Search details") {
                        inputSummary
                            .padding(.top, 14)
                    }
                    .padding(.vertical, 16)
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
               results.contains(where: { resultKey($0) == selectedResultKey }) {
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

            Picker("Results view", selection: $advancedMode) {
                Text("Simple").tag(false)
                Text("Advanced").tag(true)
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .frame(width: 190)

            if isRunning {
                HStack(spacing: 8) {
                    ProgressView()
                        .controlSize(.small)
                    Text("In progress")
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
            } else {
                ScanStatusLabel(status: detail.status)
            }
        }
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
                $0.entrypointId == input.entrypointId &&
                    $0.name == input.fieldName
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
            return "Needs attention"
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
           entities.allSatisfy({ $0["$entity"] != nil }) {
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
           entities.allSatisfy({ $0["$entity"] != nil }) {
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

private struct OfficeEntityResultsView: View {
    let entities: [[String: Any]]
    @Binding var searchText: String

    private var filteredEntities: [[String: Any]] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            return entities
        }
        return entities.filter { containsText($0, query: query) }
    }

    private var flaggedCount: Int {
        entities.filter(hasRiskFlag).count
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 14) {
                ResultSummaryMetric(
                    value: "\(entities.count)",
                    label: entities.count == 1 ? entitySingularName : entityPluralName
                )

                Divider()
                    .frame(height: 30)

                if flaggedCount > 0 {
                    Label(
                        "\(flaggedCount) \(flaggedCount == 1 ? "item" : "items") to review",
                        systemImage: "exclamationmark.triangle.fill"
                    )
                    .foregroundStyle(.red)
                } else {
                    Label(
                        "No flagged findings",
                        systemImage: "checkmark.circle.fill"
                    )
                    .foregroundStyle(.green)
                }
            }
            .font(.subheadline.weight(.medium))

            if entities.count > 8 {
                TextField("Search these results", text: $searchText)
                    .textFieldStyle(.roundedBorder)
                    .frame(maxWidth: 420)
            }

            if filteredEntities.isEmpty {
                ContentUnavailableView.search(text: searchText)
            } else {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(Array(filteredEntities.enumerated()), id: \.offset) { _, entity in
                        OfficeEntityRow(entity: entity)
                    }
                }
            }
        }
    }

    private var entitySingularName: String {
        switch entities.first?["$entity"] as? String {
        case "entity.person":
            return "person found"
        case "entity.organization":
            return "organization found"
        case "entity.mediaMention":
            return "article analyzed"
        case "entity.socialProfile":
            return "profile found"
        case "entity.financialRecord":
            return "financial record"
        case "entity.detectedEntity":
            return "related entity"
        default:
            return "result"
        }
    }

    private var entityPluralName: String {
        switch entities.first?["$entity"] as? String {
        case "entity.person":
            return "people found"
        case "entity.organization":
            return "organizations found"
        case "entity.mediaMention":
            return "articles analyzed"
        case "entity.socialProfile":
            return "profiles found"
        case "entity.financialRecord":
            return "financial records"
        case "entity.detectedEntity":
            return "related entities"
        default:
            return "results"
        }
    }
}

private struct ResultSummaryMetric: View {
    let value: String
    let label: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(value)
                .font(.title3.weight(.semibold))
            Text(label)
                .foregroundStyle(.secondary)
        }
    }
}

private struct OfficeEntityRow: View {
    let entity: [String: Any]

    @ViewBuilder
    var body: some View {
        switch entity["$entity"] as? String {
        case "entity.person":
            PersonOfficeCard(entity: entity)
        case "entity.mediaMention":
            MediaMentionOfficeCard(entity: entity)
        default:
            GenericEntityOfficeCard(entity: entity)
        }
    }
}

private struct RiskTopicOfficeView: View {
    let entities: [[String: Any]]

    private var flaggedCount: Int {
        entities.filter { entity in
            let properties = entity["$props"] as? [String: Any]
            return typedBoolean(properties?["adverseActivityDetected"]) == true
        }.count
    }

    private var targetName: String? {
        guard let properties = entities.first?["$props"] as? [String: Any] else {
            return nil
        }
        return typedStrings(properties["name"]).first
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .firstTextBaseline, spacing: 16) {
                ResultSummaryMetric(
                    value: "\(entities.count)",
                    label: "risk topics checked"
                )

                Divider()
                    .frame(height: 30)

                if flaggedCount > 0 {
                    Label(
                        "\(flaggedCount) \(flaggedCount == 1 ? "topic" : "topics") to review",
                        systemImage: "exclamationmark.triangle.fill"
                    )
                    .foregroundStyle(.red)
                } else {
                    Label(
                        "No adverse activity detected",
                        systemImage: "checkmark.circle.fill"
                    )
                    .foregroundStyle(.green)
                }
            }
            .font(.subheadline.weight(.medium))

            if let targetName {
                Text("Screening report for \(targetName)")
                    .font(.title3.weight(.semibold))
                    .textSelection(.enabled)
            }

            VStack(spacing: 0) {
                ForEach(Array(entities.enumerated()), id: \.offset) { index, entity in
                    RiskTopicRow(entity: entity)
                    if index != entities.indices.last {
                        Divider()
                    }
                }
            }
        }
    }
}

private struct RiskTopicRow: View {
    let entity: [String: Any]

    private var properties: [String: Any] {
        entity["$props"] as? [String: Any] ?? [:]
    }

    private var detected: Bool {
        typedBoolean(properties["adverseActivityDetected"]) == true
    }

    private var title: String {
        typedStrings(properties["topicId"]).first ?? "Risk topic"
    }

    private var summary: String {
        typedStrings(properties["summary"]).first ?? "No summary was provided."
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Image(
                    systemName: detected
                        ? "exclamationmark.triangle.fill"
                        : "checkmark.circle.fill"
                )
                .foregroundStyle(detected ? .red : .green)

                Text(title)
                    .font(.headline)
                    .textSelection(.enabled)

                Spacer()

                Text(detected ? "Needs review" : "No finding")
                    .font(.caption.weight(.medium))
                    .foregroundStyle(detected ? .red : .green)
            }

            Text(summary)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
                .textSelection(.enabled)

            let sources = officeSources(from: entity["$sources"])
            if !sources.isEmpty {
                SourceLinksView(sources: sources)
            }
        }
        .padding(.vertical, 14)
    }
}

private struct PersonOfficeCard: View {
    let entity: [String: Any]

    private var properties: [String: Any] {
        entity["$props"] as? [String: Any] ?? [:]
    }

    private var name: String {
        typedStrings(properties["name"]).first ?? "Unnamed person"
    }

    private var pepStatus: Bool? {
        typedBoolean(properties["pepStatus"])
    }

    private var sanctioned: Bool? {
        typedBoolean(properties["sanctioned"])
    }

    private var isPepRca: Bool? {
        typedBoolean(properties["isPepRca"])
    }

    private var facts: [OfficeFact] {
        var result: [OfficeFact] = []
        appendFact("Birth date", values: typedStrings(properties["birthDate"]), to: &result)
        appendFact("Birth place", values: typedStrings(properties["birthPlace"]), to: &result)
        appendFact("Nationality", values: typedStrings(properties["nationalities"]), to: &result)
        appendFact("Jurisdiction", values: typedStrings(properties["jurisdiction"]), to: &result)
        appendFact("Address", values: typedStrings(properties["addresses"]), to: &result)
        appendFact("Aliases", values: typedStrings(properties["aliases"]), to: &result)
        appendFact("Email", values: typedStrings(properties["emails"]), to: &result)
        appendFact("Phone", values: typedStrings(properties["phones"]), to: &result)
        return result
    }

    private var associates: [(name: String, relation: String?)] {
        typedRawValues(properties["relativeCloseAssociates"]).compactMap { value in
            guard
                let dictionary = value as? [String: Any],
                let name = dictionary["name"] as? String
            else {
                return nil
            }
            return (name, dictionary["relation"] as? String)
        }
    }

    private var notes: [String] {
        typedStrings(properties["notes"])
    }

    private var sources: [OfficeSource] {
        officeSources(from: entity["$sources"])
    }

    var body: some View {
        OfficeResultCard {
            VStack(alignment: .leading, spacing: 16) {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(name)
                            .font(.title3.weight(.semibold))
                            .textSelection(.enabled)
                        Text("Person")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()
                }

                findings

                if !facts.isEmpty {
                    OfficeFactsGrid(facts: facts)
                }

                if !associates.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Relatives and close associates")
                            .font(.subheadline.weight(.semibold))
                        ForEach(Array(associates.enumerated()), id: \.offset) { _, associate in
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text(associate.name)
                                if let relation = associate.relation {
                                    Text(relation)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .textSelection(.enabled)
                        }
                    }
                }

                ForEach(notes, id: \.self) { note in
                    Text(note)
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)
                }

                if !sources.isEmpty {
                    Divider()
                    SourceLinksView(sources: sources)
                }
            }
        }
    }

    @ViewBuilder
    private var findings: some View {
        let hasKnownStatus = pepStatus != nil || sanctioned != nil || isPepRca != nil
        let hasFinding = pepStatus == true || sanctioned == true || isPepRca == true

        if hasKnownStatus {
            HStack(spacing: 10) {
                if pepStatus == true {
                    FindingPill(
                        title: "Politically exposed person",
                        systemImage: "exclamationmark.triangle.fill",
                        color: .red
                    )
                }
                if isPepRca == true {
                    FindingPill(
                        title: "PEP relative or close associate",
                        systemImage: "person.2.fill",
                        color: .orange
                    )
                }
                if sanctioned == true {
                    FindingPill(
                        title: "Sanctions match",
                        systemImage: "exclamationmark.octagon.fill",
                        color: .red
                    )
                }
                if !hasFinding {
                    FindingPill(
                        title: "No PEP or sanctions finding",
                        systemImage: "checkmark.circle.fill",
                        color: .green
                    )
                }
            }
        }
    }
}

private struct MediaMentionOfficeCard: View {
    let entity: [String: Any]

    private var properties: [String: Any] {
        entity["$props"] as? [String: Any] ?? [:]
    }

    private var title: String {
        typedStrings(properties["title"]).first ??
            typedStrings(properties["name"]).first ??
            "Untitled article"
    }

    private var targetName: String? {
        typedStrings(properties["name"]).first
    }

    private var analysis: String? {
        typedStrings(properties["analysis"]).first
    }

    private var adverseActivityDetected: Bool? {
        typedBoolean(properties["adverseActivityDetected"])
    }

    private var articleURL: URL? {
        typedStrings(properties["url"])
            .compactMap(URL.init(string:))
            .first
    }

    private var claims: [String] {
        extraValues(named: "Claim", in: entity["$extra"]).compactMap(officeScalar)
    }

    private var sources: [OfficeSource] {
        officeSources(from: entity["$sources"])
    }

    var body: some View {
        OfficeResultCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top, spacing: 14) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(title)
                            .font(.headline)
                            .fixedSize(horizontal: false, vertical: true)
                            .textSelection(.enabled)
                        if let targetName, targetName != title {
                            Text("Analyzed for \(targetName)")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Spacer()

                    if adverseActivityDetected == true {
                        FindingPill(
                            title: "Needs review",
                            systemImage: "exclamationmark.triangle.fill",
                            color: .red
                        )
                    } else if adverseActivityDetected == false {
                        FindingPill(
                            title: "No adverse finding",
                            systemImage: "checkmark.circle.fill",
                            color: .green
                        )
                    }
                }

                if let analysis, !analysis.isEmpty {
                    Text(analysis)
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)
                }

                if !claims.isEmpty {
                    VStack(alignment: .leading, spacing: 7) {
                        Text("Key facts")
                            .font(.subheadline.weight(.semibold))
                        ForEach(claims, id: \.self) { claim in
                            HStack(alignment: .top, spacing: 8) {
                                Text("•")
                                Text(claim)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                            .textSelection(.enabled)
                        }
                    }
                }

                if let articleURL {
                    Link(destination: articleURL) {
                        Label("Open article", systemImage: "arrow.up.right.square")
                    }
                }

                if !sources.isEmpty {
                    SourceLinksView(sources: sources)
                }
            }
        }
    }
}

private struct GenericEntityOfficeCard: View {
    let entity: [String: Any]

    private var properties: [String: Any] {
        entity["$props"] as? [String: Any] ?? [:]
    }

    private var entityType: String {
        entity["$entity"] as? String ?? "Result"
    }

    private var title: String {
        typedStrings(properties["name"]).first ??
            typedStrings(properties["title"]).first ??
            entityLabel(entityType)
    }

    private var facts: [OfficeFact] {
        properties
            .filter {
                ![
                    "name",
                    "title",
                    "notes",
                    "summary",
                    "description",
                    "pepStatus",
                    "sanctioned",
                    "adverseActivityDetected",
                ].contains($0.key)
            }
            .sorted { $0.key < $1.key }
            .compactMap { key, value in
                let values = typedRawValues(value).compactMap(officeScalar)
                guard !values.isEmpty else {
                    return nil
                }
                return OfficeFact(label: canonicalPropertyLabel(key), value: values.joined(separator: ", "))
            }
    }

    private var descriptions: [String] {
        ["summary", "description", "notes"].flatMap { typedStrings(properties[$0]) }
    }

    private var sources: [OfficeSource] {
        officeSources(from: entity["$sources"])
    }

    var body: some View {
        OfficeResultCard {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(title)
                            .font(.headline)
                            .textSelection(.enabled)
                        Text(entityLabel(entityType))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    if hasRiskFlag(entity) {
                        FindingPill(
                            title: "Needs review",
                            systemImage: "exclamationmark.triangle.fill",
                            color: .red
                        )
                    }
                }

                if !facts.isEmpty {
                    OfficeFactsGrid(facts: facts)
                }

                ForEach(descriptions, id: \.self) { description in
                    Text(description)
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)
                }

                if !sources.isEmpty {
                    Divider()
                    SourceLinksView(sources: sources)
                }
            }
        }
    }
}

private struct OfficeResultCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding(.vertical, 18)
            .padding(.horizontal, 20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(nsColor: .controlBackgroundColor).opacity(0.7))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

private struct FindingPill: View {
    let title: String
    let systemImage: String
    let color: Color

    var body: some View {
        Label(title, systemImage: systemImage)
            .font(.caption.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, 9)
            .padding(.vertical, 5)
            .background(color.opacity(0.1))
            .clipShape(Capsule())
    }
}

private struct OfficeFact {
    let label: String
    let value: String
}

private struct OfficeFactsGrid: View {
    let facts: [OfficeFact]

    var body: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 230), spacing: 24)],
            alignment: .leading,
            spacing: 13
        ) {
            ForEach(Array(facts.enumerated()), id: \.offset) { _, fact in
                VStack(alignment: .leading, spacing: 3) {
                    Text(fact.label)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(fact.value)
                        .textSelection(.enabled)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }
}

private struct OfficeGenericResultView: View {
    let value: Any

    var body: some View {
        if let dictionary = value as? [String: Any] {
            let summary =
                dictionary["summary"] ??
                dictionary["message"] ??
                dictionary["name"] ??
                dictionary["title"]

            if let summary {
                JSONScalarView(value: summary)
                    .font(.body)
            } else {
                ContentUnavailableView(
                    "Structured data",
                    systemImage: "tablecells",
                    description: Text(
                        "Switch to Advanced to inspect the complete structured response."
                    )
                )
            }
        } else if let array = value as? [Any] {
            VStack(alignment: .leading, spacing: 10) {
                Text("\(array.count) items")
                    .font(.subheadline.weight(.medium))
                ForEach(Array(array.prefix(20).enumerated()), id: \.offset) { _, item in
                    if isScalar(item) {
                        JSONScalarView(value: item)
                    }
                }
            }
        } else {
            JSONScalarView(value: value)
        }
    }
}

private struct SourceLinksView: View {
    let sources: [OfficeSource]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(
                "\(sources.count) \(sources.count == 1 ? "source" : "sources")",
                systemImage: "link"
            )
            .font(.caption)
            .foregroundStyle(.secondary)

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 260), alignment: .leading)],
                alignment: .leading,
                spacing: 7
            ) {
                ForEach(Array(sources.enumerated()), id: \.offset) { _, source in
                    Link(destination: source.url) {
                        Text(source.name)
                            .lineLimit(2)
                            .fixedSize(horizontal: false, vertical: true)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .font(.caption)
                }
            }
        }
    }
}

private struct OfficeSource: Hashable {
    let name: String
    let url: URL
}

private struct AdvancedEntityResultView: View {
    let entity: [String: Any]

    private var properties: [String: Any] {
        entity["$props"] as? [String: Any] ?? [:]
    }

    private var title: String {
        if let name = typedStrings(properties["name"]).first, !name.isEmpty {
            return name
        }
        if let entityType = entity["$entity"] as? String {
            return entityType
        }
        return "Result"
    }

    private var primaryProperties: [(String, Any)] {
        properties
            .filter { !["name", "pepStatus", "sanctioned"].contains($0.key) }
            .sorted { $0.key < $1.key }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text(title)
                    .font(.title3.weight(.semibold))
                    .textSelection(.enabled)

                if let pepStatus = typedBoolean(properties["pepStatus"]) {
                    BooleanFindingLabel(
                        active: pepStatus,
                        activeTitle: "PEP",
                        inactiveTitle: "Not a PEP"
                    )
                }

                if let sanctioned = typedBoolean(properties["sanctioned"]) {
                    BooleanFindingLabel(
                        active: sanctioned,
                        activeTitle: "Sanctioned",
                        inactiveTitle: "Not sanctioned"
                    )
                }

                Spacer()
            }

            if !primaryProperties.isEmpty {
                VStack(spacing: 0) {
                    ForEach(primaryProperties, id: \.0) { key, value in
                        JSONFieldRow(label: key, value: value)
                        if key != primaryProperties.last?.0 {
                            Divider()
                        }
                    }
                }
            }

            if let extra = entity["$extra"], !(extra is NSNull) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Additional information")
                        .font(.subheadline.weight(.semibold))
                    JSONValueView(value: extra)
                }
            }

            if let sources = entity["$sources"] {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Sources")
                        .font(.subheadline.weight(.semibold))
                    JSONValueView(value: sources)
                }
            }

            if let id = entity["$id"] as? String {
                Text(id)
                    .font(.caption.monospaced())
                    .foregroundStyle(.tertiary)
                    .textSelection(.enabled)
            }
        }
    }
}

private struct BooleanFindingLabel: View {
    let active: Bool
    let activeTitle: String
    let inactiveTitle: String

    var body: some View {
        Label(
            active ? activeTitle : inactiveTitle,
            systemImage: active
                ? "exclamationmark.triangle.fill"
                : "checkmark.circle.fill"
        )
        .font(.caption.weight(.medium))
        .foregroundStyle(active ? .red : .green)
    }
}

private struct JSONValueView: View {
    let value: Any

    var body: some View {
        if let dictionary = value as? [String: Any] {
            let fields = dictionary.sorted { $0.key < $1.key }
            VStack(spacing: 0) {
                ForEach(fields, id: \.key) { key, fieldValue in
                    JSONFieldRow(label: key, value: fieldValue)
                    if key != fields.last?.key {
                        Divider()
                    }
                }
            }
        } else if let array = value as? [Any] {
            VStack(alignment: .leading, spacing: 12) {
                ForEach(Array(array.enumerated()), id: \.offset) { _, item in
                    if isScalar(item) {
                        JSONScalarView(value: item)
                    } else {
                        JSONValueView(value: item)
                            .padding(.leading, 12)
                            .overlay(alignment: .leading) {
                                Rectangle()
                                    .fill(Color.secondary.opacity(0.2))
                                    .frame(width: 2)
                            }
                    }
                }
            }
        } else {
            JSONScalarView(value: value)
        }
    }
}

private struct JSONFieldRow: View {
    let label: String
    let value: Any

    var body: some View {
        if isScalar(value) {
            HStack(alignment: .firstTextBaseline, spacing: 24) {
                Text(label)
                    .foregroundStyle(.secondary)
                    .frame(width: 180, alignment: .leading)
                JSONScalarView(value: value)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.vertical, 9)
        } else {
            VStack(alignment: .leading, spacing: 10) {
                Text(label)
                    .foregroundStyle(.secondary)
                JSONValueView(value: value)
                    .padding(.leading, 16)
            }
            .padding(.vertical, 10)
        }
    }
}

private struct JSONScalarView: View {
    let value: Any

    var body: some View {
        if value is NSNull {
            Text("Not provided")
                .foregroundStyle(.secondary)
        } else if let string = value as? String {
            if let url = URL(string: string),
               let scheme = url.scheme,
               ["http", "https"].contains(scheme.lowercased()) {
                Link(string, destination: url)
                    .lineLimit(2)
            } else {
                Text(string)
                    .textSelection(.enabled)
            }
        } else if let number = value as? NSNumber {
            if CFGetTypeID(number) == CFBooleanGetTypeID() {
                Label(
                    number.boolValue ? "Yes" : "No",
                    systemImage: number.boolValue
                        ? "checkmark.circle.fill"
                        : "minus.circle"
                )
                .foregroundStyle(number.boolValue ? .green : .secondary)
            } else {
                Text(number.stringValue)
                    .textSelection(.enabled)
            }
        } else {
            Text(String(describing: value))
                .textSelection(.enabled)
        }
    }
}

private func officeScalar(_ value: Any) -> String? {
    if value is NSNull {
        return "Not provided"
    }
    if let string = value as? String {
        return string
    }
    if let number = value as? NSNumber {
        if CFGetTypeID(number) == CFBooleanGetTypeID() {
            return number.boolValue ? "Yes" : "No"
        }
        return number.stringValue
    }
    if let array = value as? [Any] {
        let values = array.compactMap(officeScalar)
        return values.isEmpty ? nil : values.joined(separator: ", ")
    }
    if let dictionary = value as? [String: Any] {
        if dictionary["$type"] != nil, let wrappedValue = dictionary["value"] {
            return officeScalar(wrappedValue)
        }
        if let name = dictionary["name"] as? String {
            if let relation = dictionary["relation"] as? String {
                return "\(name) (\(relation))"
            }
            return name
        }
        if let key = dictionary["key"], let wrappedValue = dictionary["value"],
           let keyText = officeScalar(key), let valueText = officeScalar(wrappedValue) {
            return "\(keyText): \(valueText)"
        }
    }
    return nil
}

private func typedRawValues(_ value: Any?) -> [Any] {
    guard let value else {
        return []
    }
    if let array = value as? [Any] {
        return array.flatMap { item -> [Any] in
            if let dictionary = item as? [String: Any],
               dictionary["$type"] != nil,
               let wrappedValue = dictionary["value"] {
                return [wrappedValue]
            }
            return [item]
        }
    }
    if let dictionary = value as? [String: Any],
       dictionary["$type"] != nil,
       let wrappedValue = dictionary["value"] {
        return [wrappedValue]
    }
    return [value]
}

private func typedStrings(_ value: Any?) -> [String] {
    typedRawValues(value).compactMap(officeScalar)
}

private func typedBoolean(_ value: Any?) -> Bool? {
    for rawValue in typedRawValues(value) {
        if let boolean = rawValue as? Bool {
            return boolean
        }
        if let number = rawValue as? NSNumber,
           CFGetTypeID(number) == CFBooleanGetTypeID() {
            return number.boolValue
        }
    }
    return nil
}

private func appendFact(
    _ label: String,
    values: [String],
    to facts: inout [OfficeFact]
) {
    guard !values.isEmpty else {
        return
    }
    facts.append(OfficeFact(label: label, value: values.joined(separator: ", ")))
}

private func hasRiskFlag(_ entity: [String: Any]) -> Bool {
    if let properties = entity["$props"] as? [String: Any],
       [
           "pepStatus",
           "sanctioned",
           "isPepRca",
           "adverseActivityDetected",
       ].contains(where: { typedBoolean(properties[$0]) == true }) {
        return true
    }
    return findBoolean(named: "Match", in: entity["$extra"]) == true
}

private func extraValues(named name: String, in value: Any?) -> [Any] {
    guard let value else {
        return []
    }
    if let array = value as? [Any] {
        return array.flatMap { extraValues(named: name, in: $0) }
    }
    guard let dictionary = value as? [String: Any] else {
        return []
    }

    if dictionary["$type"] as? String == "key-value",
       let pair = dictionary["value"] as? [String: Any],
       let key = typedStrings(pair["key"]).first,
       key.caseInsensitiveCompare(name) == .orderedSame {
        return typedRawValues(pair["value"])
    }

    if let key = dictionary["key"] as? String,
       key.caseInsensitiveCompare(name) == .orderedSame,
       let result = dictionary["value"] {
        return typedRawValues(result)
    }

    return dictionary.values.flatMap { extraValues(named: name, in: $0) }
}

private func findBoolean(named name: String, in value: Any?) -> Bool? {
    if let result = extraValues(named: name, in: value)
        .compactMap({ typedBoolean($0) })
        .first {
        return result
    }

    guard let value else {
        return nil
    }
    if let dictionary = value as? [String: Any] {
        if let direct = dictionary[name] as? Bool {
            return direct
        }
        if let key = dictionary["key"] as? String,
           key.caseInsensitiveCompare(name) == .orderedSame,
           let result = dictionary["value"] as? Bool {
            return result
        }
        for nestedValue in dictionary.values {
            if let result = findBoolean(named: name, in: nestedValue) {
                return result
            }
        }
    }
    if let array = value as? [Any] {
        for item in array {
            if let result = findBoolean(named: name, in: item) {
                return result
            }
        }
    }
    return nil
}

private func entityLabel(_ entityType: String) -> String {
    switch entityType {
    case "entity.person":
        return "Person"
    case "entity.organization":
        return "Organization"
    case "entity.mediaMention":
        return "Media mention"
    case "entity.riskTopic":
        return "Risk topic"
    case "entity.socialProfile":
        return "Social profile"
    case "entity.financialRecord":
        return "Financial record"
    case "entity.detectedEntity":
        return "Related entity"
    default:
        return entityType
    }
}

private func canonicalPropertyLabel(_ key: String) -> String {
    let labels = [
        "aliases": "Aliases",
        "birthDate": "Birth date",
        "birthPlace": "Birth place",
        "nationalities": "Nationalities",
        "jurisdiction": "Jurisdiction",
        "addresses": "Addresses",
        "emails": "Emails",
        "phones": "Phones",
        "relativeCloseAssociates": "Relatives and close associates",
        "previousNames": "Previous names",
        "registrationId": "Registration ID",
        "country": "Country",
        "address": "Address",
        "status": "Status",
        "involvedPersons": "Involved people",
        "legalRoles": "Legal roles",
        "sourceRegister": "Source register",
        "entryTypes": "Entry types",
        "effectiveTo": "Effective to",
        "platform": "Platform",
        "profileTitle": "Profile",
        "profileUrl": "Profile URL",
        "userId": "User ID",
        "amountOwed": "Amount owed",
        "location": "Location",
        "debtSource": "Debt source",
    ]
    return labels[key] ?? key
}

private func containsText(_ value: Any, query: String) -> Bool {
    if let string = value as? String {
        return string.localizedCaseInsensitiveContains(query)
    }
    if let number = value as? NSNumber {
        return number.stringValue.localizedCaseInsensitiveContains(query)
    }
    if let dictionary = value as? [String: Any] {
        return dictionary.contains { key, nestedValue in
            key.localizedCaseInsensitiveContains(query) ||
                containsText(nestedValue, query: query)
        }
    }
    if let array = value as? [Any] {
        return array.contains { containsText($0, query: query) }
    }
    return false
}

private func officeSources(from value: Any?) -> [OfficeSource] {
    guard let value else {
        return []
    }

    var sources: [OfficeSource] = []

    if let array = value as? [Any] {
        sources = array.flatMap { officeSources(from: $0) }
    } else if let dictionary = value as? [String: Any] {
        let urlValue =
            dictionary["source"] as? String ??
            dictionary["url"] as? String ??
            dictionary["href"] as? String

        if let urlValue, let url = URL(string: urlValue) {
            let name =
                dictionary["name"] as? String ??
                dictionary["title"] as? String ??
                url.host() ??
                urlValue
            sources.append(OfficeSource(name: name, url: url))
        } else {
            sources = dictionary.values.flatMap { officeSources(from: $0) }
        }
    } else if let string = value as? String,
              let url = URL(string: string),
              url.scheme != nil {
        sources.append(
            OfficeSource(
                name: url.host() ?? string,
                url: url
            )
        )
    }

    var seen: Set<URL> = []
    return sources.filter { seen.insert($0.url).inserted }
}

private func isScalar(_ value: Any) -> Bool {
    value is String || value is NSNumber || value is NSNull
}
