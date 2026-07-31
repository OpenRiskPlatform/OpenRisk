import Foundation
import SwiftUI

struct OfficeResultCard<Content: View>: View {
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

struct FindingPill: View {
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

struct OfficeFact {
    let label: String
    let value: String
}

struct OfficeFactsGrid: View {
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

struct OfficeGenericResultView: View {
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

struct SourceLinksView: View {
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

struct OfficeSource: Hashable {
    let name: String
    let url: URL
}

