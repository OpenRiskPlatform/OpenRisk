import Foundation
import SwiftUI

@MainActor
final class InvestigationEditorState: ObservableObject {
    @Published var name: String
    @Published var pluginID: String
    @Published var selectedEntrypointIDs: Set<String>
    @Published private(set) var values: [String: NativeFieldValue]

    let scanID: String
    let plugins: [NativePlugin]

    init(detail: NativeScanDetail, plugins: [NativePlugin]) {
        let resolvedPluginID =
            detail.selectedPlugins.first?.pluginId ?? plugins.first?.id ?? ""
        let resolvedEntrypointIDs = Set(
            detail.selectedPlugins
                .filter { $0.pluginId == resolvedPluginID }
                .map(\.entrypointId)
        )

        scanID = detail.id
        self.plugins = plugins
        name = detail.preview ?? "Untitled"
        pluginID = resolvedPluginID
        selectedEntrypointIDs = resolvedEntrypointIDs

        var loadedValues: [String: NativeFieldValue] = [:]
        for input in detail.inputs where input.pluginId == resolvedPluginID {
            let definition = plugins
                .first(where: { $0.id == resolvedPluginID })?
                .inputs
                .first(where: {
                    $0.entrypointId == input.entrypointId &&
                        $0.name == input.fieldName
                })
            loadedValues[input.fieldName] = NativeFieldValue.from(
                json: input.valueJson,
                typeName: definition?.typeName ?? "string"
            )
        }

        if let selectedPlugin = plugins.first(where: { $0.id == resolvedPluginID }) {
            for input in selectedPlugin.inputs
            where resolvedEntrypointIDs.contains(input.entrypointId) &&
                loadedValues[input.name] == nil {
                if input.defaultValueJson == nil,
                   let firstOption = input.typeValues.first {
                    loadedValues[input.name] = .text(firstOption)
                } else {
                    loadedValues[input.name] = NativeFieldValue.from(
                        json: input.defaultValueJson,
                        typeName: input.typeName
                    )
                }
            }
        }

        values = loadedValues
    }

    var selectedPlugin: NativePlugin? {
        plugins.first { $0.id == pluginID }
    }

    var visibleInputs: [NativePluginInput] {
        guard let selectedPlugin else {
            return []
        }

        var seen: Set<String> = []
        return selectedPlugin.inputs.filter { input in
            selectedEntrypointIDs.contains(input.entrypointId) &&
                seen.insert(input.name).inserted
        }
    }

    var selections: [NativePluginSelection] {
        guard let selectedPlugin else {
            return []
        }
        return selectedPlugin.entrypoints.compactMap { entrypoint in
            guard selectedEntrypointIDs.contains(entrypoint.id) else {
                return nil
            }
            return NativePluginSelection(
                pluginId: selectedPlugin.id,
                entrypointId: entrypoint.id
            )
        }
    }

    var backendInputs: [NativeScanInput] {
        guard let selectedPlugin else {
            return []
        }

        return selectedPlugin.inputs.compactMap { definition in
            guard selectedEntrypointIDs.contains(definition.entrypointId) else {
                return nil
            }
            let value = values[definition.name] ??
                NativeFieldValue.empty(for: definition.typeName)
            return NativeScanInput(
                pluginId: selectedPlugin.id,
                entrypointId: definition.entrypointId,
                fieldName: definition.name,
                valueJson: value.json(typeName: definition.typeName)
            )
        }
    }

    var validationMessage: String? {
        if selections.isEmpty {
            return "Choose at least one check."
        }

        for definition in visibleInputs where !definition.optional {
            let value = values[definition.name] ??
                NativeFieldValue.empty(for: definition.typeName)
            switch definition.typeName.lowercased() {
            case "number", "integer":
                if Double(value.text.trimmingCharacters(in: .whitespacesAndNewlines)) == nil {
                    return "Enter \(definition.title.lowercased())."
                }
            case "boolean", "bool":
                break
            default:
                if value.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    return "Enter \(definition.title.lowercased())."
                }
            }
        }
        return nil
    }

    var snapshotKey: String {
        let fields = visibleInputs
            .map { definition in
                "\(definition.name)=\(value(for: definition).json(typeName: definition.typeName))"
            }
            .joined(separator: "&")
        return [
            name,
            pluginID,
            selectedEntrypointIDs.sorted().joined(separator: ","),
            fields,
        ].joined(separator: "|")
    }

    func selectPlugin(_ id: String) {
        pluginID = id
        selectedEntrypointIDs = []
        values = [:]
        ensureInputValues()
    }

    func setEntrypoint(_ id: String, selected: Bool) {
        if selected {
            selectedEntrypointIDs.insert(id)
        } else {
            selectedEntrypointIDs.remove(id)
        }
        ensureInputValues()
    }

    func value(for input: NativePluginInput) -> NativeFieldValue {
        values[input.name] ?? NativeFieldValue.empty(for: input.typeName)
    }

    func setText(_ text: String, for input: NativePluginInput) {
        switch input.typeName.lowercased() {
        case "number", "integer":
            values[input.name] = .number(text)
        default:
            values[input.name] = .text(text)
        }
    }

    func setBoolean(_ value: Bool, for input: NativePluginInput) {
        values[input.name] = .boolean(value)
    }

    private func ensureInputValues() {
        guard let selectedPlugin else {
            return
        }
        for input in selectedPlugin.inputs
        where selectedEntrypointIDs.contains(input.entrypointId) &&
            values[input.name] == nil {
            if input.defaultValueJson == nil, let firstOption = input.typeValues.first {
                values[input.name] = .text(firstOption)
            } else {
                values[input.name] = NativeFieldValue.from(
                    json: input.defaultValueJson,
                    typeName: input.typeName
                )
            }
        }
    }
}
