# Copyright (c) 2023, 2024, Oracle and/or its affiliates.
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
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

from ...lib.sdk import *


def test_get_interface_datatype():
    args = {
        "class_name": "MyEntity",
        "field": {
            "name": "field"
        },
        "sdk_language": "TypeScript"
    }

    type = get_interface_datatype(**args)
    assert type == "IMyEntityField"

    args["field"]["db_column"] = {
        "datatype": "varchar",
        "not_null": True
    }

    type = get_interface_datatype(**args)
    assert type == "string"

    args["field"]["db_column"] = {
        "datatype": "int",
        "not_null": False
    }

    type = get_interface_datatype(**args)
    assert type == "MaybeNull<number>"

    args["sdk_language"] = "Unknown"

    type = get_interface_datatype(**args)
    assert type == "unknown"


def test_get_datatype_mapping():
    args = {
        "db_datatype": "tinyint(1)",
        "sdk_language": "TypeScript"
    }

    type = get_datatype_mapping(**args)
    assert type == "boolean"

    args["db_datatype"] = "bit(1)"

    type = get_datatype_mapping(**args)
    assert type == "boolean"

    args["db_datatype"] = "tinyint"

    type = get_datatype_mapping(**args)
    assert type == "number"

    args["db_datatype"] = "smallint"

    type = get_datatype_mapping(**args)
    assert type == "number"

    args["db_datatype"] = "mediumint"

    type = get_datatype_mapping(**args)
    assert type == "number"

    args["db_datatype"] = "int"

    type = get_datatype_mapping(**args)
    assert type == "number"

    args["db_datatype"] = "decimal"

    type = get_datatype_mapping(**args)
    assert type == "number"

    args["db_datatype"] = "numeric"

    type = get_datatype_mapping(**args)
    assert type == "number"

    args["db_datatype"] = "float"

    type = get_datatype_mapping(**args)
    assert type == "number"

    args["db_datatype"] = "double"

    type = get_datatype_mapping(**args)
    assert type == "number"

    args["db_datatype"] = "json"

    type = get_datatype_mapping(**args)
    assert type == "JsonValue"

    args["db_datatype"] = "GEOMETRY"

    type = get_datatype_mapping(**args)
    assert type == "Geometry"

    args["db_datatype"] = "GEOMETRYCOLLECTION"

    type = get_datatype_mapping(**args)
    assert type == "GeometryCollection"

    args["db_datatype"] = "POINT"

    type = get_datatype_mapping(**args)
    assert type == "Point"

    args["db_datatype"] = "MULTIPOINT"

    type = get_datatype_mapping(**args)
    assert type == "MultiPoint"

    args["db_datatype"] = "LINESTRING"

    type = get_datatype_mapping(**args)
    assert type == "LineString"

    args["db_datatype"] = "MULTILINESTRING"

    type = get_datatype_mapping(**args)
    assert type == "MultiLineString"

    args["db_datatype"] = "POLYGON"

    type = get_datatype_mapping(**args)
    assert type == "Polygon"

    args["db_datatype"] = "MULTIPOLYGON"

    type = get_datatype_mapping(**args)
    assert type == "MultiPolygon"

    args["db_datatype"] = "varchar"

    type = get_datatype_mapping(**args)
    assert type == "string"

    args["sdk_language"] = "Unknown"

    type = get_datatype_mapping(**args)
    assert type == "unknown"


def test_datatype_is_primitive():
    args = {
        "client_datatype": "bigint",
        "sdk_language": "TypeScript"
    }

    is_native = datatype_is_primitive(**args)
    assert is_native is True

    args["client_datatype"] = "boolean"

    is_native = datatype_is_primitive(**args)
    assert is_native is True

    args["client_datatype"] = "null"

    is_native = datatype_is_primitive(**args)
    assert is_native is True

    args["client_datatype"] = "number"

    is_native = datatype_is_primitive(**args)
    assert is_native is True

    args["client_datatype"] = "string"

    is_native = datatype_is_primitive(**args)
    assert is_native is True

    args["client_datatype"] = "symbol"

    is_native = datatype_is_primitive(**args)
    assert is_native is True

    args["client_datatype"] = "undefined"

    is_native = datatype_is_primitive(**args)
    assert is_native is True

    args["client_datatype"] = "Unknown"

    is_native = datatype_is_primitive(**args)
    assert is_native is False

    args["sdk_language"] = "Unknown"

    is_native = datatype_is_primitive(**args)
    assert is_native is False


def test_field_can_be_cursor():
    field = {}

    can_be_cursor = field_can_be_cursor(field)
    assert can_be_cursor is False

    field["lev"] = 0

    can_be_cursor = field_can_be_cursor(field)
    assert can_be_cursor is False

    field["lev"] = 1

    can_be_cursor = field_can_be_cursor(field)
    assert can_be_cursor is False

    field["db_column"] = {
        "id_generation": "auto_inc"
    }

    can_be_cursor = field_can_be_cursor(field)
    assert can_be_cursor is True

    field["db_column"]["id_generation"] = None
    field["db_column"]["datatype"] = "timestamp"

    can_be_cursor = field_can_be_cursor(field)
    assert can_be_cursor is True

