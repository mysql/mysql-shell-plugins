# Database Schema Updates

This folder contains the database schema update scripts for each release that has been or will be released.

## File Name Format

For each version of the database schema file, there is a dedicated upgrade script to the next version. It uses the following format, which consists of 4 components.

- The name of the database schema followed by an underscore `_`.
- The version string to update from, consisting of 3 numbers separated by a period `.`.
- `_to_` followed by the version string this script updates to, consisting of 3 numbers separated by a period `.`.
- The file extension `.sql

```txt
<schema_name>_x.y.z_to_a.b.c.sql
```

## Versioning

It is strongly advised to use semantic versioning for the version string, as discussed at <https://semver.org/>.

Copyright (c) 2025, Oracle and/or its affiliates.
