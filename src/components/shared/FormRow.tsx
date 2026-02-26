import React from "react";
import { ChevronDown } from "lucide-react";

interface FormRowProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  value?: string;
  placeholder?: string;
}

/**
 * A tappable row for form fields that open a picker (wallet, category, date).
 * Supports forwardRef for use with DrawerTrigger asChild.
 */
export const FormRow = React.forwardRef<HTMLButtonElement, FormRowProps>(
  function FormRow({ label, value, placeholder, className: _className, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className="flex w-full items-center justify-between rounded-2xl bg-card p-4 transition-colors active:bg-muted"
        {...props}
      >
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-muted-foreground">
            {value || placeholder}
          </span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </div>
      </button>
    );
  }
);
