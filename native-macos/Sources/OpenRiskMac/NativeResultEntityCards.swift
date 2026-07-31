import Foundation
import SwiftUI

struct RiskTopicOfficeView: View {
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

struct RiskTopicRow: View {
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

struct PersonOfficeCard: View {
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

struct MediaMentionOfficeCard: View {
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

struct GenericEntityOfficeCard: View {
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

