# Copyright (c) 2021, 2022, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is also distributed with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have included with MySQL.
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

from mysqlsh.plugin_manager import plugin_function
from mysqlsh.plugin_manager.registrar import PluginRegistrar
from mysqlsh.plugin_manager import registrar
from pathlib import Path

from functools import wraps
import os
import textwrap
import datetime
import re

beginning_year = 2020
binding = {}
plugin_imports = {}

bindings_type_override = {
    "IShellDbConnection": ["IShellDbconnectionsAddDbConnectionConnection", "IShellDbconnectionsUpdateDbConnectionConnection"],
    "IShellQueryOptions": ["IShellSqleditorExecuteOptions"],
    "IShellApiOptions": ["IShellGetSchemasOptions", "IShellGetSchemaTablesOptions", "IShellGetSchemaTableColumnsOptions"],
    "IShellConnectionOptions": ["IShellDbconnectionsTestConnectionConnection"]
}

py_parameter_override = {
    "session": {
        "condition": {
            "type": "object"
        },
        "mapping": {
            "name": "module_session_id",
            "type": "string",
            "description": "The string id for the module session object, where the database session is taken from.",
        }
    },
    "module_session": {
        "condition": {
            "type": "object"
        },
        "mapping": {
            "name": "module_session_id",
            "type": "string",
            "description": {
                "search": "The module session object",
                "replace": "The string id for the module session object"
            },
        }
    }
}

js_parameter_override = {
    "connection": {
        "condition": {
            "type": "object"
        },
        "mapping": {
            "type": "IShellDbConnection | number",
        }
    }
}

CONVERT_TO_CAMEL_FUNCTION = """import _ from "lodash";

export interface IConversionOptions {
    ignore?: string[];
}

export const convertCamelToSnakeCase = (o: object, options?: IConversionOptions): object => {
    return _.deepMapKeys(o, options?.ignore ?? [], (value, key) => {
        const snakeCased = key.replace(/([a-z])([A-Z])/g, (full, match1: string, match2: string) => {
            return `${match1}_${match2.toLowerCase()}`;
        });

        return snakeCased;
    });
};"""

bindings_template = """/*
 * {__COPYRIGHT__} (c) {__YEARS__}, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { {__PLUGIN_IMPORTS__} } from ".";

{__ADDITIONAL_DEFINITIONS__}

/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/naming-convention */

export enum ShellAPI{__PLUGIN__} {
    //  Begin auto generated API names
    //  End auto generated API names
}

//  Begin auto generated types
//  End auto generated types

export class Protocol{__PLUGIN__} extends Protocol {
    //  Begin auto generated content
    //  End auto generated content
}
"""

binding_interface = """
export interface {__NAME__} {
    {__MEMBERS__}
}

//  End auto generated types"""

binding_method = """/**
{__DESCRIPTION__}
{__PARAMETER_DOCS__}
{__RETURNS__}
     */
    public static getRequest{__METHOD_NAME_JS__}({__PARAMETERS__}): IShellRequest {
{__PARAMETER_OVERRIDE__}
        return Protocol.getRequestCommandExecute({__METHOD_NAME_PYTHON__},
            {
                args: {__ARGS__}{__KWARGS__}
            });
    }

    //  End auto generated content"""

binding_parameter_override_optional = """
        let {__PARAMETER_NAME__}ToUse;
        if ({__PARAMETER__}) {
            {__PARAMETER_NAME__}ToUse = {__OVERRIDE__};
        }
"""

binding_parameter_override_required = """
        const {__PARAMETER__}ToUse = {__OVERRIDE__};
"""

binding_method_enum_item = """{__ENUM_NAME__} = "{__FUNCTION_NAME__}",
    //  End auto generated API names"""


arguments_to_ignore = ['request_id', 'web_session']

method_enums = {
}


