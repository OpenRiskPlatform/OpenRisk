import SwiftUI

private enum NativePluginManagerRoute {
    case installed
    case registry
    case manual
}

struct NativePluginManagerView: View {
    @ObservedObject var model: OpenRiskAppModel
    let settings: NativeSettingsSnapshot
    let onConfigure: (String) -> Void

    @State private var route: NativePluginManagerRoute = .installed
    @State private var selectedVersions: [String: String] = [:]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                header
                Divider()
                content
            }
            .padding(28)
            .frame(maxWidth: 760, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .navigationTitle(title)
    }

    private var title: String {
        switch route {
        case .installed: "Community Plugins"
        case .registry: "Browse Plugins"
        case .manual: "Install from File"
        }
    }

    private var subtitle: String {
        switch route {
        case .installed:
            "Choose which integrations are available in this project."
        case .registry:
            "Install a published plugin from the OpenRisk registry."
        case .manual:
            "Import a local plugin folder or ZIP archive."
        }
    }

    private var header: some View {
        HStack(alignment: .top, spacing: 14) {
            if route != .installed {
                Button {
                    route = .installed
                } label: {
                    Image(systemName: "chevron.left")
                }
                .buttonStyle(.plain)
                .padding(.top, 4)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.title2.weight(.semibold))
                Text(subtitle)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if route == .installed, !settings.project.isPreview {
                Button("Browse Plugins") {
                    route = .registry
                }
                Button("Install from File") {
                    route = .manual
                }
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch route {
        case .installed:
            installedPlugins
        case .registry:
            registryPlugins
        case .manual:
            manualInstall
        }
    }

    @ViewBuilder
    private var installedPlugins: some View {
        if settings.plugins.isEmpty {
            ContentUnavailableView(
                "No Plugins Installed",
                systemImage: "shippingbox",
                description: Text("Browse the registry or install a local plugin.")
            )
        } else {
            LazyVStack(spacing: 0) {
                ForEach(settings.plugins, id: \.id) { plugin in
                    HStack(spacing: 14) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(plugin.name)
                                .font(.headline)
                            Text(plugin.description.isEmpty ? plugin.id : plugin.description)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                            Text("Version \(plugin.version)" + (plugin.status.isEmpty ? "" : " · \(plugin.status)"))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Toggle(
                            "Enable \(plugin.name)",
                            isOn: Binding(
                                get: { plugin.enabled },
                                set: { enabled in
                                    Task {
                                        await model.updatePluginEnabled(
                                            plugin,
                                            enabled: enabled
                                        )
                                    }
                                }
                            )
                        )
                        .labelsHidden()
                        .disabled(settings.project.isPreview || model.isPerformingSettingsAction)

                        Button {
                            onConfigure(plugin.id)
                        } label: {
                            Image(systemName: "chevron.right")
                        }
                        .buttonStyle(.plain)
                        .disabled(!plugin.enabled)
                        .help("Plugin options")
                    }
                    .padding(.vertical, 14)

                    if plugin.id != settings.plugins.last?.id {
                        Divider()
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var registryPlugins: some View {
        if let registry = model.pluginRegistry {
            if registry.plugins.isEmpty {
                ContentUnavailableView(
                    "Registry Is Empty",
                    systemImage: "shippingbox",
                    description: Text("No published plugins were returned.")
                )
            } else {
                LazyVStack(spacing: 0) {
                    ForEach(registry.plugins, id: \.id) { plugin in
                        registryRow(plugin)
                        if plugin.id != registry.plugins.last?.id {
                            Divider()
                        }
                    }
                }
            }
        } else {
            VStack(spacing: 12) {
                Text("The registry is loaded only when requested.")
                    .foregroundStyle(.secondary)
                Button {
                    Task { await model.loadPluginRegistry() }
                } label: {
                    Label("Load Registry", systemImage: "arrow.down.circle")
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.isPerformingSettingsAction)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 50)
        }
    }

    private func registryRow(_ plugin: NativeRegistryPlugin) -> some View {
        let installed = settings.plugins.first { $0.id == plugin.id }
        let versions = availableVersions(plugin, installed: installed)
        let selected = selectedVersions[plugin.id] ?? plugin.version

        return HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text(plugin.name)
                    .font(.headline)
                Text(plugin.description)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                if let installed {
                    Text(installed.version == plugin.version
                         ? "Installed \(installed.version) · Up to date"
                         : "Installed \(installed.version) · Latest \(plugin.version)")
                        .font(.caption)
                        .foregroundStyle(installed.version == plugin.version ? .green : .orange)
                } else {
                    Text("Latest \(plugin.version)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            Picker(
                "Version",
                selection: Binding(
                    get: { selectedVersions[plugin.id] ?? plugin.version },
                    set: { selectedVersions[plugin.id] = $0 }
                )
            ) {
                ForEach(versions, id: \.self) { version in
                    Text(versionLabel(version, plugin: plugin, installed: installed))
                        .tag(version)
                }
            }
            .labelsHidden()
            .frame(width: 170)

            Button(actionLabel(installed: installed, latest: plugin.version, selected: selected)) {
                Task {
                    await model.installRegistryPlugin(plugin, version: selected)
                }
            }
            .disabled(model.isPerformingSettingsAction)
        }
        .padding(.vertical, 14)
    }

    private var manualInstall: some View {
        VStack(spacing: 0) {
            Button {
                model.choosePluginDirectory()
            } label: {
                installRow(
                    title: "Plugin Folder",
                    description: "Select a directory containing plugin.json.",
                    symbol: "folder"
                )
            }
            .buttonStyle(.plain)
            Divider()
            Button {
                model.choosePluginArchive()
            } label: {
                installRow(
                    title: "ZIP Archive",
                    description: "Select a packaged plugin archive.",
                    symbol: "archivebox"
                )
            }
            .buttonStyle(.plain)
        }
        .disabled(model.isPerformingSettingsAction)
    }

    private func installRow(title: String, description: String, symbol: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.title2)
                .foregroundStyle(.secondary)
                .frame(width: 30)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.headline)
                    .foregroundStyle(.primary)
                Text(description)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 16)
        .contentShape(Rectangle())
    }

    private func availableVersions(
        _ plugin: NativeRegistryPlugin,
        installed: NativePlugin?
    ) -> [String] {
        var result: [String] = []
        for version in [plugin.version] + plugin.versions + [installed?.version].compactMap({ $0 }) {
            if !result.contains(version) {
                result.append(version)
            }
        }
        return result
    }

    private func versionLabel(
        _ version: String,
        plugin: NativeRegistryPlugin,
        installed: NativePlugin?
    ) -> String {
        var labels = [version]
        if version == plugin.version { labels.append("Latest") }
        if version == installed?.version { labels.append("Installed") }
        return labels.joined(separator: " · ")
    }

    private func actionLabel(
        installed: NativePlugin?,
        latest: String,
        selected: String
    ) -> String {
        guard let installed else { return "Install" }
        if selected == installed.version { return "Reinstall" }
        return selected == latest ? "Update" : "Install"
    }
}
