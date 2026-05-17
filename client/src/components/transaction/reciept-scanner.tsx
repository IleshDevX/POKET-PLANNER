import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScanText } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { AIScanReceiptData } from "@/features/transaction/transationType";
import { toast } from "sonner";
import { useProgressLoader } from "@/hooks/use-progress-loader";
import { useAiScanReceiptMutation } from "@/features/transaction/transactionAPI";

interface ReceiptScannerProps {
  loadingChange: boolean;
  onScanComplete: (data: AIScanReceiptData) => void;
  onLoadingChange: (isLoading: boolean) => void;
}

type ScanErrorType = {
  status?: number | string;
  data?: {
    message?: string;
  };
  error?: string;
  message?: string;
};

const getScanErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") {
    return "Failed to scan receipt";
  }

  const parsedError = error as ScanErrorType;

  if (parsedError.status === "FETCH_ERROR") {
    return "Cannot reach backend API. Ensure backend is running on http://localhost:8000";
  }

  if (parsedError.status === "PARSING_ERROR") {
    return "Unexpected API response. Please retry after restarting backend";
  }

  return (
    parsedError?.data?.message ||
    parsedError?.message ||
    parsedError?.error ||
    "Failed to scan receipt"
  );
};

const ReceiptScanner = ({
  loadingChange,
  onScanComplete,
  onLoadingChange,
}: ReceiptScannerProps) => {
  const [receipt, setReceipt] = useState<string | null>(null);

  const {
    progress,
    startProgress,
    updateProgress,
    doneProgress,
    resetProgress,
  } = useProgressLoader({ initialProgress: 10, completionDelay: 500 });

  const [aiScanReceipt] = useAiScanReceiptMutation();

  const handleReceiptUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast.error("Please select a file");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    const formData = new FormData();
    formData.append("receipt", file);

    startProgress(10);
    onLoadingChange(true);
    // Simulate file upload and processing
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setReceipt(result);

      // Simulate scanning progress
      // Start progress
      let currentProgress = 10;
      const interval = setInterval(() => {
        const increment = currentProgress < 90 ? 10 : 1;
        currentProgress = Math.min(currentProgress + increment, 90);
        updateProgress(currentProgress);
      }, 250);

      aiScanReceipt(formData)
        .unwrap()
        .then((res) => {
          const payload = res.data as Partial<AIScanReceiptData> & {
            error?: string;
          };

          if (payload.error) {
            throw new Error(payload.error);
          }

          if (typeof payload.amount !== "number" || !payload.date) {
            throw new Error("Could not extract required receipt details");
          }

          updateProgress(100);
          onScanComplete(payload as AIScanReceiptData);
          toast.success("Receipt scanned successfully");
        })
        .catch((error: unknown) => {
          toast.error(getScanErrorMessage(error));
        })
        .finally(() => {
          clearInterval(interval);
          doneProgress();
          resetProgress();
          setReceipt(null);
          onLoadingChange(false);
        });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">AI Scan Receipt</Label>
      <div className="flex items-start gap-3 border-b pb-4">
        {/* Receipt Preview */}
        <div
          className={`h-12 w-12 rounded-md border bg-cover bg-center ${
            !receipt ? "bg-muted" : ""
          }`}
          style={receipt ? { backgroundImage: `url(${receipt})` } : {}}
        >
          {!receipt && (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <ScanText color="currentColor" className="h-5 w-5 !stroke-1.5" />
            </div>
          )}
        </div>

        {/* Upload Input or Progress */}
        <div className="flex-1">
          {!loadingChange ? (
            <>
              <Input
                type="file"
                accept="image/*"
                onChange={handleReceiptUpload}
                className="max-w-[250px] px-1 h-9 cursor-pointer text-sm file:mr-2 
            file:rounded file:border-0 file:bg-primary file:px-3 file:py-px
             file:text-sm file:font-medium file:text-white 
             hover:file:bg-primary/90"
                disabled={loadingChange}
              />
              <p className="mt-2 text-[11px] px-2 text-muted-foreground">
                JPG, PNG up to 5MB
              </p>
            </>
          ) : (
            <div className="space-y-2 pt-3">
              <Progress value={progress} className="h-2 w-[250px]" />
              <p className="text-xs text-muted-foreground">
                Scanning receipt... {progress}%
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReceiptScanner;
