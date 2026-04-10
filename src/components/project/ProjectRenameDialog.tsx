import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface ProjectRenameDialogProps {
    open: boolean;
    value: string;
    saving: boolean;
    onOpenChange: (open: boolean) => void;
    onValueChange: (value: string) => void;
    onSubmit: () => void;
}

export function ProjectRenameDialog({
    open,
    value,
    saving,
    onOpenChange,
    onValueChange,
    onSubmit,
}: ProjectRenameDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Rename Project</DialogTitle>
                    <DialogDescription>
                        Set a display name for this project.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                    <Label htmlFor="rename-project-input">Project name</Label>
                    <Input
                        id="rename-project-input"
                        value={value}
                        onChange={(event) => onValueChange(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                onSubmit();
                            }
                        }}
                        autoFocus
                    />
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancel
                    </Button>
                    <Button onClick={onSubmit} disabled={saving}>
                        {saving ? "Saving..." : "Save"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