class PythonParamToJavascript:
    def __init__(self, param, function_name, plugin_name, is_option=False, parent:"PythonParamToJavascript"=None):
        self.function_name = function_name
        self.plugin_name = plugin_name
        self.is_option = is_option
        self.is_required = param.get("required", False)

        self.python_name = param['name']

        self.python_type = param['type'] if 'type' in param else "unknown"
        self.description = "Not documented" if param['brief'] == "" else param["brief"]
        self.python_default_value = str(
            param['default']) if 'default' in param else None

        override = self.get_override(self.python_name, self.python_type)

        if override is not None:
            self.python_name = override["name"]
            if "type" in override:
                self.python_type = override["type"]
            if "description" in override:
                if isinstance(override["description"], str):
                    self.description = override["description"]
                elif isinstance(override["description"], dict):
                    self.description = self.description .replace(override["description"]["search"],
                                                                 override["description"]["replace"])
            if "default" in override:
                self.python_default_value = override["default"]

        if self.python_default_value in ("True", "False"):
            self.python_default_value = self.python_default_value.lower()

        self.required = param['required'] == "True" if 'required' in param else True
        self.options = None

        self.parent = parent

        if 'options' in param:
            self.options = param['options']
        elif self.python_type == "dictionary":
            print(
                f"The dictionary '{self.python_name}' is not documented in {self.function_name}")

    def get_override(self, name, type):
        if name not in py_parameter_override:
            return None

        override = py_parameter_override[name]

        if "condition" in override and not override["condition"]["type"] == type:
            return None

        return override["mapping"]

    def get_js_override(self, name, type):
        if name not in js_parameter_override:
            return None

        override = js_parameter_override[name]

        if "condition" in override and not override["condition"]["type"] == type:
            return None

        return override["mapping"]

    @property
    def javascript_name(self):
        "The name in javascript"
        words = self.python_name.split("_")
        words = [words[0]] + [word.capitalize() for word in words[1:]]
        return "".join(words)

    @property
    def javascript_function_name(self):
        "The function name in javascript"
        words = self.function_name.split("_")
        words = [words[0]] + [word.capitalize() for word in words[1:]]
        return "".join(words)

    @property
    def has_own_type(self):
        "True if a new interface is being created for this parameter"
        return self.javascript_type.startswith("IShell")

    @property
    def javascript_type(self):
        "The type name in javascript"
        optional_type = ""
        if self.is_option and self.is_required:
            optional_type = " | null"

        override = self.get_js_override(self.python_name, self.python_type)

        if not override is None and "type" in override:
            return override["type"] + optional_type

        if self.python_type in ["integer", "float"]:
            return "number" + optional_type
        if self.python_type in ["dictionary"]:
            if self.options is not None and len(self.options) > 0:
                return self.interface_name
            global plugin_imports
            if not "IShellDictionary" in plugin_imports[self.plugin_name]:
                plugin_imports[self.plugin_name].append("IShellDictionary")

            return "IShellDictionary" + optional_type
        if self.python_type in ["bool"]:
            return "boolean" + optional_type
        if self.python_type in ["array"]:
            return "unknown[]" + optional_type
        if self.python_type in ["string"]:
            return "string" + optional_type
        if self.python_type in ["object"]:
            return "object" + optional_type
        raise Exception("Documentation type is invalid: " + self.python_type)

    @property
    def javascript_default_value(self):
        if self.python_default_value == "None":
            return "undefined"
        return self.python_default_value

    @property
    def parameter_declaration(self):
        "The full declaration for this parameter for the method signature"
        if self.required:
            # return a required parameter
            return f"{self.javascript_name}: {self.javascript_type}"
        if self.python_default_value == "None" or self.python_default_value is None:
            # return a not required parameter
            return f"{self.javascript_name}?: {self.javascript_type}"

        # return a parameter with a default literal string
        if self.python_type == "string":
            return f"{self.javascript_name} = \"{self.javascript_default_value}\""

        # return any other literal
        return f"{self.javascript_name} = {self.javascript_default_value}"

    @property
    def has_override(self):
        "True if the type is a dictionary that contains a defined structure"
        if self.python_type != "dictionary" or self.options is None or len(self.options) == 0:
            return False
        return True

    @property
    def parent_is_dict(self):
        return self.parent and self.parent.python_type == "dictionary"

    @property
    def override(self):
        "Generate the override (object recreation to comply with the specified structure and keys)"
        if not self.has_override:
            return None

        override_dependencies = []
        indent = "        " if self.required else "            "
        inner = ["{"]
        for option in self.options:

            option = PythonParamToJavascript(
                option, self.function_name, self.plugin_name, True, self)

            entry_name = f"{self.javascript_name}.{option.javascript_name}"

            if option.python_type == "dictionary" and option.options and option.override:
                override_dependencies.append(option.override.replace(f": {option.javascript_name}.", f": kwargs?.{option.javascript_name}?."))
                entry_name = f"{option.javascript_name}ToUse"

            inner.append(f"    {option.python_name}: {entry_name},")

        inner.append("}")

        override = binding_parameter_override_required if self.required else binding_parameter_override_optional
        override = override.replace("{__PARAMETER_NAME__}", self.javascript_name)
        override = override.replace("{__PARAMETER__}", f"kwargs?.{self.javascript_name}" if self.parent_is_dict else self.javascript_name)
        override = override.replace("{__OVERRIDE__}", f'\n{indent}'.join(inner))

        override_dependencies = "\n".join(override_dependencies)

        return f"{override_dependencies}{override}"


    @property
    def generate_json_argument(self):
        "Generated the entry for the args: {} object"
        if self.plugin_name == "Gui" and self.function_name == "DbStartSession" \
                and self.python_name == "connection":
            return f'{self.python_name}: typeof connection === "number" ? connection : convertCamelToSnakeCase(connection)'

        if self.has_override:
            return f"{self.python_name}: {self.javascript_name}ToUse"

        if self.python_name == self.javascript_name:
            return self.python_name

        return f"{self.python_name}: {self.javascript_name}"

    @property
    def documentation(self):
        "Generate the documentation for this parameter"
        return f"     * @param {self.javascript_name} {self.description}"

    def get_interface_parameter(self, option):
        "Generate the parameter when defining the new javascript interface"
        param = PythonParamToJavascript(
            option, self.function_name, self.plugin_name, is_option=True, parent=self)
        separator = ":" if 'required' in option else "?:"

        return f"{param.javascript_name}{separator} {param.javascript_type};"

    @property
    def interface_name(self):
        "Get the javascript interface name"
        preliminary_type_name = f"IShell{self.javascript_function_name}{self.javascript_name[0].upper()}{self.javascript_name[1:]}"

        for (key, value) in bindings_type_override.items():
            if preliminary_type_name in value:
                return key

        return preliminary_type_name

    @property
    def interface_dependencies(self):
        if not self.options:
            return ""

        dependent_interfaces = []

        for option in self.options:
            if option["type"] == "dictionary" and option["options"]:
                op = PythonParamToJavascript(option, self.function_name, self.plugin_name, True, self)
                dependent_interfaces.append(op.interface_definition.replace("//  End auto generated types", ""))

        return "\n".join(dependent_interfaces)

    @property
    def interface_definition(self):
        "Generate the javascript interface for this dictionary"
        if self.options is None:
            return ""

        members = "\n    ".join(
            [self.get_interface_parameter(opt) for opt in self.options])

        interface = binding_interface
        interface = interface.replace("{__NAME__}", self.interface_name)
        interface = interface.replace("{__MEMBERS__}", members)

        if self.interface_name in binding[self.plugin_name]:
            return ""

        return interface


