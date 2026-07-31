import SwiftUI

@main
struct OpenRiskMacApp: App {
    @StateObject private var model = OpenRiskAppModel()

    var body: some Scene {
        WindowGroup {
            OpenRiskRootView(model: model)
                .frame(minWidth: 900, minHeight: 620)
                .onOpenURL { url in
                    Task {
                        await model.prepareToOpenProject(at: url.path)
                    }
                }
        }
        .windowStyle(.automatic)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("New Investigation") {
                    model.createInvestigation()
                }
                .keyboardShortcut("n")
                .disabled(model.project == nil)

                Button("Open Project…") {
                    model.chooseProject()
                }
                .keyboardShortcut("o")
            }
        }
    }
}
