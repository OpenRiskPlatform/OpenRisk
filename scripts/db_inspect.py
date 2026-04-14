import os
import sqlite3
import sys

DEFAULT_DB_PATH = "project.db"
DB_PATH = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("DB_PATH", DEFAULT_DB_PATH)

print(f"DB exists: {os.path.exists(DB_PATH)} {DB_PATH}")
if not os.path.exists(DB_PATH):
    print(f"Usage: python {os.path.basename(sys.argv[0])} [db_path]")
    print("You can also set the DB_PATH environment variable.")
    raise SystemExit(0)

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

print("\nTables:")
for (name,) in cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"):
    print(f"- {name}")

print("\nSchemaVersion rows:")
try:
    rows = list(cur.execute("SELECT * FROM SchemaVersion"))
    if not rows:
        print("<empty>")
    for row in rows:
        print(row)
except Exception as err:
    print(f"error: {err}")

print("\nProjectSettings columns:")
for row in cur.execute("PRAGMA table_info(ProjectSettings)"):
    print(row)

print("\nProjectSettings rows:")
try:
    rows = list(cur.execute("SELECT id, description, locale, theme FROM ProjectSettings"))
    if not rows:
        print("<empty>")
    for row in rows:
        print(row)
except Exception as err:
    print(f"error: {err}")

con.close()
