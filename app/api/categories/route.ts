import { getRuntimeEnv } from "@/lib/db-runtime";
import {
  createManagementPackCategory,
  getManagementPackCategory,
  listManagementPackCategories,
  listReferencePacks,
  updateManagementPackCategoryMembership,
} from "@/lib/mp-reference-db";

export const runtime = "edge";

type CategoryBody = {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
};

type MembershipBody = {
  categoryId?: unknown;
  managementPackIds?: unknown;
};

function unavailableResponse() {
  return Response.json(
    {
      categories: [],
      packs: [],
      message: "The database binding is not available in this preview.",
    },
    { status: 503 }
  );
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

async function categoryPayload(db: D1Database, slug?: string) {
  const [categories, packs, category] = await Promise.all([
    listManagementPackCategories(db),
    listReferencePacks(db),
    slug ? getManagementPackCategory(db, slug) : Promise.resolve(null),
  ]);

  return { categories, packs, category };
}

export async function GET(request: Request) {
  const runtimeEnv = getRuntimeEnv();

  if (!runtimeEnv.DB) {
    return unavailableResponse();
  }

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug") ?? undefined;
  const payload = await categoryPayload(runtimeEnv.DB, slug);

  if (slug && !payload.category) {
    return Response.json(
      {
        ...payload,
        error: "Category not found.",
      },
      { status: 404 }
    );
  }

  return Response.json(payload);
}

export async function POST(request: Request) {
  const runtimeEnv = getRuntimeEnv();

  if (!runtimeEnv.DB) {
    return unavailableResponse();
  }

  const body = await readJson<CategoryBody>(request);

  if (typeof body.name !== "string" || !body.name.trim()) {
    return Response.json({ error: "Category name is required." }, { status: 400 });
  }

  try {
    const category = await createManagementPackCategory(runtimeEnv.DB, {
      name: body.name,
      slug: typeof body.slug === "string" ? body.slug : undefined,
      description:
        typeof body.description === "string" ? body.description : undefined,
    });
    const payload = await categoryPayload(runtimeEnv.DB, category.slug);

    return Response.json({ ...payload, category }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Category could not be created.",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const runtimeEnv = getRuntimeEnv();

  if (!runtimeEnv.DB) {
    return unavailableResponse();
  }

  const body = await readJson<MembershipBody>(request);
  const categoryId =
    typeof body.categoryId === "number" ? Math.trunc(body.categoryId) : 0;
  const managementPackIds = Array.isArray(body.managementPackIds)
    ? body.managementPackIds
        .map((value) => (typeof value === "number" ? Math.trunc(value) : 0))
        .filter((value) => value > 0)
    : [];

  if (!categoryId) {
    return Response.json({ error: "Category id is required." }, { status: 400 });
  }

  const category = await updateManagementPackCategoryMembership(
    runtimeEnv.DB,
    categoryId,
    managementPackIds
  );

  if (!category) {
    return Response.json({ error: "Category not found." }, { status: 404 });
  }

  const payload = await categoryPayload(runtimeEnv.DB, category.slug);
  return Response.json({ ...payload, category });
}
