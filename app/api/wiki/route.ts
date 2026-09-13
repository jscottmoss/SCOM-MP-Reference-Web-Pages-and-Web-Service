import { getRuntimeEnv } from "@/lib/db-runtime";
import {
  getReferenceElement,
  getReferencePack,
  listElementTypes,
  listReferenceElements,
  listReferencePacks,
} from "@/lib/mp-reference-db";

export const runtime = "edge";

function getQueryValue(url: URL, name: string) {
  return url.searchParams.has(name) ? url.searchParams.get(name) ?? "" : null;
}

export async function GET(request: Request) {
  const runtimeEnv = getRuntimeEnv();

  if (!runtimeEnv.DB) {
    return Response.json(
      { error: "The database binding is not available in this preview." },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const getManagementPack = getQueryValue(url, "Get-ManagementPack");
  const getElements = getQueryValue(url, "GetElements");
  const getElement = getQueryValue(url, "GetElement");
  const getCategory = getQueryValue(url, "GetCategory");

  if (getManagementPack) {
    const pack = await getReferencePack(
      runtimeEnv.DB,
      getManagementPack,
      url.searchParams.get("Version") ?? undefined
    );

    if (!pack) {
      return Response.json({ error: "Management pack not found." }, { status: 404 });
    }

    const types = await listElementTypes(runtimeEnv.DB, {
      managementPack: getManagementPack,
      version: url.searchParams.get("Version") ?? undefined,
    });

    return Response.json({ pack, types });
  }

  if (getElements) {
    const elements = await listReferenceElements(runtimeEnv.DB, {
      type: getElements,
      managementPack: url.searchParams.get("ManagementPack") ?? undefined,
      version: url.searchParams.get("Version") ?? undefined,
      category: url.searchParams.get("Category") ?? undefined,
      limit: Number(url.searchParams.get("Limit") ?? 500),
    });

    return Response.json({ type: getElements, elements });
  }

  if (getElement) {
    const element = await getReferenceElement(runtimeEnv.DB, getElement, {
      type: url.searchParams.get("Type") ?? undefined,
      managementPack: url.searchParams.get("ManagementPack") ?? undefined,
      version: url.searchParams.get("Version") ?? undefined,
    });

    if (!element) {
      return Response.json({ error: "Element not found." }, { status: 404 });
    }

    return Response.json({ element });
  }

  if (getCategory) {
    const packs = await listReferencePacks(runtimeEnv.DB, { category: getCategory });
    const types = await listElementTypes(runtimeEnv.DB, { category: getCategory });

    return Response.json({ category: getCategory, packs, types });
  }

  return Response.json({
    examples: [
      "/api/wiki?Get-ManagementPack=Microsoft.SQLServer.Windows.Monitoring&Version=7.6.5.0",
      "/api/wiki?GetElements=ClassType&ManagementPack=Microsoft.SQLServer.Windows.Discovery&Version=7.6.5.0",
      "/api/wiki?GetElement=Microsoft.SQLServer.Windows.DBEngine&Type=ClassType&ManagementPack=Microsoft.SQLServer.Windows.Discovery&Version=7.6.5.0",
      "/api/wiki?GetElements=DataSourceModuleType&Category=Imported",
    ],
  });
}
