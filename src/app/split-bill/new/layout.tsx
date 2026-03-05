import { SplitBillProvider } from "@/components/split-bill/split-bill-context";
import { SplitBillStepper } from "@/components/split-bill/SplitBillStepper";

export default function SplitBillLayout({ children }: { children: React.ReactNode }) {
  return (
    <SplitBillProvider>
      <div className="flex min-h-screen flex-col">
        <SplitBillStepper />
        <div className="flex-1">{children}</div>
      </div>
    </SplitBillProvider>
  );
}
