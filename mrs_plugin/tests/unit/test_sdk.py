# Copyright (c) 2023, 2025, Oracle and/or its affiliates.
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
        "sdk_language": "typescript",
        "nullable": True,
    }

    type = get_interface_datatype(**args)
    assert type == "IMyEntityField"

    args["field"]["db_column"] = {
        "datatype": "varchar",
        "not_null": True
    }

    type = get_interface_datatype(**args)
    assert type == "string"

    args["sdk_language"] = "python"
    type = get_interface_datatype(**args)
    assert type == "str"

    args["field"]["db_column"] = {
        "datatype": "int",
        "not_null": False
    }
    args["sdk_language"] = "typescript"

    type = get_interface_datatype(**args)
    assert type == "MaybeNull<number>"

    args["sdk_language"] = "python"
    type = get_interface_datatype(**args)
    assert type == "Optional[int]"

    args["nullable"] = False
    type = get_interface_datatype(**args)
    assert type == "int"

    args["sdk_language"] = "Unknown"

    type = get_interface_datatype(**args)
    assert type == "unknown"


def test_get_datatype_mapping():
    datatype_map = {
        "typescript": {
            ("tinyint(1)", "bit(1)"): "boolean",
            (
                "tinyint",
                "smallint",
                "mediumint",
                "int",
                "decimal",
                "numeric",
                "float",
                "double",
            ): "number",
            ("json",): "JsonValue",
            ("GEOMETRY",): "Geometry",
            ("GEOMCOLLECTION",): "GeometryCollection",
            ("POINT",): "Point",
            ("MULTIPOINT",): "MultiPoint",
            ("LINESTRING",): "LineString",
            ("MULTILINESTRING",): "MultiLineString",
            ("POLYGON",): "Polygon",
            ("MULTIPOLYGON",): "MultiPolygon",
            ("varchar",): "string",
        },
        "python": {
            ("tinyint(1)", "bit(1)"): "bool",
            (
                "tinyint",
                "smallint",
                "mediumint",
                "int",
            ): "int",
            (
                "decimal",
                "numeric",
                "float",
                "double",
            ): "float",
            ("json",): "JsonValue",
            ("varchar",): "str",
            ("GEOMETRY",): "Geometry",
            ("GEOMCOLLECTION",): "GeometryCollection",
            ("POINT",): "Point",
            ("MULTIPOINT",): "MultiPoint",
            ("LINESTRING",): "LineString",
            ("MULTILINESTRING",): "MultiLineString",
            ("POLYGON",): "Polygon",
            ("MULTIPOLYGON",): "MultiPolygon",
            ("DATETIME", "TIMESTAMP"): "DateTime",
            ("DATE",): "Date",
            ("TIME",): "Time",
            ("YEAR",): "Year",
            ("VECTOR",): "Vector",
        },
        "Unknown": {
            ("varchar",): "unknown",
        }
    }

    for sdk_language, db_to_sdk_language_datatype_map in datatype_map.items():
        for db_datatypes, expected_sdk_language_datatype in db_to_sdk_language_datatype_map.items():
            for db_datatype in db_datatypes:
                assert expected_sdk_language_datatype == get_datatype_mapping(
                    db_datatype, sdk_language
                )


