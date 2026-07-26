import { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { Download, LockKeyhole } from "lucide-react";
import type { OpenRiskClient } from "@/backend/OpenRiskClient";
import type {
  ProjectLockStatus,
  ProjectSettingsPayload,
} from "@/core/backend/bindings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SecuritySettingsPanelProps {
  client: OpenRiskClient;
  settings: ProjectSettingsPayload;
}

export function SecuritySettingsPanel({
  client,
  settings,
}: SecuritySettingsPanelProps) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lockStatus, setLockStatus] = useState<ProjectLockStatus | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const readOnly = settings.project.is_preview;

  const run = async (action: () => Promise<void>) => {
    setPending(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setPending(false);
    }
  };

  const clearPasswords = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const loadLockStatus = async () => {
    await run(async () => {
      setLockStatus(
        await client.getProjectLockStatus(settings.project.directory),
      );
    });
  };

  const enablePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      setMessage("New passwords do not match.");
      return;
    }
    await run(async () => {
      setLockStatus(await client.setProjectPassword(newPassword));
      clearPasswords();
      setMessage("Project encryption enabled.");
    });
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword || newPassword !== confirmPassword) {
      setMessage("Enter the current password and matching new passwords.");
      return;
    }
    await run(async () => {
      setLockStatus(
        await client.changeProjectPassword(currentPassword, newPassword),
      );
      clearPasswords();
      setMessage("Project password changed.");
    });
  };

  const removePassword = async () => {
    if (!currentPassword) {
      setMessage("Enter the current password.");
      return;
    }
    await run(async () => {
      setLockStatus(await client.removeProjectPassword(currentPassword));
      clearPasswords();
      setMessage("Project encryption removed.");
    });
  };

  const exportPreview = async () => {
    const destination = await save({
      title: "Export read-only preview",
      defaultPath: `${settings.project.name}-preview.orproj`,
      filters: [{ name: "OpenRisk Project", extensions: ["orproj"] }],
    });
    if (typeof destination !== "string") {
      return;
    }
    await run(async () => {
      await client.createPreviewProject(destination);
      setMessage(`Preview exported to ${destination}`);
    });
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-8">
      <header>
        <div className="flex items-center gap-2">
          <LockKeyhole className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Security and sharing</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Protect the project file or export a read-only copy.
        </p>
      </header>

      {readOnly ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          This is a read-only preview project.
        </div>
      ) : (
        <>
          <section className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Encryption</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Status is checked only when you request it.
              </p>
            </div>

            {lockStatus === null ? (
              <Button
                variant="outline"
                className="gap-2"
                disabled={pending}
                onClick={() => void loadLockStatus()}
              >
                <LockKeyhole className="h-4 w-4" />
                Check encryption status
              </Button>
            ) : (
              <div className="space-y-3 rounded-xl border p-4">
                <p className="text-sm font-medium">
                  Encryption is {lockStatus.locked ? "enabled" : "disabled"}.
                </p>
                {lockStatus.locked ? (
                  <Input
                    type="password"
                    autoComplete="off"
                    placeholder="Current password"
                    value={currentPassword}
                    disabled={pending}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                ) : null}
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder="New password"
                  value={newPassword}
                  disabled={pending}
                  onChange={(event) => setNewPassword(event.target.value)}
                />
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  disabled={pending}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  {lockStatus.locked ? (
                    <>
                      <Button
                        disabled={pending}
                        onClick={() => void changePassword()}
                      >
                        Change password
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={pending}
                        onClick={() => void removePassword()}
                      >
                        Remove encryption
                      </Button>
                    </>
                  ) : (
                    <Button
                      disabled={pending}
                      onClick={() => void enablePassword()}
                    >
                      Enable encryption
                    </Button>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-4 border-t pt-7">
            <div>
              <h3 className="text-sm font-semibold">Read-only preview</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a review copy without editable settings or credentials.
              </p>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              disabled={pending}
              onClick={() => void exportPreview()}
            >
              <Download className="h-4 w-4" />
              Export preview
            </Button>
          </section>
        </>
      )}

      {message ? (
        <p role="status" className="rounded-lg border bg-muted/30 p-3 text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
