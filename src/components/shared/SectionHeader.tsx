import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface SectionHeaderProps {
  title: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

/**
 * The "Title + See All link" row used above every list section.
 */
export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <div className="mb-3.5 flex items-center justify-between">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {action && (
        <>
          {action.href ? (
            <Link href={action.href}>
              <Button
                variant="link"
                className="h-auto p-0 text-[13px] font-medium text-primary"
              >
                {action.label}
              </Button>
            </Link>
          ) : (
            <Button
              variant="link"
              onClick={action.onClick}
              className="h-auto p-0 text-[13px] font-medium text-primary"
            >
              {action.label}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
