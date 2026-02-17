# Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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

import inspect
import os
from enum import Enum, StrEnum, IntEnum
from typing import Union, get_args, get_origin
from types import UnionType

PYTHON_BUILT_IN_TYPES = [object, int, str, float, bool, list, dict,
                         tuple, type(None), Enum, StrEnum, IntEnum]


class PluginInterfaceRegistry(object):
    def __init__(self):
        self.enums = []
        self.union_types = {}

        self.ts_enums = []
        self.ts_interfaces = []

    def generate(self):
        # Generate enum definitions
        for enum_type in self.enums:
            if issubclass(enum_type, StrEnum) or issubclass(enum_type, IntEnum):
                if issubclass(enum_type, StrEnum):
                    enum_values = [f"'{e.value}'" for e in enum_type]
                else:
                    enum_values = [f"{e.value}" for e in enum_type]

                enum_definition = f'export enum {enum_type.__name__} {{\n'
                enum_definition += f'    {",\n    ".join([f"{e.name} = {v}" for e, v in zip(
                    enum_type, enum_values)])}\n'
                enum_definition += '}'
            else:
                enum_definition = f'export enum {enum_type.__name__} {{\n'
                enum_definition += f'    {",\n    ".join([f"{e.name} = {e.value}" for e in enum_type])}\n'
                enum_definition += '}'

            if enum_definition not in self.ts_enums:
                self.ts_enums.append(enum_definition)

        # Remove duplicates while preserving order
        seen = set()
        unique_ts_interfaces = []
        for interface in self.ts_interfaces:
            if interface not in seen:
                seen.add(interface)
                unique_ts_interfaces.append(interface)

        return self.ts_enums + unique_ts_interfaces


def split_file_components(filename):
    """Split a file path into its components."""
    elements = []
    # raise ValueError("===> Function return type is not annotated")
    while filename != "":
        elements.insert(0, os.path.basename(filename))
        filename = os.path.dirname(filename)

        # The case for the root element: /
        if elements[0] == '':
            break

    return elements


def raise_error(func, error):
    this_file_elements = split_file_components(__file__)

    file_name = inspect.getfile(func)
    line_number = inspect.getsourcelines(func)[1]
    ffile_elements = split_file_components(filename=file_name)

    root_count = len(this_file_elements)-5
    mapped_file_elements = ffile_elements[0:root_count]
    mapped_file_elements = mapped_file_elements + \
        ffile_elements[root_count+4:]

    new_file_name = os.path.sep.join(mapped_file_elements)
    raise ValueError(f"{error}: {new_file_name}:{line_number}")


def generate_ts_interfaces(type_hint, registry):
    def has_annotations(type_):
        return hasattr(type_, '__annotations__') and len(type_.__annotations__) > 0

    def generate_interface(name, type_):
        interface_name = ""
        parent_interface_name = ""

        # Process the base class if needed
        if not type_.__base__ in PYTHON_BUILT_IN_TYPES:
            parent_interface_name = generate_interface(
                type_.__base__.__name__, type_.__base__)

        properties = []
        if has_annotations(type_):
            if isinstance(type_, type) and issubclass(type_, Enum):
                enum_name = type_.__name__
                registry.enums.append(type_)
                interface_name = enum_name
            else:
                interface_name = f'I{name}'
                for prop_name, prop_type in type_.__annotations__.items():
                    prop = getattr(type_, prop_name, None)
                    # Check if it's not a method
                    if not inspect.isroutine(prop):
                        ts_type = get_ts_type(prop_type)
                        properties.append(f'{prop_name}: {ts_type}')

                if parent_interface_name:
                    ts_interface = f'export interface {interface_name} extends {parent_interface_name} {{\n'
                else:
                    ts_interface = f'export interface {interface_name} {{\n'
                if properties:
                    ts_interface += f'    {",\n    ".join(properties)}\n'
                ts_interface += '}'
                registry.ts_interfaces.append(ts_interface)
                interface_name = interface_name
        else:
            interface_name = ""
        return interface_name

    def get_ts_type(type_):
        if isinstance(type_, type) and issubclass(type_, Enum):
            enum_name = type_.__name__
            registry.enums.append(type_)
            return enum_name
        elif get_origin(type_) is list:
            inner_type = get_args(type_)[0]
            return f'{get_ts_type(inner_type)}[]'
        elif get_origin(type_) is Union or get_origin(type_) is UnionType:
            inner_types = [get_ts_type(inner_type)
                           for inner_type in get_args(type_)]
            return ' | '.join(inner_types)
        elif has_annotations(type_) and inspect.isclass(type_):  # Class with annotations
            interface_name = generate_interface(type_.__name__, type_)
            return interface_name
        elif getattr(type_, "__name__", None) in registry.union_types:
            return registry.union_types[type_.__name__]
        elif type_ == str:
            return 'string'
        elif type_ == int or type_ == float:
            return 'number'
        elif type_ == bool:
            return 'boolean'
        elif get_origin(type_) is dict:
            key_type, value_type = get_args(type_)
            # TypeScript only allows string or number keys in objects
            key_ts = get_ts_type(key_type)
            value_ts = get_ts_type(value_type)
            # Use {[key: string]: ValueType} for TypeScript
            return f'Record<{key_ts}, {value_ts}>'
        elif type_ == dict:
            return 'IShellDictionary'  # or '{}' for an empty object, depending on your needs
        elif type_ == type(None):
            return 'null'  # or '{}' for an empty object, depending on your needs
        elif inspect.isclass(type_) and type_ != object:
            subclasses = [subclass for subclass in type_.__subclasses__(
            ) if has_annotations(subclass)]
            if subclasses:
                union_name = f'I{type_.__name__}'
                union_type = ' | '.join(
                    [f'I{subclass.__name__}' for subclass in subclasses])
                registry.union_types[type_.__name__] = union_name
                for subclass in subclasses:
                    generate_interface(subclass.__name__, subclass)
                ts_union = f'export type {union_name} = {union_type};'
                registry.ts_interfaces.append(ts_union)
                return union_name
            else:
                interface_name = f'I{type_.__name__}'
                ts_interface = f'export interface {interface_name} {{}}'
                registry.ts_interfaces.append(ts_interface)
                return interface_name
        else:
            return 'any'  # or some other default type

    return get_ts_type(type_hint)
