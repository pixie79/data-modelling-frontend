# Configuration Guide

This guide explains how to configure the Open Data Modelling application, including the new SDK 1.13.1 features for Decision Logs, Knowledge Base, and DuckDB backend.

## Configuration File

The application uses a `.data-model.toml` configuration file in your workspace root to configure database and sync settings.

### Creating the Configuration File

Create a `.data-model.toml` file in your workspace root:

```toml
# .data-model.toml - Data Model Configuration

[database]
# Backend options: "none" (default), "duckdb", "postgres"
backend = "duckdb"

# Path to DuckDB file (relative to workspace, only for duckdb backend)
path = ".data-model.duckdb"

[postgres]
# PostgreSQL connection string (only for postgres backend)
connection_string = "postgresql://user:password@localhost:5432/datamodel"

# Connection pool size (default: 5)
pool_size = 5

# SSL mode: "disable", "prefer", "require", "verify-ca", "verify-full"
ssl_mode = "prefer"

# Connection timeout in seconds (default: 30)
connect_timeout = 30

[sync]
# Automatically sync YAML files to database on workspace load
auto_sync = true

# Watch for file changes and auto-sync (requires file watcher)
watch = false

# Sync changes to database when saving
sync_on_save = true

# Conflict resolution strategy: "database-wins", "yaml-wins", "prompt"
conflict_strategy = "prompt"

[git]
# Enable Git hooks for automatic sync
hooks_enabled = false

# Export database to YAML before commit
pre_commit = true

# Sync YAML to database after checkout
post_checkout = true

# Sync YAML to database after merge
post_merge = true
```

## Configuration Options

### Database Backend

The `[database]` section configures which database backend to use:

| Option    | Values                             | Description                       |
| --------- | ---------------------------------- | --------------------------------- |
| `backend` | `"none"`, `"duckdb"`, `"postgres"` | Database backend type             |
| `path`    | String                             | Path to DuckDB file (DuckDB only) |

#### No Database (YAML Only)

```toml
[database]
backend = "none"
```

This is the default mode. All data is stored in YAML files only.

#### DuckDB (Embedded)

```toml
[database]
backend = "duckdb"
path = ".data-model.duckdb"
```

DuckDB provides an embedded analytical database for:

- Fast SQL queries across your data model
- Analytics and reporting
- Complex joins and aggregations

#### PostgreSQL (Server)

```toml
[database]
backend = "postgres"

[postgres]
connection_string = "postgresql://user:password@localhost:5432/datamodel"
pool_size = 5
ssl_mode = "require"
```

PostgreSQL provides a server-based database for:

- Multi-user access
- Team collaboration
- Enterprise deployments

### Sync Configuration

The `[sync]` section configures how YAML files and the database stay synchronized:

| Option              | Type   | Default    | Description                             |
| ------------------- | ------ | ---------- | --------------------------------------- |
| `auto_sync`         | bool   | `true`     | Sync YAML to database on workspace load |
| `watch`             | bool   | `false`    | Watch files for changes                 |
| `sync_on_save`      | bool   | `true`     | Sync to database when saving            |
| `conflict_strategy` | string | `"prompt"` | How to handle conflicts                 |

#### Conflict Strategies

- **`database-wins`**: Database changes overwrite YAML files
- **`yaml-wins`**: YAML files overwrite database
- **`prompt`**: Ask user to resolve conflicts

### Git Hooks

The `[git]` section configures Git integration:

| Option          | Type | Default | Description                     |
| --------------- | ---- | ------- | ------------------------------- |
| `hooks_enabled` | bool | `false` | Enable Git hooks                |
| `pre_commit`    | bool | `true`  | Export DB to YAML before commit |
| `post_checkout` | bool | `true`  | Sync YAML to DB after checkout  |
| `post_merge`    | bool | `true`  | Sync YAML to DB after merge     |

## Environment-Specific Configuration

You can create environment-specific configurations:

- `.data-model.toml` - Default configuration
- `.data-model.local.toml` - Local overrides (add to `.gitignore`)
- `.data-model.production.toml` - Production settings

The application loads configuration in this order:

1. Default settings
2. `.data-model.toml`
3. Environment-specific file (if exists)

## Validating Configuration

The application validates your configuration on startup. Common validation errors:

### DuckDB Errors

```
Error: DuckDB path is required when using DuckDB backend
Solution: Add path = ".data-model.duckdb" to [database] section

Error: DuckDB path should end with .duckdb extension
Solution: Ensure path ends with .duckdb
```

### PostgreSQL Errors

```
Error: PostgreSQL connection string is required
Solution: Add connection_string to [postgres] section

Error: PostgreSQL connection string should start with postgresql://
Solution: Use format: postgresql://user:password@host:port/database
```

## Example Configurations

### Minimal DuckDB Setup

```toml
[database]
backend = "duckdb"
path = ".data-model.duckdb"

[sync]
auto_sync = true
```

### Team Collaboration with PostgreSQL

```toml
[database]
backend = "postgres"

[postgres]
connection_string = "postgresql://team:secret@db.example.com:5432/datamodel"
pool_size = 10
ssl_mode = "require"

[sync]
auto_sync = true
sync_on_save = true
conflict_strategy = "prompt"

[git]
hooks_enabled = true
pre_commit = true
```

### Development with File Watching

```toml
[database]
backend = "duckdb"
path = ".data-model.duckdb"

[sync]
auto_sync = true
watch = true
sync_on_save = true
conflict_strategy = "yaml-wins"
```

## Database Operations

### Manual Sync

You can manually trigger sync operations from the UI:

1. Open the **Database** panel in settings
2. Click **Sync to Database** to push YAML changes
3. Click **Export to YAML** to pull database changes

### SQL Queries

With DuckDB or PostgreSQL enabled, you can run SQL queries:

```sql
-- List all tables
SELECT * FROM tables;

-- Count columns per table
SELECT table_id, COUNT(*) as column_count
FROM columns
GROUP BY table_id;

-- Find tables in a domain
SELECT t.name, t.description
FROM tables t
WHERE t.domain_id = 'domain-uuid';
```

### Database Status

The Database panel shows:

- Connection status (Connected/Disconnected/Error)
- Sync status (In Sync/Out of Sync/Syncing)
- Last sync timestamp
- Database size (for DuckDB)

## Troubleshooting

### Database Not Initializing

1. Check that `.data-model.toml` exists in workspace root
2. Verify backend is set correctly
3. Check file permissions for DuckDB path
4. For PostgreSQL, verify connection string and network access

### Sync Conflicts

When conflicts occur:

1. Review the conflict details in the UI
2. Choose which version to keep
3. Consider using a consistent conflict strategy

### Performance Issues

For large workspaces:

1. Disable `watch` if not needed
2. Increase PostgreSQL `pool_size`
3. Run sync during off-peak hours

## Related Documentation

- [Decision Logs Guide](DECISION_LOGS.md) - Managing architecture decisions
- [Knowledge Base Guide](KNOWLEDGE_BASE.md) - Documentation management
