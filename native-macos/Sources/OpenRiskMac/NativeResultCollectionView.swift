import Foundation
import SwiftUI

struct OfficeEntityResultsView: View {
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

struct ResultSummaryMetric: View {
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

struct OfficeEntityRow: View {
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

