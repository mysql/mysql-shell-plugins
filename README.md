# MySQL Shell Plugins

The MySQL Shell Plugins Repository contains MySQL Shell plugins developed by
the MySQL Client Tools team. It also contains the source code for MySQL
Workbench, which is built on MySQL Shell and these plugins.

The repository currently includes:

- **GUI plugin**: provides backend functionality for MySQL Workbench.
- **MDS plugin**: implements [MySQL Database Service](mds_plugin/readme.md) and
  Oracle Cloud Infrastructure support.
- **MRS plugin**: implements [MySQL REST Service](mrs_plugin/readme.md) support.
- **MSM plugin**: implements [MySQL Schema Management](msm_plugin/readme.md)
  operations.
- **Utils plugin**: provides SQL formatting and visual query execution plans.

## MySQL Workbench

<img src="gui/electron/images/app-icon.png" alt="MySQL Workbench icon" width="80">

MySQL Workbench is a desktop application for developing, administering, and
migrating MySQL databases. It includes a rich SQL editor, database administration
and maintenance tools, and migration tools.

Workbench is an Electron application built from a Preact frontend, a Python
backend running in MySQL Shell, and the plugins in this repository. See the
[MySQL Workbench developer documentation](gui/WORKBENCH_DEV.md) to build it
locally, make changes and write new features.

The GUI plugin also contains the
[MySQL Migration Assistant](gui/backend/gui_plugin/migration/README.md) backend.

## Installation

Released versions of these plugins are included as built-in plugins in MySQL
Shell package distributions. MySQL Workbench includes its own MySQL Shell runtime and copies of the
plugins it needs, so users do not normally need to install them separately.

- [Download MySQL Workbench](https://dev.mysql.com/downloads/workbench/)
- [Download MySQL Shell](https://dev.mysql.com/downloads/shell/)

To develop a plugin from this repository, copy or symlink its source directory
into your MySQL Shell user plugin directory. Preserve the source directory name;
the GUI plugin source is under `gui/backend/gui_plugin`, while the other plugin
directories are at the repository root.

The user plugin directory is:

- Windows: `%AppData%\MySQL\mysqlsh\plugins`
- macOS and Linux: `~/.mysqlsh/plugins`

Run MySQL Shell with `--disable-builtin-plugins` while developing so the source
copy is loaded instead of the bundled version. For Workbench development, use
the setup in the
[MySQL Workbench developer documentation](gui/WORKBENCH_DEV.md), which prepares
the runtime and plugin sources together.

## Documentation

For full documentation on MySQL Server, MySQL Shell and related topics, see: https://dev.mysql.com/doc/refman/en/


## Contributing

This project welcomes contributions from the community. Before submitting a pull request, please [review our contribution guide](./CONTRIBUTING.md)


## Security

Please consult the [security guide](./SECURITY.md) for our responsible security vulnerability disclosure process


## License

License information can be found in the [LICENSE.txt](./LICENSE.txt) file.

This distribution may include materials developed by third parties. For license and attribution notices for these materials, please refer to the LICENSE file.

For additional downloads and the source of MySQL Shell (part of MySQL Server), visit: https://dev.mysql.com/downloads

Copyright &copy; 2022, 2026, Oracle and/or its affiliates.
