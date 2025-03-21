# Copyright (c) 2021, 2025, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have either included with
# the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA"""

import datetime
import os
import re
from abc import ABC
from pathlib import Path
import typing

from mysqlsh.plugin_manager import registrar  # cspell:ignore mysqlsh

BEGINNING_YEAR = 2020

PROTOCOL_TEMPLATE = """/*
 * Copyright (c) {__YEARS__}, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

{__PREAMBLE__}

export enum {__AUTOGENERATED_API_NAME__} {
{__AUTOGENERATED_API_NAMES__}
}

{__AUTOGENERATED_PARAMETER_TYPES__}

export interface {__AUTOGENERATED_PROTOCOL_NAME__} {
{__AUTOGENERATED_MAPPINGS__}
}

{__RESULTS__}
"""

# Contains dictionary that contains all functions
# splitted into modules linked with
# backend fully qualified function name and docstring
# example:
# {
#   'Gui': {
#       'GuiClusterIsGuiModuleBackend': ('gui.cluster.is_gui_module_backend', 'Indicates whether this module is a GUI backend module')
#   }
# }
protocol_bindings = {}

# Contains dictionary that contains all interfaces
# splitted into modules linked with list of parameters,
# every parameter is stored in tuple that contains:
# name, type and docstring
# example:
# {
#   'Gui': {
#       'IShellGuiCoreIsShellWebCertificateInstalledKwargs': [('checkKeychain', 'boolean', 'Check if not only the certificates have been created but also installed into the keychain')]
#   }
# }
parameter_types_bindings = {}

# Contains dictionary that contains all functions
# splitted into modules linked with parameters,
# parameters are splitted onto args and kwargs.
# Args is dictionary with param name as key and
# a tuple as value, it contains type, is_default,
# docstring and required. Kwargs is simply links
# name with interface name.
# example:
# {
#     'GuiCoreSetLogLevel': {
#         'args': {'logLevel': ('string', False, 'Level of logging', False)}, 'kwargs': {}},
#     }
# }
parameter_mapper_bindings = {}

nullable_bindings = {
    'Gui' : {
        'IShellDbConnection': ['dbType', 'caption', 'description', 'options', 'settings']
    },
    'Mrs' : {
        'IShellMrsAddServiceKwargs': ['options'],
        'IShellMrsGetServiceKwargs': ['serviceId', 'urlContextRoot', 'urlHostName', 'getDefault', 'autoSelectSingle'],
        'IShellMrsEnableServiceKwargs': ['serviceId', 'urlContextRoot', 'urlHostName'],
        'IShellMrsDisableServiceKwargs': ['serviceId', 'urlContextRoot', 'urlHostName'],
        'IShellMrsDeleteServiceKwargs': ['serviceId', 'urlContextRoot', 'urlHostName'],
        'IShellMrsSetServiceContextPathKwargs': ['serviceId', 'urlContextRoot', 'urlHostName', 'value'],
        'IShellMrsSetServiceProtocolKwargs': ['serviceId', 'urlContextRoot', 'urlHostName', 'value'],
        'IShellMrsSetServiceCommentsKwargs': ['serviceId', 'urlContextRoot', 'urlHostName', 'value'],
        'IShellMrsUpdateServiceKwargs': ['serviceId', 'urlContextRoot', 'urlHostName', 'value'],
        'IShellMrsAddSchemaKwargs': ['itemsPerPage', 'options'],
        'IShellMrsGetSchemaKwargs': ['serviceId', 'requestPath', 'schemaName', 'schemaId', 'autoSelectSingle'],
        'IShellMrsEnableSchemaKwargs': ['schemaId', 'serviceId', 'schemaName'],
        'IShellMrsDisableSchemaKwargs': ['schemaId', 'serviceId', 'schemaName'],
        'IShellMrsDeleteSchemaKwargs': ['schemaId', 'serviceId', 'schemaName'],
        'IShellMrsSetSchemaNameKwargs': ['schemaId', 'serviceId', 'schemaName', 'value'],
        'IShellMrsSetSchemaRequestPathKwargs': ['schemaId', 'serviceId', 'schemaName', 'value'],
        'IShellMrsSetSchemaRequiresAuthKwargs': ['schemaId', 'serviceId', 'schemaName', 'value'],
        'IShellMrsSetSchemaItemsPerPageKwargs': ['schemaId', 'serviceId', 'schemaName', 'value'],
        'IShellMrsSetSchemaCommentsKwargs': ['schemaId', 'serviceId', 'schemaName', 'value'],
        'IShellMrsUpdateSchemaKwargsValue': ['itemsPerPage', 'options'],
        'IShellMrsUpdateSchemaKwargs': ['value'],
        'IShellMrsAddAuthenticationAppKwargs': ['defaultRoleId'],
        'IShellMrsUpdateAuthenticationAppKwargsValue': ['defaultRoleId'],
        'IShellMrsUpdateAuthenticationAppKwargs': ['value'],
        'IShellMrsAddDbObjectKwargs': ['options', 'metadata'],
        'IShellMrsEnableDbObjectKwargs': ['dbObjectId'],
        'IShellMrsDisableDbObjectKwargs': ['dbObjectId'],
        'IShellMrsDeleteDbObjectKwargs': ['dbObjectId'],
        'IShellMrsUpdateDbObjectKwargsValue': ['options', 'itemsPerPage', 'metadata'],
        'IShellMrsAddContentSetKwargs': ['requestPath', 'requiresAuth', 'options'],
        'IShellMrsAddUserKwargs': ['options', 'appOptions'],
        'IShellMrsUpdateUserKwargsValue': ['name', 'email', 'vendorUserId', 'mappedUserId', 'options', 'appOptions', 'authString']
    }
}


