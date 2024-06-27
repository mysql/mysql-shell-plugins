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

    args["sdk_language"] = "Python"
    type = get_interface_datatype(**args)
    assert type == "str"

    args["field"]["db_column"] = {
        "datatype": "int",
        "not_null": False
    }
    args["sdk_language"] = "TypeScript"

    type = get_interface_datatype(**args)
    assert type == "MaybeNull<number>"

    args["sdk_language"] = "Python"
    type = get_interface_datatype(**args)
    assert type == "Optional[int]"

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

    args["sdk_language"] = "Python"
    args["db_datatype"] = "tinyint(1)"

    type = get_datatype_mapping(**args)
    assert type == "bool"

    args["db_datatype"] = "bit(1)"

    type = get_datatype_mapping(**args)
    assert type == "bool"

    args["db_datatype"] = "tinyint"

    type = get_datatype_mapping(**args)
    assert type == "int"

    args["db_datatype"] = "smallint"

    type = get_datatype_mapping(**args)
    assert type == "int"

    args["db_datatype"] = "mediumint"

    type = get_datatype_mapping(**args)
    assert type == "int"

    args["db_datatype"] = "int"

    type = get_datatype_mapping(**args)
    assert type == "int"

    args["db_datatype"] = "decimal"

    type = get_datatype_mapping(**args)
    assert type == "float"

    args["db_datatype"] = "numeric"

    type = get_datatype_mapping(**args)
    assert type == "float"

    args["db_datatype"] = "float"

    type = get_datatype_mapping(**args)
    assert type == "float"

    args["db_datatype"] = "double"

    type = get_datatype_mapping(**args)
    assert type == "float"

    args["db_datatype"] = "varchar"

    type = get_datatype_mapping(**args)
    assert type == "str"

    args["sdk_language"] = "Unknown"

    type = get_datatype_mapping(**args)
    assert type == "unknown"


def test_datatype_is_primitive():
    args = {
        "client_datatype": "boolean",
        "sdk_language": "TypeScript"
    }

    is_native = datatype_is_primitive(**args)
    assert is_native is True

    args["client_datatype"] = "number"

    is_native = datatype_is_primitive(**args)
    assert is_native is True

    args["client_datatype"] = "string"

    is_native = datatype_is_primitive(**args)
    assert is_native is True

    args["client_datatype"] = "Unknown"

    is_native = datatype_is_primitive(**args)
    assert is_native is False

    args["client_datatype"] = "bool"
    args["sdk_language"] = "Python"

    is_native = datatype_is_primitive(**args)
    assert is_native is True

    args["client_datatype"] = "float"

    is_native = datatype_is_primitive(**args)
    assert is_native is True

    args["client_datatype"] = "int"

    is_native = datatype_is_primitive(**args)
    assert is_native is True

    args["client_datatype"] = "str"

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


def test_substitute_imports_in_template():
    template = """// --- importLoopStart
import {
    // --- importRequiredDatatypesOnlyStart
    // --- importRequiredDatatypesOnlyEnd
} from "somewhere";
// --- importLoopEnd\n"""

    want = """import {
    foo,
} from "somewhere";\n"""

    res = substitute_imports_in_template(template, [], {"foo"}, "TypeScript")
    got = res.get("template")

    assert got == want

    want = """import {
    bar,
    foo,
} from "somewhere";\n"""

    res = substitute_imports_in_template(template, [], {"foo","bar"}, "TypeScript")
    got = res.get("template")

    assert got == want


def test_generate_interfaces():
    class_name = "Foo"
    db_obj = { "object_type": "TABLE" }
    obj = {}
    fields = []
    want = "type IFooCursors = never;\n\n"

    got, _ = generate_interfaces(db_obj, obj, fields, class_name, "TypeScript")

    assert got == want

    db_column = { "datatype": "varchar(3)", "not_null": True, "id_generation": "auto_inc" }
    fields = [{ "lev": 1, "enabled": True, "db_column": db_column, "name": "bar" }]
    want = """export type IFooData = {
    bar?: string,
} & IMrsResourceData;

export interface IFoo {
    bar?: string,
}

export interface IFooCursors {
    bar?: string,
}

"""

    got, _ = generate_interfaces(db_obj, obj, fields, class_name, "TypeScript")

    assert got == want

    want = '''class IFooDetails(IMrsResourceDetails):
    bar: str


class IFooData(TypedDict):
    bar: str


@dataclass(init=False, repr=True)
class IFoo(Record):

    # For data attributes, `None` means 'NULL' and
    # `UndefinedField` means 'not set or undefined'
    bar: str | UndefinedDataClassField

    def __init__(self, data: IFooData) -> None:
        """Actor data class."""
        self.__load_fields(data)

    def __load_fields(self, data: IFooData) -> None:
        """Refresh data fields based on the input data."""
        self.bar = data.get("bar", UndefinedField)

        for key in Record._reserved_keys:
            self.__dict__.update({key:data.get(key)})


IFooField: TypeAlias = Literal[
    "bar",
]


IFooNestedField: TypeAlias = None


class IFooSelectable(TypedDict, total=False):
    bar: bool


class IFooSortable(TypedDict, total=False):
    bar: Order


class IFooCursors(TypedDict, total=False):
    bar: StringField


'''

    got, _ = generate_interfaces(db_obj, obj, fields, class_name, "Python")

    assert got == want


