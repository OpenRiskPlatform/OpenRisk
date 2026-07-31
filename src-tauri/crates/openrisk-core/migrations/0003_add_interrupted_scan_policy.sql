ALTER TABLE ProjectSettings
ADD COLUMN interrupted_scan_policy TEXT NOT NULL DEFAULT 'fail'
CHECK (interrupted_scan_policy IN ('fail', 'draft', 'off'));