class TypeScriptHelper:
    """Helper class to generate TypeScript code.

        Attributes
            _params_to_replace : dict
                The file contains keys that are parameter names needs
                to be replaced for param that is know to frontend.
                Inside this key it should contain `mapping` key that
                collects what should be replaced:
                    * `name` - name of parameter
                    * `param_type` - type of target parameter
                    * `brief` - could be simple string with new docstring
                                or dictionary with two keys `search` and `replace`
                                that search and replace original docstring

 """

    _params_to_replace = {
        "session": {
            "mapping": {
                "name": "module_session_id",
                "param_type": "string",
                "brief": "The string id for the module session object, holding the database session to be used on the operation.",
            }
        },
        "module_session": {
            "mapping": {
                "name": "module_session_id",
                "param_type": "string",
                "brief": {
                    "search": "The module session object",
                    "replace": "The string id for the module session object"
                },
            }
        },
        "connection": {
            "mapping": {
                "param_type": "IShellDbConnection | number",
                "interface_name": "IShellDbConnection"
            }
        },
    }

    @classmethod
    def snakify(cls, name: str) -> str:  # cspell:ignore snakify
        """Converts a camel case name to snake case."""

        name = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
        return re.sub("([a-z0-9])([A-Z])", r"\1_\2", name).lower()

    @classmethod
    def convert_name_to_ts(cls, name: str) -> str:
        """Converts a Python name to TypeScript."""

        # example: python_name -> pythonName
        return re.sub(r"_(\w)", lambda m: m.group(1).upper(), name)

    @classmethod
    def convert_python_type_to_ts(cls, python_type: str) -> str:
        """Converts a Python type to TypeScript."""

        ts_type = python_type
        if python_type in ["integer", "float"]:
            ts_type = "number"
        elif python_type in ["bool"]:
            ts_type = "boolean"
        elif python_type in ["array"]:
            ts_type = "unknown[]"
        elif python_type in ["dictionary"]:
            ts_type = "IShellDictionary"

        return ts_type

    @classmethod
    def replace_param(cls, param_name: str, param_type: str, brief: str) -> typing.Tuple[str, str, str]:
        """Replaces some params names and types onto different

            This function can replace param that is internal for backend function with
            param that can be passed from frontend, f. e.: `session` is internal backend
            parameter and frontend doesn't have access to it, so it must be replaced
            with `module_session_id` which is known to frontend parameter and can be easy
            used in backend to obtain proper session object.
        """

        if param_name in cls._params_to_replace:
            override = cls._params_to_replace[param_name]['mapping']
            param_name = override.get('name', param_name)
            param_type = override.get('param_type', param_type)
            if 'brief' in override:
                if isinstance(override["brief"], dict):
                    brief = brief.replace(
                        override["brief"]["search"], override["brief"]["replace"])
                else:
                    brief = override["brief"]

        return (param_name, param_type, brief)

    @classmethod
    def get_interface_name(cls, param_name: str) -> str:
        """Gets interface name for the given param name"""

        interface_name = None
        if param_name in cls._params_to_replace and \
                'interface_name' in cls._params_to_replace[param_name]['mapping']:
            interface_name = cls._params_to_replace[param_name]['mapping']['interface_name']

        return interface_name


