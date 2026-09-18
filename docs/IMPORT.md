# Private prospect import

The first real import is authorized for ten prospects, but remains blocked until the user supplies the designated private source and target season. Do not substitute names from unrelated finance, film or statistics files. No real input or output belongs in this repository.

## Source format

Use UTF-8 CSV with unique headers. `source_id` and `full_name` are required; every other supported field is optional. Give each source row a stable ID, retained on retries. If the source lacks IDs, assign them once in a private staging copy rather than deriving them from the person's name.

| Column | Meaning / validation |
| --- | --- |
| source_id | Unique nonempty source row ID, up to 120 characters |
| full_name | Required, up to 120 characters |
| prospect_id | Optional existing person UUID; explicitly resolves a duplicate and never overwrites that person's shared facts |
| email | Email address, up to 254 characters |
| phone | Text, up to 40 characters; preserve source formatting |
| social_url | Complete HTTP(S) URL without embedded credentials, up to 500 characters |
| location | Text, up to 120 characters |
| teams | Text, up to 500 characters |
| age | Whole number 16–100, or blank |
| height_cm | Whole number 100–250, or blank; convert only if the source supplies an unambiguous measurement |
| position | Handler, Cutter, or blank |

Blank optional fields become null. Do not infer age, height, position, contact information, recruiting stage, interest, outcomes, projections or evaluations. Unsupported columns are rejected; map only supported known facts into a private staging CSV. The script defaults to exactly ten rows, with at most ten rows per batch.

## Validate and prepare

Run Python 3.11+ from the repository root. Place the input outside the repository or in ignored `data/private/`.

```sh
python3 scripts/private_import.py --file data/private/prospects.private.csv
```

This prints counts only and writes nothing. It does not contact Supabase or check existing database names. Error messages identify a row/field, never print source values. Fix validation errors before preparing the SQL.

Resolve the target season UUID and an approved import author's profile UUID in the existing project. Do not choose an inactive or shared application account. Use a stable lowercase batch ID on every retry. Do not put actual names or credentials in shell arguments, logs or public issue/PR descriptions.

```sh
python3 scripts/private_import.py \
  --file data/private/prospects.private.csv \
  --write-sql \
  --output data/private/import.private.sql \
  --project-ref ldrdsvsmwnjzhyzqdcdt \
  --actor-id APPROVED_PROFILE_UUID \
  --season-id ACTIVE_SEASON_UUID \
  --batch-id initial-ten-prospects
```

Replace the UUID placeholders locally. The output is created exclusively with mode `0600`; the script refuses to overwrite it or write it into a tracked repository directory. On Windows, also use the user's private local folder/ACLs: Unix mode bits are not a Windows access-control guarantee. Successful preparation reports `database_changed: false`. It does not execute the import.

An authorized administrator runs this private SQL in the SQL Editor of project `ldrdsvsmwnjzhyzqdcdt`, or through its authenticated management connector. The generated SQL sets a transaction-local approved author identity, assumes `authenticated`, invokes the guarded import and commits. This identity setup requires database-administrator privileges; it is not a client sign-in mechanism. Ordinary authenticated callers can also call `import_prospects` using their own verified Auth identity. Do not paste the payload into GitHub, commit it, or publish it as a migration.

## Import behavior

The public RPC is a security-invoker wrapper around a private privileged helper. The helper explicitly checks and locks current leadership approval and the active season, validates only supported source fields, and uses existing creation/audit functions. All people, memberships, activity and receipts are one transaction; a late bad row rolls back the entire batch.

An unresolved normalized-name match stops the batch instead of guessing a person's identity. Open the existing profile privately and add its exact `prospect_id` to that source row. Existing name/reference correspondence is verified. For reuse, existing shared facts stay authoritative; supplied source facts do not overwrite them. If same-name people really are different, create the separate person through the application's explicit duplicate-name confirmation, then reference that person's UUID.

A private receipt stores only source/batch IDs, season/person references, an input fingerprint, author and timestamp. It stores no source fact payload and has no ordinary client grants. An unchanged retry with the same batch ID, source IDs and season is skipped without creating records or events. A changed previously imported row stops for review instead of overwriting live edits. The fingerprint is a change detector, not a credential. Duplicate source IDs within one batch are rejected. Membership uniqueness prevents adding the same person to the same season twice.

New people use only supplied shared facts. New memberships retain Unknown Prospect and null optional fields; no evaluations are created. Import events reflect the actual import time and author, not invented earlier interactions. Closed seasons, anonymous callers, inactive/missing/revoked profiles and client-edited approval metadata cannot import. A retry into a subsequently closed season is denied too.

## Verify the real batch privately

The import returns only `processed`, `created`, `reused`, `skipped` and `memberships_added` counts. Verify that all ten designated source IDs resolve to the intended people and target memberships, check known source facts, and confirm historical records are intact. Re-run the same batch to confirm ten skips and no new people/events. Keep any reconciliation report private; publish only the completion status and aggregate checks.

`tests/phase-seven-access.sql` exercises ten wholly synthetic rows, retries, duplicates, invalid fields, rollback, reuse, history and permissions, then rolls back. Passing it does not mean ten real prospects were imported.
