# MySQL Shell Plugins

The MySQL Shell Plugins Repository is a collection of plugins for the MySQL Shell (part of MySQL Server), written by the MySQL Client Tools team. It covers currently these plugins:

- **GUI plugin**: provides backend functionality for the [MySQL Shell GUI](gui/frontend/readme.md) application.
- **MDS plugin**: implements [MySQL Database Services](mds_plugin/readme.md) and Oracle Cloud Infrastructure support
- **MRS plugin**: implements [MySQL REST Service](mrs_plugin/readme.md) support
- **MSM plugin**: implements [MySQL Schema Management operations](msm_plugin/readme.md)

## Installation

The GUI plugin backend and the other plugins can all be used on their own via MySQL Shell, but together they power the [MySQL Shell GUI](gui/frontend/readme.md) and the [MySQL Shell for VS Code](gui/extension/readme.md). Read the individual project readme files for more details, how to contribute and other information.

The following plugins are installed by copying the folders into the MySQL Shell Plugins directory:

- mds_plugin
- mrs_plugin
- msm_plugin

The plugins location for the MySQL Shell depends on the target platform:

- Windows: %appdata%\MySQL\mysqlsh\plugins
- Others: ~/.mysqlsh/plugins

For instructions about how to build and install the gui_plugin refer to the MySQL Shell GUI [readme.md](gui/frontend/readme.md).

## Documentation

For full documentation on MySQL Server, MySQL Shell and related topics, see: https://dev.mysql.com/doc/refman/en/


## Contributing

This project welcomes contributions from the community. Before submitting a pull request, please [review our contribution guide](./CONTRIBUTING.md)


## Security

Please consult the [security guide](./SECURITY.md) for our responsible security vulnerability disclosure process


## License

License information can be found in the LICENSE.txt file.

This distribution may include materials developed by third parties. For license and attribution notices for these materials, please refer to the LICENSE file.

For additional downloads and the source of MySQL Shell (part of MySQL Server), visit: https://dev.mysql.com/downloads

Copyright &copy; 2022, 2025, Oracle and/or its affiliates.