class ProtocolBuilder:
    """Class to build the protocol bindings."""

    def __init__(self, plugin_name: str, definition: registrar.PluginRegistrar.FunctionData) -> None:
        self._plugin_name = plugin_name
        self._definition = definition
        self._protocol_file_content = PROTOCOL_TEMPLATE

        self._init_bindings()

    def _init_bindings(self) -> None:
        global parameter_mapper_bindings  # pylint: disable=invalid-name, global-variable-not-assigned
        global parameter_types_bindings  # pylint: disable=invalid-name, global-variable-not-assigned
        global protocol_bindings  # pylint: disable=invalid-name, global-variable-not-assigned

        if self._plugin_name not in parameter_mapper_bindings:
            parameter_mapper_bindings[self._plugin_name] = {}

        if self._plugin_name not in parameter_types_bindings:
            parameter_types_bindings[self._plugin_name] = {}

        if self._plugin_name not in protocol_bindings:
            protocol_bindings[self._plugin_name] = {}

    def build(self) -> None:
        """Builds the protocol bindings for the given API."""
        ts_function = TypeScriptFunction(self._plugin_name, self._definition)
        for param in self._definition.parameters:
            info = param.format_info()
            if info['name'] == "kwargs":
                ts_function.add_kwargs_parameter(info)
            else:
                ts_function.add_args_parameter(info)
            # ts_function.add_return_type(param)

        ts_function.add_bindings()
        self._generate()

    def _generate_protocol_bindings(self, bindings: dict) -> None:
        """Generates the protocol bindings.


            Function generates interface that binds every function in module
            to backend fully qualified function name, also adds doc string to it f. e.:

            export enum ShellAPIMrs {
                /** Adds a new MRS service */
                MrsAddService = "mrs.add.service",
                ...
            }
        """

        return ",\n".join(
            [
                f'    /** {bindings[key][1]} */\n    {key} = "{bindings[key][0]}"'
                for key in bindings
            ]
        )

    def _generate_parameter_bindings(self, bindings: dict, nullables: dict) -> None:
        """Generates the parameter bindings.


            Function generates interfaces for every function in module,
            it adds comment, name and type for all parameters and put it
            inside interface, f. e.:

            export interface IShellMrsStatusKwargs {
                /** The string id for the module session object, holding the database session to be used on the operation. */
                moduleSessionId?: string;
                /** Indicates whether to execute in interactive mode */
                interactive?: boolean;
                /** If set to true exceptions are raised */
                raiseExceptions?: boolean;
                /** If set to true, a list object is returned */
                returnFormatted?: boolean;
            }
        """

        output = []

        for key in bindings:
            args = []
            for arg in bindings[key]:
                arg_name = arg[0]
                arg_type = arg[1]
                arg_brief = arg[2]
                arg_required = arg[3]
                key_nullables = nullables[key] if key in nullables else []
                arg_nullable = arg_name in key_nullables
                args.append(
                    f"    /** {arg_brief} */\n    {arg_name}{'' if arg_required or arg_nullable else '?'}: {arg_type}{' | null' if arg_nullable else ''};")
            args = '\n'.join(args)
            output.append(f"export interface {key} {{\n{args}\n}}")

        return "\n\n".join(output)

    def _generate_parameter_mapper_bindings(self, bindings: dict) -> None:
        """Generates the parameter mapper bindings.

            Function creates interface for the module, for every function in module generates
            dictionary that contains parameters that are bound to the function, f. e.:

            export interface IProtocolMrsParameters {
                [ShellAPIMrs.MrsAddService]: { args: {urlContextRoot?: string, urlHostName?: string, enabled?: boolean}; kwargs?: IShellMrsAddServiceKwargs };
                ...
            }

        """

        output = ""
        for func_name in bindings:
            name_parts = re.sub(
                "([a-z])([A-Z])", r"\1 \2", func_name).split(" ")
            output += f"    [ShellAPI{name_parts[0]}.{func_name}]: "
            line_args = "args: { "
            line_kwargs = ""
            contains_args = False
            contains_kwargs = False
            for argument in bindings[func_name]['args']:
                if isinstance(bindings[func_name]['args'][argument], list):
                    line_args += f"{argument}: {{ "
                    for option in bindings[func_name]['args'][argument]:
                        line_args += f"{option[0]}: {option[1]}; "
                    line_args = line_args[:-1] + " }; "
                else:
                    param_type, required, _, default_none = bindings[func_name]['args'][argument]
                    line_args += f"{argument}{'?' if default_none or not required else ''}: {param_type}; "
                contains_args = True

            line_args = line_args[:-1] + " };"

            for argument in bindings[func_name]['kwargs']:
                line_kwargs += f"{bindings[func_name]['kwargs'][argument][0]}?: {bindings[func_name]['kwargs'][argument][1]}; "
                contains_kwargs = True

            line_kwargs = line_kwargs[:-2] + ";"

            if not contains_args and not contains_kwargs:
                output += "{};\n"
            else:
                output += "{ "
                if contains_args:
                    output += line_args + " "
                if contains_kwargs:
                    output += line_kwargs + " "
                output += "};\n"

        return output

    def _generate(self) -> None:
        """Generates the protocol files."""

        global protocol_bindings          # pylint: disable=invalid-name, global-variable-not-assigned
        global parameter_mapper_bindings  # pylint: disable=invalid-name, global-variable-not-assigned
        global parameter_types_bindings   # pylint: disable=invalid-name, global-variable-not-assigned

        current_year = datetime.datetime.now().year
        years = f"{current_year}" if current_year == BEGINNING_YEAR else f"{BEGINNING_YEAR}, {current_year}"
        self._protocol_file_content = self._protocol_file_content.replace(
            "{__YEARS__}", years)

        self._protocol_file_content = self._protocol_file_content.replace(
            "{__PREAMBLE__}", self._load_file_content("preamble_"))

        self._protocol_file_content = self._protocol_file_content.replace(
            "{__AUTOGENERATED_API_NAME__}", f"ShellAPI{self._plugin_name}")
        self._protocol_file_content = self._protocol_file_content.replace(
            "{__AUTOGENERATED_API_NAMES__}", self._generate_protocol_bindings(protocol_bindings[self._plugin_name]))

        nullables = nullable_bindings[self._plugin_name] if self._plugin_name in nullable_bindings else {}
        self._protocol_file_content = self._protocol_file_content.replace(
            "{__AUTOGENERATED_PARAMETER_TYPES__}", self._generate_parameter_bindings(parameter_types_bindings[self._plugin_name], nullables))

        self._protocol_file_content = self._protocol_file_content.replace(
            "{__AUTOGENERATED_PROTOCOL_NAME__}", f"IProtocol{self._plugin_name}Parameters")
        self._protocol_file_content = self._protocol_file_content.replace(
            "{__AUTOGENERATED_MAPPINGS__}", self._generate_parameter_mapper_bindings(parameter_mapper_bindings[self._plugin_name]))

        self._protocol_file_content = self._protocol_file_content.replace(
            "{__RESULTS__}", self._load_file_content("results_"))

    def _load_file_content(self, prefix: str) -> str:
        """Loads the file content from the file."""

        file_name = f"{prefix}{self._plugin_name.lower()}.txt"
        current_path = os.path.dirname(os.path.realpath(__file__))
        file_path = os.path.join(current_path, file_name)
        with open(file_path, "r", encoding="UTF-8") as preamble_file:
            return preamble_file.read()

    def save(self, output_dir: str) -> None:
        """Saves the protocol bindings to the given output directory."""

        protocol_filename: str = f"Protocol{self._plugin_name}.ts"
        protocol_path = os.path.join(
            output_dir, "frontend", "src", "communication", protocol_filename
        )

        with open(protocol_path, "w", encoding="utf-8", newline="\n") as protocol_file:
            protocol_file.write(self._protocol_file_content)


