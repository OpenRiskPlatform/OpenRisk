import SwiftUI

struct ScanRow: View {
    let scan: NativeScanSummary
    let isRunning: Bool

    var body: some View {
        HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 3) {
                Text(scan.preview ?? "Untitled")
                    .lineLimit(1)

                HStack(spacing: 5) {
                    if isRunning {
                        Text("Running")
                    } else if scan.status.lowercased() == "draft" {
                        Text("Draft")
                    } else if let pluginName = scan.pluginName {
                        Text(pluginName)
                    }
                    if scan.resultCount > 0 {
                        Text("· \(scan.resultCount) results")
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }

            Spacer(minLength: 4)

            if isRunning {
                ProgressView()
                    .controlSize(.mini)
            } else if let statusSymbol {
                Image(systemName: statusSymbol)
                    .foregroundStyle(statusColor)
            }
        }
        .padding(.vertical, 3)
    }

    private var statusSymbol: String? {
        if scan.errorResultCount > 0 {
            return "exclamationmark.circle.fill"
        }

        switch scan.status.lowercased() {
        case "completed", "complete", "success":
            return nil
        case "failed", "error":
            return "exclamationmark.circle.fill"
        case "draft":
            return "pencil.circle"
        case "running":
            return "clock"
        default:
            return "questionmark.circle.fill"
        }
    }

    private var statusColor: Color {
        if scan.errorResultCount > 0 {
            return .red
        }

        switch scan.status.lowercased() {
        case "failed", "error":
            return .red
        case "draft", "running", "completed", "complete", "success":
            return .secondary
        default:
            return .orange
        }
    }
}

struct ProjectPasswordView: View {
    let onCancel: () -> Void
    let onUnlock: (String) -> Void

    @State private var password = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Unlock Project")
                    .font(.title2.weight(.semibold))
                Text("Enter this project’s password.")
                    .foregroundStyle(.secondary)
            }

            SecureField("Password", text: $password)
                .onSubmit(unlock)

            HStack {
                Spacer()
                Button("Cancel", role: .cancel, action: onCancel)
                Button("Unlock", action: unlock)
                    .buttonStyle(.borderedProminent)
                    .disabled(password.isEmpty)
            }
        }
        .padding(24)
        .frame(width: 380)
    }

    private func unlock() {
        guard !password.isEmpty else {
            return
        }
        onUnlock(password)
    }
}

struct RenameScanView: View {
    let onCancel: () -> Void
    let onRename: (String) -> Void

    @State private var name: String

    init(
        currentName: String,
        onCancel: @escaping () -> Void,
        onRename: @escaping (String) -> Void
    ) {
        self.onCancel = onCancel
        self.onRename = onRename
        _name = State(initialValue: currentName)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 5) {
                Text("Rename Investigation")
                    .font(.title2.weight(.semibold))
                Text("The name is changed only when you edit it.")
                    .foregroundStyle(.secondary)
            }

            TextField("Investigation name", text: $name)
                .onSubmit(rename)

            HStack {
                Spacer()
                Button("Cancel", role: .cancel, action: onCancel)
                Button("Rename", action: rename)
                    .buttonStyle(.borderedProminent)
            }
        }
        .padding(24)
        .frame(width: 420)
    }

    private func rename() {
        onRename(name)
    }
}
