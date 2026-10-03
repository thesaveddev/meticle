# Play store listing as code

The Meticle Care Google Play listing, held in `store/listing.json` and pushed
through the Play Developer API rather than clicked through the console.

```
npm run store:validate                  # check the data, no credentials needed
npm run store:publish                   # dry run: diff against live, change nothing
npm run store:publish -- --apply        # write the listing and images
npm run store:publish -- --apply --data-safety
```

## What the API can and cannot do

Verified against the androidpublisher v3 discovery document
(`androidpublisher.googleapis.com/$discovery/rest?version=v3`), not against
memory. The `edits` resource has exactly these sub-resources:

> apks, bundles, countryavailability, deobfuscationfiles, details,
> expansionfiles, **images**, **listings**, testers, tracks

| Field | Pushable | How |
| --- | --- | --- |
| Title, short and full description | Yes | `edits.listings` |
| App icon, feature graphic | Yes | `edits.images` (two-step upload) |
| Data safety form | Yes | `applications.dataSafety` — takes a **CSV**, not JSON |
| **Contact email / phone / website** | **No** | No `edits.contact` resource exists |
| **Categories** | **No** | No `edits.categories` resource exists |
| Target audience, content rating | No | Not in the API at all |

`edits.contact` and `edits.categories` existed historically and were removed.
There is no workaround — those two are Play Console clicks, and they are
recorded in `listing.json` under `consoleOnly` with their intended values so
they are not lost, plus surfaced by `store:publish` on every dry run.

## Credentials

```
export GOOGLE_PLAY_SERVICE_ACCOUNT=/path/to/key.json
```

The key is never committed. `.gitignore` covers `meticlecare-*.json`,
`*service*account*.json`, `*play*key*.json`, `google-services*.json`,
`*.p12`, `*.keystore` and `*.jks`. The key used for the first draft submit was
deleted from the working tree afterwards — **rotate it in Google Cloud** if it
is to be used again.

## Why dry run is the default

`edits.commit` applies immediately and changes a live store listing. There is
no undo, and the draft release currently in Play is the only release there is.
So the default run authenticates, opens an edit, reads what is live, prints a
field-by-field diff, uploads nothing, and discards the edit.

## Validation

`npm run store:validate` runs with no credentials and catches:

- Play's character limits — title 30, short description 80, full description
  4000 — which Play rejects or truncates silently rather than explaining
- Promotional copy Play restricts: ranking claims, calls to action, pricing
  language, and unevidenced certifications. The ISO 27001 case is load-bearing
  here; `docs/STORE_PRIVACY_ANSWERS.md` explains why that claim was withdrawn
  and must not come back.
- Data safety internal contradictions — a type declared collected with no
  purpose, a type marked shared with no sharing purpose, a type that is neither
- Missing image files, malformed language tags, a `defaultLanguage` with no
  matching listing

It was checked against a deliberately broken listing and reports all ten
planted defects.

## Data safety

`applications.dataSafety` is not an edit resource. It takes the CSV you would
export from Play Console, and it applies the moment it is accepted — it cannot
be rolled back with `deleteEdit`.

The CSV format is documented by example only, and only two of its question
identifiers appear in Google's docs. Writing the rest from memory would produce
a file Play rejects, and that rejection is quiet: the form simply does not
update.

So `store/data-safety.mjs` takes the template Play itself exports and fills in
the response values. See `store/data-safety/README.md`.

**Apps on internal testing only are exempt from the Data safety section**, so
this is not blocking the current draft. It blocks production.

## Still a human decision

`store/listing.json` carries the answers that are code facts. These are not:

- **The lawful basis for retaining a worker's professional name** after account
  deletion. The code supports the retention and the engineering rationale is in
  `docs/STORE_PRIVACY_ANSWERS.md`, but the policy position is for the DPO
  (`dpo@meticlecare.com`) or a legal adviser.
- **Whether "Financial info — payroll, mileage" belongs in this form at all.**
  It is declared as collected because the app shows payslips, but the mobile app
  has no billing flow of its own.
- **Categories.** Medical and Business is the obvious pair; the choice is a
  positioning decision.