class TypeScriptInterface:
    """Class to generate TypeScript interfaces."""

    def __init__(self, plugin_name: str, name: str, options: dict) -> None:
        self._plugin_name = plugin_name
        self._name = name
        self._options = options

    def add_bindings(self) -> None:
        """Adds the bindings for the interface."""

        global parameter_types_bindings  # pylint: disable=invalid-name, global-variable-not-assigned

        interface_params = []
        for option in self._options:
            param_name, param_type, param_brief = TypeScriptHelper.replace_param(
                option['name'], option['type'],  option['brief'])
            param_name = TypeScriptHelper.convert_name_to_ts(param_name)
            param_type = TypeScriptHelper.convert_python_type_to_ts(param_type)
            required = option['required'] if 'required' in option else False

            if 'options' in option and len(option['options']) > 0:
                param_type = f"{self._name}{option['name'].capitalize()}"
                interface = TypeScriptInterface(
                    self._plugin_name, param_type, option['options'])
                interface.add_bindings()

            interface_params.append(
                (param_name, param_type, param_brief, required))

        parameter_types_bindings[self._plugin_name][self._name] = interface_params


class TypeScriptParameter(ABC):
    """Base class for TypeScript parameters."""

    def __init__(self, plugin_name: str, func_name: str) -> None:
        self._plugin_name = plugin_name
        self._func_name = func_name
        self._params_to_ignore = ['request_id',
                                  'web_session', 'be_session', '_user_id']

    def add_bindings(self) -> None:
        """Adds the bindings for the parameter."""

        raise NotImplementedError(
            f"{TypeScriptParameter} is an abstract class and cannot be instantiated.")


