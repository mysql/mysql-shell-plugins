# Copyright (c) 2023, Oracle and/or its affiliates.
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


def test_get_datatype_mapping():
    args = {
        "db_datatype": "tinyint(1)",
        "db_not_null": True,
        "sdk_language": "TypeScript"
    }

    type = get_datatype_mapping(**args)
    assert type == "boolean"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<boolean>"

    args["db_datatype"] = "bit(1)"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "boolean"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<boolean>"

    args["db_datatype"] = "tinyint"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "number"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<number>"

    args["db_datatype"] = "smallint"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "number"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<number>"

    args["db_datatype"] = "mediumint"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "number"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<number>"

    args["db_datatype"] = "int"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "number"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<number>"

    args["db_datatype"] = "decimal"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "number"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<number>"

    args["db_datatype"] = "numeric"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "number"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<number>"

    args["db_datatype"] = "float"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "number"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<number>"

    args["db_datatype"] = "double"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "number"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<number>"

    args["db_datatype"] = "json"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "JsonValue"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<JsonValue>"

    args["db_datatype"] = "GEOMETRY"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "Geometry"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<Geometry>"

    args["db_datatype"] = "GEOMETRYCOLLECTION"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "GeometryCollection"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<GeometryCollection>"

    args["db_datatype"] = "POINT"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "Point"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<Point>"

    args["db_datatype"] = "MULTIPOINT"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "MultiPoint"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<MultiPoint>"

    args["db_datatype"] = "LINESTRING"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "LineString"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<LineString>"

    args["db_datatype"] = "MULTILINESTRING"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "MultiLineString"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<MultiLineString>"

    args["db_datatype"] = "POLYGON"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "Polygon"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<Polygon>"

    args["db_datatype"] = "MULTIPOLYGON"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "MultiPolygon"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<MultiPolygon>"

    args["db_datatype"] = "varchar"
    args["db_not_null"] = True

    type = get_datatype_mapping(**args)
    assert type == "string"

    args["db_not_null"] = False

    type = get_datatype_mapping(**args)
    assert type == "MaybeNull<string>"
