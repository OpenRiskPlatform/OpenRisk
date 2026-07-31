import Foundation
import SwiftUI

private enum InvestigationFieldValue: Hashable {
    case text(String)
    case number(String)
    case boolean(Bool)
    case null

    static func from(json: String?, typeName: String) -> InvestigationFieldValue {
        guard
            let json,
            let data = json.data(using: .utf8),
            let value = try? JSONSerialization.jsonObject(
                with: data,
                options: .fragmentsAllowed
            )
        else {
            return empty(for: typeName)
        }

        if value is NSNull {
            return empty(for: typeName)
        }
        if let string = value as? String {
            return .text(string)
        }
        if let number = value as? NSNumber {
            if CFGetTypeID(number) == CFBooleanGetTypeID() {
                return .boolean(number.boolValue)
            }
            return .number(number.stringValue)
        }
        return empty(for: typeName)
    }

    static func empty(for typeName: String) -> InvestigationFieldValue {
        switch typeName.lowercased() {
        case "boolean", "bool":
            return .boolean(false)
        case "number", "integer":
            return .number("")
        default:
            return .text("")
        }
    }

    var text: String {
        switch self {
        case let .text(value), let .number(value):
            return value
        case let .boolean(value):
            return value ? "true" : "false"
        case .null:
            return ""
        }
    }

    var boolean: Bool {
        if case let .boolean(value) = self {
            return value
        }
        return false
    }

    func json(typeName: String) -> String {
        switch self {
        case let .text(value):
            return Self.encode(value)
        case let .number(value):
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            return Double(trimmed).map { Self.encode($0) } ?? "null"
        case let .boolean(value):
            return value ? "true" : "false"
        case .null:
            return "null"
        }
    }

    private static func encode<T: Encodable>(_ value: T) -> String {
        guard
            let data = try? JSONEncoder().encode(value),
            let encoded = String(data: data, encoding: .utf8)
        else {
            return "null"
        }
        return encoded
    }
}

@MainActor
private final class InvestigationEditorState: ObservableObject {
    @Published var name: String
    @Published var pluginID: String
    @Published var selectedEntrypointIDs: Set<String>
    @Published private(set) var values: [String: InvestigationFieldValue]

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

        var loadedValues: [String: InvestigationFieldValue] = [:]
        for input in detail.inputs where input.pluginId == resolvedPluginID {
            let definition = plugins
                .first(where: { $0.id == resolvedPluginID })?
                .inputs
                .first(where: {
                    $0.entrypointId == input.entrypointId &&
                        $0.name == input.fieldName
                })
            loadedValues[input.fieldName] = InvestigationFieldValue.from(
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
                    loadedValues[input.name] = InvestigationFieldValue.from(
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
                InvestigationFieldValue.empty(for: definition.typeName)
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
                InvestigationFieldValue.empty(for: definition.typeName)
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

    func value(for input: NativePluginInput) -> InvestigationFieldValue {
        values[input.name] ?? InvestigationFieldValue.empty(for: input.typeName)
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
                values[input.name] = InvestigationFieldValue.from(
                    json: input.defaultValueJson,
                    typeName: input.typeName
                )
            }
        }
    }
}

struct InvestigationEditorView: View {
    @ObservedObject var model: OpenRiskAppModel
    @StateObject private var editor: InvestigationEditorState
    @State private var lastSavedSnapshot: String
    @State private var isSaving = false
    @State private var isSubmitting = false
    @State private var validationMessage: String?

