import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

const revisions = [
  {
    label: "before",
    revision: "6a7f5817ec081eac7071b3a4459ce817cca41da9",
    directory:
      process.env.OPENRISK_EVIDENCE_BEFORE ?? "/tmp/openrisk-evidence-before",
  },
  {
    label: "after",
    revision: "e824ad8de10fe128e06966a52c83a8c916f27a9a",
    directory:
      process.env.OPENRISK_EVIDENCE_AFTER ?? "/tmp/openrisk-evidence-after",
  },
];

function run(command, args, cwd) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function output(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

for (const historical of revisions) {
  const gitMarker = path.join(historical.directory, ".git");
  if (!fs.existsSync(gitMarker)) {
    fs.mkdirSync(path.dirname(historical.directory), { recursive: true });
    run(
      "git",
      ["worktree", "add", "--detach", historical.directory, historical.revision],
      repositoryRoot,
    );
  }

  const actualRevision = output(
    "git",
    ["rev-parse", "HEAD"],
    historical.directory,
  );
  if (actualRevision !== historical.revision) {
    throw new Error(
      `${historical.label} worktree is at ${actualRevision}, expected ${historical.revision}`,
    );
  }

  if (!fs.existsSync(path.join(historical.directory, "node_modules/.bin/vite"))) {
    run("npm", ["ci"], historical.directory);
  }

  console.log(
    `[evidence] ${historical.label}: ${historical.revision.slice(0, 7)} at ${historical.directory}`,
  );
}