def test_datatype_is_primitive():
    args = {
        "client_datatype": "boolean",
        "sdk_language": "typescript"
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
    args["sdk_language"] = "python"
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

    args["client_datatype"] = "list"
    is_native = datatype_is_primitive(**args)
    assert is_native is True

    args["client_datatype"] = "tuple"
    is_native = datatype_is_primitive(**args)
    assert is_native is True

    args["client_datatype"] = "dict"
    is_native = datatype_is_primitive(**args)
    assert is_native is True

    args["client_datatype"] = "Unknown"
    is_native = datatype_is_primitive(**args)
    assert is_native is False

    # Feed an unknown SDK language
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

    res = substitute_imports_in_template(
        template=template, required_datatypes={"foo"}, sdk_language="typescript"
    )
    got = res.get("template")

    assert got == want

    want = """import {
    bar,
    foo,
} from "somewhere";\n"""

    res = substitute_imports_in_template(
        template=template, required_datatypes={"foo", "bar"}, sdk_language="typescript"
    )
    got = res.get("template")

    assert got == want

    template = """// --- importLoopStart
import {
    // --- importCreateOnlyStart
    foo,
    bar,
    // --- importCreateOnlyEnd
    // --- importUpdateOnlyStart
    baz,
    // --- importUpdateOnlyEnd
    // --- importReadOnlyStart
    qux,
    // --- importReadOnlyEnd
} from "somewhere";
// --- importLoopEnd\n"""

    want = """import {
    foo,
    bar,
    qux,
} from "somewhere";\n"""

    res = substitute_imports_in_template(
        template=template,
        enabled_crud_ops={"Read", "Create"},
        sdk_language="typescript",
    )
    got = res.get("template")

    assert got == want


def test_generate_function_interface():
    class_name = "MyServiceSakilaSumFuncParams"
    db_obj = {"object_type": "FUNCTION"}
    obj = {
        "id": b"\xbd\x07oC\x91\xaaI\xc4\xdf\xf2\xb7eJ56\xa0",
        "db_object_id": b"\x11\xefE\x1e\x8c\xc5\xc0\x01\xa9\xaa\n\x00'\x00\x00\t",
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

    db_object_crud_ops = ["FUNCTIONCALL"]
    obj_endpoint = "https://localhost:8443/myService/sakila/sumFunc"

    got, _ = generate_interfaces(
        db_obj, obj, fields, class_name, "python", db_object_crud_ops, obj_endpoint
    )

    want = """class IMyServiceSakilaSumFuncParams(TypedDict, total=False):
    b: int
    a: int
    """

    assert got.rstrip() == want.rstrip()


def test_generate_interfaces():
    class_name = "Foo"
    db_obj = {"object_type": "TABLE"}
    obj = {}
    fields = []
    db_object_crud_ops = ["READ"]

    db_column = {
        "datatype": "varchar(3)",
        "not_null": True,
        "id_generation": "auto_inc",
    }
    fields = [{"lev": 1, "enabled": True, "db_column": db_column, "name": "bar", "allow_sorting": True}]

    want = """export interface IFoo {
    bar?: string,
}

export type IFooSortable = ["bar"];

export interface IFooCursors {
    bar?: string,
}

"""

    got, _ = generate_interfaces(
        db_obj, obj, fields, class_name, "typescript", db_object_crud_ops
    )

    assert got == want

    db_object_crud_ops = ["CREATE", "READ", "UPDATE", "DELETE"]
    want = """export interface INewFoo {
    bar?: string,
}

export interface IUpdateFoo {
    bar: string,
}

export interface IFoo {
    bar?: string,
}

export type IFooSortable = ["bar"];

export interface IFooCursors {
    bar?: string,
}

"""

    got, _ = generate_interfaces(
        db_obj, obj, fields, class_name, "typescript", db_object_crud_ops
    )

    assert got == want

    obj_endpoint = "https://localhost:8443/myService/dummy/foo"
    obj_primary_key = None
    join_field_block = "    bar: str | UndefinedDataClassField"

    mixins = []
    if obj_primary_key:
        mixins.extend([
            f'\n\t_MrsDocumentUpdateMixin["I{class_name}Data", "I{class_name}", "I{class_name}Details"],',
            f'\n\t_MrsDocumentDeleteMixin["I{class_name}Data", "I{class_name}Filterable"],',
            "\n\t"
        ])

    want = """class I{name}Details(IMrsResourceDetails, total=False):
    bar: str


class I{name}Data(TypedDict, total=False):
    bar: str


class INew{name}(TypedDict, total=False):
    bar: str


class IUpdate{name}(TypedDict):
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


""".format(
        name=class_name,
        sdk_python_dataclass=SDK_PYTHON_DATACLASS_TEMPLATE.format(
            name=class_name,
            join_field_block=join_field_block,
            obj_endpoint=obj_endpoint,
            field_profile=(
                "{\n"
                + f"{" "*16}"
                + f",\n{" "*16}".join(['"bar": str']).rstrip()
                + f"\n{" "*12}"
                + "}"
            ),
            primary_key_name=(
                None if obj_primary_key is None else f'"{obj_primary_key}"'
            ),
            mixins="".join(mixins),
        ).rstrip(),
    )

    got, _ = generate_interfaces(
        db_obj,
        obj,
        fields,
        class_name,
        "python",
        db_object_crud_ops,
        obj_endpoint=obj_endpoint,
    )

    assert got == want

    # PROCEDUREs
    got, _ = generate_interfaces(
        db_obj={"object_type":"PROCEDURE"},
        obj={"kind":"RESULT"},
        fields=fields,
        class_name="Foo",
        db_object_crud_ops=["PROCEDURECALL"],
        sdk_language="typescript",
    )

    want = """export interface IFoo {
    bar?: string,
}

export type ITaggedFoo = {
    type: "Foo",
    items: IFoo[],
} & JsonObject;

"""

    assert got == want

    want = """public struct INewFoo: Encodable {
    public var bar: String? = nil
}

public class IFoo: MrsDocument, SelfUpdatable, SelfDeletable {
    public typealias DocumentType = IFoo
    public typealias ModelType = FooDatabaseObject

    public let bar: String?

    private enum CodingKeys: String, CodingKey {
        case bar
    }

    public required init(from decoder: any Decoder) throws {
        let container: KeyedDecodingContainer<CodingKeys> = try decoder.container(keyedBy: CodingKeys.self)
        self.bar = try container.decodeIfPresent(String.self, forKey: .bar)
        try super.init(from: decoder)
    }

    public override func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(bar, forKey: .bar)
    }

    public override func getPrimaryKeyName() -> String? {
        return self.bar == nil ? nil : [String(self.bar!)].joined(separator: ",")
    }
}

enum IFooSelectable: String, CaseIterable {
    case bar = "bar"
}

enum IFooSortable: String, CaseIterable {
    case bar = "bar"
}

public struct IFooUniqueFilterable {
    public var bar: String
}

public struct IFooCursors {
    public var bar: String
}

"""

    fields[0]["db_column"]["is_primary"] = True
    got, _ = generate_interfaces(
        db_obj, obj, fields, class_name, "swift", db_object_crud_ops
    )

    assert got == want


def test_generate_field_enum():
    field_enum = generate_field_enum("Foo")
    assert field_enum == ""

    field_enum = generate_field_enum("Foo", ["bar"])
    assert field_enum == ""

    field_enum = generate_field_enum("Foo", ["bar"], "typescript")
    assert field_enum == ""

    field_enum = generate_field_enum("Foo", [], "python")
    assert field_enum == "IFooField: TypeAlias = None\n\n\n"

    field_enum = generate_field_enum("Foo", None, "python")
    assert field_enum == "IFooField: TypeAlias = None\n\n\n"

    field_enum = generate_field_enum("Foo", ["bar", "baz"], "python")
    assert field_enum == """IFooField: TypeAlias = Literal[
    "bar",
    "baz",
]\n\n\n"""


def test_generate_type_declaration_field():
    type_declaration_field = generate_type_declaration_field(name="foo", value="bar", sdk_language="typescript")
    assert type_declaration_field == "    foo: bar,\n"

    type_declaration_field = generate_type_declaration_field(name="foo", value="bar", sdk_language="typescript", non_mandatory=True)
    assert type_declaration_field == "    foo?: bar,\n"

    type_declaration_field = generate_type_declaration_field(name="foo", value="bar", sdk_language="python")
    assert type_declaration_field == "    foo: bar\n"

    type_declaration_field = generate_type_declaration_field(name="foo", value="bar", sdk_language="python", non_mandatory=True)
    assert type_declaration_field == "    foo: NotRequired[bar]\n"

    type_declaration_field = generate_type_declaration_field(name="foo", value=["bar"], sdk_language="typescript")
    assert type_declaration_field == "    foo: bar[],\n"

    type_declaration_field = generate_type_declaration_field(name="foo", value=["bar"], sdk_language="typescript", non_mandatory=True)
    assert type_declaration_field == "    foo?: bar[],\n"

    type_declaration_field = generate_type_declaration_field(name="foo", value=["bar"], sdk_language="python")
    assert type_declaration_field == "    foo: list[bar]\n"

    type_declaration_field = generate_type_declaration_field(name="foo", value=["bar"], sdk_language="python", non_mandatory=True)
    assert type_declaration_field == "    foo: NotRequired[list[bar]]\n"

    # test that the language convention is being applied
    type_declaration_field = generate_type_declaration_field(name="fooBar", value="baz", sdk_language="python")
    assert type_declaration_field == "    foo_bar: baz\n"

    type_declaration_field = generate_type_declaration_field(name="fooBar", value="baz", sdk_language="python", non_mandatory=True)
    assert type_declaration_field == "    foo_bar: NotRequired[baz]\n"


def test_generate_type_declaration_placeholder():
    type_declaration_placeholder = generate_type_declaration_placeholder(
        name="Foo", sdk_language="typescript"
    )
    assert type_declaration_placeholder == "type IFoo = never;\n\n"

    type_declaration_placeholder = generate_type_declaration_placeholder(
        name="Foo", sdk_language="python"
    )
    assert type_declaration_placeholder == "IFoo: TypeAlias = None\n\n\n"

    type_declaration_placeholder = generate_type_declaration_placeholder(
        name="Foo", sdk_language="python", is_unpacked=False
    )
    assert type_declaration_placeholder == "IFoo: TypeAlias = None\n\n\n"

    type_declaration_placeholder = generate_type_declaration_placeholder(
        name="Foo", sdk_language="python", is_unpacked=True
    )
    assert type_declaration_placeholder == "class IFoo(TypedDict):\n    pass\n\n\n"


def test_generate_type_declaration():
    type_declaration = generate_type_declaration("Foo")
    assert type_declaration == ""

    type_declaration = generate_type_declaration("Foo", ["Bar", "Baz"])
    assert type_declaration == ""

    type_declaration = generate_type_declaration("Foo", ["Bar", "Baz"], {"qux": "quux"})
    assert type_declaration == (
        """export type IFoo = {
    qux: quux,
} & Bar & Baz;

"""
    )

    type_declaration = generate_type_declaration(
        "Foo", ["Bar", "Baz"], {"qux": "quux"}, "python"
    )
    assert type_declaration == (
        """class IFoo(TypedDict, Bar, Baz):
    qux: quux


"""
    )

    type_declaration = generate_type_declaration(
        name="Foo",
        fields={"bar": "baz", "qux": "quux"},
        sdk_language="python",
        non_mandatory_fields={"qux"},
    )
    assert type_declaration == (
        """class IFoo(TypedDict):
    bar: baz
    qux: NotRequired[quux]


"""
    )

    type_declaration = generate_type_declaration(
        name="Foo",
        parents=["Bar", "Baz"],
        fields={"qux": "quux"},
        ignore_base_types=True,
        sdk_language="python",
    )
    assert type_declaration == (
        """class IFoo(Bar, Baz):
    qux: quux


"""
    )

    fields = {"qux": "quux"}
    type_declaration = generate_type_declaration(
        name="Foo", fields=fields, non_mandatory_fields=set(fields)
    )
    assert type_declaration == (
        """export interface IFoo {
    qux?: quux,
}

"""
    )

    type_declaration = generate_type_declaration(
        name="Foo",
        fields=fields,
    )
    assert type_declaration == (
        """export interface IFoo {
    qux: quux,
}

"""
    )

    type_declaration = generate_type_declaration(
        name="Foo",
        fields=fields,
        non_mandatory_fields=set(fields),
        sdk_language="python",
    )
    assert type_declaration == (
        """class IFoo(TypedDict, total=False):
    qux: quux


"""
    )

    fields.update({"corge": "grault"})
    type_declaration = generate_type_declaration(
        name="Foo",
        fields=fields,
        sdk_language="python",
    )
    assert type_declaration == (
        """class IFoo(TypedDict):
    qux: quux
    corge: grault


"""
    )

    type_declaration = generate_type_declaration(
        name="Foo", fields=fields, non_mandatory_fields={"qux"}, sdk_language="python"
    )
    assert type_declaration == (
        """class IFoo(TypedDict):
    qux: NotRequired[quux]
    corge: grault


"""
    )

    type_declaration = generate_type_declaration(name="Foo", fields=[])
    assert type_declaration == ""

    type_declaration = generate_type_declaration(
        name="Foo", fields=[], requires_placeholder=True, sdk_language="typescript"
    )
    assert type_declaration == "type IFoo = never;\n\n"

    type_declaration = generate_type_declaration(
        name="Foo", fields=[], requires_placeholder=True, sdk_language="python"
    )
    assert type_declaration == "IFoo: TypeAlias = None\n\n\n"


def test_generate_data_class():
    # TypeScript
    fields = {"foo": "baz", "bar": "qux"}
    data_class = generate_data_class(
        "Foobar", fields, "typescript", ["CREATE", "READ", "UPDATE", "DELETE"]
    )
    assert data_class == generate_type_declaration(
        name="Foobar",
        fields=fields,
        sdk_language="typescript",
        non_mandatory_fields=set(fields),
    )

    # Python
    obj_endpoint = "https://localhost:8443/myService/dummy/foo"
    obj_primary_key = None
    join_field_block = (
        "    foo: baz | UndefinedDataClassField\n"
        + "    bar_baz: qux | UndefinedDataClassField"
    )

    test_cases_db_object_crud_ops = [
        [],
        ["UPDATE"],
        ["DELETE"],
        ["UPDATE", "DELETE"],
    ]
    name = "Foobar"
    for db_object_crud_ops in test_cases_db_object_crud_ops:
        for obj_prk_fields in [[], [], ["foo_id"], ["foo_id"], ["foo_id1", "foo_id2"]]:
            db_object_delete_op = []
            mixins = []

            if len(obj_prk_fields) > 0:
                if "UPDATE" in db_object_crud_ops:
                    mixins.append(
                        f'\n\t_MrsDocumentUpdateMixin["I{name}Data", "I{name}", "I{name}Details"],'
                    )
                if "DELETE" in db_object_crud_ops:
                    mixins.append(
                        f'\n\t_MrsDocumentDeleteMixin["I{name}Data", "I{name}Filterable"],'
                    )
                if mixins:
                    mixins.append("\n\t")

            data_class = generate_data_class(
                name,
                {"foo": "baz", "barBaz": "qux"},
                "python",
                db_object_crud_ops + db_object_delete_op,
                obj_endpoint=obj_endpoint,
                primary_key_fields=obj_prk_fields,
            )

            assert data_class == SDK_PYTHON_DATACLASS_TEMPLATE.format(
                name=name,
                join_field_block=join_field_block,
                obj_endpoint=obj_endpoint,
                field_profile=(
                    "{\n"
                    + f"{" "*16}"
                    + f",\n{" "*16}".join(['"foo": baz', '"bar_baz": qux']).rstrip()
                    + f"\n{" "*12}"
                    + "}"
                ),
                primary_key_name=f'"{','.join(obj_prk_fields)}"' if len(obj_prk_fields) > 0 else None,
                mixins="".join(mixins),
            )


def test_generate_literal_type():
    literal = generate_literal_type(["foo", "bar"], "typescript")
    assert literal == '"foo" | "bar"'

    literal = generate_literal_type(["foo", "bar"], "python")
    assert (
        literal
        == """Literal[
    "foo",
    "bar",
]"""
    )


def test_generate_selectable():
    selectable = generate_selectable("Foo", {"bar": "baz", "qux": "quux"}, "typescript")
    assert selectable == ""

    selectable = generate_selectable("Foo", {"bar": "baz", "qux": "quux"}, "python")
    assert selectable == (
        "class IFooSelectable(TypedDict, total=False):\n"
        + "    bar: bool\n"
        + "    qux: bool\n\n\n"
    )


def test_generate_sortable():
    sortable = generate_sortable("Foo", {"bar": "baz", "qux": "quux"}, "typescript")
    assert sortable == 'export type IFooSortable = ["bar", "qux"];\n\n'

    sortable = generate_sortable(name="Foo")
    assert sortable == "export type IFooSortable = [];\n\n"

    sortable = generate_sortable("Foo", {"bar": "baz", "qux": "quux"}, "python")
    assert sortable == (
        "class IFooSortable(TypedDict, total=False):\n"
        + "    bar: Order\n"
        + "    qux: Order\n\n\n"
    )

    sortable = generate_sortable(name="Foo", sdk_language="python")
    assert sortable == "IFooSortable: TypeAlias = None\n\n\n"


def test_generate_union():
    union = generate_union("Foo", ["Bar", "Baz"], "typescript")
    assert union == "export type Foo = Bar | Baz;\n\n"

    union = generate_union("Foo", ["Bar", "Baz"], "python")
    assert union == "Foo: TypeAlias = Bar | Baz\n\n\n"


def test_generate_sequence_constant():
    constant = generate_sequence_constant("Foo", ["Bar", "Baz"], "typescript")
    assert constant == 'const Foo = ["Bar", "Baz"] as const;\n'

    constant = generate_sequence_constant("Foo", ["Bar", "Baz"], "python")
    assert constant == 'Foo: Sequence = ["Bar", "Baz"]\n\n'


def test_field_is_required():
    obj = {"row_ownership_field_id": None}
    field = {
        "id": 42,
        "lev": 1,
        "db_column": {"not_null": True, "id_generation": None, "column_default": None},
    }
    is_required = field_is_required(field, obj)
    assert is_required == True

    field["db_column"]["not_null"] = False
    is_required = field_is_required(field, obj)
    assert is_required == False

    field["db_column"]["not_null"] = True
    field["db_column"]["id_generation"] = "auto_inc"
    is_required = field_is_required(field, obj)
    assert is_required == False

    field["db_column"]["not_null"] = True
    field["db_column"]["id_generation"] = None
    field["db_column"]["column_default"] = "CURRENT_TIMESTAMP"
    is_required = field_is_required(field, obj)
    assert is_required == False

    obj["row_ownership_field_id"] = 42
    field["db_column"]["id_generation"] = None
    field["db_column"]["column_default"] = None
    is_required = field_is_required(field, obj)
    assert is_required == False


def test_field_is_sortable():
    field = {}
    assert field_is_sortable(field) is False

    field["allow_sorting"] = True
    assert field_is_sortable(field) is True

    field["allow_sorting"] = False
    assert field_is_sortable(field) is False


def test_object_is_routine():
    assert object_is_routine({"object_type": "PROCEDURE"}) == True
    assert object_is_routine({"object_type": "FUNCTION"}) == True
    assert object_is_routine({"object_type": "SCRIPT"}) == True
    assert object_is_routine({"object_type": "VIEW"}) == False
    assert object_is_routine({"object_type": "TABLE"}) == False

    assert (
        object_is_routine({"object_type": "PROCEDURE"}, of_type={"PROCEDURE"}) == True
    )
    assert (
        object_is_routine(
            {"object_type": "PROCEDURE"}, of_type={"PROCEDURE", "FUNCTION"}
        )
        == True
    )
    assert (
        object_is_routine({"object_type": "PROCEDURE"}, of_type={"PROCEDURE", "SCRIPT"})
        == True
    )
    assert (
        object_is_routine(
            {"object_type": "PROCEDURE"}, of_type={"PROCEDURE", "FUNCTION", "SCRIPT"}
        )
        == True
    )
    assert (
        object_is_routine({"object_type": "PROCEDURE"}, of_type={"FUNCTION"}) == False
    )
    assert object_is_routine({"object_type": "PROCEDURE"}, of_type={"SCRIPT"}) == False
    assert (
        object_is_routine({"object_type": "PROCEDURE"}, of_type={"FUNCTION", "SCRIPT"})
        == False
    )


def test_generate_identifier():
    value = generate_identifier(value="foo", primitive="class", existing_identifiers=[])
    assert value == "Foo"

    value = generate_identifier(value="fooBar", primitive="class", existing_identifiers=[])
    assert value == "FooBar"

    value = generate_identifier(value="foo_bar", primitive="class", existing_identifiers=[])
    assert value == "FooBar"

    value = generate_identifier(value="foo", existing_identifiers=[])
    assert value == "foo"

    value = generate_identifier(value="foo_bar", existing_identifiers=[])
    assert value == "fooBar"

    value = generate_identifier(value="Foo", existing_identifiers=[])
    assert value == "foo"

    value = generate_identifier(value="fooBar", sdk_language="python", existing_identifiers=[])
    assert value == "foo_bar"

    value = generate_identifier(value="FooBar", sdk_language="python", existing_identifiers=[])
    assert value == "foo_bar"

    value = generate_identifier(value="/1", existing_identifiers=[])
    assert value == "_1"

    value = generate_identifier(value="/_1", existing_identifiers=[])
    assert value == "_1"

    existing_identifiers = ["_1"]
    value = generate_identifier(value="/_1", existing_identifiers=existing_identifiers)
    assert value == "_11"
    assert existing_identifiers == ["_1", "_1"]

    existing_identifiers = ["_1", "_1"]
    value = generate_identifier(value="/_1", existing_identifiers=existing_identifiers)
    assert value == "_12"
    assert existing_identifiers == ["_1", "_1", "_1"]


def test_generate_tuple():
    tup = generate_tuple(name="Foo", values={"bar", "baz"})
    assert tup == 'export type Foo = ["bar", "baz"];\n\n'

    tup = generate_tuple(name="Foo")
    assert tup == "export type Foo = [];\n\n"

    tup = generate_tuple(name="Foo", values={"bar", "baz"}, sdk_language="python")
    assert tup == 'Foo: TypeAlias = tuple[Literal["bar"], Literal["baz"]]\n\n\n'

    tup = generate_tuple(name="Foo", sdk_language="python")
    assert tup == "Foo: TypeAlias = tuple[()]\n\n\n"


def test_get_top_level_keywords():
    keywords = get_top_level_keywords()
    assert keywords == ["authenticate", "deauthenticate", "getAuthApps", "getMetadata"]

    keywords = get_top_level_keywords(resource="schema")
    assert keywords == ["getMetadata"]

    keywords = get_top_level_keywords(resource="object")
    assert keywords == ["getMetadata"]

    keywords = get_top_level_keywords(resource="service", sdk_language="python")
    assert keywords == ["authenticate", "deauthenticate", "get_auth_apps", "get_metadata"]

    keywords = get_top_level_keywords(resource="schema", sdk_language="python")
    assert keywords == ["get_metadata"]

    keywords = get_top_level_keywords(resource="object", sdk_language="python")
    assert keywords == ["get_metadata"]

