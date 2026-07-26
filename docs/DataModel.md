# Plugin Data Model 0.0.3

The canonical OpenRisk plugin contract is maintained in
[`openrisk-plugin-sdk`](https://openriskplatform.github.io/plugin-sdk).

Semantic source of truth:

- `model/data-model-v0.0.3.ts` for entities, properties, labels, types, and
  multiplicity
- `model/openrisk-types.ts` for the inline plugin-author helper
- `schemas/data-model-v0.0.3.schema.json` for wire-format validation
- `schemas/plugin-manifest-v0.0.2.schema.json` for `plugin.json`

The JSON Schema validates the common envelope and typed values. It does not
enforce every entity-specific property rule, so application code must also
follow the structured TypeScript model.

## Result envelope

An entrypoint returns a JSON array of flat entities:

```json
[
  {
    "$modelVersion": "0.0.3",
    "$entity": "entity.person",
    "$id": "source:person:123",
    "$props": {
      "name": [{ "$type": "string", "value": "Jane Example" }]
    },
    "$extra": [],
    "$sources": [
      {
        "name": "Source name",
        "source": "https://example.com/record/123"
      }
    ]
  }
]
```

Rules:

- `$modelVersion`, `$entity`, and a non-empty stable `$id` are required.
- Every `$props` value is an array of typed values.
- `$extra` is a flat array of `key-value` typed values.
- `$sources` contains source name and source location pairs.
- New plugins explicitly return model version `0.0.3`.
- Unversioned historical results remain on the legacy compatibility path; they
  are not reinterpreted as `0.0.3`.

## Typed values

Model `0.0.3` defines:

- `string`
- `number`
- `boolean`
- `jurisdiction-iso-3166-2`
- `relative-close-associate`
- `date-iso8601`
- `date-partial-iso8601`
- `date-time-iso8601`
- `url`
- `address`
- `location-iso6709`
- `image-url`
- `image-base64`
- `key-value`

`relative-close-associate` contains `{ "name": string, "relation"?: string }`.

## Entities

### `entity.person`

`name`, `aliases`, `notes`, `birthDate`, `birthPlace`, `nationalities`,
`jurisdiction`, `addresses`, `emails`, `phones`,
`relativeCloseAssociates`, `pepStatus`, `isPepRca`, `sanctioned`.

`pepStatus`, `isPepRca`, and `sanctioned` are tri-state:

- `true`: confirmed
- `false`: explicitly checked and clear
- absent: not evaluated

### `entity.organization`

`name`, `aliases`, `notes`, `previousNames`, `registrationId`, `country`,
`jurisdiction`, `address`, `status`, `involvedPersons`, `legalRoles`,
`sourceRegister`, `entryTypes`, `effectiveTo`, `pepStatus`, `sanctioned`.

### `entity.mediaMention`

`name`, `title`, `url`, `analysis`, `adverseActivityDetected`.

Atomic claims are stored in `$extra` with the label `Claim`, not in `$props`.

### `entity.riskTopic`

`name`, `topicId`, `summary`, `adverseActivityDetected`.

One entity represents one topic. The UI groups all topics returned by one
report into a single summary.

### `entity.socialProfile`

`name`, `platform`, `profileTitle`, `profileUrl`, `userId`.

### `entity.financialRecord`

`name`, `amountOwed`, `location`, `debtSource`.

### `entity.detectedEntity`

`name`, `description`.

This is the fallback when a plugin cannot reliably classify an extracted
entity as a person or organization.

## Presentation contract

Normal mode is intended for office users:

- known property labels come from the model metadata
- booleans are presented as meaningful states, not raw `true`/`false`
- PEP, PEP associate, sanctions, and adverse-activity states are prominent
- typed URLs, images, and relative/close associates receive dedicated views
- sources remain visible

Advanced mode exposes identifiers, typed-value containers, raw keys, and
execution logs.

Unknown plugin-provided keys and values are preserved and displayed as-is.
The frontend must not rename, sanitize, or otherwise mutate them.

## Manifest compatibility

The current plugin manifest schema is `0.0.2`. The canonical jurisdiction
field type is `jurisdiction-iso-3166-2`.

OpenRisk continues to accept the historical
`registry-jurisdiction-code` alias and the application extensions `secret` and
`validation` so existing plugins remain usable.