class TypeScriptSimpleParameter(TypeScriptParameter):
    """Represents a simple parameter."""

    def __init__(self, plugin_name: str, func_name: str, name: str, param_type: str,
                 default_none: bool, required: bool, param_doc) -> None:
        super().__init__(plugin_name, func_name)
        self._default_none = default_none
        self._required = required
        self._name, self._param_type, self._param_doc = TypeScriptHelper.replace_param(
            name, param_type, param_doc)

    def add_bindings(self) -> None:
        """Adds a binding to the parameter mapper."""

        global parameter_mapper_bindings  # pylint: disable=invalid-name, global-variable-not-assigned

        if self._name not in self._params_to_ignore:
            parameter_mapper_bindings[self._plugin_name][self._func_name]['args'][TypeScriptHelper.convert_name_to_ts(self._name)] = (
                TypeScriptHelper.convert_python_type_to_ts(self._param_type), self._required, self._param_doc, self._default_none)


class TypeScriptDictionaryParameter(TypeScriptParameter):
    """Represents a dictionary parameter."""

    def __init__(self, plugin_name: str, func_name: str, name: str, param_type: str,
                 default_none: bool, required: bool, param_doc: str, options: list) -> None:
        super().__init__(plugin_name, func_name)
        self._name = name
        self._param_type = param_type
        self._default_none = default_none
        self._required = required
        self._param_doc = param_doc
        self._options = options

    def add_bindings(self) -> None:
        """Adds a binding to the parameter mapper."""

        global parameter_mapper_bindings  # pylint: disable=invalid-name, global-variable-not-assigned

        if self._name not in self._params_to_ignore:
            interface_name = TypeScriptHelper.get_interface_name(self._name)
            if interface_name is not None:
                interface = TypeScriptInterface(
                    self._plugin_name, interface_name, self._options)

                parameter_mapper_bindings[self._plugin_name][self._func_name]['args'][TypeScriptHelper.convert_name_to_ts(
                    self._name)] = (interface_name, self._required, self._param_doc, self._default_none)

                interface.add_bindings()
            else:
                parameter_mapper_bindings[self._plugin_name][self._func_name]['args'][TypeScriptHelper.convert_name_to_ts(self._name)] = [
                    (TypeScriptHelper.convert_name_to_ts(option['name']), TypeScriptHelper.convert_python_type_to_ts(option['type']), option['brief']) for option in self._options
                ]


class TypeScriptKwargsParameter(TypeScriptParameter):
    """Represents an kwargs parameter."""

    def __init__(self, plugin_name: str, func_name: str, name: str, param_type: str,
                 default_none: bool, required: bool, param_doc, options: list) -> None:
        super().__init__(plugin_name, func_name)
        self._param_type = param_type
        self._default_none = default_none
        self._required = required
        self._param_doc = param_doc
        self._options = options
        self._name = name
        self._interface = None

    def add_interface(self) -> None:
        """Adds an interface to the parameter."""

        interface_name = f"IShell{self._func_name}{TypeScriptHelper.convert_name_to_ts(self._name).capitalize()}"
        self._interface = TypeScriptInterface(
            self._plugin_name, interface_name, self._options)

    def add_bindings(self) -> None:
        """Adds a binding to the parameter mapper."""

        global parameter_mapper_bindings  # pylint: disable=invalid-name, global-variable-not-assigned

        if self._name not in self._params_to_ignore:
            interface_name = f"IShell{self._func_name}{TypeScriptHelper.convert_name_to_ts(self._name).capitalize()}"
            parameter_mapper_bindings[self._plugin_name][self._func_name]['kwargs'][TypeScriptHelper.convert_name_to_ts(self._name)] = (
                self._name, interface_name, self._param_doc, self._default_none)

        self._interface.add_bindings()


