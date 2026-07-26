import { type FormEvent, useState } from "react";
import { MonitorCog } from "lucide-react";
import type { OpenRiskClient } from "@/backend/OpenRiskClient";
import type { ProjectSettingsPayload } from "@/core/backend/bindings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface GeneralSettingsPanelProps {
  client: OpenRiskClient;
  settings: ProjectSettingsPayload;
  onSettingsReloaded: (settings: ProjectSettingsPayload) => void;
}

export function GeneralSettingsPanel({
  client,
  settings,
  onSettingsReloaded,
}: GeneralSettingsPanelProps) {
  const [name, setName] = useState(settings.project.name);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const readOnly = settings.project.is_preview;
  const theme = ["light", "dark", "system"].includes(
    settings.projectSettings.theme,
  )
    ? settings.projectSettings.theme
    : "system";

  const reload = async () => {
    onSettingsReloaded(await client.loadSettings());
  };

  const run = async (actionName: string, action: () => Promise<void>) => {
    setPending(actionName);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(null);
    }
  };

  const saveName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = name.trim();
    if (!nextName) {
      setMessage("Project name is required.");
      return;
    }
    if (nextName === settings.project.name) {
      setMessage("No changes to save.");
      return;
    }

    await run("name", async () => {
      await client.updateProjectSettings(nextName, null, null);
      await reload();
      setMessage("Project name saved.");
    });
  };

  const changeTheme = async (theme: string) => {
    if (theme === settings.projectSettings.theme) {
      return;
    }
    await run("theme", async () => {
      await client.updateProjectSettings(null, theme, null);
      await reload();
    });
  };

  const changeAdvancedMode = async (advancedMode: boolean) => {
    await run("advanced", async () => {
      await client.updateProjectSettings(null, null, advancedMode);
      await reload();
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <header>
        <div className="flex items-center gap-2">
          <MonitorCog className="h-5 w-5" />
          <h2 className="text-xl font-semibold">General</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Project identity and interface preferences.
        </p>
      </header>

      {readOnly ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          This preview is read-only. Settings cannot be changed.
        </div>
      ) : null}

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Project</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            The name is shown in the application header.
          </p>
        </div>
        <form onSubmit={(event) => void saveName(event)} className="flex gap-2">
          <Input
            aria-label="Project name"
            value={name}
            disabled={readOnly || pending !== null}
            onChange={(event) => setName(event.target.value)}
          />
          {!readOnly ? (
            <Button type="submit" disabled={pending !== null}>
              {pending === "name" ? "Saving…" : "Save"}
            </Button>
          ) : null}
        </form>
        <p className="break-all rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {settings.project.directory}
        </p>
      </section>

      <section className="space-y-5 border-t pt-7">
        <div>
          <h3 className="text-sm font-semibold">Appearance</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Changes are applied when you select a theme.
          </p>
        </div>
        <div className="flex items-center justify-between gap-6">
          <div>
            <Label htmlFor="project-theme">Theme</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Follow the system or use a fixed color scheme.
            </p>
          </div>
          <Select
            value={theme}
            disabled={readOnly || pending !== null}
            onValueChange={(value) => void changeTheme(value)}
          >
            <SelectTrigger id="project-theme" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">System</SelectItem>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="border-t pt-7">
        <div className="flex items-center justify-between gap-6">
          <div>
            <Label htmlFor="advanced-mode">Advanced mode</Label>
            <p className="mt-1 max-w-lg text-xs text-muted-foreground">
              Show entity IDs, raw field containers, logs, and other technical
              details in investigation results.
            </p>
          </div>
          <Switch
            id="advanced-mode"
            checked={settings.projectSettings.advancedMode}
            disabled={readOnly || pending !== null}
            onCheckedChange={(checked) => void changeAdvancedMode(checked)}
          />
        </div>
      </section>

      {message ? (
        <p role="status" className="rounded-lg border bg-muted/30 p-3 text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
