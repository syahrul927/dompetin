import React from "react";
import { ArrowDown } from "lucide-react";
import { FormRow } from "@/components/shared/FormRow";

interface TransferWalletRowProps {
  fromWallet?: string;
  toWallet?: string;
  onFromClick: () => void;
  onToClick: () => void;
}

/**
 * The "From → To" wallet selector shown when Transfer type is active.
 * Replaces the single FormRow for wallet.
 */
export function TransferWalletRow({
  fromWallet,
  toWallet,
  onFromClick,
  onToClick,
}: TransferWalletRowProps) {
  return (
    <div className="flex flex-col gap-0">
      <FormRow
        label="Dari Dompet"
        value={fromWallet}
        placeholder="Pilih dompet"
        onClick={onFromClick}
      />
      <div className="flex justify-center py-1">
        <ArrowDown size={18} className="text-muted-foreground" />
      </div>
      <FormRow
        label="Ke Dompet"
        value={toWallet}
        placeholder="Pilih dompet"
        onClick={onToClick}
      />
    </div>
  );
}
