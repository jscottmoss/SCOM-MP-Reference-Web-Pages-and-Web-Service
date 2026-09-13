import { ManagementPackElementApp } from "@/components/ManagementPackElementApp";

type ManagementPackElementPageProps = {
  searchParams: Promise<{
    managementPack?: string;
    pack?: string;
    version?: string;
    id?: string;
    element?: string;
    type?: string;
  }>;
};

export default async function ManagementPackElementPage({
  searchParams,
}: ManagementPackElementPageProps) {
  const params = await searchParams;

  return (
    <ManagementPackElementApp
      initialManagementPack={params.managementPack ?? params.pack}
      initialVersion={params.version}
      initialId={params.id ?? params.element}
      initialType={params.type}
    />
  );
}
