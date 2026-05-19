import { useState } from "react";
import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { openUrl } from "@tauri-apps/plugin-opener";

interface ExternalLinkProps {
    href: string;
    children: React.ReactNode;
    className?: string;
}

export function ExternalLink({ href, children, className }: ExternalLinkProps) {
    const [open, setOpen] = useState(false);

    function handleClick(e: React.MouseEvent) {
        e.preventDefault();
        setOpen(true);
    }

    async function handleProceed() {
        setOpen(false);
        try {
            await openUrl(href);
        } catch {
            // fallback
            window.open(href, "_blank", "noreferrer");
        }
    }

    return (
        <>
            <a
                href={href}
                onClick={handleClick}
                className={className}
                rel="noreferrer"
            >
                {children}
            </a>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ExternalLinkIcon className="h-4 w-4" />
                            External Link
                        </DialogTitle>
                        <DialogDescription className="break-all pt-1">
                            You are about to open an external link:
                            <br />
                            <span className="text-foreground font-medium">{href}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleProceed}>
                            Proceed
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

