# Data safety CSV

`store/listing.json` holds the answers. Google wants a CSV.

## Getting the template

Play Console → your app → **Policy and programs → App content → Data safety →
Start → Export to CSV**. Save the result here as:

```
store/data-safety/template.csv
```

That file is the source of Play's question and response identifiers, and it is
not committed — it is a developer account export, not project source. Add it to
`.gitignore` if you prefer to be explicit.

## Why it cannot be generated from scratch

`applications.dataSafety` takes the CSV as a string:

```json
{ "safetyLabels": "<contents of the CSV file>" }
```

The format is one row per response, with columns for the machine-readable
question id, the machine-readable response id, a TRUE/FALSE response value, an
answer requirement, and a human-readable label. Google's documentation shows
exactly two identifiers — `PSL_DATA_TYPES_LOCATION`/`PSL_APPROX_LOCATION` and
`PSL_DATA_TYPES_PERSONAL`/`PSL_NAME`. The other thirty-odd are not documented
anywhere.

Guessing them would produce a file Play rejects as malformed. That rejection is
the dangerous kind: the API call fails quietly and the form keeps whatever it
had before.

## How the generator works

`store/data-safety.mjs`:

1. Parses the template as a CSV **document**, not by lines. Play's label cell is
   a quoted multi-line value — `"Personal info\nName"` — and splitting on
   newlines tears each record apart and pairs labels with the wrong questions.
2. Matches each declared data type against the template's label column, because
   the labels are the part of the format that is stable and human-readable.
3. Writes TRUE into the matching rows and echoes the rest of the template
   back unchanged, so question ids and requirements survive verbatim.
4. **Refuses to produce a CSV if any declared data type cannot be mapped**, and
   names the ones that failed rather than dropping them.

That last point is the behaviour worth keeping. A partial CSV would upload
cleanly and declare less than the app actually does.

## Our labels carry a qualifier on purpose

Play's data types are broad. The declaration needs to say what the broad type
actually holds here, so labels read:

```
Location - precise location
Personal info - other info (date of birth)
App activity - other user-generated content (care notes)
```

The parenthetical is stripped and mapped back to Play's own type name via the
`ALIASES` table in `store/data-safety.mjs`. Keys *and* values in that table are
normalised — an earlier version mixed the two forms and half its entries never
matched, which surfaced as a refusal rather than as a wrong declaration, but
only because the refusal path was tested.

## Testing it

`npm run store:data-safety` writes `template.fixture.csv` — a synthetic template
in Play's shape, including the multi-line label cells. It exists so the
generator can be exercised without a real account export.

`store/publish.mjs --apply --data-safety` **refuses** to run against the
fixture, so it can never be submitted by accident.