import { ImportMutationProvider } from "@/components/import-mutation/import-mutation-context";

export default function ImportMutationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ImportMutationProvider>{children}</ImportMutationProvider>;
}