def add_to_protocol_ts(definition):
    # Only functions with web enabled make it to the protocols file
    if not definition.web:
        return

    def snakify(name):
        return re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()

    # Get the plugin name by stripping the function name
    name_path = definition.fully_qualified_name.split(".")
    base_name = ".".join(name_path[0:-1])
    plugin_name = f"{name_path[0][0].upper()}{name_path[0][1:]}"

    name_path_python = []
    for item in name_path:
        name_path_python.append(snakify(item))

    protocol_filename = f"Protocol{plugin_name}.ts"

    this_file_path = Path(__file__).resolve(strict=True).as_posix()
    base_plugin_path = os.path.dirname(this_file_path)
    base_plugin_path = os.path.dirname(base_plugin_path)
    base_plugin_path = os.path.dirname(base_plugin_path)
    protocol_path = os.path.join(base_plugin_path,
                                 "frontend", "src", "communication", protocol_filename)

    global binding
    global plugin_imports
    global bindings_template

    if plugin_name not in binding:
        if os.path.exists(protocol_path):
            os.remove(protocol_path)
        plugin_imports[plugin_name] = ["Protocol", "IShellRequest"]
        binding[plugin_name] = bindings_template.replace(
            "{__PLUGIN__}", plugin_name)
        binding[plugin_name] = binding[plugin_name].replace(
            "{__COPYRIGHT__}", "Copyright")

        if plugin_name == "Gui":
            binding[plugin_name] = binding[plugin_name].replace(
                "{__ADDITIONAL_DEFINITIONS__}", CONVERT_TO_CAMEL_FUNCTION)
        else:
            binding[plugin_name] = binding[plugin_name].replace(
                "{__ADDITIONAL_DEFINITIONS__}", "")

        current_year = datetime.datetime.now().year
        years = f"{current_year}" if current_year == beginning_year else f"{beginning_year}, {current_year}"
        binding[plugin_name] = binding[plugin_name].replace(
            "{__YEARS__}", years)

    # If the template is empty, use the Protocol.ts file as a template
    # by removing the auto generated parts
    if bindings_template == "":
        with open(os.path.join(protocol_path), "r") as f:
            blocked = False
            for line in f.readlines():
                if "//  End auto generated" in line:
                    blocked = False

                if not blocked:
                    bindings_template = f"{bindings_template}{line}"

                if "//  Begin auto generated" in line:
                    blocked = True

    function_name = "".join(
        [word[0].upper() + word[1:] for word in name_path[1:]])
    function_full_name = "".join(
        [word[0].upper() + word[1:] for word in name_path])

    info = definition.format_info()

    method_enums[function_full_name] = ".".join(
        [base_name, definition.name])

    # Process the parameters for this function
    params = []

    for param in definition.parameters:
        if param.format_info()['name'] in arguments_to_ignore:
            continue
        params.append(PythonParamToJavascript(
            param.format_info(), function_name, plugin_name))

    # Process the "details" documentation
    # Currently, returns is not parsed as individual item, so we may have or not
    # a returns documentation, but still have details
    return_text = ""
    detail_count = len(
        info['details']) if info['details'] is not None else 0
    detail_index = 0

    return_text = "     *\n"
    if (detail_count == 0 or info['details'][0] != "<b>Returns:</b>"):
        return_text += "     * @returns Not documented"
    elif info['details'][0] == "<b>Returns:</b>":
        return_text += "     * @returns " + \
            info['details'][1].strip()
        detail_index = 2

    # Adds detail paragraphs to the function comments
    if detail_count > detail_index:
        for paragraph in info['details'][detail_index:]:
            # Each paragraph is prepended by empty line
            return_text += "\n     *"
            return_text += "\n     * "
            lines = textwrap.wrap(paragraph, 75)
            return_text += "\n     * ".join(lines)

    # Get all the needed information to run the template
    inline_params = [p.parameter_declaration for p in params]
    args = []
    kwargs = ""
    for p in params:
        if p.python_name == "kwargs":
            kwargs = '\n                kwargs: kwargsToUse,'
        else:
            args.append(p.generate_json_argument)

    doc_params = [p.documentation for p in params]
    type_definitions = [f"{p.interface_dependencies}{p.interface_definition}" for p in params]
    overrides = [p.override for p in params]

    # Some cleanup
    while None in overrides:
        overrides.remove(None)

    while "" in type_definitions:
        type_definitions.remove("")

    if len(doc_params) == 0:
        doc_params.append("")
    else:
        doc_params = ["     *"] + doc_params + [""]

    # Build the method text by using the defined function template
    method = binding_method
    method = method.replace(
        "{__DESCRIPTION__}", f"     * {definition.docs.brief if len(definition.docs.brief) > 0 else 'No description'}")
    method = method.replace(
        "{__PARAMETER_DOCS__}\n", "\n".join(doc_params))
    method = method.replace("{__RETURNS__}", return_text)
    method = method.replace("{__METHOD_NAME_JS__}", function_name)
    method = method.replace(
        "{__PARAMETER_OVERRIDE__}", "\n".join(overrides))
    method = method.replace(
        "{__METHOD_NAME_PYTHON__}", f"ShellAPI{plugin_name}.{function_full_name}")
    method = method.replace(
        "{__PARAMETERS__}", ", ".join(inline_params))
    method = method.replace("{__ARGS__}", "{\n                    %s,\n                }," %
                            ",\n                    ".join(args) if len(args) > 0 else "{},")
    method = method.replace("{__KWARGS__}", kwargs)

    # Generate the method enum
    api_enum = binding_method_enum_item.replace("{__ENUM_NAME__}", function_full_name).replace(
        "{__FUNCTION_NAME__}", ".".join(name_path_python))

    binding[plugin_name] = binding[plugin_name].replace(
        "//  End auto generated API names", api_enum)


    # Generate all the interface types
    if len(type_definitions) > 0:
        binding[plugin_name] = binding[plugin_name].replace(
            "//  End auto generated types", "\n".join(type_definitions))



    # Generate all the methods
    binding[plugin_name] = binding[plugin_name].replace(
        "//  End auto generated content", method)

    # Save the current Protocol.ts file as it is at this moment
    with open(os.path.join(protocol_path), "w") as f:
        f.write(binding[plugin_name].replace(
            "{__PLUGIN_IMPORTS__}", ", ".join(plugin_imports[plugin_name])))


registrar.add_registration_callback(add_to_protocol_ts)
