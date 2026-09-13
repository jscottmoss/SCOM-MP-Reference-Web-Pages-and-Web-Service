import { getRuntimeEnv, readImportedPacks } from "@/lib/db-runtime";
import { referencePayload } from "@/lib/reference-data";

export const runtime = "edge";

export async function GET() {
  const runtimeEnv = getRuntimeEnv();
  const imported = runtimeEnv.DB ? await readImportedPacks(runtimeEnv.DB) : [];
  const importedCategories = new Map(
    referencePayload.categories.map((category) => [category.name, category])
  );

  for (const pack of imported) {
    const current = importedCategories.get(pack.category);
    importedCategories.set(pack.category, {
      slug: pack.category,
      name: pack.category,
      count: (current?.count ?? 0) + 1,
    });
  }

  return Response.json({
    ...referencePayload,
    categories: Array.from(importedCategories.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    categoryPacks: [
      ...imported.map((pack) => ({
        category: pack.category,
        systemName: pack.systemName,
        version: pack.version,
      })),
      ...referencePayload.categoryPacks,
    ],
    packs: [...imported, ...referencePayload.packs],
  });
}
