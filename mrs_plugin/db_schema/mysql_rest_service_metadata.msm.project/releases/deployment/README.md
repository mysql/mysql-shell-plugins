# Database Schema Deployment Scripts

This folder contains the database schema deployment scripts for each version that has been or will be released.

## File Name Format

Each version of the database schema file has its own deployment script. It uses the following format, which consists of 4 components.

- The name of the database schema followed by an underscore `_`.
- `deployment_` to indicate the nature of the script.
- The version string, consisting of 3 numbers separated by period `.`.
- The file extension `.sql`

```txt
<schema_name>_deployment_x.y.z.sql
```

## Versioning

It is strongly advised to use semantic versioning for the version string, as discussed at <https://semver.org/>.

Copyright (c) 2025, Oracle and/or its affiliates.
