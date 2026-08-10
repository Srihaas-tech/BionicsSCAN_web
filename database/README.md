# Database Files

- `setup.sql` creates the schema and inserts all seed records.
- `schema.sql` creates the database objects only.
- `seed.sql` inserts inventory records that do not exist only.

Use `setup.sql` for the first Neon deployment.

The seed operation preserves current quantities.
