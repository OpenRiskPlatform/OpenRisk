import SwiftUI

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
          .padding(.bottom, 20)

        Divider()

        sourceSection
          .padding(.vertical, 20)

        Divider()

        checksSection
          .padding(.vertical, 20)

        if !editor.visibleInputs.isEmpty {
          Divider()
          inputsSection
            .padding(.vertical, 20)
        }

        Divider()

        runSection
          .padding(.vertical, 20)
      }
      .padding(.horizontal, 32)
      .padding(.vertical, 26)
      .frame(maxWidth: 760, alignment: .leading)
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
        .frame(width: 380, alignment: .leading)
        .frame(maxWidth: .infinity, alignment: .leading)
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
                    !description.isEmpty
                  {
                    Text(description)
                      .font(.subheadline)
                      .foregroundStyle(.secondary)
                      .fixedSize(horizontal: false, vertical: true)
                  }
                }

                Spacer()
              }
              .padding(.vertical, 10)
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
        columns: [GridItem(.adaptive(minimum: 280), spacing: 24)],
        alignment: .leading,
        spacing: 18
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
