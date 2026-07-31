import SwiftUI

struct NativeSecuritySettingsView: View {
    @ObservedObject var model: OpenRiskAppModel
    let settings: NativeSettingsSnapshot

    @State private var lockStatus: NativeProjectLockStatus?
    @State private var currentPassword = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""

    var body: some View {
        Form {
            if settings.project.isPreview {
                NativeReadOnlyNotice()
            } else {
                Section {
                    encryptionContent
                } header: {
                    Text("Encryption")
                } footer: {
                    Text("The project database is encrypted locally with SQLCipher.")
                }

                Section {
                    Button {
                        model.exportPreview()
                    } label: {
                        Label("Export Read-only Preview", systemImage: "square.and.arrow.up")
                    }
                    .disabled(model.isPerformingSettingsAction)
                } header: {
                    Text("Sharing")
                } footer: {
                    Text("Creates a review copy without editable settings or exposed credentials.")
                }
            }
        }
        .formStyle(.grouped)
        .navigationTitle("Security")
    }

    @ViewBuilder
    private var encryptionContent: some View {
        if let lockStatus {
            LabeledContent("Status") {
                Label(
                    lockStatus.locked ? "Encrypted" : "Not encrypted",
                    systemImage: lockStatus.locked ? "lock.fill" : "lock.open"
                )
                .foregroundStyle(lockStatus.locked ? .green : .secondary)
            }

            if lockStatus.locked {
                SecureField("Current password", text: $currentPassword)
            }
            SecureField("New password", text: $newPassword)
            SecureField("Confirm new password", text: $confirmPassword)

            HStack {
                if lockStatus.locked {
                    Button("Change Password") {
                        changePassword()
                    }
                    .buttonStyle(.borderedProminent)

                    Button("Remove Encryption", role: .destructive) {
                        removeEncryption()
                    }
                } else {
                    Button("Enable Encryption") {
                        enableEncryption()
                    }
                    .buttonStyle(.borderedProminent)
                }
            }
            .disabled(model.isPerformingSettingsAction)
        } else {
            Button {
                Task {
                    lockStatus = await model.loadProjectLockStatus()
                }
            } label: {
                Label("Check Encryption Status", systemImage: "lock")
            }
            .disabled(model.isPerformingSettingsAction)
        }
    }

    private func enableEncryption() {
        guard validateNewPassword() else {
            return
        }
        Task {
            if let status = await model.enableProjectEncryption(password: newPassword) {
                lockStatus = status
                clearPasswords()
                model.settingsMessage = "Project encryption enabled."
            }
        }
    }

    private func changePassword() {
        guard !currentPassword.isEmpty, validateNewPassword() else {
            if currentPassword.isEmpty {
                model.settingsMessage = "Enter the current password."
            }
            return
        }
        Task {
            if let status = await model.changeProjectPassword(
                currentPassword: currentPassword,
                newPassword: newPassword
            ) {
                lockStatus = status
                clearPasswords()
                model.settingsMessage = "Project password changed."
            }
        }
    }

    private func removeEncryption() {
        guard !currentPassword.isEmpty else {
            model.settingsMessage = "Enter the current password."
            return
        }
        Task {
            if let status = await model.removeProjectEncryption(password: currentPassword) {
                lockStatus = status
                clearPasswords()
                model.settingsMessage = "Project encryption removed."
            }
        }
    }

    private func validateNewPassword() -> Bool {
        guard !newPassword.isEmpty, newPassword == confirmPassword else {
            model.settingsMessage = "New passwords do not match."
            return false
        }
        return true
    }

    private func clearPasswords() {
        currentPassword = ""
        newPassword = ""
        confirmPassword = ""
    }
}
