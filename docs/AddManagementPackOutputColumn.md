# Add A Management Pack Field To A Web Page Output

This guide shows how to add a new column from imported Management Pack XML to
one of the web page tables. The example adds a `ParamName` column to the
`Overrides` output on the Management Pack Selection page.

## How The Data Gets To The Page

The path is:

1. `lib/mp-reference-parser.ts` reads the Management Pack XML.
2. `detailForBlock()` builds a `detail` object for each XML element.
3. `lib/mp-reference-db.ts` saves that object into `mp_reference_elements.detail_json`.
4. `/api/mp/elements` returns each stored element to the browser.
5. `components/ManagementPackSelectionApp.tsx` chooses which columns to show.

Most new display columns do not need a database schema change. The app already
stores flexible element details in `detail_json`, and the parser already saves
all XML attributes under `detail.attributes`.

Only add a real database column when the field must be indexed, filtered, or
joined by SQL.

## Example Goal

Show this XML attribute in the Overrides table:

```xml
<RuleConfigurationOverride ID="Example.Override" Context="Example.Group" Rule="Example.Rule" Parameter="IntervalSeconds" ParamName="IntervalSeconds">
  <Value>300</Value>
</RuleConfigurationOverride>
```

The desired table output is a new column named:

```text
ParamName
```

## Step 1: Decide Where The Value Comes From

For Overrides, values usually come from one of these places:

- XML attributes on the override element, such as `Context`, `Rule`,
  `Monitor`, `Property`, `Parameter`, `ParamName`, and `Enforced`
- The child `<Value>` element
- Normalized override details stored as `element.detail.override`

The current parser already stores raw XML attributes here:

```ts
detail.attributes = a;
```

Because of that, if `ParamName` is an XML attribute, the Management Pack
Selection page can read it from:

```ts
detailAttribute(element, "ParamName")
```

That means a UI-only column can work for already-imported records, as long as
the original imported XML attribute was already stored in `detail.attributes`.

## Step 2: Optionally Normalize The Parser Field

File:

```text
lib/mp-reference-parser.ts
```

Find the override block inside `detailForBlock()`:

```ts
if (isOverrideBlock(block)) {
  const overrideTarget = overrideTargetForBlock(block);
  const value = readTag(block.inner, "Value");
  const enforced = boolish(a.Enforced) || "False";

  detail.override = {
    context: a.Context,
    target: overrideTarget.value,
    targetType: overrideTarget.attribute,
    monitor: a.Monitor,
    rule: a.Rule,
    discovery: a.Discovery,
    diagnostic: a.Diagnostic,
    recovery: a.Recovery,
    property: a.Property,
    parameter: a.Parameter,
    value,
    enforced,
  };
}
```

Add `paramName` if you want a normalized field:

```ts
paramName: a.ParamName || a.Parameter,
```

Example:

```ts
detail.override = {
  context: a.Context,
  target: overrideTarget.value,
  targetType: overrideTarget.attribute,
  monitor: a.Monitor,
  rule: a.Rule,
  discovery: a.Discovery,
  diagnostic: a.Diagnostic,
  recovery: a.Recovery,
  property: a.Property,
  parameter: a.Parameter,
  paramName: a.ParamName || a.Parameter,
  value,
  enforced,
};
```

Also add it to `detail.elementProperties` if the individual element page should
show it in the Element Properties table:

```ts
["ParamName", a.ParamName || a.Parameter],
```

Important: parser changes only affect newly imported data. Re-import the
affected Management Pack XML if the page needs the normalized
`detail.override.paramName` value.

## Step 3: Teach The Selection Page How To Read The Column

File:

```text
components/ManagementPackSelectionApp.tsx
```

Find `getColumnValue()`.

Add a new switch case:

```ts
case "ParamName":
  return (
    overrideValue(element, "paramName") ||
    detailAttribute(element, "ParamName") ||
    overrideValue(element, "parameter") ||
    detailAttribute(element, "Parameter")
  );
```

This reads the normalized parser value first. If that is not present, it reads
the raw XML `ParamName` attribute. If the Management Pack only has the standard
SCOM `Parameter` attribute, it falls back to that.

## Step 4: Add The Column To The Overrides Table

In the same file, find the `Override` entry in `elementTableDefinitions`:

```ts
{
  key: "Override",
  title: "Overrides",
  types: [
    "DiscoveryPropertyOverride",
    "MonitorConfigurationOverride",
    "MonitorPropertyOverride",
    "RuleConfigurationOverride",
    "RulePropertyOverride",
  ],
  columns: ["ID", "Context", "Target", "Property", "Parameter", "Value", "Enforced"],
  showType: true,
},
```

Add `ParamName` to the `columns` list:

```ts
columns: [
  "ID",
  "Context",
  "Target",
  "Property",
  "ParamName",
  "Parameter",
  "Value",
  "Enforced",
],
```

If you want `ParamName` to replace the existing `Parameter` column, remove
`"Parameter"` from the list.

## Step 5: Optionally Update The Individual Element Page

File:

```text
components/ManagementPackElementApp.tsx
```

Find `buildPropertyRows()`.

Near the existing `Property` and `Parameter` rows, add:

```ts
add(
  "ParamName",
  valueFromRecord(override, "paramName") ||
    valueFromRecord(attributes, "ParamName") ||
    valueFromRecord(override, "parameter") ||
    valueFromRecord(attributes, "Parameter")
);
```

That makes the single element page show the same field when someone clicks an
Override element from the table.

## Step 6: Rebuild And Test

Run:

```powershell
pnpm run build
```

Then start or refresh the local preview:

```powershell
.\scripts\start-local-preview.ps1
```

Open a Management Pack Selection page and check the Overrides section.

Example:

```text
http://localhost:3000/management-pack-selection?managementPack=<PACK_NAME>&version=<VERSION>
```

## Quick Checklist

- Add parser normalization in `lib/mp-reference-parser.ts` only if needed.
- Add the column read logic in `getColumnValue()`.
- Add the column name to the correct `elementTableDefinitions` entry.
- Update the individual element page if the field should appear there too.
- Re-import the Management Pack only when parser output changed.
- Build the project and refresh the preview.

