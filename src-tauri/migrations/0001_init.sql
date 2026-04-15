PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ProjectSettings (
    id TEXT PRIMARY KEY,
    description TEXT,
    locale TEXT,
    theme TEXT,
    advanced_mode INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS SchemaVersion (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS Project (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    audit TEXT,
    project_settings_id TEXT NOT NULL,
    FOREIGN KEY (project_settings_id) REFERENCES ProjectSettings(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS Plugin (
    id TEXT PRIMARY KEY,
    current_revision_id TEXT
);

CREATE TABLE IF NOT EXISTS PluginRevision (
    id TEXT PRIMARY KEY,
    plugin_id TEXT NOT NULL,
    version TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    license TEXT,
    authors_json TEXT,
    icon TEXT,
    homepage TEXT,
    update_metrics_fn TEXT,
    code TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ProjectPlugin (
    project_id TEXT NOT NULL,
    plugin_id TEXT NOT NULL,
    pinned_revision_id TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (project_id, plugin_id),
    FOREIGN KEY (project_id) REFERENCES Project(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
    FOREIGN KEY (pinned_revision_id) REFERENCES PluginRevision(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ProjectPluginSettingValue (
    plugin_id TEXT NOT NULL,
    project_settings_id TEXT NOT NULL,
    setting_name TEXT NOT NULL,
    value_json TEXT NOT NULL DEFAULT 'null',
    PRIMARY KEY (plugin_id, project_settings_id, setting_name),
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
    FOREIGN KEY (project_settings_id) REFERENCES ProjectSettings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Scan (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Draft','Running','Completed','Failed')),
    preview TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (project_id) REFERENCES Project(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ScanSelectedPlugin (
    scan_id TEXT NOT NULL,
    plugin_id TEXT NOT NULL,
    plugin_revision_id TEXT NOT NULL,
    entrypoint_id TEXT NOT NULL,
    PRIMARY KEY (scan_id, plugin_revision_id, entrypoint_id),
    FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_revision_id) REFERENCES PluginRevision(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ScanEntrypointInput (
    scan_id TEXT NOT NULL,
    plugin_id TEXT NOT NULL,
    plugin_revision_id TEXT NOT NULL,
    entrypoint_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    value_json TEXT NOT NULL DEFAULT 'null',
    PRIMARY KEY (scan_id, plugin_revision_id, entrypoint_id, field_name),
    FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_revision_id) REFERENCES PluginRevision(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ScanPluginResult (
    id TEXT PRIMARY KEY,
    plugin_id TEXT NOT NULL,
    plugin_revision_id TEXT NOT NULL,
    entrypoint_id TEXT NOT NULL DEFAULT 'default',
    scan_id TEXT NOT NULL,
    ok INTEGER NOT NULL DEFAULT 0,
    data_json TEXT,
    error TEXT,
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE,
    FOREIGN KEY (scan_id) REFERENCES Scan(id) ON DELETE CASCADE,
    FOREIGN KEY (plugin_revision_id) REFERENCES PluginRevision(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ScanPluginLog (
    id TEXT PRIMARY KEY,
    scan_result_id TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('log', 'warn', 'error')),
    message TEXT NOT NULL,
    FOREIGN KEY (scan_result_id) REFERENCES ScanPluginResult(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PluginRevisionEntrypoint (
    revision_id TEXT NOT NULL,
    id TEXT NOT NULL,
    name TEXT NOT NULL,
    function_name TEXT NOT NULL,
    description TEXT,
    PRIMARY KEY (revision_id, id),
    FOREIGN KEY (revision_id) REFERENCES PluginRevision(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PluginRevisionInputDef (
    revision_id TEXT NOT NULL,
    entrypoint_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    type_ TEXT NOT NULL,
    type_json TEXT NOT NULL,
    enum_values_json TEXT,
    optional INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    default_value_json TEXT,
    PRIMARY KEY (revision_id, entrypoint_id, name),
    FOREIGN KEY (revision_id) REFERENCES PluginRevision(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PluginRevisionSettingDef (
    revision_id TEXT NOT NULL,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    type_ TEXT NOT NULL,
    type_json TEXT NOT NULL,
    enum_values_json TEXT,
    description TEXT,
    required INTEGER NOT NULL DEFAULT 0,
    default_value_json TEXT,
    PRIMARY KEY (revision_id, name),
    FOREIGN KEY (revision_id) REFERENCES PluginRevision(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PluginRevisionMetricDef (
    revision_id TEXT NOT NULL,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    type_ TEXT NOT NULL,
    type_json TEXT NOT NULL,
    enum_values_json TEXT,
    description TEXT,
    PRIMARY KEY (revision_id, name),
    FOREIGN KEY (revision_id) REFERENCES PluginRevision(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PluginMetric (
    plugin_id TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    value_json TEXT NOT NULL DEFAULT 'null',
    PRIMARY KEY (plugin_id, metric_name),
    FOREIGN KEY (plugin_id) REFERENCES Plugin(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO SchemaVersion (id, version) VALUES (1, 19);
