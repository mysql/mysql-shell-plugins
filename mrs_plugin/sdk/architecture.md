# MRS SDK backend architecture

Relevant files:

  - mrs_plugin/services.py
  - mrs_plugin/lib/sdk.py

Relevant code paths:

```
services.dump_sdk_service_files()
  services.get_sdk_base_classes()
    sdk.get_base_classes()
  services.get_sdk_service_classes()
    sdk.generate_service_sdk()
```

Not-so-relevant code paths:

```
services.get_runtime_management_code()
  sdk.sdk.get_mrs_runtime_management_code()
```

## Entrypoint

The frontend client (VSCode extension) communicates via web-sockets with the MySQL Shell backend plugin, in this case, via the `mrs.dump.sdkServiceFiles` (:shrug:) service. The service implementation is available at the `mrs_plugin/services.py` file. Internally, it calls functions specified by a custom library with SDK-related utilities which is available at the `mrs_plugin/lib/sdk.py` file.

In a nutshell, the `dump_sdk_service_files()` function sets up the basic file structure for each platform (for now, TypeScript and Python), i.e. "packages" the base files and other language-specific stuff.

## Library

The `generate_service_sdk()` function is the top-level function responsible for selecting the platform-specific templates based the language parameter it gets called with and replace its contents.

The heavy-lifting is done in two main blocks by other helper functions, by first replacing the contextual type definitions for the given REST service (`substitute_service_in_template()`) and later adding the required dependencies from the base file (`substitute_imports_in_template()`).

Replacing the contextual type definitions for the service itself, the existing schemas and database objects is done in a cascading fashion by other helper functions:

```
substitute_service_in_template()
  substitute_schemas_in_template()
    substitute_objects_in_template()
```

The content replacement happens based on placeholders specified using "${}" and delimiter control comments that determine the scope and context of each specific block of code which start with "^// --- <block_name>Start\n" and end with "^// -- <block_name>End\n". Both `substitute_objects_in_template()` and `substitute_imports_in_template()` leverage these blocks to determine if something should be part of the SDK or not based on the operations allowed at the service level.

For instance, if the user enables just READ operations, only the `find*()` commands will be included as part of the SDK, these are delimited by the "^// --- crudReadOnlyStart\n" and "^// --- crudReadOnlyEnd\n" control comments.

Copyright &copy; 2024, Oracle and/or its affiliates.
