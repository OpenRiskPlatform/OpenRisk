/**
 * Print Page - Print or export the current report/analysis
 */

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Printer, FileDown, ArrowLeft, Loader2 } from "lucide-react";

interface PrintPageProps {
  title?: string;
}

export function PrintPage({ title }: PrintPageProps) {
  const navigate = useNavigate();
  const [isPrinting, setIsPrinting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePrint = async () => {
    setIsPrinting(true);
    setError(null);
    setSuccess(null);
    try {
      window.print();
      setSuccess("Print dialog opened.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to open print dialog.";
      setError(message);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setSuccess(null);
    try {
      // Placeholder: in a real implementation this would call the backend
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setSuccess("Report exported successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to export report.";
      setError(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
        {/* Page Header */}
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Printer className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold">{title ?? "Print & Export"}</h1>
          </div>
          <p className="text-muted-foreground">
            Print the current report or export it as a file.
          </p>
        </header>

        {/* Actions Card */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
            <CardDescription>
              Choose how you would like to output the current analysis report.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={handlePrint} disabled={isPrinting || isExporting}>
              {isPrinting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
              {isPrinting ? "Opening Print Dialog..." : "Print"}
            </Button>

            <Button
              variant="outline"
              onClick={handleExport}
              disabled={isPrinting || isExporting}
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-2 h-4 w-4" />
              )}
              {isExporting ? "Exporting..." : "Export as PDF"}
            </Button>

            <Button
              variant="ghost"
              onClick={() => navigate({ to: "/" })}
              disabled={isPrinting || isExporting}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Project
            </Button>
          </CardContent>
        </Card>

        {/* Feedback */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-sm text-destructive font-medium">{error}</p>
            </CardContent>
          </Card>
        )}
        {success && (
          <Card className="border-green-500">
            <CardContent className="pt-6">
              <p className="text-sm text-green-600 font-medium">{success}</p>
            </CardContent>
          </Card>
        )}

        {/* Print Preview Placeholder */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              A preview of the document to be printed will appear here once a
              report is generated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="min-h-[300px] rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">
                No report loaded. Run a search or analysis first.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

