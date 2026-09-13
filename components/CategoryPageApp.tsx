"use client";

import { useEffect, useMemo, useState } from "react";
import type { SectionTemplate } from "@/lib/reference-data";

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

type Props = {
  initialSlug: string;
  sectionTemplates: SectionTemplate[];
};

function totalFromCounts(counts?: Record<string, number>) {
  return Object.values(counts ?? {}).reduce((total, count) => total + count, 0);
}

function selectionHref(pack: Pick<ImportedPackSummary, "systemName" | "version">) {
  return `/management-pack-selection?managementPack=${encodeURIComponent(
    pack.systemName
  )}&version=${encodeURIComponent(pack.version)}`;
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split(/[^0-9]+/).filter(Boolean).map(Number);
  const rightParts = right.split(/[^0-9]+/).filter(Boolean).map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);

    if (diff !== 0) {
      return diff;
    }
  }

  return left.localeCompare(right);
}

function sumSectionCounts(packs: ImportedPackSummary[]) {
  const counts: Record<string, number> = {};

  for (const pack of packs) {
    for (const [key, value] of Object.entries(pack.sectionCounts ?? {})) {
      counts[key] = (counts[key] ?? 0) + value;
    }
  }

  return counts;
}

export function CategoryPageApp({ initialSlug, sectionTemplates }: Props) {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [category, setCategory] = useState<CategoryDetail | null>(null);
  const [selectedVersion, setSelectedVersion] = useState("latest");
  const [status, setStatus] = useState("Loading category...");

  useEffect(() => {
    let active = true;

    fetch(`/api/categories?slug=${encodeURIComponent(initialSlug)}`)
      .then(async (response) => {
        const payload = (await response.json()) as CategoryPayload;

        if (!response.ok || payload.error) {
          throw new Error(payload.error ?? payload.message ?? "Category could not be loaded.");
        }

        return payload;
      })
      .then((payload) => {
        if (!active) {
          return;
        }

        setCategories(payload.categories ?? []);
        setCategory(payload.category ?? null);
        setSelectedVersion("latest");
        setStatus("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setCategory(null);
        setStatus(error instanceof Error ? error.message : "Category could not be loaded.");
      });

    return () => {
      active = false;
    };
  }, [initialSlug]);

  const versionOptions = useMemo(
    () =>
      (category?.members ?? [])
        .slice()
        .sort((left, right) => {
          const nameDiff = left.systemName.localeCompare(right.systemName);
          return nameDiff || compareVersions(right.version, left.version);
        }),
    [category?.members]
  );

  const displayedPacks = useMemo(() => {
    if (!category) {
      return [];
    }

    if (selectedVersion === "latest") {
      return category.latestMembers;
    }

    const managementPackId = Number(selectedVersion);
    return category.members.filter((pack) => pack.managementPackId === managementPackId);
  }, [category, selectedVersion]);

  const sectionCounts = useMemo(() => sumSectionCounts(displayedPacks), [displayedPacks]);
  const displayedElementCount = totalFromCounts(sectionCounts);

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

      <main className="container-fluid">
        {category ? (
          <section className="topic-page" aria-labelledby="category-heading">
            <div className="section-heading">
              <div>
                <h1 id="category-heading" className="page-title">
                  {category.name}
                </h1>
                <p className="lead">
                  {category.description ||
                    "Imported management packs grouped into this category."}
                </p>
              </div>
              <label className="version-control">
                Category
                <select
                  value={category.slug}
                  onChange={(event) => {
                    window.location.href = `/categories/${event.target.value}`;
                  }}
                >
                  {categories.map((option) => (
                    <option key={option.categoryId} value={option.slug}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="category-summary">
              <label className="version-control">
                Version View
                <select
                  value={selectedVersion}
                  onChange={(event) => setSelectedVersion(event.target.value)}
                >
                  <option value="latest">Highest revisions by management pack</option>
                  {versionOptions.map((pack) => (
                    <option key={pack.managementPackId} value={pack.managementPackId}>
                      {pack.systemName} :: {pack.version}
                    </option>
                  ))}
                </select>
              </label>
              <span>
                {displayedPacks.length} management packs, {displayedElementCount} components
              </span>
            </div>

            <section aria-labelledby="category-members-heading">
              <h2 id="category-members-heading">Management Packs</h2>
              <div className="ScrollArea">
                <table className="DataTable">
                  <thead>
                    <tr>
                      <th>Management Pack</th>
                      <th>Version</th>
                      <th>File</th>
                      <th>Components</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPacks.map((pack) => (
                      <tr key={pack.managementPackId}>
                        <td>
                          <a className="table-link" href={selectionHref(pack)}>
                            {pack.systemName}
                          </a>
                          <div className="minor">{pack.displayName}</div>
                        </td>
                        <td>{pack.version}</td>
                        <td>{pack.fileName ?? ""}</td>
                        <td>{totalFromCounts(pack.sectionCounts)}</td>
                      </tr>
                    ))}
                    {!displayedPacks.length ? (
                      <tr>
                        <td colSpan={4}>No management packs are assigned to this category.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="component-breakdown" aria-labelledby="components-heading">
              <div className="section-heading">
                <h2 id="components-heading">Component Breakdown</h2>
                <span className="minor">
                  {selectedVersion === "latest"
                    ? "Highest revisions"
                    : "Selected management pack version"}
                </span>
              </div>
              <div className="component-grid">
                {sectionTemplates.map((section) => (
                  <article
                    className="component-card component-card-static"
                    key={section.key}
                  >
                    <span>{section.title}</span>
                    <strong>{sectionCounts[section.key] ?? 0}</strong>
                  </article>
                ))}
              </div>
            </section>
          </section>
        ) : (
          <section className="empty-state">
            {status || "Category could not be loaded."}
          </section>
        )}
      </main>

      <footer className="footer" role="contentinfo">
        Private System Center Management Pack reference library
      </footer>
    </>
  );
}
