import Foundation

enum NativeRecentProjects {
    private static let key = "openrisk.recent-projects"
    private static let limit = 8

    static func load() -> [String] {
        (UserDefaults.standard.stringArray(forKey: key) ?? [])
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .prefix(limit)
            .map { $0 }
    }

    @discardableResult
    static func add(_ path: String) -> [String] {
        let updated = ([path] + load().filter { $0 != path })
            .prefix(limit)
            .map { $0 }
        UserDefaults.standard.set(updated, forKey: key)
        return updated
    }

    @discardableResult
    static func remove(_ path: String) -> [String] {
        let updated = load().filter { $0 != path }
        UserDefaults.standard.set(updated, forKey: key)
        return updated
    }
}
