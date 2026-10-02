# Configuration

Project configuration is optional:

```text
.incetro-ecc.json
```

```json
{
  "target": "cursor",
  "profile": "django",
  "autoDetectProfile": true,
  "exclude": [],
  "include": []
}
```

The file is data. The CLI does not execute it, import it, or follow paths inside it.

## Fields

- `target`: install target. `cursor` is supported.
- `profile`: Incetro profile id. When set, detection is skipped.
- `autoDetectProfile`: when `profile` is omitted, detect a profile. Default `true`. Low confidence selects `core`.
- `include`: extra Incetro component ids or ECC skill ids.
- `exclude`: ids to drop from the resolved profile. Unknown ids are an error.

`--profile` on the command line overrides the file.

## Rejected input

Exit code 2:

- invalid JSON
- unknown keys
- profile ids with `..` or path separators
- include or exclude entries that are not plain ids
- a target other than `cursor`

## State

`.incetro-ecc/state.json` is machine-owned. Edit the overlay or the project files, then run `update`. Do not hand-edit state except to recover a broken install with `doctor` and `remove`.
