import SwiftUI

struct NativeFormSection<Content: View>: View {
  let number: String
  let title: String
  let help: String
  @ViewBuilder let content: Content

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
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

struct NativeInputField: View {
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
