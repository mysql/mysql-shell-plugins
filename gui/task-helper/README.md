# Task Helper

This directory contains the security-sensitive helper for desktop backup
operations that need to run under a different local operating-system identity.
The helper exposes named capabilities only. It does not expose a generic command
runner, arbitrary argv passthrough, or shell interface.

There are two entry points:

- `task-helper-setup` is the bootstrap script. It may be run through
  sudo as the dedicated backup OS user, but only from a trusted installation
  path that is not writable by the desktop user. Its only capability is
  `backupHome.setup`.
- `task-helper` is the packaged runtime helper. It runs as the dedicated
  backup OS user, receives an explicit `--backup-home` selector for CLI work
  or a top-level `backupHome` selector for JSON requests, reads `backups.cnf`
  from that directory, and handles jobs, scheduled execution, backups, and
  logs.

## Trust Boundaries

- The renderer is untrusted.
- The Electron main process is a UI transport, not an authorization authority.
- The mysqlsh GUI backend is not allowed to construct sensitive task commands.
- Setup is the only phase where executable paths enter trusted state.
- Runtime requests explicitly select a backup home and use its `backups.cnf`
  file as trusted local configuration. The runtime helper refuses symlinked,
  writable, oversized, malformed, or wrong-owner config files and rejects an
  operation-level backup home that differs from the selected directory.
- Normal backup execution does not require a root-owned daemon.

## Security Invariants

All future code in this directory must preserve these invariants:

- No generic command execution API.
- No shell execution: do not use `shell=True`, `sh -c`, `bash -c`, `sudo`,
  `su`, `runuser`, or string-concatenated commands.
- Every operation must be named, registered explicitly, and schema-validated.
- Every operation must reject unknown or malformed fields.
- Executable paths and target users must come from trusted backup-home config,
  not from desktop app state or normal runtime request parameters.
- User-controlled data may only appear in allowlisted argument positions after
  operation-specific validation.
- Child environments must be constructed from scratch. Do not inherit the
  caller environment.
- Paths used for helper work must be absolute, symlink-safe, and constrained
  to reviewed roots where the operation mutates filesystem state.
- Logs and results must not include secrets, option-file contents, passwords, or
  full inherited environments.
- Public helper requests must return status-oriented results. They must not
  expose raw child stdout/stderr or diagnostic process plans from
  process execution. Explicit log-view operations may return bounded log content
  by reviewed log id.
- Child stdin, stdout, stderr, runtime, and returned result size must be
  bounded. MEB stdout/stderr must be streamed to private backup-home log files,
  not accumulated in memory or returned to callers.
- Managed scheduled jobs must invoke only the reviewed job runner with validated
  job ids.
- A new capability must include tests for malformed input, hostile path shapes,
  and the security property it is meant to preserve.

## Setup

`backupHome.setup` is served by `task-helper-setup`. It repairs the backup-home
owner and permissions for the effective setup user and writes `backups.cnf`.
The runtime helper remains in the trusted Workbench installation.

The generated `backups.cnf` contains the MySQL data directory, target OS user,
executable paths, backup root, option-file root, scheduler backend settings,
working directory, and process limits. There is no separate packaged policy
file.

On POSIX, `backups.cnf` must be a regular file owned by root or the effective
helper user and must not be group or world writable. Every parent directory in
its resolved path must be owned by root or the effective helper user and must
not be group or world writable.

## Setup Capability

### `backupHome.setup`

Bootstraps a backup home for the effective OS user. This operation is bootstrap
only; it is not registered by the packaged runtime helper.

## Runtime Capabilities

### `jobs.list`

Lists sanitized job definitions derived from validated backup-profile `.cnf`
files in the backup home.

### `jobs.execute`

Executes one backup job by id. The helper derives and validates the job from its
profile `.cnf` file before building the fixed `mysqlbackup` argv and returns only
status-oriented execution results. `mysqlbackup` stdout/stderr are streamed to
`<backup-home>/logs/*.log`; the response includes the log path, exit status,
timeout status, and truncation flags.

### `backups.list`

