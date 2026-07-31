import CoreFoundation
import Foundation

enum NativeFieldValue: Hashable {
    case text(String)
    case number(String)
    case boolean(Bool)
    case null

    static func from(json: String?, typeName: String) -> NativeFieldValue {
        guard
            let json,
            let data = json.data(using: .utf8),
            let value = try? JSONSerialization.jsonObject(
                with: data,
                options: .fragmentsAllowed
            )
        else {
            return empty(for: typeName)
        }

        if value is NSNull {
            return empty(for: typeName)
        }
        if let string = value as? String {
            return .text(string)
        }
        if let number = value as? NSNumber {
            if CFGetTypeID(number) == CFBooleanGetTypeID() {
                return .boolean(number.boolValue)
            }
            return .number(number.stringValue)
        }
        return empty(for: typeName)
    }

    static func empty(for typeName: String) -> NativeFieldValue {
        switch typeName.lowercased() {
        case "boolean", "bool":
            return .boolean(false)
        case "number", "integer":
            return .number("")
        default:
            return .text("")
        }
    }

    var text: String {
        switch self {
        case let .text(value), let .number(value):
            return value
        case let .boolean(value):
            return value ? "true" : "false"
        case .null:
            return ""
        }
    }

    var boolean: Bool {
        if case let .boolean(value) = self {
            return value
        }
        return false
    }

    func json(typeName: String) -> String {
        switch self {
        case let .text(value):
            return Self.encode(value)
        case let .number(value):
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            return Double(trimmed).map { Self.encode($0) } ?? "null"
        case let .boolean(value):
            return value ? "true" : "false"
        case .null:
            return "null"
        }
    }

    private static func encode<T: Encodable>(_ value: T) -> String {
        guard
            let data = try? JSONEncoder().encode(value),
            let encoded = String(data: data, encoding: .utf8)
        else {
            return "null"
        }
        return encoded
    }
}
