# Database Schema Versions

This folder contains the complete database schema CREATE scripts for each version that has been or will be released.

## File Name Format

There is a separate CREATE script for each version of the database schema file. It uses the following format, which consists of 3 components

- The name of the database schema, followed by an underscore.
- The version string, consisting of 3 numbers separated by a period.
- The .sql file extension

```txt
<schema_name>_x.y.z.sql
```

## Versioning

It is strongly advised to use semantic versioning for the version string, as discussed at <https://semver.org/>.

Copyright (c) 2025, Oracle and/or its affiliates.