    init(
        model: OpenRiskAppModel,
        detail: NativeScanDetail,
        plugins: [NativePlugin]
    ) {
        self.model = model
        let state = InvestigationEditorState(
            detail: detail,
            plugins: plugins
        )
        _editor = StateObject(wrappedValue: state)
        _lastSavedSnapshot = State(initialValue: state.snapshotKey)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                    .padding(.bottom, 24)

                Divider()

                sourceSection
                    .padding(.vertical, 24)

                Divider()

                checksSection
                    .padding(.vertical, 24)

                if !editor.visibleInputs.isEmpty {
                    Divider()
                    inputsSection
                        .padding(.vertical, 24)
                }

                Divider()

                runSection
                    .padding(.vertical, 24)
            }
            .padding(.horizontal, 40)
            .padding(.vertical, 30)
            .frame(maxWidth: 820, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle(editor.name.isEmpty ? "Untitled" : editor.name)
        .task(id: editor.snapshotKey) {
            let snapshot = editor.snapshotKey
            guard snapshot != lastSavedSnapshot else {
                return
            }
            try? await Task.sleep(nanoseconds: 600_000_000)
            guard !Task.isCancelled, snapshot == editor.snapshotKey else {
                return
            }
            isSaving = true
            let saved = await model.saveDraft(
                scanID: editor.scanID,
                name: editor.name,
                selections: editor.selections,
                inputs: editor.backendInputs
            )
            if saved {
                lastSavedSnapshot = snapshot
            }
            isSaving = false
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .center) {
                Text("New investigation")
                    .font(.title2.weight(.semibold))
                Spacer()
                HStack(spacing: 6) {
                    if isSaving {
                        ProgressView()
                            .controlSize(.mini)
                    }
                    Text(isSaving ? "Saving draft…" : "Draft saved automatically")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            VStack(alignment: .leading, spacing: 7) {
                Text("Investigation name")
                    .font(.subheadline.weight(.medium))
                TextField("Untitled", text: $editor.name)
                    .font(.title3)
                    .accessibilityLabel("Investigation name")
            }
        }
    }

    private var sourceSection: some View {
        NativeFormSection(
            number: "1",
            title: "Source",
            help: "Choose where OpenRisk should search."
        ) {
            if editor.plugins.isEmpty {
                ContentUnavailableView(
                    "No Plugins Available",
                    systemImage: "puzzlepiece.extension",
                    description: Text(
                        "Enable a plugin in the existing OpenRisk settings, then reopen this project."
                    )
                )
            } else {
                Picker(
                    "Source",
                    selection: Binding(
                        get: { editor.pluginID },
                        set: { editor.selectPlugin($0) }
                    )
                ) {
                    ForEach(editor.plugins, id: \.id) { plugin in
                        Text(plugin.name).tag(plugin.id)
                    }
                }
                .labelsHidden()
                .frame(maxWidth: 420)
            }
        }
    }

    private var checksSection: some View {
        NativeFormSection(
            number: "2",
            title: "Checks",
            help: "Select one or more checks to run."
        ) {
            if let plugin = editor.selectedPlugin {
                VStack(spacing: 0) {
                    ForEach(plugin.entrypoints, id: \.id) { entrypoint in
                        let isSelected =
                            editor.selectedEntrypointIDs.contains(entrypoint.id)

                        Button {
                            editor.setEntrypoint(
                                entrypoint.id,
                                selected: !isSelected
                            )
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Image(
                                    systemName: isSelected
                                        ? "checkmark.square.fill"
                                        : "square"
                                )
                                .font(.title3)
                                .foregroundStyle(
                                    isSelected ? Color.accentColor : Color.secondary
                                )
                                .frame(width: 22)

                            VStack(alignment: .leading, spacing: 3) {
                                Text(entrypoint.name)
                                    .font(.body.weight(.medium))
                                    .foregroundStyle(.primary)
                                if let description = entrypoint.description,
                                   !description.isEmpty {
                                    Text(description)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                        .fixedSize(horizontal: false, vertical: true)
                                }
                            }

                                Spacer()
                            }
                            .padding(.vertical, 12)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)

                        if entrypoint.id != plugin.entrypoints.last?.id {
                            Divider()
                        }
                    }
                }
            }
        }
    }

    private var inputsSection: some View {
        NativeFormSection(
            number: "3",
            title: "Search details",
            help: "Only the fields required by the selected checks are shown."
        ) {
            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 300), spacing: 28)],
                alignment: .leading,
                spacing: 20
            ) {
                ForEach(editor.visibleInputs, id: \.name) { input in
                    NativeInputField(editor: editor, input: input)
                }
            }
        }
    }

    private var runSection: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text("Ready to investigate?")
                    .font(.headline)
                Text("The scan runs in the background. You can keep using the app.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if let validationMessage {
                    Text(validationMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }

            Spacer()

            Button {
                validationMessage = editor.validationMessage
                guard validationMessage == nil else {
                    return
                }
                isSubmitting = true
                Task {
                    let saved = await model.saveDraft(
                        scanID: editor.scanID,
                        name: editor.name,
                        selections: editor.selections,
                        inputs: editor.backendInputs
                    )
                    guard saved else {
                        isSubmitting = false
                        return
                    }
                    model.runInvestigation(
                        scanID: editor.scanID,
                        name: editor.name,
                        selections: editor.selections,
                        inputs: editor.backendInputs
                    )
                    isSubmitting = false
                }
            } label: {
                if isSubmitting {
                    ProgressView()
                        .controlSize(.small)
                        .frame(minWidth: 150)
                } else {
                    Label("Run Investigation", systemImage: "play.fill")
                        .frame(minWidth: 150)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(isSubmitting)
        }
    }
}

private struct NativeFormSection<Content: View>: View {
    let number: String
    let title: String
    let help: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 5) {
                Text("\(number). \(title)")
                    .font(.headline)
                Text(help)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            content
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct NativeInputField: View {
    @ObservedObject var editor: InvestigationEditorState
    let input: NativePluginInput

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 4) {
                Text(input.title)
                    .font(.subheadline.weight(.medium))
                if !input.optional {
                    Text("Required")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            control

            if let description = input.description, !description.isEmpty {
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    @ViewBuilder
    private var control: some View {
        if !input.typeValues.isEmpty {
            Picker(
                input.title,
                selection: Binding(
                    get: { editor.value(for: input).text },
                    set: { editor.setText($0, for: input) }
                )
            ) {
                ForEach(input.typeValues, id: \.self) { option in
                    Text(option).tag(option)
                }
            }
            .labelsHidden()
        } else {
            switch input.typeName.lowercased() {
            case "boolean", "bool":
                Toggle(
                    "",
                    isOn: Binding(
                        get: { editor.value(for: input).boolean },
                        set: { editor.setBoolean($0, for: input) }
                    )
                )
                .toggleStyle(.switch)
                .labelsHidden()
            default:
                TextField(
                    input.title,
                    text: Binding(
                        get: { editor.value(for: input).text },
                        set: { editor.setText($0, for: input) }
                    )
                )
            }
        }
    }
}
