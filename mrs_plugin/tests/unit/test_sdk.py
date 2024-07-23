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


def test_generate_function_interface():
    class_name = "MyServiceSakilaSumFuncResult"
    db_obj = {"object_type": "FUNCTION"}
    obj = {
        "id": b"\xbd\x07oC\x91\xaaI\xc4\xdf\xf2\xb7eJ56\xa0",
        "db_object_id": b"\x11\xefE\x1e\x8c\xc5\xc0\x01\xa9\xaa\n\x00'\x00\x00\t",
        "name": "MyServiceSakilaSumFuncParams",
        "kind": "PARAMETERS",
        "position": 0,
        "sdk_options": None,
        "comments": None,
    }
    fields = [
        {
            "caption": "- b",
            "lev": 1,
            "position": 2,
            "id": b"=]\x0e}\xac~C\r\xdd\xfcv\xef\x0c|\x95\x1d",
            "represents_reference_id": None,
            "parent_reference_id": None,
            "object_id": b"\xbd\x07oC\x91\xaaI\xc4\xdf\xf2\xb7eJ56\xa0",
            "name": "b",
            "db_column": {
                "in": True,
                "out": False,
                "name": "b",
                "datatype": "int",
                "not_null": True,
                "is_unique": False,
                "is_primary": False,
                "is_generated": False,
            },
            "enabled": True,
            "allow_filtering": True,
            "allow_sorting": False,
            "no_check": False,
            "no_update": False,
            "sdk_options": None,
            "comments": None,
            "object_reference": None,
        },
        {
            "caption": "- a",
            "lev": 1,
            "position": 1,
            "id": b"\xb7\xd6H<\xdd\x03F\xeb\xae\x93VK6\xdb\x9e\xb9",
            "represents_reference_id": None,
            "parent_reference_id": None,
            "object_id": b"\xbd\x07oC\x91\xaaI\xc4\xdf\xf2\xb7eJ56\xa0",
            "name": "a",
            "db_column": {
                "in": True,
                "out": False,
                "name": "a",
                "datatype": "int",
                "not_null": True,
                "is_unique": False,
                "is_primary": False,
                "is_generated": False,
            },
            "enabled": True,
            "allow_filtering": True,
            "allow_sorting": False,
            "no_check": False,
            "no_update": False,
            "sdk_options": None,
            "comments": None,
            "object_reference": None,
        },
    ]

    db_object_crud_ops = ["READFUNCTION"]
    obj_endpoint = "https://localhost:8444/myService/sakila/sumFunc"

    got, _ = generate_interfaces(
        db_obj, obj, fields, class_name, "Python", db_object_crud_ops, obj_endpoint
    )


    want = """class IMyServiceSakilaSumFuncResult(TypedDict, total=True):
    b: int
    a: int
    """

    assert got.rstrip() == want.rstrip()


def test_generate_interfaces():
    class_name = "Foo"
    db_obj = { "object_type": "TABLE" }
    obj = {}
    fields = []
    want = "type IFooCursors = never;\n\n"
    db_object_crud_ops = ["CREATE", "READ", "UPDATE", "DELETE"]

    got, _ = generate_interfaces(db_obj, obj, fields, class_name, "TypeScript", db_object_crud_ops)

    assert got == want

    db_column = { "datatype": "varchar(3)", "not_null": True, "id_generation": "auto_inc"}
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

    got, _ = generate_interfaces(db_obj, obj, fields, class_name, "TypeScript", db_object_crud_ops)

    assert got == want

    obj_endpoint = "https://localhost:8444/myService/dummy/foo"
    obj_primary_key = None
    join_field_block = "    bar: str | UndefinedDataClassField"
    join_assignment_block = '        self.bar = data.get("bar", UndefinedField)'
    update_snippet = SDK_PYTHON_DATACLASS_TEMPLATE_SAVE_UPDATE.format(name=class_name)
    create_snippet = SDK_PYTHON_DATACLASS_TEMPLATE_SAVE_CREATE.format(name=class_name)
    save_method = SDK_PYTHON_DATACLASS_TEMPLATE_SAVE.format(
        create_snippet=create_snippet,
        update_snippet=update_snippet,
    )
    delete_method = SDK_PYTHON_DATACLASS_TEMPLATE_DELETE.format(name=class_name) if obj_primary_key else ""
    if save_method and delete_method:
        delete_method = " "*4 + delete_method.lstrip()

    want = '''class I{name}Details(IMrsResourceDetails):
    bar: str


class I{name}Data(TypedDict):
    bar: NotRequired[str]


class I{name}DataCreate(TypedDict):
    bar: NotRequired[str]


class I{name}DataUpdate(TypedDict):
    bar: str


{sdk_python_dataclass}


I{name}Field: TypeAlias = Literal[
    "bar",
]


I{name}NestedField: TypeAlias = None


class I{name}Selectable(TypedDict, total=False):
    bar: bool


class I{name}Sortable(TypedDict, total=False):
    bar: Order


class I{name}Cursors(TypedDict, total=False):
    bar: StringField


'''.format(
    name=class_name,
    sdk_python_dataclass=SDK_PYTHON_DATACLASS_TEMPLATE.format(
        name=class_name,
        join_field_block=join_field_block,
        obj_endpoint=obj_endpoint,
        join_assignment_block=join_assignment_block,
        primary_key_name=(None if obj_primary_key is None else f'"{obj_primary_key}"'),
        save_method=save_method,
        delete_method=delete_method,
    ).rstrip()
)

    got, _ = generate_interfaces(
        db_obj,
        obj,
        fields,
        class_name,
        "Python",
        db_object_crud_ops,
        obj_endpoint=obj_endpoint
        )

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
    assert type_declaration == ("IFoo: TypeAlias = None\n\n\n")

    type_declaration = generate_type_declaration("Foo", ["Bar", "Baz"], {"qux":"quux"}, "Python")
    assert type_declaration == ("class IFoo(TypedDict, Bar, Baz, total=False):\n" +
                                "    qux: quux\n\n\n")


