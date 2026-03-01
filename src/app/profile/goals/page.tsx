"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { useRouter } from "next/navigation";

/**
 * Goals page - placeholder for future implementation.
 */
export default function GoalsPage() {
  const router = useRouter();

  return (
    <>
      <PageHeader
        title="Tujuan Finansial"
        variant="back"
        onBack={() => router.back()}
      />
      <div className="px-5 pt-2">
        <p className="mt-8 text-center text-muted-foreground">
          Halaman Tujuan - Coming Soon
        </p>
      </div>
    </>
  );
}
