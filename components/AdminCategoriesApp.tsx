"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ImportedPackSummary = {
  managementPackId: number;
  systemName: string;
  displayName: string;
  version: string;
  category: string;
  description: string;
  fileName?: string;
  sourceKind: "xml" | "compiled";
  sectionCounts: Record<string, number>;
  elementTypeCounts?: Record<string, number>;
  importedAt?: string;
};

type CategorySummary = {
  categoryId: number;
  slug: string;
  name: string;
  description: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

type CategoryDetail = CategorySummary & {
  members: ImportedPackSummary[];
  latestMembers: ImportedPackSummary[];
  sectionCounts: Record<string, number>;
  elementTypeCounts: Record<string, number>;
};

type CategoryPayload = {
  categories?: CategorySummary[];
  packs?: ImportedPackSummary[];
  category?: CategoryDetail | null;
  error?: string;
  message?: string;
};

type StatusTone = "idle" | "busy" | "ok" | "error";

function totalFromCounts(counts?: Record<string, number>) {
  return Object.values(counts ?? {}).reduce((total, count) => total + count, 0);
}

function formatImportedAt(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

async function readCategoryPayload(slug?: string) {
  const suffix = slug ? `?slug=${encodeURIComponent(slug)}` : "";
  const response = await fetch(`/api/categories${suffix}`);
  const payload = (await response.json()) as CategoryPayload;

  if (!response.ok) {
    throw new Error(payload.error ?? payload.message ?? "Categories could not be loaded.");
  }

  return payload;
}

export function AdminCategoriesApp() {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [packs, setPacks] = useState<ImportedPackSummary[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryDetail | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<number>>(new Set());
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [status, setStatus] = useState<{ tone: StatusTone; message: string }>({
    tone: "idle",
    message: "Create a category, then choose which imported management pack versions belong to it.",
  });
  const [importStatus, setImportStatus] = useState<{ tone: StatusTone; message: string }>({
    tone: "idle",
    message: "XML files can be submitted here.",
  });

  const sortedPacks = useMemo(
    () =>
      packs
        .filter((pack) => totalFromCounts(pack.elementTypeCounts ?? pack.sectionCounts) > 0)
        .sort((left, right) => {
          const nameDiff = left.systemName.localeCompare(right.systemName);
          return nameDiff || right.version.localeCompare(left.version);
        }),
    [packs]
  );

  async function loadList(preferredSlug?: string) {
    const payload = await readCategoryPayload();
    const nextCategories = payload.categories ?? [];
    setCategories(nextCategories);
    setPacks(payload.packs ?? []);

    const slugToOpen =
      preferredSlug ??
      selectedCategory?.slug ??
      nextCategories[0]?.slug;

    if (slugToOpen) {
      await loadCategory(slugToOpen);
    } else {
      setSelectedCategory(null);
      setSelectedMemberIds(new Set());
    }
  }

  async function loadCategory(slug: string) {
    const payload = await readCategoryPayload(slug);
    setCategories(payload.categories ?? []);
    setPacks(payload.packs ?? []);
    setSelectedCategory(payload.category ?? null);
    setSelectedMemberIds(
      new Set((payload.category?.members ?? []).map((pack) => pack.managementPackId))
    );
  }

  useEffect(() => {
    loadList().catch((error) => {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Categories could not be loaded.",
      });
    });
  }, []);

  async function handleCreateCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newCategoryName.trim()) {
      setStatus({ tone: "error", message: "Category name is required." });
      return;
    }

    setStatus({ tone: "busy", message: "Creating category..." });

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName,
          description: newCategoryDescription,
        }),
      });
      const payload = (await response.json()) as CategoryPayload;

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Category could not be created.");
      }

      setNewCategoryName("");
      setNewCategoryDescription("");
      setCategories(payload.categories ?? []);
      setPacks(payload.packs ?? []);
      setSelectedCategory(payload.category ?? null);
      setSelectedMemberIds(new Set());
      setStatus({
        tone: "ok",
        message: `${payload.category?.name ?? "Category"} was created.`,
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Category could not be created.",
      });
    }
  }

  async function handleImport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];

    if (!file) {
      setImportStatus({ tone: "error", message: "Choose a management pack file first." });
      return;
    }

    setImportStatus({ tone: "busy", message: `Importing ${file.name}...` });
    const body = new FormData();
    body.append("file", file);

    try {
      const response = await fetch("/api/import", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as { error?: string; message?: string };

      if (!response.ok || result.error) {
        throw new Error(result.error ?? "Import failed.");
      }

      if (fileRef.current) {
        fileRef.current.value = "";
      }

      setImportStatus({
        tone: "ok",
        message: result.message ?? `${file.name} was imported.`,
      });
      await loadList(selectedCategory?.slug);
    } catch (error) {
      setImportStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Import failed.",
      });
    }
  }

  function toggleMember(managementPackId: number) {
    setSelectedMemberIds((current) => {
      const next = new Set(current);

      if (next.has(managementPackId)) {
        next.delete(managementPackId);
      } else {
        next.add(managementPackId);
      }

      return next;
    });
  }

  async function saveMembership() {
    if (!selectedCategory) {
      setStatus({ tone: "error", message: "Choose a category first." });
      return;
    }

    setStatus({ tone: "busy", message: "Saving category membership..." });

    try {
      const response = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: selectedCategory.categoryId,
          managementPackIds: Array.from(selectedMemberIds),
        }),
      });
      const payload = (await response.json()) as CategoryPayload;

      if (!response.ok || payload.error) {
        throw new Error(payload.error ?? "Membership could not be saved.");
      }

      setCategories(payload.categories ?? []);
      setPacks(payload.packs ?? []);
      setSelectedCategory(payload.category ?? null);
      setSelectedMemberIds(
        new Set((payload.category?.members ?? []).map((pack) => pack.managementPackId))
      );
      setStatus({
        tone: "ok",
        message: `${payload.category?.name ?? "Category"} membership was saved.`,
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "Membership could not be saved.",
      });
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/" title="System Center Management Pack Catalog - Home">
            <span className="brand-mark">SC</span>
            Home
          </a>
          <nav className="navlinks" aria-label="Reference navigation">
            <a href="/">Catalog</a>
            <a href="/management-pack-selection">Management Pack Selection</a>
            <a href="/sql-server">SQL Server</a>
            <a href="/admin">Admin</a>
            <a href="/api/export">CSV Export</a>
          </nav>
        </div>
      </header>

      <main className="container-fluid admin-layout">
        <h1 className="page-title">Administration</h1>
        <p className="lead">
          Import management packs and group imported versions into category pages.
        </p>

        <section className="import-panel" aria-labelledby="admin-import-heading">
          <h2 id="admin-import-heading">Import Management Pack</h2>
          <form className="import-form" onSubmit={handleImport}>
            <input
              ref={fileRef}
              aria-label="Management pack file"
              type="file"
              accept=".xml"
            />
            <button
              className="btn-link btn-primary"
              disabled={importStatus.tone === "busy"}
              type="submit"
            >
              Import XML
            </button>
          </form>
          <p className={`status status-${importStatus.tone}`}>{importStatus.message}</p>
        </section>

        <section className="admin-panel" aria-labelledby="category-create-heading">
          <div className="section-heading">
            <h2 id="category-create-heading">Categories</h2>
            {selectedCategory ? (
              <a className="btn-link" href={`/categories/${selectedCategory.slug}`}>
                Open Category Page
              </a>
            ) : null}
          </div>

          <form className="admin-form" onSubmit={handleCreateCategory}>
            <label>
              Category Name
              <input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="Base OS"
              />
            </label>
            <label>
              Description
              <input
                value={newCategoryDescription}
                onChange={(event) => setNewCategoryDescription(event.target.value)}
                placeholder="Windows Server, client OS, and core platform packs"
              />
            </label>
            <button className="btn-link btn-primary" type="submit">
              Create Category
            </button>
          </form>

          <div className="admin-select-row">
            <label>
              Edit Category
              <select
                value={selectedCategory?.categoryId ?? ""}
                onChange={(event) => {
                  const categoryId = Number(event.target.value);
                  const category = categories.find(
                    (candidate) => candidate.categoryId === categoryId
                  );

                  if (category) {
                    loadCategory(category.slug).catch((error) => {
                      setStatus({
                        tone: "error",
                        message:
                          error instanceof Error
                            ? error.message
                            : "Category could not be loaded.",
                      });
                    });
                  }
                }}
              >
                <option value="">Choose a category</option>
                {categories.map((category) => (
                  <option key={category.categoryId} value={category.categoryId}>
                    {category.name} ({category.memberCount})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className={`status status-${status.tone}`}>{status.message}</p>
        </section>

        <section className="admin-panel" aria-labelledby="membership-heading">
          <div className="section-heading">
            <h2 id="membership-heading">Category Membership</h2>
            <button
              className="btn-link btn-primary"
              disabled={!selectedCategory || status.tone === "busy"}
              onClick={saveMembership}
              type="button"
            >
              Save Membership
            </button>
          </div>
          <p>
            Choose the imported management pack versions that make up{" "}
            {selectedCategory ? selectedCategory.name : "the selected category"}.
          </p>

          <div className="ScrollArea membership-scroll">
            <table className="DataTable membership-table">
              <thead>
                <tr>
                  <th>Included</th>
                  <th>Management Pack</th>
                  <th>Version</th>
                  <th>Elements</th>
                  <th>Imported</th>
                </tr>
              </thead>
              <tbody>
                {sortedPacks.map((pack) => (
                  <tr key={pack.managementPackId}>
                    <td>
                      <input
                        aria-label={`Include ${pack.systemName} ${pack.version}`}
                        checked={selectedMemberIds.has(pack.managementPackId)}
                        disabled={!selectedCategory}
                        onChange={() => toggleMember(pack.managementPackId)}
                        type="checkbox"
                      />
                    </td>
                    <td>
                      <strong>{pack.systemName}</strong>
                      <div className="minor">{pack.displayName}</div>
                    </td>
                    <td>{pack.version}</td>
                    <td>{totalFromCounts(pack.elementTypeCounts ?? pack.sectionCounts)}</td>
                    <td className="date-cell">{formatImportedAt(pack.importedAt)}</td>
                  </tr>
                ))}
                {!sortedPacks.length ? (
                  <tr>
                    <td colSpan={5}>No imported management packs are available yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer className="footer" role="contentinfo">
        Private System Center Management Pack reference library
      </footer>
    </>
  );
}
