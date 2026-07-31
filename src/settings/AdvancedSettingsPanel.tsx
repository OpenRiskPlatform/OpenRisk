import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { OpenRiskClient } from "@/backend/OpenRiskClient";
import type { ProjectSettingsPayload } from "@/core/backend/bindings";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AdvancedSettingsPanelProps {
  client: OpenRiskClient;
  settings: ProjectSettingsPayload;
  onSettingsReloaded: (settings: ProjectSettingsPayload) => void;
}

const policies = new Set(["fail", "draft", "off"]);

export function AdvancedSettingsPanel({
  client,
  settings,
  onSettingsReloaded,
}: AdvancedSettingsPanelProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const readOnly = settings.project.is_preview;
  const currentPolicy = policies.has(
    settings.projectSettings.interruptedScanPolicy,
  )
    ? settings.projectSettings.interruptedScanPolicy
    : "fail";

  const changePolicy = async (policy: string) => {
    if (policy === currentPolicy) {
      return;
    }

    setPending(true);
    setMessage(null);
    try {
      await client.updateProjectSettings(null, null, null, policy);
      onSettingsReloaded(await client.loadSettings());
      setMessage("Recovery preference saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <header>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Advanced</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Less common project behavior and recovery preferences.
        </p>
      </header>

      <section className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold">Interrupted investigations</h3>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            Choose what happens when OpenRisk is closed while an investigation
            is still running. The choice is applied the next time this project
            opens.
          </p>
        </div>

        <div className="flex items-center justify-between gap-8 border-t pt-5">
          <div>
            <Label htmlFor="interrupted-scan-policy">On next project open</Label>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Automatic retry is avoided because it could repeat paid external
              requests.
            </p>
          </div>
          <Select
            value={currentPolicy}
            disabled={readOnly || pending}
            onValueChange={(value) => void changePolicy(value)}
          >
            <SelectTrigger id="interrupted-scan-policy" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fail">Mark as failed</SelectItem>
              <SelectItem value="draft">Restore as draft</SelectItem>
              <SelectItem value="off">Leave unchanged</SelectItem>
            </SelectContent>
          </Select>
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
