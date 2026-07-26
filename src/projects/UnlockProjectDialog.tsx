import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UnlockProjectDialogProps {
  projectPath: string;
  pending: boolean;
  error: string | null;
  onSubmit: (password: string) => Promise<void>;
  onCancel: () => void;
}

export function UnlockProjectDialog({
  projectPath,
  pending,
  error,
  onSubmit,
  onCancel,
}: UnlockProjectDialogProps) {
  const [password, setPassword] = useState("");

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password || pending) {
      return;
    }
    void onSubmit(password);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onCancel()}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Unlock project</DialogTitle>
            <DialogDescription>
              This project is encrypted. Enter its password to continue.
            </DialogDescription>
          </DialogHeader>

          <div className="my-5 space-y-4">
            <div className="space-y-2">
              <Label>Project file</Label>
              <Input value={projectPath} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-password">Password</Label>
              <Input
                id="project-password"
                type="password"
                autoFocus
                autoComplete="off"
                value={password}
                disabled={pending}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !password}>
              {pending ? "Unlocking…" : "Unlock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
