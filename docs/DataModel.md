# Data Model 0.0.2

OpenRisk plugins return JSON arrays of entities.

```json
[
  { "...": "entity-1" },
  { "...": "entity-2" }
]
```

The model has two layers:
- typed values for machine-readable fields
- entities that combine well-known props with raw extra data

## Typed Value

Every typed value has this shape:

```json
{
  "$type": "string",
  "value": "some value"
}
```

### Primitive types

- `string`
- `number`
- `boolean`
- `date-iso8601`
  - full date, for example `2024-06-01`
- `date-partial-iso8601`
  - partial date, for example `2024` or `2024-06`
- `date-time-iso8601`
  - full timestamp, for example `2024-06-01T12:34:56Z`
- `image-base64`
- `image-url`
- `url`
- `address`
- `location-iso6709`

### key-value

`key-value` is used inside `$extra`.

```json
{
  "$type": "key-value",
  "value": {
    "key": {
      "$type": "string",
      "value": "someKey"
    },
    "value": {
      "$type": "string",
      "value": "someValue"
    }
  }
}
```

Rules:
- `key` is always a `string`
- `value` can be any typed value

## Entity Contract

Each entity has:
- `$entity`: entity type identifier, for example `entity.person`
- `$id`: stable entity id; plugins should namespace external ids when needed, for example `opensanctions:Q7747`
- `$sources`: array of source descriptors
- `$props`: object of predefined props that the UI can render intentionally
- `$extra`: flat array of `key-value` entries for raw or unmapped data

### $sources

Each source entry has this shape:

```json
{
  "name": "OpenSanctions",
  "source": "https://www.opensanctions.org/entities/Q7747/"
}
```

### $props rules

- each prop value is always an array
- arrays allow several values for the same prop
- props are optional unless a specific entity definition says otherwise
- if the source has no usable value for a prop, omit that prop

### $extra rules

- `$extra` is for data that is still useful but not part of the predefined card layout
- repeated keys are allowed
- `$extra` should preserve source-specific detail that would otherwise be lost

## entity.person

`entity.person` is the first defined entity in this draft. It is designed for person-oriented registry and sanctions plugins.

### Defined props

- `name`
  - type: `string`
  - primary display name
- `surname`
  - type: `string`
  - family name or last name
- `position`
  - type: `string`
  - public role, office, title, or position
- `country`
  - type: `string`
  - country code or country text attached to the person
- `age`
  - type: `number`
  - optional point-in-time value, usually derived from birth date
- `photo`
  - type: `image-url` or `image-base64`
  - profile image or portrait
- `personId`
  - type: `string`
  - personal identifier such as rodne cislo, SSN, or another country-specific person number
- `birthDate`
  - type: `date-iso8601` or `date-partial-iso8601`
  - birth date as provided by the source
- `nationality`
  - type: `string`
  - nationality or citizenship
- `residenceAddress`
  - type: `address`
  - permanent or known residential address
- `documentId`
  - type: `string`
  - passport number, identity card number, or similar document identifier

### What belongs in $extra for person

Typical examples:
- aliases and alternative spellings
- source URLs
- sanctions topics
- dataset names
- registry-specific notes
- raw identifiers with source-specific keys
- match score and matching metadata
- timestamps such as `first_seen`, `last_seen`, `last_change`
- any other raw properties that are not mapped to a defined prop

## Additional Universal Entities

To keep integrations lossless, plugins may use additional entity types when
`entity.person` alone is not enough.

### entity.organization

Generic legal entity representation.

Typical props:
- `name` (`string`)
- `country` (`string`)
- `address` (`address`)
- `organizationId` (`string`)

### entity.mediaMention

One analyzed media/search hit linked to a target.

Typical props:
- `name` (`string`)
- `title` (`string`)
- `url` (`url`)
- `analysis` (`string`)
- `adverseActivityDetected` (`boolean`)

### entity.riskTopic

One topic-level screening result.

Typical props:
- `name` (`string`)
- `topicId` (`string`)
- `summary` (`string`)
- `adverseActivityDetected` (`boolean`)

### entity.socialProfile

One discovered social profile.

Typical props:
- `name` (`string`)
- `platform` (`string`)
- `profileTitle` (`string`)
- `profileUrl` (`url`)
- `userId` (`string`)

### entity.businessActivity

One business-subject/activity record.

Typical props:
- `organizationId` (`string`)
- `description` (`string`)
- `effectiveFrom` (`date-iso8601` or `date-partial-iso8601`)
- `effectiveTo` (`date-iso8601` or `date-partial-iso8601`)

### entity.financialRecord

One financial obligation/debtor record.

Typical props:
- `name` (`string`)
- `amountOwed` (`string`)
- `location` (`address`)
- `debtSource` (`string`)

### entity.legalCase

One court-case level record.

Typical props:
- `courtTopic` (`string`)
- `courtDecision` (`string`)
- `court` (`string`)
- `courtMark` (`string`)
- `courtId` (`string`)
- `courtDecisionDate` (`date-iso8601` or `date-partial-iso8601`)

### entity.detectedEntity

Entity recognized by extraction endpoints when person/organization type is not guaranteed.

Typical props:
- `name` (`string`)
- `description` (`string`)

### entity.serviceAccount

Operational account/service metadata.

Typical props:
- `provider` (`string`)
- `remainingCredit` (`number`)

## Current Scope

This draft defines:
- typed values
- shared entity contract
- `entity.person`
- additional universal entities listed above
