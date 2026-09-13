"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CategoryPack,
  ManagementPackSummary,
  MpElement,
  ReferencePayload,
} from "@/lib/reference-data";

type PageKey = "catalog" | "sql-server";

type ImportedPackSummary = {
  managementPackId?: number;
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

type Props = {
  initialPayload: ReferencePayload;
  initialPage?: PageKey;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function elementMatches(element: MpElement, search: string) {
  if (!search) {
    return true;
  }

  return [
    element.displayName,
    element.id,
    element.type,
    element.target,
    element.category,
    element.enabled,
    element.alertGenerate,
    element.accessibility,
    element.detail,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(search);
}

function getColumnValue(element: MpElement, column: string) {
  switch (column) {
    case "DisplayName":
      return element.displayName;
    case "ID":
      return element.id;
    case "Target":
    case "Base":
      return element.target ?? "";
    case "Category":
      return element.category ?? "";
    case "Enabled":
      return element.enabled ?? "";
    case "Alert Generate":
      return element.alertGenerate ?? "";
    case "Accessibility":
      return element.accessibility ?? "";
    default:
      return element.detail ?? "";
  }
}

function detailCountForSection(pack: ManagementPackSummary, key: string) {
  if (key === "references") {
    return pack.references.length;
  }

  return pack.elements.filter((element) => element.section === key).length;
}

function totalFromCounts(counts?: Record<string, number>) {
  return Object.values(counts ?? {}).reduce((total, count) => total + count, 0);
}

function formatImportedAt(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function isSqlManagementPack(
  pack: Pick<ManagementPackSummary | ImportedPackSummary | CategoryPack, "systemName" | "category"> & {
    displayName?: string;
  }
) {
  return (
    pack.category === "SQL Server" ||
    /(^|[^a-z])sql\s*server([^a-z]|$)/i.test(pack.displayName ?? "") ||
    /SQLServer|\.SQL\./i.test(pack.systemName)
  );
}

function firstPopulatedSection(pack: ManagementPackSummary, fallback = "discoveries") {
  const populated = Object.keys(pack.sectionCounts).find(
    (key) => detailCountForSection(pack, key) > 0
  );

  return populated ?? pack.elements[0]?.section ?? fallback;
}

function optionValue(systemName: string, version: string) {
  return `${systemName}||${version}`;
}

function parseOptionValue(value: string) {
  const [systemName, version = ""] = value.split("||");
  return { systemName, version };
}

function selectionHref(pack: Pick<ImportedPackSummary | CategoryPack, "systemName" | "version">) {
  return `/management-pack-selection?managementPack=${encodeURIComponent(
    pack.systemName
  )}&version=${encodeURIComponent(pack.version)}`;
}

async function fetchImportedPacks() {
  const response = await fetch("/api/mp/packs");

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { packs?: ImportedPackSummary[] };

  return (data.packs ?? [])
    .filter((pack) => totalFromCounts(pack.elementTypeCounts ?? pack.sectionCounts) > 0)
    .sort((a, b) => {
      const aTime = a.importedAt ? new Date(a.importedAt).getTime() : 0;
      const bTime = b.importedAt ? new Date(b.importedAt).getTime() : 0;
      return bTime - aTime || a.systemName.localeCompare(b.systemName);
    });
}

async function fetchCategories() {
  const response = await fetch("/api/categories");

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as { categories?: CategorySummary[] };

  return data.categories ?? [];
}

export function ReferenceCatalogApp({
  initialPayload,
  initialPage = "catalog",
}: Props) {
  const [payload, setPayload] = useState(initialPayload);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [importedPacks, setImportedPacks] = useState<ImportedPackSummary[]>([]);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [selectedPackName, setSelectedPackName] = useState("");
  const [selectedPackVersion, setSelectedPackVersion] = useState("");
  const [activeSection, setActiveSection] = useState("discoveries");

  useEffect(() => {
    let active = true;

    fetch("/api/catalog")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: ReferencePayload | null) => {
        if (!active || !data?.packs?.length) {
          return;
        }

        setPayload(data);

        const preferredPack =
          initialPage === "sql-server"
            ? data.packs.find(isSqlManagementPack) ?? data.packs[0]
            : data.packs.find((pack) => pack.sourceKind !== "seed") ?? undefined;

        if (preferredPack) {
          setSelectedPackName((current) => current || preferredPack.systemName);
          setSelectedPackVersion((current) => current || preferredPack.version);
          setActiveSection(firstPopulatedSection(preferredPack));
        }
      })
      .catch(() => undefined);

    fetchImportedPacks()
      .then((packs) => {
        if (!active) {
          return;
        }

        setImportedPacks(packs);

        if (initialPage !== "catalog" && packs[0]) {
          setSelectedPackName((current) => current || packs[0].systemName);
          setSelectedPackVersion((current) => current || packs[0].version);
        }
      })
      .catch(() => undefined);

    fetchCategories()
      .then((nextCategories) => {
        if (!active) {
          return;
        }

        setCategories(nextCategories);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [initialPage]);

  const selectedPack = useMemo(() => {
    if (!selectedPackName) {
      return undefined;
    }

    return (
      payload.packs.find(
        (pack) =>
          pack.systemName === selectedPackName &&
          (!selectedPackVersion || pack.version === selectedPackVersion)
      ) ?? payload.packs.find((pack) => pack.systemName === selectedPackName)
    );
  }, [payload.packs, selectedPackName, selectedPackVersion]);

  const normalizedCatalogSearch = normalize(catalogSearch);
  const normalizedGlobalSearch = normalize(globalSearch);

  const fallbackImportedPacks = useMemo<ImportedPackSummary[]>(
    () =>
      payload.packs
        .filter((pack) => pack.sourceKind !== "seed")
        .map((pack) => ({
          systemName: pack.systemName,
          displayName: pack.displayName,
          version: pack.version,
          category: pack.category,
          description: pack.description,
          fileName: pack.fileName,
          sourceKind: pack.sourceKind === "compiled" ? "compiled" : "xml",
          sectionCounts: pack.sectionCounts,
        })),
    [payload.packs]
  );

  const importedCatalogPacks = importedPacks.length
    ? importedPacks
    : fallbackImportedPacks;

  const filteredImportedPacks = useMemo(
    () =>
      importedCatalogPacks.filter((pack) =>
        `${pack.displayName} ${pack.systemName} ${pack.version} ${pack.fileName ?? ""}`
          .toLowerCase()
          .includes(normalizedCatalogSearch)
      ),
    [importedCatalogPacks, normalizedCatalogSearch]
  );

  const recentImportedPacks = importedCatalogPacks.slice(0, 10);

  const sqlRows = useMemo(() => {
    const importedRows = importedCatalogPacks
      .filter(isSqlManagementPack)
      .map<CategoryPack>((pack) => ({
        category: "SQL Server",
        systemName: pack.systemName,
        version: pack.version,
      }));
    const referenceRows = payload.categoryPacks.filter(
      (pack) => pack.category === "SQL Server"
    );
    const seen = new Set<string>();

    return [...importedRows, ...referenceRows]
      .filter((pack) => {
        const key = optionValue(pack.systemName, pack.version);

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      })
      .filter((pack) =>
        `${pack.systemName} ${pack.version}`.toLowerCase().includes(normalizedGlobalSearch)
      );
  }, [importedCatalogPacks, normalizedGlobalSearch, payload.categoryPacks]);

  const filteredElements = useMemo(() => {
    if (!selectedPack) {
      return [];
    }

    return selectedPack.elements.filter(
      (element) =>
        element.section === activeSection &&
        elementMatches(element, normalizedGlobalSearch)
    );
  }, [activeSection, normalizedGlobalSearch, selectedPack]);

  const activeTemplate =
    payload.sectionTemplates.find((section) => section.key === activeSection) ??
    payload.sectionTemplates[0];

  const detailChoices = useMemo(() => {
    const importedChoices = payload.packs.filter((pack) => pack.sourceKind !== "seed");
    return initialPage === "catalog" && importedChoices.length
      ? importedChoices
      : payload.packs;
  }, [initialPage, payload.packs]);

  const sqlDetailPack =
    selectedPack && isSqlManagementPack(selectedPack)
      ? selectedPack
      : payload.packs.find(isSqlManagementPack);

  function choosePack(systemName: string, version = "") {
    const pack =
      payload.packs.find(
        (candidate) =>
          candidate.systemName === systemName &&
          (!version || candidate.version === version)
      ) ?? payload.packs.find((candidate) => candidate.systemName === systemName);

    setSelectedPackName(systemName);
    setSelectedPackVersion(version);

    if (pack) {
      setActiveSection(firstPopulatedSection(pack));
    }
  }

  function renderPackButton(pack: Pick<ImportedPackSummary | CategoryPack, "systemName" | "version">) {
    if (initialPage === "catalog") {
      return (
        <a className="table-link" href={selectionHref(pack)}>
          {pack.systemName}
        </a>
      );
    }

    return (
      <button
        className="table-link"
        onClick={() => choosePack(pack.systemName, pack.version)}
        type="button"
      >
        {pack.systemName}
      </button>
    );
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
          <div className="nav-spacer" />
          <label className="nav-search">
            <input
              aria-label="Search management pack elements"
              value={globalSearch}
              onChange={(event) => setGlobalSearch(event.target.value)}
              placeholder="Search elements"
            />
            <span aria-hidden="true">S</span>
          </label>
        </div>
      </header>

      <main className="container-fluid">
        {initialPage === "catalog" ? (
          <>
            <h1 id="catalog" className="page-title">
              System Center Management Pack Catalog
            </h1>
            <p className="lead">
              Imported management packs available in this reference database.
            </p>

            <div className="catalog-layout">
              <section className="column" aria-labelledby="catalog-heading">
                <h2 id="catalog-heading">Imported Management Packs</h2>
                <input
                  className="category-filter"
                  aria-label="Filter imported management packs"
                  value={catalogSearch}
                  onChange={(event) => setCatalogSearch(event.target.value)}
                  placeholder="Filter imported management packs"
                />
                <div className="ScrollArea">
                  <table className="DataTable">
                    <thead>
                      <tr>
                        <th>Management Pack</th>
                        <th>Version</th>
                        <th>Elements</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredImportedPacks.map((pack) => (
                        <tr key={`${pack.managementPackId ?? pack.systemName}-${pack.version}`}>
                          <td>
                            {renderPackButton(pack)}
                            <div className="minor">{pack.displayName}</div>
                          </td>
                          <td>{pack.version}</td>
                          <td>{totalFromCounts(pack.elementTypeCounts ?? pack.sectionCounts)}</td>
                        </tr>
                      ))}
                      {!filteredImportedPacks.length ? (
                        <tr>
                          <td colSpan={3}>
                            No imported management packs match the current filter.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="column" aria-labelledby="recent-heading">
                <h2 id="recent-heading">Recent Imports</h2>
                <p>
                  The latest imported management packs appear here so new XML
                  uploads are easy to find.
                </p>
                <div className="ScrollArea">
                  <table className="DataTable">
                    <thead>
                      <tr>
                        <th>Management Pack</th>
                        <th>Version</th>
                        <th>Imported</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentImportedPacks.map((pack) => (
                        <tr key={`recent-${pack.managementPackId ?? pack.systemName}-${pack.version}`}>
                          <td>{renderPackButton(pack)}</td>
                          <td>{pack.version}</td>
                          <td className="date-cell">{formatImportedAt(pack.importedAt)}</td>
                        </tr>
                      ))}
                      {!recentImportedPacks.length ? (
                        <tr>
                          <td colSpan={3}>No management packs have been imported yet.</td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>

                <div className="category-links" aria-label="Category pages">
                  <div className="section-heading">
                    <h3>Category Pages</h3>
                    <a className="btn-link" href="/admin">
                      Manage Categories
                    </a>
                  </div>
                  {categories.length ? (
                    <ul>
                      {categories.map((category) => (
                        <li key={category.categoryId}>
                          <a href={`/categories/${category.slug}`}>{category.name}</a>
                          <span className="badge">{category.memberCount}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="minor">No category pages have been created yet.</p>
                  )}
                </div>
              </section>
            </div>
          </>
        ) : (
          <section id="sql-server" className="topic-page" aria-labelledby="sql-heading">
            <h1 id="sql-heading" className="page-title">
              SQL Server Management Packs
            </h1>
            <p className="lead">
              SQL Server is one management pack family in the catalog. This page
              keeps the SQL-specific list and component breakdown separate from
              the imported-pack landing page.
            </p>

            <div className="ScrollArea">
              <table className="DataTable">
                <thead>
                  <tr>
                    <th>Management Pack</th>
                    <th>Version</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {sqlRows.map((pack) => {
                    const imported = importedCatalogPacks.some(
                      (candidate) =>
                        candidate.systemName === pack.systemName &&
                        candidate.version === pack.version
                    );

                    return (
                      <tr key={`sql-${pack.systemName}-${pack.version}`}>
                        <td>{renderPackButton(pack)}</td>
                        <td>{pack.version}</td>
                        <td>{imported ? "Imported" : "Reference list"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <section className="component-breakdown" aria-labelledby="sql-components-heading">
              <div className="section-heading">
                <h2 id="sql-components-heading">Component Breakdown</h2>
                {sqlDetailPack ? (
                  <span className="minor">
                    {sqlDetailPack.systemName} :: {sqlDetailPack.version}
                  </span>
                ) : null}
              </div>
              {sqlDetailPack ? (
                <div className="component-grid">
                  {payload.sectionTemplates.map((section) => {
                    const count = detailCountForSection(sqlDetailPack, section.key);

                    return (
                      <button
                        className={`component-card${count ? "" : " component-card-disabled"}`}
                        disabled={!count}
                        key={section.key}
                        onClick={() => {
                          choosePack(sqlDetailPack.systemName, sqlDetailPack.version);
                          setGlobalSearch("");
                          setActiveSection(section.key);
                        }}
                        type="button"
                      >
                        <span>{section.title}</span>
                        <strong>{count}</strong>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p>No SQL Server management pack has detail data available yet.</p>
              )}
            </section>
          </section>
        )}

        {initialPage !== "catalog" && selectedPack ? (
          <section id="management-pack" className="mp-detail">
            <div className="mp-card">
              <div className="mp-header">
                <div>
                  <h2 className="mp-title">{selectedPack.displayName}</h2>
                  <p className="mp-subtitle">
                    {selectedPack.systemName} :: {selectedPack.version} (Management Pack)
                  </p>
                </div>
                <select
                  aria-label="Choose management pack"
                  value={optionValue(selectedPack.systemName, selectedPack.version)}
                  onChange={(event) => {
                    const value = parseOptionValue(event.target.value);
                    choosePack(value.systemName, value.version);
                  }}
                >
                  {detailChoices.map((pack) => (
                    <option
                      key={`${pack.systemName}-${pack.version}`}
                      value={optionValue(pack.systemName, pack.version)}
                    >
                      {pack.systemName} :: {pack.version}
                    </option>
                  ))}
                </select>
              </div>

              <ul className="leftbar">
                <li>
                  <a
                    className="btn-link"
                    href={`/api/export?pack=${encodeURIComponent(selectedPack.systemName)}`}
                  >
                    Get Management Pack data in CSV format
                  </a>
                </li>
                <li>
                  <button className="btn-link" type="button">
                    Show Management Pack XML
                  </button>
                </li>
                {selectedPack.fileName ? (
                  <li>
                    <button className="btn-link" type="button">
                      {selectedPack.fileName}
                    </button>
                  </li>
                ) : null}
              </ul>

              <div className="summary-box">
                <h3 className="lead">Summary</h3>
                <p>{selectedPack.description}</p>
              </div>

              <h2>Management Pack Elements</h2>
              <ul className="element-nav">
                {payload.sectionTemplates.map((section) => {
                  const count = detailCountForSection(selectedPack, section.key);

                  return (
                    <li key={section.key}>
                      <button
                        type="button"
                        disabled={!count}
                        className={section.key === activeSection ? "is-active" : ""}
                        onClick={() => setActiveSection(section.key)}
                      >
                        {section.title}{" "}
                        <span className="lighter">({count})</span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="section-heading">
                <h3>
                  {activeTemplate.title}{" "}
                  <span className="lighter">({filteredElements.length})</span>
                </h3>
                <a
                  className="btn-link"
                  href={`/api/export?pack=${encodeURIComponent(
                    selectedPack.systemName
                  )}&section=${encodeURIComponent(activeSection)}`}
                >
                  Export section
                </a>
              </div>

              {activeSection === "references" ? (
                <div className="ScrollArea">
                  <table className="DataTable">
                    <thead>
                      <tr>
                        <th>Alias</th>
                        <th>ID</th>
                        <th>Version</th>
                        <th>Public Key Token</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPack.references.map((reference) => (
                        <tr key={`${reference.alias}-${reference.id}`}>
                          <td>{reference.alias}</td>
                          <td>{reference.id}</td>
                          <td>{reference.version}</td>
                          <td>{reference.publicKeyToken ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="ScrollArea">
                  <table className="DataTable">
                    <thead>
                      <tr>
                        <th>&nbsp;</th>
                        {activeTemplate.defaultColumns.map((column) => (
                          <th key={column}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredElements.map((element) => (
                        <tr key={`${element.type}-${element.id}`}>
                          <td>
                            <span className="ico" title={element.type}>
                              {element.type.slice(0, 1)}
                            </span>
                          </td>
                          {activeTemplate.defaultColumns.map((column) => (
                            <td key={column}>{getColumnValue(element, column)}</td>
                          ))}
                        </tr>
                      ))}
                      {!filteredElements.length ? (
                        <tr>
                          <td colSpan={activeTemplate.defaultColumns.length + 1}>
                            {normalizedGlobalSearch
                              ? "No elements match the current search."
                              : "No elements are available for this section."}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        ) : initialPage !== "catalog" ? (
          <section id="management-pack" className="empty-state">
            Select an imported management pack to view its details.
          </section>
        ) : null}
      </main>

      <footer className="footer" role="contentinfo">
        Private System Center Management Pack reference library
      </footer>
    </>
  );
}
