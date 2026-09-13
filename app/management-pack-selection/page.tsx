import { ManagementPackSelectionApp } from "@/components/ManagementPackSelectionApp";
import { sectionTemplates } from "@/lib/reference-data";

type ManagementPackSelectionPageProps = {
  searchParams: Promise<{
    managementPack?: string;
    pack?: string;
    version?: string;
  }>;
};

export default async function ManagementPackSelectionPage({
  searchParams,
}: ManagementPackSelectionPageProps) {
  const params = await searchParams;

  return (
    <ManagementPackSelectionApp
      initialManagementPack={params.managementPack ?? params.pack}
      initialVersion={params.version}
      sectionTemplates={sectionTemplates}
    />
  );
}