def test_generate_field_enum():
    field_enum = generate_field_enum("Foo")
    assert field_enum == ""

    field_enum = generate_field_enum("Foo", ["bar"])
    assert field_enum == ""

    field_enum = generate_field_enum("Foo", ["bar"], "TypeScript")
    assert field_enum == ""

    field_enum = generate_field_enum("Foo", [], "Python")
    assert field_enum == "IFooField: TypeAlias = None\n\n\n"

    field_enum = generate_field_enum("Foo", None, "Python")
    assert field_enum == "IFooField: TypeAlias = None\n\n\n"

    field_enum = generate_field_enum("Foo", ["bar", "baz"], "Python")
    assert field_enum == """IFooField: TypeAlias = Literal[
    "bar",
    "baz",
]\n\n\n"""


def test_generate_type_declaration_field():
    type_declaration_field = generate_type_declaration_field("foo", "bar", "TypeScript")
    assert type_declaration_field == "    foo?: bar,\n"

    type_declaration_field = generate_type_declaration_field("foo", "bar", "Python")
    assert type_declaration_field == "    foo: bar\n"

    type_declaration_field = generate_type_declaration_field("foo", ["bar"], "TypeScript")
    assert type_declaration_field == "    foo?: bar[],\n"

    type_declaration_field = generate_type_declaration_field("foo", ["bar"], "Python")
    assert type_declaration_field == "    foo: list[bar]\n"

    type_declaration_field = generate_type_declaration_field("fooBar", "baz", "Python")
    assert type_declaration_field == "    foo_bar: baz\n"

    type_declaration_field = generate_type_declaration_field("fooBar", "baz", "Python", False)
    assert type_declaration_field == "    fooBar: baz\n"


def test_generate_type_declaration_placeholder():
    type_declaration_placeholder = generate_type_declaration_placeholder("Foo", "TypeScript")
    assert type_declaration_placeholder == "type IFoo = never;\n\n"

    type_declaration_placeholder = generate_type_declaration_placeholder("Foo", "Python")
    assert type_declaration_placeholder == "IFoo: TypeAlias = None\n\n\n"


def test_generate_type_declaration():
    type_declaration = generate_type_declaration("Foo")
    assert type_declaration == "export interface IFoo {\n}\n\n"

    type_declaration = generate_type_declaration("Foo", ["Bar", "Baz"])
    assert type_declaration == "export interface IFoo extends Bar, Baz {\n}\n\n"

    type_declaration = generate_type_declaration("Foo", ["Bar", "Baz"], {"qux":"quux"})
    assert type_declaration == ("export interface IFoo extends Bar, Baz {\n" +
                                "    qux?: quux,\n" +
                                "}\n\n")

    type_declaration = generate_type_declaration(name="Foo", parents=["Bar", "Baz"], sdk_language="Python")
    assert type_declaration == ("class IFoo(TypedDict, Bar, Baz, total=False):\n" +
                                "    pass\n\n\n")

    type_declaration = generate_type_declaration("Foo", ["Bar", "Baz"], {"qux":"quux"}, "Python")
    assert type_declaration == ("class IFoo(TypedDict, Bar, Baz, total=False):\n" +
                                "    qux: quux\n\n\n")


def test_generate_data_class():
    data_class = generate_data_class("Foobar", {"foo": "baz", "bar": "qux"}, "TypeScript")
    assert data_class == generate_type_declaration(name="Foobar", fields={"foo": "baz", "bar": "qux"},
                                                   sdk_language="TypeScript")

    data_class = generate_data_class("Foobar", {"foo": "baz", "barBaz": "qux"}, "Python")
    assert data_class == ("@dataclass(init=False, repr=True)\n" +
                          "class IFoobar(Record):\n\n" +
                          "    # For data attributes, `None` means 'NULL' and\n" +
                          "    # `UndefinedField` means 'not set or undefined'\n" +
                          "    foo: baz | UndefinedDataClassField\n" +
                          "    bar_baz: qux | UndefinedDataClassField\n\n" +
                          "    def __init__(self, data: IFoobarData) -> None:\n" +
                          '        """Actor data class."""\n' +
                          '        self.__load_fields(data)\n\n' +
                          "    def __load_fields(self, data: IFoobarData) -> None:\n" +
                          '        """Refresh data fields based on the input data."""\n' +
                          '        self.foo = data.get("foo", UndefinedField)\n' +
                          '        self.bar_baz = data.get("bar_baz", UndefinedField)\n\n' +
                          "        for key in Record._reserved_keys:\n" +
                          "            self.__dict__.update({key:data.get(key)})\n\n\n")


def test_generate_literal_type():
    literal = generate_literal_type(["foo", "bar"], "TypeScript")
    assert literal == '"foo" | "bar"'

    literal = generate_literal_type(["foo", "bar"], "Python")
    assert literal == """Literal[
    "foo",
    "bar",
]"""


def test_generate_selectable():
    selectable = generate_selectable("Foo", { "bar": "baz", "qux": "quux" }, "TypeScript")
    assert selectable == ""

    selectable = generate_selectable("Foo", { "bar": "baz", "qux": "quux" }, "Python")
    assert selectable == ("class IFooSelectable(TypedDict, total=False):\n" +
                          "    bar: bool\n" +
                          "    qux: bool\n\n\n")


def test_generate_sortable():
    sortable = generate_sortable("Foo", { "bar": "baz", "qux": "quux" }, "TypeScript")
    assert sortable == ""

    sortable = generate_sortable("Foo", { "bar": "baz", "qux": "quux" }, "Python")
    assert sortable == ("class IFooSortable(TypedDict, total=False):\n" +
                          "    bar: Order\n" +
                          "    qux: Order\n\n\n")


def test_generate_union():
    union = generate_union("Foo", ["Bar", "Baz"], "TypeScript")
    assert union == 'export type Foo = Bar | Baz;\n\n'

    union = generate_union("Foo", ["Bar", "Baz"], "Python")
    assert union == 'Foo: TypeAlias = Bar | Baz\n\n\n'