class TypeScriptFunction:
    """Holds information about a TypeScript function."""

    def __init__(self, plugin_name: str, definition: registrar.PluginRegistrar.FunctionData) -> None:
        self._plugin_name = plugin_name
        self._params: list[TypeScriptParameter] = []
        self._func_doc = definition.docs.brief

        full_name = definition.fully_qualified_name

        # Creates name for the Shell API from fully qualified name
        # example: "gui.core.listRoles" -> "GuiCoreListRoles"
        self._ts_fully_qualified_name = "".join(
            [x[0].upper() + x[1:] for x in full_name.split(".")])

        # Creates proper name for BE function from fully qualified name
        # example: "gui.core.listRoles" -> "gui.core.list_roles"
        self._py_fully_qualified_name = ".".join(full_name.split(
            ".")[:-1] + [TypeScriptHelper.snakify(full_name.split(".")[-1])])

    def add_bindings(self) -> None:
        """Adds bindings to the parameter mapper."""

        global protocol_bindings  # pylint: disable=invalid-name, global-variable-not-assigned

        protocol_bindings[self._plugin_name][self._ts_fully_qualified_name] = (
            self._py_fully_qualified_name, self._func_doc)

        self._init_params_binding()

        for param in self._params:
            param.add_bindings()

    def _init_params_binding(self) -> None:
        global parameter_mapper_bindings  # pylint: disable=invalid-name, global-variable-not-assigned

        if self._ts_fully_qualified_name not in parameter_mapper_bindings[self._plugin_name]:
            parameter_mapper_bindings[self._plugin_name][self._ts_fully_qualified_name] = {
            }
            parameter_mapper_bindings[self._plugin_name][self._ts_fully_qualified_name]['args'] = {
            }
            parameter_mapper_bindings[self._plugin_name][self._ts_fully_qualified_name]['kwargs'] = {
            }

    def add_kwargs_parameter(self, param: dict) -> None:
        """Adds a kwargs parameter to the function."""

        default_none = param['default'] is None if 'default' in param else False
        required = param['required'] == "True" if 'required' in param else False
        param = TypeScriptKwargsParameter(
            self._plugin_name,
            self._ts_fully_qualified_name,
            param['name'],
            param['type'],
            default_none,
            required,
            param['brief'],
            param['options'])

        param.add_interface()
        self._params.append(param)

    def add_args_parameter(self, param: dict) -> None:
        """Adds an args parameter to the function."""

        default_none = param['default'] is None if 'default' in param else False
        required = param['required'] == "True" if 'required' in param else True
        if param['type'] == "dictionary":
            parameter = TypeScriptDictionaryParameter(
                self._plugin_name,
                self._ts_fully_qualified_name,
                param['name'],
                param['type'],
                default_none,
                required,
                param['brief'],
                param['options'])
        else:
            parameter = TypeScriptSimpleParameter(
                self._plugin_name,
                self._ts_fully_qualified_name,
                param['name'],
                param['type'],
                default_none,
                required,
                param['brief'])

        self._params.append(parameter)


def add_to_protocol_ts(definition: registrar.PluginRegistrar.FunctionData) -> None:
    """Adds a new definition to the protocol file."""
    # Only functions with web enabled make it to the protocols file
    if not definition.web:  # type: ignore
        return

    # Get the plugin name by stripping the function name
    name_path = definition.fully_qualified_name.split(".")
    # base_name = ".".join(name_path[0:-1])
    plugin_name = f"{name_path[0][0].upper()}{name_path[0][1:]}"

    base_plugin_path = Path(__file__).resolve(
        strict=True).parents[3].as_posix()

    protocol_ts = ProtocolBuilder(plugin_name, definition)
    protocol_ts.build()
    protocol_ts.save(base_plugin_path)


registrar.add_registration_callback(add_to_protocol_ts)
