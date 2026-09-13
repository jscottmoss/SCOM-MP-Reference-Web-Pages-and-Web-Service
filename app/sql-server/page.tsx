import { ReferenceCatalogApp } from "@/components/ReferenceCatalogApp";
import { referencePayload } from "@/lib/reference-data";

export default function SqlServerPage() {
  return (
    <ReferenceCatalogApp
      initialPayload={referencePayload}
      initialPage="sql-server"
    />
  );
}
