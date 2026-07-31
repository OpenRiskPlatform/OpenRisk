import SwiftUI

struct NativeProjectLauncherView: View {
    @ObservedObject var model: OpenRiskAppModel

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: 40)

            Image(systemName: "shield.lefthalf.filled.badge.checkmark")
                .font(.system(size: 58, weight: .regular))
                .foregroundStyle(.tint)
                .accessibilityHidden(true)

            Text("OpenRisk")
                .font(.largeTitle.weight(.semibold))
                .padding(.top, 14)
            Text("Investigations without the technical noise.")
                .foregroundStyle(.secondary)
                .padding(.top, 4)

            HStack(spacing: 12) {
                Button {
                    model.chooseNewProject()
                } label: {
                    Label("Create Project", systemImage: "folder.badge.plus")
                        .frame(minWidth: 140)
                }
                .buttonStyle(.borderedProminent)

                Button {
                    model.chooseProject()
                } label: {
                    Label("Open Project", systemImage: "folder")
                        .frame(minWidth: 140)
                }
                .buttonStyle(.bordered)
            }
            .controlSize(.large)
            .disabled(model.isLoadingProject)
            .padding(.top, 24)

            if model.isLoadingProject {
                ProgressView("Opening project…")
                    .controlSize(.small)
                    .padding(.top, 14)
            }

            recentProjects
                .padding(.top, 34)

            Spacer(minLength: 40)
        }
        .padding(.horizontal, 40)
        .frame(minWidth: 680, minHeight: 540)
    }

    @ViewBuilder
    private var recentProjects: some View {
        if !model.recentProjectPaths.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Recent projects")
                    .font(.headline)

                ForEach(model.recentProjectPaths, id: \.self) { path in
                    HStack(spacing: 10) {
                        Button {
                            model.openRecentProject(path)
                        } label: {
                            HStack(spacing: 10) {
                                Image(systemName: "doc.badge.gearshape")
                                    .foregroundStyle(.secondary)
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(projectName(path))
                                        .foregroundStyle(.primary)
                                    Text(path)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
                                }
                                Spacer()
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .disabled(model.isLoadingProject)

                        Button {
                            model.forgetRecentProject(path)
                        } label: {
                            Image(systemName: "xmark")
                        }
                        .buttonStyle(.plain)
                        .foregroundStyle(.secondary)
                        .help("Remove from recent projects")
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)

                    if path != model.recentProjectPaths.last {
                        Divider()
                    }
                }
            }
            .padding(14)
            .background(.quaternary.opacity(0.35), in: RoundedRectangle(cornerRadius: 12))
            .frame(maxWidth: 560)
        }
    }

    private func projectName(_ path: String) -> String {
        URL(fileURLWithPath: path)
            .deletingPathExtension()
            .lastPathComponent
    }
}
