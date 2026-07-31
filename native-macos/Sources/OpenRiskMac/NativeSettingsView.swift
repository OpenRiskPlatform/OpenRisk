import SwiftUI

enum NativeSettingsRoute: Hashable {
  case general
  case advanced
  case plugins
  case security
  case plugin(String)
}

struct NativeSettingsView: View {
  @ObservedObject var model: OpenRiskAppModel
  @State private var route: NativeSettingsRoute? = .general

  var body: some View {
    NavigationSplitView {
      List(selection: $route) {
        Section("Settings") {
          Label("General", systemImage: "gearshape")
            .tag(NativeSettingsRoute.general)
          if model.settingsSnapshot?.projectSettings.advancedMode == true {
            Label("Advanced", systemImage: "slider.horizontal.3")
              .tag(NativeSettingsRoute.advanced)
          }
          Label("Community Plugins", systemImage: "shippingbox")
            .tag(NativeSettingsRoute.plugins)
          Label("Security", systemImage: "lock")
            .tag(NativeSettingsRoute.security)
        }

        if !model.plugins.isEmpty {
          Section("Plugin Options") {
            ForEach(model.plugins.filter(\.enabled), id: \.id) { plugin in
              Label(plugin.name, systemImage: "puzzlepiece.extension")
                .lineLimit(1)
                .tag(NativeSettingsRoute.plugin(plugin.id))
            }
          }
        }
      }
      .navigationTitle("Settings")
      .navigationSplitViewColumnWidth(min: 190, ideal: 220, max: 270)
    } detail: {
      Group {
        if let settings = model.settingsSnapshot {
          content(settings: settings)
        } else {
          ProgressView("Loading settings…")
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
      }
      .safeAreaInset(edge: .bottom) {
        if let message = model.settingsMessage {
          Text(message)
            .font(.caption)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.vertical, 10)
            .background(.bar)
        }
      }
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button("Done") {
            model.isSettingsPresented = false
          }
        }
      }
    }
    .frame(width: 900, height: 650)
  }

  @ViewBuilder
  private func content(settings: NativeSettingsSnapshot) -> some View {
    switch route ?? .general {
    case .general:
      NativeGeneralSettingsView(model: model, settings: settings)
        .id(
          "general-\(settings.project.name)-\(settings.projectSettings.theme)-\(settings.projectSettings.advancedMode)"
        )
    case .advanced:
      NativeAdvancedSettingsView(model: model, settings: settings)
        .id("advanced-\(settings.projectSettings.interruptedScanPolicy)")
    case .plugins:
      NativePluginManagerView(
        model: model,
        settings: settings,
        onConfigure: { route = .plugin($0) }
      )
    case .security:
      NativeSecuritySettingsView(model: model, settings: settings)
    case .plugin(let pluginID):
      if let plugin = settings.plugins.first(where: { $0.id == pluginID }) {
        NativePluginSettingsView(model: model, plugin: plugin, readOnly: settings.project.isPreview)
          .id(pluginSnapshotKey(plugin))
      } else {
        ContentUnavailableView(
          "Plugin Not Available",
          systemImage: "puzzlepiece.extension",
          description: Text("The plugin was disabled or removed.")
        )
      }
    }
  }

  private func pluginSnapshotKey(_ plugin: NativePlugin) -> String {
    plugin.settings
      .map { "\($0.name):\($0.valueJson ?? "")" }
      .joined(separator: "|")
  }
}

private struct NativeGeneralSettingsView: View {
  @ObservedObject var model: OpenRiskAppModel
  let settings: NativeSettingsSnapshot

  @State private var name: String

  init(model: OpenRiskAppModel, settings: NativeSettingsSnapshot) {
    self.model = model
    self.settings = settings
    _name = State(initialValue: settings.project.name)
  }

  var body: some View {
    Form {
      Section {
        TextField("Project name", text: $name)
        Text(settings.project.directory)
          .font(.caption)
          .foregroundStyle(.secondary)
          .textSelection(.enabled)
      } header: {
        Text("Project")
      } footer: {
        Text("The name is shown in the application sidebar and title bar.")
      }

      Section("Appearance") {
        Picker(
          "Theme",
          selection: Binding(
            get: { normalizedTheme(settings.projectSettings.theme) },
            set: { theme in
              Task {
                _ = await model.saveProjectSettings(
                  name: nil,
                  theme: theme,
                  advancedMode: nil
                )
              }
            }
          )
        ) {
          Text("System").tag("system")
          Text("Light").tag("light")
          Text("Dark").tag("dark")
        }

        Toggle(
          "Advanced mode",
          isOn: Binding(
            get: { settings.projectSettings.advancedMode },
            set: { enabled in
              Task {
                _ = await model.saveProjectSettings(
                  name: nil,
                  theme: nil,
                  advancedMode: enabled
                )
              }
            }
          )
        )

        Text("Shows technical result details and additional project settings.")
          .font(.caption)
          .foregroundStyle(.secondary)
      }

      Section {
        Button("Save Project Name") {
          let nextName = name.trimmingCharacters(in: .whitespacesAndNewlines)
          guard !nextName.isEmpty else {
            model.settingsMessage = "Project name is required."
            return
          }
          Task {
            if await model.saveProjectSettings(
              name: nextName,
              theme: nil,
              advancedMode: nil
            ) {
              model.settingsMessage = "Project name saved."
            }
          }
        }
        .disabled(
          settings.project.isPreview || model.isPerformingSettingsAction
            || name.trimmingCharacters(in: .whitespacesAndNewlines) == settings.project.name
        )
      }
    }
    .formStyle(.grouped)
    .navigationTitle("General")
    .disabled(settings.project.isPreview)
    .overlay(alignment: .top) {
      if settings.project.isPreview {
        NativeReadOnlyNotice()
          .padding(.top, 8)
      }
    }
  }

  private func normalizedTheme(_ theme: String) -> String {
    ["system", "light", "dark"].contains(theme) ? theme : "system"
  }
}

struct NativeReadOnlyNotice: View {
  var body: some View {
    Label("This preview is read-only.", systemImage: "lock.fill")
      .font(.caption)
      .padding(.horizontal, 12)
      .padding(.vertical, 7)
      .background(.orange.opacity(0.12), in: Capsule())
  }
}
