import Foundation
import SwiftUI

struct AdvancedEntityResultView: View {
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

struct BooleanFindingLabel: View {
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

struct JSONValueView: View {
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

struct JSONFieldRow: View {
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

struct JSONScalarView: View {
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

