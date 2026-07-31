import Foundation
import SwiftUI

func officeScalar(_ value: Any) -> String? {
    if value is NSNull {
        return "Not provided"
    }
    if let string = value as? String {
        return string
    }
    if let number = value as? NSNumber {
        if CFGetTypeID(number) == CFBooleanGetTypeID() {
            return number.boolValue ? "Yes" : "No"
        }
        return number.stringValue
    }
    if let array = value as? [Any] {
        let values = array.compactMap(officeScalar)
        return values.isEmpty ? nil : values.joined(separator: ", ")
    }
    if let dictionary = value as? [String: Any] {
        if dictionary["$type"] != nil, let wrappedValue = dictionary["value"] {
            return officeScalar(wrappedValue)
        }
        if let name = dictionary["name"] as? String {
            if let relation = dictionary["relation"] as? String {
                return "\(name) (\(relation))"
            }
            return name
        }
        if let key = dictionary["key"], let wrappedValue = dictionary["value"],
           let keyText = officeScalar(key), let valueText = officeScalar(wrappedValue) {
            return "\(keyText): \(valueText)"
        }
    }
    return nil
}

func typedRawValues(_ value: Any?) -> [Any] {
    guard let value else {
        return []
    }
    if let array = value as? [Any] {
        return array.flatMap { item -> [Any] in
            if let dictionary = item as? [String: Any],
               dictionary["$type"] != nil,
               let wrappedValue = dictionary["value"] {
                return [wrappedValue]
            }
            return [item]
        }
    }
    if let dictionary = value as? [String: Any],
       dictionary["$type"] != nil,
       let wrappedValue = dictionary["value"] {
        return [wrappedValue]
    }
    return [value]
}

func typedStrings(_ value: Any?) -> [String] {
    typedRawValues(value).compactMap(officeScalar)
}

func typedBoolean(_ value: Any?) -> Bool? {
    for rawValue in typedRawValues(value) {
        if let boolean = rawValue as? Bool {
            return boolean
        }
        if let number = rawValue as? NSNumber,
           CFGetTypeID(number) == CFBooleanGetTypeID() {
            return number.boolValue
        }
    }
    return nil
}

func appendFact(
    _ label: String,
    values: [String],
    to facts: inout [OfficeFact]
) {
    guard !values.isEmpty else {
        return
    }
    facts.append(OfficeFact(label: label, value: values.joined(separator: ", ")))
}

func hasRiskFlag(_ entity: [String: Any]) -> Bool {
    if let properties = entity["$props"] as? [String: Any],
       [
           "pepStatus",
           "sanctioned",
           "isPepRca",
           "adverseActivityDetected",
       ].contains(where: { typedBoolean(properties[$0]) == true }) {
        return true
    }
    return findBoolean(named: "Match", in: entity["$extra"]) == true
}

func extraValues(named name: String, in value: Any?) -> [Any] {
    guard let value else {
        return []
    }
    if let array = value as? [Any] {
        return array.flatMap { extraValues(named: name, in: $0) }
    }
    guard let dictionary = value as? [String: Any] else {
        return []
    }

    if dictionary["$type"] as? String == "key-value",
       let pair = dictionary["value"] as? [String: Any],
       let key = typedStrings(pair["key"]).first,
       key.caseInsensitiveCompare(name) == .orderedSame {
        return typedRawValues(pair["value"])
    }

    if let key = dictionary["key"] as? String,
       key.caseInsensitiveCompare(name) == .orderedSame,
       let result = dictionary["value"] {
        return typedRawValues(result)
    }

    return dictionary.values.flatMap { extraValues(named: name, in: $0) }
}

func findBoolean(named name: String, in value: Any?) -> Bool? {
    if let result = extraValues(named: name, in: value)
        .compactMap({ typedBoolean($0) })
        .first {
        return result
    }

    guard let value else {
        return nil
    }
    if let dictionary = value as? [String: Any] {
        if let direct = dictionary[name] as? Bool {
            return direct
        }
        if let key = dictionary["key"] as? String,
           key.caseInsensitiveCompare(name) == .orderedSame,
           let result = dictionary["value"] as? Bool {
            return result
        }
        for nestedValue in dictionary.values {
            if let result = findBoolean(named: name, in: nestedValue) {
                return result
            }
        }
    }
    if let array = value as? [Any] {
        for item in array {
            if let result = findBoolean(named: name, in: item) {
                return result
            }
        }
    }
    return nil
}

func entityLabel(_ entityType: String) -> String {
    switch entityType {
    case "entity.person":
        return "Person"
    case "entity.organization":
        return "Organization"
    case "entity.mediaMention":
        return "Media mention"
    case "entity.riskTopic":
        return "Risk topic"
    case "entity.socialProfile":
        return "Social profile"
    case "entity.financialRecord":
        return "Financial record"
    case "entity.detectedEntity":
        return "Related entity"
    default:
        return entityType
    }
}

func canonicalPropertyLabel(_ key: String) -> String {
    let labels = [
        "aliases": "Aliases",
        "birthDate": "Birth date",
        "birthPlace": "Birth place",
        "nationalities": "Nationalities",
        "jurisdiction": "Jurisdiction",
        "addresses": "Addresses",
        "emails": "Emails",
        "phones": "Phones",
        "relativeCloseAssociates": "Relatives and close associates",
        "previousNames": "Previous names",
        "registrationId": "Registration ID",
        "country": "Country",
        "address": "Address",
        "status": "Status",
        "involvedPersons": "Involved people",
        "legalRoles": "Legal roles",
        "sourceRegister": "Source register",
        "entryTypes": "Entry types",
        "effectiveTo": "Effective to",
        "platform": "Platform",
        "profileTitle": "Profile",
        "profileUrl": "Profile URL",
        "userId": "User ID",
        "amountOwed": "Amount owed",
        "location": "Location",
        "debtSource": "Debt source",
    ]
    return labels[key] ?? key
}

func containsText(_ value: Any, query: String) -> Bool {
    if let string = value as? String {
        return string.localizedCaseInsensitiveContains(query)
    }
    if let number = value as? NSNumber {
        return number.stringValue.localizedCaseInsensitiveContains(query)
    }
    if let dictionary = value as? [String: Any] {
        return dictionary.contains { key, nestedValue in
            key.localizedCaseInsensitiveContains(query) ||
                containsText(nestedValue, query: query)
        }
    }
    if let array = value as? [Any] {
        return array.contains { containsText($0, query: query) }
    }
    return false
}

func officeSources(from value: Any?) -> [OfficeSource] {
    guard let value else {
        return []
    }

    var sources: [OfficeSource] = []

    if let array = value as? [Any] {
        sources = array.flatMap { officeSources(from: $0) }
    } else if let dictionary = value as? [String: Any] {
        let urlValue =
            dictionary["source"] as? String ??
            dictionary["url"] as? String ??
            dictionary["href"] as? String

        if let urlValue, let url = URL(string: urlValue) {
            let name =
                dictionary["name"] as? String ??
                dictionary["title"] as? String ??
                url.host() ??
                urlValue
            sources.append(OfficeSource(name: name, url: url))
        } else {
            sources = dictionary.values.flatMap { officeSources(from: $0) }
        }
    } else if let string = value as? String,
              let url = URL(string: string),
              url.scheme != nil {
        sources.append(
            OfficeSource(
                name: url.host() ?? string,
                url: url
            )
        )
    }

    var seen: Set<URL> = []
    return sources.filter { seen.insert($0.url).inserted }
}

func isScalar(_ value: Any) -> Bool {
    value is String || value is NSNumber || value is NSNull
}
