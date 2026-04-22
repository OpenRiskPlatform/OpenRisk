/**
 * General Settings Panel
 */

import { useEffect, useState } from "react";
import type { ProjectSettingsRecord } from "@/core/backend/bindings";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBackendClient } from "@/hooks/useBackendClient";
import { unwrap } from "@/lib/utils";
import { useSettings } from "@/core/settings/SettingsContext";

interface GeneralSettingsProps {
  projectDir?: string;
  projectName?: string;
  projectSettings: ProjectSettingsRecord | null;
  loading: boolean;
  error?: string | null;
  onProjectSettingsUpdated: (settings: ProjectSettingsRecord) => void;
  onProjectNameUpdated?: (name: string) => void;
}

export function GeneralSettings({
  projectDir,
  projectName,
  projectSettings,
  loading,
  error,
  onProjectSettingsUpdated,
  onProjectNameUpdated,
}: GeneralSettingsProps) {
  const backendClient = useBackendClient();
  const { updateGlobalSettings, globalSettings } = useSettings();
  const advancedMode = globalSettings.advancedMode ?? false;
  const [savingTheme, setSavingTheme] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordInfo, setPasswordInfo] = useState<string | null>(null);
  const [passwordEnabled, setPasswordEnabled] = useState<boolean | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [projectNameDraft, setProjectNameDraft] = useState(projectName ?? "");
  const [renamingProject, setRenamingProject] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  const theme = projectSettings?.theme ?? "system";

  const handleAdvancedModeChange = async (checked: boolean) => {
    await updateGlobalSettings({ advancedMode: checked });
    try {
      const updated = await unwrap(backendClient.updateProjectSettings(null, null, checked));
      onProjectSettingsUpdated(updated);
    } catch (e) {
      console.error("[GeneralSettings] Failed to persist advancedMode", e);
    }
  };

  const handleThemeChange = async (value: "light" | "dark" | "system") => {
    if (!projectDir) {
      return;
    }

    setSavingTheme(true);
    try {
      const updated = await unwrap(backendClient.updateProjectSettings(null, value, null));
      onProjectSettingsUpdated(updated);
      await updateGlobalSettings({ theme: updated.theme as "light" | "dark" | "system" });
    } finally {
      setSavingTheme(false);
    }
  };

  const refreshPasswordStatus = async () => {
    if (!projectDir) {
      setPasswordEnabled(null);
      return;
    }
    const status = await unwrap(backendClient.getProjectLockStatus(projectDir));
    setPasswordEnabled(status.locked);
  };

  const clearPasswordInputs = () => {
    setNewPassword("");
    setConfirmPassword("");
    setCurrentPassword("");
  };

  const submitRenameProject = async () => {
    if (!projectDir) {
      return;
    }
    const nextName = projectNameDraft.trim();
    if (!nextName) {
      setRenameError("Project name must not be empty");
      return;
    }

    setRenameError(null);
    setRenamingProject(true);
    try {
      const updated = await unwrap(backendClient.updateProjectSettings(nextName, null, null));
      onProjectSettingsUpdated(updated);
      onProjectNameUpdated?.(nextName);
      window.dispatchEvent(
        new CustomEvent("openrisk:project-renamed", {
          detail: { name: nextName },
        }),
      );
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : String(err));
    } finally {
      setRenamingProject(false);
    }
  };

  const submitEnablePassword = async () => {
    if (!projectDir) {
      return;
    }
    setPasswordError(null);
    setPasswordInfo(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setPasswordBusy(true);
    try {
      await unwrap(backendClient.setProjectPassword(newPassword));
      setPasswordInfo("Password protection enabled. Database file is now encrypted.");
      clearPasswordInputs();
      await refreshPasswordStatus();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : String(err));
    } finally {
      setPasswordBusy(false);
    }
  };

  const submitChangePassword = async () => {
    if (!projectDir) {
      return;
    }
    setPasswordError(null);
    setPasswordInfo(null);
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    setPasswordBusy(true);
    try {
      await unwrap(backendClient.changeProjectPassword(currentPassword, newPassword));
      setPasswordInfo("Password changed successfully.");
      clearPasswordInputs();
      await refreshPasswordStatus();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : String(err));
    } finally {
      setPasswordBusy(false);
    }
  };

  const submitDisablePassword = async () => {
    if (!projectDir) {
      return;
    }
    setPasswordError(null);
    setPasswordInfo(null);
    setPasswordBusy(true);
    try {
      await unwrap(backendClient.removeProjectPassword(currentPassword));
      setPasswordInfo("Password protection removed. File is no longer encrypted.");
      clearPasswordInputs();
      await refreshPasswordStatus();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : String(err));
    } finally {
      setPasswordBusy(false);
    }
  };

  useEffect(() => {
    void refreshPasswordStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectDir]);

  useEffect(() => {
    setProjectNameDraft(projectName ?? "");
  }, [projectName]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">General Settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage project-level preferences
        </p>
      </div>

      {!projectDir && (
        <p className="text-sm text-muted-foreground">
          Open or create a project to edit settings.
        </p>
      )}

      {projectDir && loading && (
        <p className="text-sm text-muted-foreground">Loading project settings…</p>
      )}

      {projectDir && !loading && error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {projectDir && !loading && !error && projectSettings && (
        <div className="space-y-4">
          <div className="space-y-0.5">
            <Label>Project Name</Label>
            <p className="text-sm text-muted-foreground">
              Update display name for this project.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={projectNameDraft}
              onChange={(e) => setProjectNameDraft(e.target.value)}
              placeholder="Project name"
            />
            <Button
              type="button"
              onClick={() => void submitRenameProject()}
              disabled={renamingProject}
            >
              {renamingProject ? "Saving..." : "Rename"}
            </Button>
          </div>
          {renameError ? <p className="text-sm text-red-600">{renameError}</p> : null}

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Theme</Label>
              <p className="text-sm text-muted-foreground">
                Stored in project settings and applied immediately.
              </p>
            </div>
            <Select
              value={theme}
              onValueChange={handleThemeChange}
              disabled={savingTheme}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            Locale: {projectSettings.locale} &bull; Settings ID: {projectSettings.id}
          </p>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="advanced-mode">Advanced Mode</Label>
              <p className="text-sm text-muted-foreground">
                Show entity IDs and low-level technical details in scan results.
              </p>
            </div>
            <Switch
              id="advanced-mode"
              checked={advancedMode}
              onCheckedChange={(checked) => void handleAdvancedModeChange(checked)}
            />
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="space-y-0.5">
              <Label>Password Protection</Label>
              <p className="text-sm text-muted-foreground">
                Encrypt this project file with SQLCipher.
              </p>
            </div>

            {passwordEnabled === false && (
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Button
                  type="button"
                  onClick={() => void submitEnablePassword()}
                  disabled={passwordBusy || !newPassword || !confirmPassword}
                >
                  {passwordBusy ? "Applying..." : "Enable Encryption"}
                </Button>
              </div>
            )}

            {passwordEnabled === true && (
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Input
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => void submitChangePassword()}
                    disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword}
                  >
                    {passwordBusy ? "Saving..." : "Change Password"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void submitDisablePassword()}
                    disabled={passwordBusy || !currentPassword}
                  >
                    Disable Encryption
                  </Button>
                </div>
              </div>
            )}

            {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
            {passwordInfo ? <p className="text-sm text-muted-foreground">{passwordInfo}</p> : null}
          </div>
        </div>
      )}
    </div>
  );
}