Lists backup-home-relative backup directories. The helper skips reserved
manager paths such as `backups.cnf`, helper scripts, and `logs`,
ignores symlinks, and returns safe relative ids plus metadata.

### `backups.delete`

Deletes one backup directory by safe backup-home-relative id. The id cannot be
absolute, cannot contain `..`, cannot name a reserved manager path, and the
target must be a directory under the validated backup home.

### `backupLogs.list`

Lists private log files in `<backup-home>/logs`. The log directory must be an
owned private directory, and symlinked or incorrectly permissioned log entries
are skipped.

### `backupLogs.read`

Reads a bounded tail of one private log file from `<backup-home>/logs`. The
caller supplies a safe `logId`; arbitrary paths and symlinks are rejected.

### `cron.installManagedJob`

Installs or updates one helper-managed scheduled job for the reviewed backup
user. The generated scheduled command always points back to the reviewed job
runner as `run-job <jobId>`, which derives and executes the corresponding job through
`jobs.execute`.

### `cron.removeManagedJob`

Removes one helper-managed scheduled job for the reviewed backup user. Unmanaged
scheduler content is preserved where the platform backend supports shared
scheduler state.

### `backupHome.validate`

Validates a backup home directory against the effective user running the helper.
The result reports whether the backup home path, ownership, permissions,
configured backup root, manager config file, and configured data directory match
the expected model.

Path shape checks are intentionally coalesced. For example, a config-file path
failure is reported as one `config.path` check instead of separate
exists/type/symlink flags.

### `backupHome.repair`

Repairs ownership and permissions for a backup home directory and its manager
config file. Repair is narrow by design: it does not recurse, does not create or
rewrite job configuration, and refuses paths outside reviewed backup roots.

On non-POSIX platforms, owner/mode checks report that those checks need a
reviewed platform ACL backend instead of pretending POSIX modes describe the
effective access policy.

### `backupHome.readConfig`

Reads the known backup-home manager config file and returns only reviewed,
non-secret fields. It does not return raw file contents and does not expose
unknown keys such as passwords or encryption material.

### `backupHome.writeConfig`

Writes the known backup-home manager config file from a narrow schema. The
caller provides only the backup home and MySQL data directory. The helper keeps
the executable paths, scheduler settings, process limits, login path, and login
file in the same trusted manager config.

## Delegated Backup User Model

The preferred deployment uses a dedicated `mysqlbackup` OS user:

- `mysqlbackup` owns the backup home directory.
- The runtime helper is loaded from the trusted Workbench installation.
- `mysqlbackup` owns the backup job definitions.
- `mysqlbackup` has read access to the MySQL data directory.
- `mysqlbackup` has write access to the configured backup destination.
- The desktop user can trigger only predefined jobs.

Normal execution uses a narrow sudoers entry for a fixed runtime helper path and
preferably a fixed job id:

```sudoers
alice ALL=(mysqlbackup) NOPASSWD: /trusted/workbench/bin/task-helper --backup-home /backup-home run-job nightly-backup
```

Avoid broad entries:

```sudoers
alice ALL=(mysqlbackup) NOPASSWD: /trusted/workbench/bin/task-helper --backup-home /backup-home run-job *
alice ALL=(mysqlbackup) NOPASSWD: /usr/bin/mysqlbackup *
```

Setup delegation is separate. If setup is delegated through sudo, the sudoers
path must point to a trusted Workbench installation path whose file and parent
directories are not writable by the desktop user:

```sudoers
alice ALL=(mysqlbackup) NOPASSWD: /trusted/workbench/bin/task-helper-setup --self-test
alice ALL=(mysqlbackup) NOPASSWD: /trusted/workbench/bin/task-helper-setup ""
```

The desktop user must not be able to write the delegated runtime helper, setup
script, any parent directory in either path, option files, or job definitions
used by the backup user. If a backup flow appears to require root, treat that as
a deployment-permission problem first: grant the dedicated backup user only the
filesystem and database access required for the reviewed jobs.


---
Copyright (c) 2026, Oracle and/or its affiliates.
