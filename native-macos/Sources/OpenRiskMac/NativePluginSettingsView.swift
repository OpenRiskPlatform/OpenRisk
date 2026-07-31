import SwiftUI

struct NativePluginSettingsView: View {
    @ObservedObject var model: OpenRiskAppModel
    let plugin: NativePlugin
    let readOnly: Bool

    @State private var values: [String: NativeFieldValue]
    @State private var initialJSON: [String: String]
    @State private var validationMessage: String?

    init(model: OpenRiskAppModel, plugin: NativePlugin, readOnly: Bool) {
        self.model = model
        self.plugin = plugin
        self.readOnly = readOnly

        var loaded: [String: NativeFieldValue] = [:]
        var snapshots: [String: String] = [:]
        for setting in plugin.settings {
            let value = NativeFieldValue.from(
                json: setting.valueJson,
                typeName: setting.typeName
            )
            loaded[setting.name] = value
            snapshots[setting.name] = value.json(typeName: setting.typeName)
        }
        _values = State(initialValue: loaded)
        _initialJSON = State(initialValue: snapshots)
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 26) {
                header

                if readOnly {
                    NativeReadOnlyNotice()
                }

                if plugin.settings.isEmpty {
                    Text("This plugin has no configurable options.")
                        .foregroundStyle(.secondary)
                } else {
                    VStack(alignment: .leading, spacing: 20) {
                        ForEach(plugin.settings, id: \.name) { setting in
                            settingField(setting)
                        }
                    }

                    if let validationMessage {
                        Text(validationMessage)
                            .font(.caption)
                            .foregroundStyle(.red)
                    }

                    if !readOnly {
                        Button("Save Settings") {
                            save()
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(!isDirty || model.isPerformingSettingsAction)
                    }
                }

                if !plugin.metrics.isEmpty || plugin.canRefreshMetrics {
                    Divider()
                    metricsSection
                }
            }
            .padding(28)
            .frame(maxWidth: 680, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle(plugin.name)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(plugin.name)
                        .font(.title2.weight(.semibold))
                    Text(plugin.description)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Text("Version \(plugin.version)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let homepage = plugin.homepage, let url = URL(string: homepage) {
                Link("Plugin homepage", destination: url)
                    .font(.caption)
            }
        }
    }

    @ViewBuilder
    private func settingField(_ setting: NativePluginSetting) -> some View {
        let value = values[setting.name] ?? NativeFieldValue.empty(for: setting.typeName)

        VStack(alignment: .leading, spacing: 7) {
            if setting.typeName.lowercased() == "boolean" ||
                setting.typeName.lowercased() == "bool" {
                Toggle(
                    setting.title,
                    isOn: Binding(
                        get: { value.boolean },
                        set: { values[setting.name] = .boolean($0) }
                    )
                )
            } else {
                HStack(spacing: 4) {
                    Text(setting.title)
                        .font(.subheadline.weight(.medium))
                    if setting.required {
                        Text("Required")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                }

                settingControl(setting, value: value)
            }

            if let description = setting.description, !description.isEmpty {
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .disabled(readOnly || model.isPerformingSettingsAction)
    }

    @ViewBuilder
    private func settingControl(
        _ setting: NativePluginSetting,
        value: NativeFieldValue
    ) -> some View {
        if !setting.typeValues.isEmpty {
            Picker(
                setting.title,
                selection: Binding(
                    get: { value.text },
                    set: { values[setting.name] = .text($0) }
                )
            ) {
                ForEach(setting.typeValues, id: \.self) { option in
                    Text(option).tag(option)
                }
            }
            .labelsHidden()
        } else if setting.secret {
            SecureField(
                setting.title,
                text: Binding(
                    get: { value.text },
                    set: { values[setting.name] = .text($0) }
                )
            )
        } else {
            TextField(
                setting.title,
                text: Binding(
                    get: { value.text },
                    set: {
                        values[setting.name] =
                            setting.typeName.lowercased() == "number" ||
                            setting.typeName.lowercased() == "integer"
                            ? .number($0)
                            : .text($0)
                    }
                )
            )
        }
    }

    private var metricsSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Usage and Status")
                        .font(.headline)
                    Text("Values reported by the plugin.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                if plugin.canRefreshMetrics, !readOnly {
                    Button {
                        Task { await model.refreshMetrics(for: plugin) }
                    } label: {
                        Label("Refresh", systemImage: "arrow.clockwise")
                    }
                    .disabled(model.isPerformingSettingsAction)
                }
            }

            ForEach(plugin.metrics, id: \.name) { metric in
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(metric.title)
                        if let description = metric.description, !description.isEmpty {
                            Text(description)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    Text(metricDisplayValue(metric))
                        .font(.body.monospacedDigit())
                        .textSelection(.enabled)
                }
                .padding(.vertical, 5)
            }
        }
    }

    private var isDirty: Bool {
        plugin.settings.contains { setting in
            let current = values[setting.name] ?? NativeFieldValue.empty(for: setting.typeName)
            return current.json(typeName: setting.typeName) != initialJSON[setting.name]
        }
    }

    private func save() {
        validationMessage = nil
        var changed: [String: String] = [:]
        for setting in plugin.settings {
            let value = values[setting.name] ?? NativeFieldValue.empty(for: setting.typeName)
            if setting.required && value.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                validationMessage = "Enter \(setting.title.lowercased())."
                return
            }
            let json = value.json(typeName: setting.typeName)
            if json != initialJSON[setting.name] {
                changed[setting.name] = json
            }
        }

        Task {
            if await model.savePluginSettings(pluginID: plugin.id, values: changed) {
                initialJSON.merge(changed) { _, current in current }
                model.settingsMessage = "Settings saved."
            }
        }
    }

    private func metricDisplayValue(_ metric: NativePluginMetric) -> String {
        let value = NativeFieldValue.from(json: metric.valueJson, typeName: metric.typeName)
        if metric.typeName.lowercased() == "boolean" || metric.typeName.lowercased() == "bool" {
            return value.boolean ? "Yes" : "No"
        }
        let text = value.text.trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? "Not available" : text
    }
}