def test_generate_data_class():

    # TypeScript
    data_class = generate_data_class(
        "Foobar", {"foo": "baz", "bar": "qux"}, "TypeScript", ["CREATE", "READ", "UPDATE", "DELETE"]
    )
    assert data_class == generate_type_declaration(
        name="Foobar", fields={"foo": "baz", "bar": "qux"}, sdk_language="TypeScript"
    )

    # Python
    obj_endpoint = "https://localhost:8444/myService/dummy/foo"
    obj_primary_key = None
    join_field_block = (
        "    foo: baz | UndefinedDataClassField\n"
        + "    bar_baz: qux | UndefinedDataClassField"
    )
    join_assignment_block = (
        '        self.foo = data.get("foo", UndefinedField)\n'
        + '        self.bar_baz = data.get("bar_baz", UndefinedField)'
    )

    permutations = [
        ("", "", []),
        (
            SDK_PYTHON_DATACLASS_TEMPLATE_SAVE_UPDATE.format(name="Foobar"),
            "",
            ["UPDATE"],
        ),
        (
            "",
            SDK_PYTHON_DATACLASS_TEMPLATE_SAVE_CREATE.format(name="Foobar"),
            ["CREATE"],
        ),
        (
            SDK_PYTHON_DATACLASS_TEMPLATE_SAVE_UPDATE.format(name="Foobar"),
            SDK_PYTHON_DATACLASS_TEMPLATE_SAVE_CREATE.format(name="Foobar"),
            ["UPDATE", "CREATE"],
        ),
    ]

    for update_snippet, create_snippet, db_object_crud_ops in permutations:
        for obj_prk, add_delete in [(None, False), (None, True), ("foo_id", True), ("foo_id", False)]:
            save_method = ""
            delete_method = ""
            db_object_delete_op = []

            if update_snippet or create_snippet:
                save_method = SDK_PYTHON_DATACLASS_TEMPLATE_SAVE.format(
                    create_snippet=create_snippet,
                    update_snippet=update_snippet,
                )
            if add_delete and obj_prk:
                delete_method = SDK_PYTHON_DATACLASS_TEMPLATE_DELETE.format(name="Foobar")
                db_object_delete_op.append("DELETE")
                if save_method:
                    delete_method = " "*4 + delete_method.lstrip()

            data_class = generate_data_class(
                "Foobar",
                {"foo": "baz", "barBaz": "qux"},
                "Python",
                db_object_crud_ops+db_object_delete_op,
                obj_endpoint=obj_endpoint,
                obj_primary_key=obj_prk,
            )

            assert data_class == SDK_PYTHON_DATACLASS_TEMPLATE.format(
                name="Foobar",
                join_field_block=join_field_block,
                obj_endpoint=obj_endpoint,
                join_assignment_block=join_assignment_block,
                primary_key_name=f'"{obj_prk}"' if obj_prk is not None else obj_prk,
                save_method=save_method,
                delete_method=delete_method
            ) + ("" if save_method or delete_method else "\n\n")


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
