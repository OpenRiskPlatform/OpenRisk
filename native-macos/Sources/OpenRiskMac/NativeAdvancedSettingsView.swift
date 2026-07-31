import SwiftUI

struct NativeAdvancedSettingsView: View {
  @ObservedObject var model: OpenRiskAppModel
  let settings: NativeSettingsSnapshot

  private var policy: String {
    ["fail", "draft", "off"].contains(settings.projectSettings.interruptedScanPolicy)
      ? settings.projectSettings.interruptedScanPolicy
      : "fail"
  }

  var body: some View {
    Form {
      Section {
        Picker(
          "On next project open",
          selection: Binding(
            get: { policy },
            set: { policy in
              Task {
                if await model.saveProjectSettings(
                  name: nil,
                  theme: nil,
                  advancedMode: nil,
                  interruptedScanPolicy: policy
                ) {
                  model.settingsMessage = "Recovery preference saved."
                }
              }
            }
          )
        ) {
          Text("Mark as failed").tag("fail")
          Text("Restore as draft").tag("draft")
          Text("Leave unchanged").tag("off")
        }
      } header: {
        Text("Interrupted investigations")
      } footer: {
        Text(
          "Choose what happens when OpenRisk is closed while an investigation is running. "
            + "The choice applies the next time this project opens. Automatic retry is avoided "
            + "because it could repeat paid external requests."
        )
      }
    }
    .formStyle(.grouped)
    .navigationTitle("Advanced")
    .disabled(settings.project.isPreview || model.isPerformingSettingsAction)
    .overlay(alignment: .top) {
      if settings.project.isPreview {
        NativeReadOnlyNotice()
          .padding(.top, 8)
      }
    }
  }
}
