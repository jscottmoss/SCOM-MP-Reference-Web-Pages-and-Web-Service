import { ReferenceCatalogApp } from "@/components/ReferenceCatalogApp";
import { referencePayload } from "@/lib/reference-data";

export default function Home() {
  return <ReferenceCatalogApp initialPayload={referencePayload} initialPage="catalog" />;
}
