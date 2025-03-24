# Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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
"""Core logic for the MRS Python SDK is implemented in this module."""

from __future__ import annotations

import asyncio
import base64
import datetime
import hashlib
import hmac
import json
import random
import re
import ssl
from abc import ABC, abstractmethod
from collections.abc import Iterable
from dataclasses import asdict, dataclass
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Generic,
    Literal,
    Mapping,
    NotRequired,
    Optional,
    Required,
    Sequence,
    TypeAlias,
    TypeAliasType,
    TypedDict,
    TypeVar,
    Union,
    Unpack,
    cast,
)
import typing
from urllib.parse import urlencode, quote
from urllib.request import HTTPError, Request, urlopen


####################################################################################
#                                Utility Classes
####################################################################################
class _Singleton:
    """A single pointer of this class is guaranteed to exits at any given time.
    In other words, all existing instances point to the same memory address.
    """

    def __new__(cls):
        """Singleton."""
        if not hasattr(cls, "instance"):
            cls.instance = super(_Singleton, cls).__new__(cls)
        return cls.instance

    def __repr__(self):
        """What is seen when printed onto console."""
        return "<singleton>"


class UndefinedDataClassField(_Singleton):
    """Class representing a special symbol used for undefined or 'never set'
    data class fields.

    A single pointer of this class is guaranteed to exits at any given time.
    In other words, all existing instances point to the same memory address.
    """

    def __repr__(self):
        return "<undef>"  # undefined field


####################################################################################
#                       MRS Python SDK Exceptions
####################################################################################
class MrsError(Exception):
    """Base class for `MySQL Rest Service` errors."""

    _default_msg = "MRS Error"

    def __init__(self, *args: object, msg: Optional[str] = None) -> None:
        """MRS Error."""
        if msg is None:
            msg = self._default_msg
        super().__init__(msg, *args)


class MrsDocumentNotFoundError(MrsError):
    """Raised when a document doesn't exist in the database."""

    _default_msg = "No document exists matching the query options"


class AuthenticationError(MrsError):
    """Raised when something goes wrong during authentication."""

    _default_msg = "Authentication failed"


class DeauthenticationError(MrsError):
    """Raised when something goes wrong during deauthentication."""

    _default_msg = "Deauthentication failed"


####################################################################################
#                          Client-side representations
####################################################################################
# pylint: disable=too-few-public-methods
# JSON data type
JsonPrimitive = bool | float | int | str | None
JsonObject = Mapping[str, "JsonValue"]
JsonArray = list["JsonValue"]
JsonValue = JsonPrimitive | JsonObject | JsonArray

# Spatial data type
Position = list[float] | tuple[float, float]  # two dimensional vector
TwoOrMorePositions: TypeAlias = list[Position]  # two or more positions
LinearRing: TypeAlias = list[Position]  # four or more positions
LinearRings: TypeAlias = list[LinearRing]


class Point(TypedDict):
    """Stores a MySQL single X and Y coordinate value.

    Example:
    ```
    POINT(-74.044514 40.689244)
    ```
    """

    type: Literal["Point"]
    coordinates: Position


class LineString(TypedDict):
    """Stores a set of points that form a curve. An ordered list of
    points connected by edges.

    Example:
    ```
    LINESTRING(0 0, 0 1, 1 1)
    ```
    """

    type: Literal["LineString"]
    coordinates: TwoOrMorePositions


class Polygon(TypedDict):
    """Stores a set of points in a multi-sided geometry. Similar to a
    linestring, but closed (must have at least three unique points,
    and the first and last point-pairs must be equal).

    Example:
    ```
    POLYGON((0 0, 10 0, 10 10, 0 10, 0 0), (5 5, 7 5, 7 7, 5 7, 5 5))
    ```
    """

    type: Literal["Polygon"]
    coordinates: LinearRings


Geometry = Point | LineString | Polygon
"""Stores any type of geometry value. It is a `noninstantiable` class
but has a number of properties common to all geometry values.

See `Geometry` class hierarchy:
https://dev.mysql.com/doc/refman/8.4/en/gis-geometry-class-hierarchy.html
"""


class MultiPoint(TypedDict):
    """Stores a set of multiple point values.

    Example:
    ```
    MULTIPOINT(0 0, 20 20, 60 60)
    ```
    """

    type: Literal["MultiPoint"]
    coordinates: list[Position]


class MultiLineString(TypedDict):
    """Stores a set of multiple LINESTRING values.

    Example:
    ```
    MULTILINESTRING((10 10, 20 20), (15 15, 30 15))
    ```
    """

    type: Literal["MultiLineString"]
    coordinates: list[TwoOrMorePositions]


class MultiPolygon(TypedDict):
    """Stores a set of multiple POLYGON values.

    Example:
    ```
    MULTIPOLYGON(((0 0,10 0,10 10,0 10,0 0)),((5 5,7 5,7 7,5 7, 5 5)))
    ```
    """

    type: Literal["MultiPolygon"]
    coordinates: list[LinearRings]


GeometryCollectionSubClass = MultiPoint | MultiLineString | MultiPolygon


class GeometryCollectionBaseClass(TypedDict):
    """`GeometryCollection` is an `instantiable` class.

    Note that if a column is of type `GEOMETRYCOLLECTION` with value:
    ```
    mysql> GEOMETRYCOLLECTION(POINT(10 10), POINT(30 30), LINESTRING(15 15, 20 20))
    ```

    Router sends:
    ```
    {
        "type": "GeometryCollection",
        "geometries": [
            {"type": "Point", "coordinates": [10.0, 10.0]},
            {"type": "Point", "coordinates": [30.0, 30.0]},
            {"type": "LineString", "coordinates": [[15.0, 15.0], [20.0, 20.0]]},
        ],
    }
    ```

    This structure differs from subclasses.

    Furthermore, a `GeometryCollection` can hold multiple geometries, including
    other `GeometryCollections`, a.k.a. nesting capability.
    """

    type: Literal["GeometryCollection"]
    geometries: list[Geometry | GeometryCollection]


GeometryCollection = GeometryCollectionBaseClass | GeometryCollectionSubClass
"""Stores a set of multiple GEOMETRY values. It is an `instantiable` class.

Note that MySQL does NOT support empty GeometryCollections
except for the single GeometryCollection object itself.

See `GeometryCollection` class hierarchy:
https://dev.mysql.com/doc/refman/8.4/en/gis-geometry-class-hierarchy.html

Example:
```
GEOMETRYCOLLECTION(POINT(10 10), POINT(30 30), LINESTRING(15 15, 20 20))
```
"""


# Date and Time data type"
# These aliases are instances of 'typing.TypeAliasType'
type Date = datetime.date
"""Type alias object (instance of `typing.TypeAliasType`) identifying
the client-side counterpart of MySQL DATE data type."""
type DateTime = datetime.datetime
"""Type alias object (instance of `typing.TypeAliasType`) identifying
the client-side counterpart of MySQL DATETIME and TIMESTAMP data types."""
type Time = datetime.timedelta
"""Type alias object (instance of `typing.TypeAliasType`) identifying
the client-side counterpart of MySQL TIME data type."""
type Year = int
"""Type alias object (instance of `typing.TypeAliasType`) identifying
the client-side counterpart of MySQL YEAR data type."""
type DateOrTime = Date | DateTime | Time | Year
"""Type alias object (instance of `typing.TypeAliasType`) identifying
Client Date and Time data types."""
type JsonFormattableDateOrTime = Date | DateTime | Time
"""Type alias object (instance of `typing.TypeAliasType`) identifying
Client Date and Time data types that should convert to JSON formattable
values before using them in an HTTP request."""


# Misc types
UndefinedField = UndefinedDataClassField()

Data = TypeVar("Data", bound=Mapping)
DataClass = TypeVar("DataClass", bound="MrsDocument")
DataDetails = TypeVar("DataDetails", bound="IMrsResourceDetails")
Filterable = TypeVar("Filterable", bound=Optional[Mapping])
UniqueFilterable = TypeVar("UniqueFilterable", bound=Optional[Mapping])
Selectable = TypeVar("Selectable", bound=Optional[Mapping | Sequence])
Sortable = TypeVar("Sortable", bound=Optional[Mapping])
Cursors = TypeVar("Cursors", bound=Optional[Mapping])


EqOperand = TypeVar("EqOperand", bound=str | int | float | DateOrTime)
NeqOperand = TypeVar("NeqOperand", bound=str | int | float | DateOrTime)
NotOperator = TypedDict("NotOperator", {"not": None})
PatternOperand = TypeVar("PatternOperand", bound=str)
RangeOperand = TypeVar(
    "RangeOperand",
    bound=int | float | datetime.datetime | datetime.date | datetime.timedelta,
)


DataField = TypeVar("DataField", bound=Optional[str])
NestedField = TypeVar("NestedField", bound=Optional[str])

ProgressCallback: TypeAlias = Callable[[list[Data]], None]
Order: TypeAlias = Literal["ASC", "DESC"]

VarTypeHintStruct = TypeVar("VarTypeHintStruct", bound=Mapping)
IMrsRoutineResponse = TypeVar("IMrsRoutineResponse", bound=Any)
IMrsRoutineInParameters = TypeVar("IMrsRoutineInParameters", bound=Mapping)
IMrsProcedureOutParameters = TypeVar(
    "IMrsProcedureOutParameters", bound=Optional[Mapping]
)
IMrsProcedureResultSet = TypeVar(
    "IMrsProcedureResultSet", bound="MrsProcedureResultSet"
)
ResultSetType = TypeVar("ResultSetType", bound=str)
ResultSetItem = TypeVar("ResultSetItem", bound=Mapping)
ResultSetDetails = TypeVar("ResultSetDetails", bound=Mapping)
IMrsFunctionResult = TypeVar(
    "IMrsFunctionResult", bound=str | int | float | bool | JsonValue | "DateOrTime"
)


class AuthApp(TypedDict):
    name: str
    vendor_id: str


type AuthApps = list[AuthApp]


####################################################################################
#                              REST Documents
####################################################################################
@dataclass
class MrsDocumentBase(ABC):
    """Data classes produced by the SDK generator inherit from this base class.

    Relevant dunder methods are customized to achieve the wanted behavior where
    hypermedia-related information remains hidden and inaccessible publicly.

    This base class is not instantiable.
    """

    _reserved_keys = ("_reserved_keys", "_metadata", "links")

    if not TYPE_CHECKING:

        def __getattribute__(self, name: str) -> Any:
            """Hypermedia-related fields cannot be accessed."""
            if name in MrsDocumentBase._reserved_keys:
                raise AttributeError(
                    f"'{type(self).__name__}' object has no attribute '{name}'"
                )
            return super().__getattribute__(name)

        def __setattr__(self, name: str, value: Any) -> None:
            """Hypermedia-related fields cannot be modified."""
            if name in MrsDocumentBase._reserved_keys:
                raise AttributeError(
                    f"Attribute '{name}' of '{type(self).__name__}' object cannot be changed."
                )
            super().__setattr__(name, value)

        def __delattr__(self, name: str) -> None:
            """Hypermedia-related fields cannot be deleted."""
            if name in MrsDocumentBase._reserved_keys:
                raise AttributeError(
                    f"Attribute '{name}' of '{type(self).__name__}' object cannot be deleted."
                )
            super().__delattr__(name)

    def __dir__(self) -> Iterable[str]:
        """Hypermedia-related fields should be hidden."""
        return [
            key
            for key in super().__dir__()
            if key not in MrsDocumentBase._reserved_keys
        ]


class MrsDocument(Generic[Data], MrsDocumentBase):
    """Data classes (representing table records) produced by the SDK
    generator inherit from base class.

    Relevant dunder methods are customized to achieve the wanted behavior where
    hypermedia-related information remains hidden and inaccessible publicly.

    This base class is not instantiable.
    """

    def __init__(
        self,
        schema: MrsBaseSchema,
        data: Data,
        fields_map: dict[str, TypeAlias],
        obj_endpoint: str = "",
    ) -> None:
        """MRS REST Document.

        Args:
            schema: REST schema object from what the REST document is grouped under.
            data: JSON-like structure storing the field values.
            fields_map: A map relating each field name to its corresponding
                field type (client-side).
            obj_endpoint: URI of resource.
        """
        self._schema: MrsBaseSchema = schema
        self._request_path: str = obj_endpoint

        self._load_fields(data, fields_map)

    def _load_fields(self, data: Data, fields_map: dict[str, TypeAlias]) -> None:
        """Refresh data fields based on the input data."""
        for field_name, field_hint in fields_map.items():
            setattr(
                self,
                field_name,
                MrsJSONDataDecoder.convert_field_value(
                    data.get(field_name, UndefinedField), dst_type=field_hint
                ),
            )

        for key in MrsDocumentBase._reserved_keys:
            self.__dict__.update({key: data.get(key)})

    @classmethod
    @abstractmethod
    def get_primary_key_name(cls) -> Optional[str]:
        """Get primary key name.

        Returns:
            `str` when there is a primary key, `None` otherwise.
        """


class _MrsDocumentUpdateMixin(Generic[Data, DataClass, DataDetails], MrsDocument[Data]):
    """Adds the `update()` command to REST Document API."""

    async def update(self) -> None:
        """Update a resource represented by the data class instance."""
        prk_name = cast(str, self.get_primary_key_name())
        rest_document_id = getattr(self, prk_name)

        await MrsBaseObjectUpdate[DataClass, DataDetails](
            schema=self._schema,
            request_path=f"{self._request_path}/{rest_document_id}",
            data=cast(DataClass, self),
        ).submit()


class _MrsDocumentDeleteMixin(Generic[Data, Filterable], MrsDocument[Data]):
    """Adds the `delete()` command to REST Document API."""

    async def delete(self, read_own_writes: bool = False) -> None:
        """Deletes the resource represented by the data class instance."""
        prk_name = cast(str, self.get_primary_key_name())
        rest_document_id = getattr(self, prk_name)
        options = {
            "where": {prk_name: rest_document_id},
            "read_own_writes": read_own_writes,
        }

        _ = await MrsBaseObjectDelete[Filterable](
            schema=self._schema,
            request_path=self._request_path,
            options=cast(DeleteOptions, options),
        ).submit()


####################################################################################
#                                MRS Protocol
####################################################################################
class MrsResourceLink(TypedDict):
    """Available keys for the `links` field."""

    rel: str
    href: str


class MrsTransactionalMetadata(TypedDict, total=False):
    """Metadata associated with transactions."""

    gtid: str


class MrsResourceMetadata(MrsTransactionalMetadata, total=False):
    """Available keys for the `_metadata` field."""

    etag: str


class IMrsResourceDetails(TypedDict):
    """Available hypermedia and metadata fields in payloads."""

    _metadata: MrsResourceMetadata
    links: list[MrsResourceLink]


class IMrsResourceCollectionData(TypedDict):
    """Available fields in result sets."""

    items: list[IMrsResourceDetails]
    limit: int
    offset: int
    has_more: bool
    count: int
    links: list[MrsResourceLink]


class IMrsDeleteResponse(TypedDict, total=False):
    """Response got by a delete operation"""

    items_deleted: Required[int]
    _metadata: MrsResourceMetadata


class IMrsFunctionResponse(Generic[IMrsFunctionResult], TypedDict):
    """Response got by invoking/calling a MySQL function."""

    result: IMrsFunctionResult
    _metadata: NotRequired[MrsTransactionalMetadata]


class FunctionResponseTypeHintStruct(TypedDict):
    """Structure storing key information to convert the value of a function response.

    - result: A type alias.
    """

    result: TypeAlias


class ProcedureResponseTypeHintStruct(TypedDict):
    """Structure storing key information to convert fields values of a procedure response.

    - out_parameters: A `typing.TypedDict` type alias.
    - result_sets: A dictionary which key is a `str` and value a `typing.TypedDict` type alias.
    """

    out_parameters: TypeAlias
    result_sets: Optional[dict[str, TypeAlias]]


class IMrsProcedureResponseDetails(
    Generic[IMrsProcedureOutParameters, IMrsProcedureResultSet], TypedDict
):
    result_sets: list[dict]
    out_parameters: dict
    _metadata: NotRequired[MrsTransactionalMetadata]


@dataclass(init=False, repr=True)
class IMrsProcedureResponse(
    Generic[IMrsProcedureOutParameters, IMrsProcedureResultSet], MrsDocumentBase
):

    result_sets: list[IMrsProcedureResultSet]
    out_parameters: IMrsProcedureOutParameters

    def __init__(
        self,
        data: IMrsProcedureResponseDetails[
            IMrsProcedureOutParameters, IMrsProcedureResultSet
        ],
        type_hint_struct: ProcedureResponseTypeHintStruct,
    ) -> None:
        """Procedure response dataclass."""
        self.result_sets = [
            MrsProcedureResultSet[str, Any, Any](  # type: ignore[misc]
                result_set,
                typed_dict=(type_hint_struct["result_sets"] or {}).get(
                    result_set["type"]
                ),
            )
            for result_set in data["result_sets"]
        ]
        self.out_parameters = (
            MrsDataDownstreamConverter.convert_obj_fields_from_typed_dict(
                data["out_parameters"], typed_dict=type_hint_struct["out_parameters"]
            )
        )

        for key in MrsDocumentBase._reserved_keys:
            self.__dict__.update({key: data.get(key)})


@dataclass(init=False, repr=True)
class MrsProcedureResultSet(
    Generic[ResultSetType, ResultSetItem, ResultSetDetails], MrsDocumentBase
):

    type: ResultSetType
    items: list[ResultSetItem]

    def __init__(
        self,
        data: ResultSetDetails,
        typed_dict: Optional[TypeAlias] = None,
    ) -> None:
        """Procedure result-set response dataclass."""
        self.type = data["type"]
        self.items = [
            (
                item
                if typed_dict is None  # If result set is untyped. Let's skip conversion
                else MrsDataDownstreamConverter.convert_obj_fields_from_typed_dict(
                    obj=item,
                    typed_dict=typed_dict,
                )
            )
            for item in data["items"]
        ]

        for key in MrsDocumentBase._reserved_keys:
            self.__dict__.update({key: data.get(key)})


class AuthenticateOptions(TypedDict):
    app: str
    user: str
    password: NotRequired[str]
    vendor_id: NotRequired[Optional[str]]


class MrsBaseSession(TypedDict, total=False):
    access_token: Optional[str]
    gtid: Optional[str]


class IMrsTokenBasedAuthenticationResponse(TypedDict):
    access_token: str


class IMrsAuthenticationStartResponse(TypedDict):
    nonce: str
    iterations: int
    salt: list[int] | bytes
    session: NotRequired[str]


class EqOperator(Generic[EqOperand], TypedDict):
    """Equal."""

    equals: EqOperand


class NeqOperator(Generic[NeqOperand], TypedDict):
    """Not Equal."""

    ne: NeqOperand


class GtOperator(Generic[RangeOperand], TypedDict):
    """Greater than."""

    gt: RangeOperand


class GteOperator(Generic[RangeOperand], TypedDict):
    """Greater than or equal."""

    gte: RangeOperand


class LtOperator(Generic[RangeOperand], TypedDict):
    """Lower than."""

    lt: RangeOperand


class LteOperator(Generic[RangeOperand], TypedDict):
    """Lower than or equal."""

    lte: RangeOperand


class PatternOperator(Generic[PatternOperand], TypedDict):
    """`like` operator"""

    like: PatternOperand


IntField: TypeAlias = (
    int
    | EqOperator[int]
    | NeqOperator[int]
    | GtOperator[int]
    | GteOperator[int]
    | LtOperator[int]
    | LteOperator[int]
    | NotOperator
)
FloatField: TypeAlias = (
    float
    | EqOperator[float]
    | NeqOperator[float]
    | GtOperator[float]
    | GteOperator[float]
    | LtOperator[float]
    | LteOperator[float]
    | NotOperator
)
StringField: TypeAlias = (
    str | EqOperator[str] | NeqOperator[str] | PatternOperator[str] | NotOperator
)
BoolField: TypeAlias = bool | EqOperator[bool] | NeqOperator[bool] | NotOperator

DateTimeField: TypeAlias = (
    datetime.datetime
    | EqOperator[datetime.datetime]
    | NeqOperator[datetime.datetime]
    | GtOperator[datetime.datetime]
    | GteOperator[datetime.datetime]
    | LtOperator[datetime.datetime]
    | LteOperator[datetime.datetime]
    | NotOperator
)
DateField: TypeAlias = (
    datetime.date
    | EqOperator[datetime.date]
    | NeqOperator[datetime.date]
    | GtOperator[datetime.date]
    | GteOperator[datetime.date]
    | LtOperator[datetime.date]
    | LteOperator[datetime.date]
    | NotOperator
)
TimeField: TypeAlias = (
    datetime.timedelta
    | EqOperator[datetime.timedelta]
    | NeqOperator[datetime.timedelta]
    | GtOperator[datetime.timedelta]
    | GteOperator[datetime.timedelta]
    | LtOperator[datetime.timedelta]
    | LteOperator[datetime.timedelta]
    | NotOperator
)
YearField: TypeAlias = (
    int
    | EqOperator[int]
    | NeqOperator[int]
    | GtOperator[int]
    | GteOperator[int]
    | LtOperator[int]
    | LteOperator[int]
    | NotOperator
)


class HighOrderOperator(Generic[Filterable], TypedDict, total=False):
    """Set-related operations supported when adding a filter (`where` option)
    to a query."""

    AND: list[Union[Filterable, HighOrderOperator[Filterable]]]
    OR: list[Union[Filterable, HighOrderOperator[Filterable]]]


class DeleteOptions(
    Generic[Filterable],
    TypedDict,
    total=False,
):
    """Options supported by `delete()` and `delete_many()`.

    where (dict): Query filter.
    read_own_writes (bool): A switch; when ON, the filter attribute `asof` is
        specified and set as per the tracked `GTID`, and
        when OFF, the attribute isn't included as part of
        the query filter (a.k.a. `where`).
    """

    where: Required[Filterable]
    read_own_writes: bool


class FindOptionsBase(
    Generic[Selectable, DataField, NestedField],
    TypedDict,
    total=False,
):
    """`Find*Options` base type."""

    select: list[DataField | NestedField] | Selectable
    read_own_writes: bool


class FindUniqueOptions(
    Generic[Filterable, Selectable, DataField, NestedField],
    FindOptionsBase[Selectable, DataField, NestedField],
    total=False,
):
    """Options supported by `find_unique()` and `find_unique_or_throw()`.

    select (dict | list): Specifies which properties to include or exclude
        on the returned object. It can be a list or a dictionary.
        ```
        # Only include the fields specified (`list` use case)
        select=["last_update"]

        # Only include the fields specified (`dict` use case)
        select={"last_name": True}

        # Include all fields but the specified
        select={"last_name": False}
        ```
    where (dict): Wraps all model fields in a type so that the list
        can be filtered by any property.
        ```
        # Equality
        where={"actor_id": 3} or {"actor_id": {"equals": 3}}
        ```
    read_own_writes (bool): A switch; when ON, the filter attribute `asof` is
        specified and set as per the tracked `GTID`, and
        when OFF, the attribute isn't included as part of
        the query filter (a.k.a. `where`).
    """

    where: Required[Filterable]


class FindFirstOptions(
    Generic[
        Filterable,
        Selectable,
        Sortable,
        DataField,
        NestedField,
        Cursors,
    ],
    FindOptionsBase[Selectable, DataField, NestedField],
    total=False,
):
    """Options supported by `find_first()` and `find_first_or_throw()`.

    select (dict | list): Specifies which properties to include or exclude
        on the returned object. It can be a list or a dictionary.
        ```
        # Only include the fields specified (`list` use case)
        select=["last_update"]

        # Only include the fields specified (`dict` use case)
        select={"last_name": True}

        # Include all fields but the specified
        select={"last_name": False}
        ```
    where (dict): Wraps all model fields in a type so that the list
        can be filtered by any property.
        ```
        # Equality
        where={"actor_id": 3} or {"actor_id": {"equals": 3}}

        # Not Equality
        where={"last_name": {"ne": "Pacheco"}}

        # Pattern
        where={"first_name": {"like": "%%ED%%"}}
        ```
    skip (int): Specifies how many of the returned objects in the
        list should be skipped.
        ```
        skip=2
        ```
    order_by (dict): Lets you order the returned list by any property.
        ```
        order_by={"first_name": "DESC"}

        order_by={"actor_id": "ASC"}
        ```
    cursor (int): Specifies the position for the list (the value
        typically specifies an id or another unique value).
        ```
        actor: Optional[Actor] = await self.my_service.sakila.actor.find_first(
            where={"first_name": "PENELOPE"}
        )

        if actor is not None:
            # actor_id is of type int or UndefinedDataClassField
            cursor = actor.actor_id
            if not isinstance(cursor, int):
                self.fail("Cursor is undefined")
            actors = await self.my_service.sakila.actor.find_many(
                where={"first_name": "PENELOPE"}, cursor={"actor_id": cursor}
            )
        ```
    read_own_writes (bool): A switch; when ON, the filter attribute `asof` is
        specified and set as per the tracked `GTID`, and
        when OFF, the attribute isn't included as part of
        the query filter (a.k.a. `where`).
    """

    where: Filterable
    skip: int
    order_by: Sortable
    cursor: Cursors


class FindManyOptions(
    Generic[
        Data,
        Filterable,
        Selectable,
        Sortable,
        DataField,
        NestedField,
        Cursors,
    ],
    FindFirstOptions[
        Filterable,
        Selectable,
        Sortable,
        DataField,
        NestedField,
        Cursors,
    ],
    total=False,
):
    """Options supported by `find_many()`. See `FindFirstOptions` to know
    about the other options.

    take (int): Specifies how many objects should be returned in the list.
        ```
            actors: list[Actors] = await self.my_service.sakila.actor.find_many(
                where={"first_name": "PENELOPE"}, take=2
            )
        ```
    iterator (bool): (not actually available on Prisma) it is used by the SDK to reset
        the internal iterator when consuming paginated data in order to avoid n + 1
        requests, the internal iterator stops after the MySQL Router says there are
        no more items. Default value is `True`.
    """

    take: int
    iterator: bool


class FindAllOptions(
    Generic[
        Data,
        Filterable,
        Selectable,
        Sortable,
        DataField,
        NestedField,
        Cursors,
    ],
    FindFirstOptions[
        Filterable,
        Selectable,
        Sortable,
        DataField,
        NestedField,
        Cursors,
    ],
    total=False,
):
    """Options supported by `find_all()`. See `FindFirstOptions` to
    know about the other options.

    progress (callback): Display loop progress.
        ```
        def my_progress(data: list[ActorData]) -> None:
            print("Test Progress Option")
            for i, item in enumerate(data):
                print(f"{i+1} of {len(data)}: actor_id={item["actor_id"]}")

        actors: list[Actor] = await self.my_service.sakila.actor.find_all(
            where={"first_name": "PENELOPE"}, progress=my_progress
        )
        ```
    """

    progress: Callable[[list[Data]], None]


####################################################################################
#                                 Conversion
####################################################################################
JSON_FORMATTABLE_DATE_OR_TIME = (
    datetime.date,
    datetime.datetime,
    datetime.timedelta,
)


class MrsDataDownstreamConverter:
    """Namespace encapsulating the conversion logic for downstream commands."""

    @staticmethod
    def convert_obj_fields_from_typed_dict(obj: object, typed_dict: TypeAlias) -> Any:
        """Convert object's fields based on the `typing.TypedDict` type hint information.

        Args:
            obj: It can be any object (supporting `getattr` and `setattr`) or a dictionary.
            typed_dict: A type alias - It must be an alias of a `typing.TypedDict` type.

        Returns:
            The original object with fields converted.
        """
        for field_name, field_type in typing.get_type_hints(typed_dict).items():
            if isinstance(obj, dict):
                obj[field_name] = MrsDataDownstreamConverter.convert(
                    value=obj[field_name], dst_type=field_type
                )
            else:
                setattr(
                    obj,
                    field_name,
                    MrsDataDownstreamConverter.convert(
                        value=getattr(obj, field_name), dst_type=field_type
                    ),
                )
        return obj

    @staticmethod
    def _convert_date_or_time(
        value: int | str | None,
        type_alias_name: Literal["Date", "DateTime", "Time", "Year"],
    ) -> JsonFormattableDateOrTime | int | None:
        """Convert value to a client type based on the type alias name."""
        if value is None:
            return value
        if type_alias_name == "Year":
            return value if isinstance(value, int) else int(value)

        value = cast(str, value)
        if type_alias_name == "DateTime":
            return datetime.datetime.fromisoformat(value)
        if type_alias_name == "Date":
            return datetime.date.fromisoformat(value)

        # target must be `Time`
        if "." in value:
            time, fraction = value.split(".")
            hours, minutes, seconds, microseconds = tuple(
                int(x) for x in time.split(":")
            ) + (int(fraction),)
        else:
            hours, minutes, seconds, microseconds = tuple(
                int(x) for x in value.split(":")
            ) + (0,)

        return datetime.timedelta(
            hours=hours, minutes=minutes, seconds=seconds, microseconds=microseconds
        )

    @staticmethod
    def convert(value: JsonValue, dst_type: TypeAliasType) -> Any:
        """Convert JSON formattable value to a client value.

        Conversion is skipped if the value does not require conversion
        (determined by the client based on the type alias).

        The type alias should be an instance of `typing.TypeAliasType`
        or an instance of such a class wrapped with `typing.Optional`,
        otherwise conversion is skipped. For example, consider the
        following type alias:

        ```
        import datetime

        class Foo:
            ...

        # i am an instance of `typing.TypeAliasType`
        type DateOrFoo = datetime.date | Foo
        ```

        In this case, you may want to pass `Date` or `typing.Optional[Date]`
        as type alias. See [Type Aliases](https://docs.python.org/3/library/typing.html#type-aliases)
        to know more.

        Args:
            value: JSON formattable value to be converted to.
            dst_type: Client type to convert the value to.

        Returns:
            output: Converted value if conversion isn't skipped, or the original
            value otherwise.
        """
        type_alias_type_instance: Optional[TypeAliasType] = None
        if isinstance(dst_type, typing.TypeAliasType):
            type_alias_type_instance = dst_type
        elif hasattr(dst_type, "__name__") and dst_type.__name__.startswith("Optional"):
            for arg in typing.get_args(dst_type):
                if isinstance(arg, typing.TypeAliasType):
                    type_alias_type_instance = arg
                    break

        if type_alias_type_instance in (Date, DateTime, Time, Year):
            return MrsDataDownstreamConverter._convert_date_or_time(
                cast(int | str | None, value),
                cast(
                    Literal["Date", "DateTime", "Time", "Year"],
                    type_alias_type_instance.__name__,
                ),
            )
        return value


class MrsDataUpstreamConverter:
    """Namespace encapsulating the conversion logic for upstream commands."""

    @staticmethod
    def _convert_date_or_time(value: JsonFormattableDateOrTime) -> str:
        """Convert a `date or time` client value to a JSON formattable value."""
        if isinstance(value, datetime.datetime):
            return value.isoformat(sep=" ")
        elif isinstance(value, datetime.date):
            return value.isoformat()

        # value must be an instance of datetime.timedelta
        seconds = value.total_seconds()
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        seconds = int(seconds % 60)

        if value.microseconds != 0:
            return f"{hours:>03}:{minutes:>02}:{seconds:>02}.{value.microseconds:>06}"
        return f"{hours:>03}:{minutes:>02}:{seconds:>02}"

    @staticmethod
    def convert(value: Any) -> JsonValue:
        """Convert client value to a JSON formattable value."""
        if isinstance(value, JSON_FORMATTABLE_DATE_OR_TIME):
            return MrsDataUpstreamConverter._convert_date_or_time(value)
        return value


####################################################################################
#                     HTTP Requests - Payload Encoding/Decoding
####################################################################################
class MrsJSONDataEncoder(json.JSONEncoder):
    """Namespace where utility functions for encoding a `payload` about
    to be sent to the MySQL Router are implemented.

    The router expects field names (keys) in camel case, but Python
    delivers them in snake case. We must convert the field names from
    snake to camel case.
    """

    _pattern = re.compile(r"[_-](.)")

    @staticmethod
    def snake_to_camel(key: str) -> str:
        """From snake to camel."""
        # This is a temporary workaround to avoid update conflicts.
        # The MySQL Router expects a "_metadata" field.
        # Should be removed once BUG#37716405 is addressed.
        if key == "_metadata":
            return key

        return MrsJSONDataEncoder._pattern.sub(
            lambda x: x.group(1).upper(), key.lower()
        )

    @staticmethod
    def convert_field_value(value: Any) -> JsonValue:
        """Convert client value to a JSON formattable value."""
        return MrsDataUpstreamConverter.convert(value)

    @staticmethod
    def parse_value(value: Any) -> Any:
        """Parse value."""
        if isinstance(value, dict):
            return MrsJSONDataEncoder.convert_keys(value)
        if isinstance(value, list):
            return [
                (
                    MrsJSONDataEncoder.convert_keys(x)
                    if isinstance(x, dict)
                    else MrsJSONDataEncoder.convert_field_value(x)
                )
                for x in value
            ]
        return MrsJSONDataEncoder.convert_field_value(value)

    @staticmethod
    def convert_keys(o: dict) -> dict:
        """Convert keys from snake to camel."""
        # Undefined fields are discarded
        return {
            MrsJSONDataEncoder.snake_to_camel(k): MrsJSONDataEncoder.parse_value(v)
            for k, v in o.items()
            if v is not UndefinedField
        }

    def encode(self, o: dict) -> str:
        """Convert keys from snake to camel. Finally, encode and serialize `o`."""
        return super().encode(MrsJSONDataEncoder.convert_keys(o))


class MrsJSONDataDecoder:
    """Namespace where utility functions for decoding a `payload` coming
    from the MySQL Router are implemented.

    The router sends in field names (keys) in camel case but Python by
    convention prefers snake case. To honor this well-accepted
    convention, we should convert the field names from camel to snake case.
    """

    _pattern = re.compile(r"(?<!^)(?=[A-Z])")

    @staticmethod
    def camel_to_snake(key: str) -> str:
        """From camel to snake."""
        return MrsJSONDataDecoder._pattern.sub("_", key).lower()

    @staticmethod
    def convert_field_value(value: Any, dst_type: TypeAlias) -> Any:
        """Convert JSON formattable value to a client value."""
        return MrsDataDownstreamConverter.convert(
            cast(JsonValue, value), cast(TypeAliasType, dst_type)
        )

    @staticmethod
    def parse_value(value: Any) -> Any:
        """Parse value."""
        if isinstance(value, dict):
            return MrsJSONDataDecoder.convert_keys(value)
        if isinstance(value, list):
            return [
                MrsJSONDataDecoder.convert_keys(x) if isinstance(x, dict) else x
                for x in value
            ]
        return value

    @staticmethod
    def convert_keys(data: dict) -> dict:
        """Convert keys from camel to snake."""
        return {
            MrsJSONDataDecoder.camel_to_snake(k): MrsJSONDataDecoder.parse_value(v)
            for k, v in data.items()
        }


class MrsQueryEncoder(json.JSONEncoder):
    """Customize `json.JSONEncoder` -  it's used when encoding a query
    filter (provided as a dictionary).

    Operators are properly converted before serializing the filter.
    Additionally, keys are converted from snake to camel case.
    """

    _ords_keyword = {
        "and": "$and",
        "or": "$or",
        "equals": "$eq",
        "gt": "$gt",
        "gte": "$gte",
        "like": "$like",
        "lt": "$lt",
        "lte": "$lte",
        "not": "$notnull",
        "ne": "$ne",
        "orderBy": "$orderby",
        "asof": "$asof",
    }

    def encode(self, o: Any) -> str:
        """Convert keys from snake to camel and translates
        operators-related fields. Finally, encode and serialize `o`.
        """
        if isinstance(o, dict):
            json_obj: dict[str, Any] = {}
            for item_key, item_value in o.items():
                key_in_camel_case = MrsJSONDataEncoder.snake_to_camel(item_key)
                json_key = self._ords_keyword.get(key_in_camel_case, key_in_camel_case)
                # handle $null vs $notnull
                if item_value is None and json_key != self._ords_keyword.get("not"):
                    json_obj.update({json_key: {"$null": None}})
                elif isinstance(item_value, dict):
                    json_obj.update({json_key: json.loads(self.encode(item_value))})
                elif isinstance(item_value, list):
                    json_obj.update(
                        {
                            json_key: [
                                (
                                    json.loads(self.encode(x))
                                    if isinstance(x, dict)
                                    else MrsJSONDataEncoder.convert_field_value(x)
                                )
                                for x in item_value
                            ]
                        }
                    )
                else:
                    json_obj.update(
                        {json_key: MrsJSONDataEncoder.convert_field_value(item_value)}
                    )
            return super().encode(json_obj)
        return super().encode(o)


####################################################################################
#                            REST Services and Schemas
####################################################################################
# pylint: disable=protected-access,too-many-lines


async def _get_metadata(url: str, access_token: Optional[str] = None) -> JsonObject:
    """Get the underlying MRS metadata information of the REST object.

    Returns:
        metadata: A dictionary.

    Raises:
        HTTPError: If something goes wrong while trying to retrieve
            the data.
    """
    headers = {"Accept": "application/json"}

    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"

    req = Request(
        url=f"{url}/_metadata",
        headers=headers,
        method="GET",
    )
    response = await asyncio.to_thread(
        urlopen, req, context=ssl.create_default_context()
    )

    return json.loads(response.read(), object_hook=MrsJSONDataDecoder.convert_keys)


class MrsBaseSchema:
    """Base class for MRS-related schema (database) instances."""

    def __init__(self, service: MrsService, request_path: str) -> None:
        """Constructor."""
        self._service: MrsService = service
        self._request_path: str = request_path

    async def get_metadata(self) -> JsonObject:
        return await _get_metadata(
            url=self._request_path,
            access_token=self._service._session.get("access_token"),
        )


class MrsBaseObject:
    """Base class for MRS-related database object instances."""

    def __init__(self, schema: MrsBaseSchema, request_path: str) -> None:
        self._schema: MrsBaseSchema = schema
        self._request_path: str = request_path
        self._has_more: bool = True

    async def get_metadata(self) -> JsonObject:
        return await _get_metadata(
            url=self._request_path,
            access_token=self._schema._service._session.get("access_token"),
        )


####################################################################################
#                        REST Procedures and Functions
####################################################################################
# This class cannot be instantiated as it defines an abstract interface.
class MrsBaseObjectRoutineCall(
    Generic[IMrsRoutineInParameters, IMrsRoutineResponse, VarTypeHintStruct], ABC
):
    """Implements the core logic utilized by function and procedure objects."""

    def __init__(
        self,
        schema: MrsBaseSchema,
        request_path: str,
        parameters: IMrsRoutineInParameters,
        result_type_hint_struct: VarTypeHintStruct,
    ) -> None:
        """MrsBaseObjectRoutineCall.

        Args:
            schema: Instance of the corresponding MRS schema
            request_path: The base endpoint to the resource (function).
            parameters: Dictionary representing the input parameters of the routine.
            result_type_hint: Client type(s) to convert the response/result (object) to.
        """
        self._schema: MrsBaseSchema = schema
        self._request_path: str = request_path
        self._params: IMrsRoutineInParameters = parameters
        self._result_type_hint_struct: VarTypeHintStruct = result_type_hint_struct

    # Unlike Java abstract methods, Python abstract methods may have an implementation.
    # This implementation can be called via the super() mechanism from the class that
    # overrides it. See https://docs.python.org/3/library/abc.html#abc.abstractmethod.
    @abstractmethod
    async def submit(self) -> IMrsRoutineResponse:
        """Submit the request to the Router to invoke the corresponding
        MySQL routine.

        Reurns:
            A dictionary, but the specific type definition shall be
            determined by the subclass itself.
        """
        headers = {"Accept": "application/json"}
        access_token = self._schema._service._session.get("access_token")

        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"

        req = Request(
            url=self._request_path,
            headers=headers,
            data=json.dumps(obj=self._params, cls=MrsJSONDataEncoder).encode(),
            method="POST",
        )
        context = ssl.create_default_context()
        data = await asyncio.to_thread(urlopen, req, context=context)

        response = cast(
            IMrsRoutineResponse,
            json.loads(data.read(), object_hook=MrsJSONDataDecoder.convert_keys),
        )

        # Track the latest GTID
        try:
            self._schema._service._session["gtid"] = response["_metadata"]["gtid"]
        except KeyError:
            pass

        return response


class MrsBaseObjectProcedureCall(
    Generic[
        IMrsRoutineInParameters,
        IMrsProcedureOutParameters,
        IMrsProcedureResultSet,
    ],
    MrsBaseObjectRoutineCall[
        IMrsRoutineInParameters,
        IMrsProcedureResponseDetails[
            IMrsProcedureOutParameters, IMrsProcedureResultSet
        ],
        ProcedureResponseTypeHintStruct,
    ],
):
    """Implements the core logic utilized by procedure objects."""

    async def submit(  # type: ignore[override]
        self,
    ) -> IMrsProcedureResponse[IMrsProcedureOutParameters, IMrsProcedureResultSet]:
        """Submit the request to the Router to invoke the corresponding
        MySQL procedure.

        Reurns:
            A dictionary which typing construct complies with the corresponding MySQL
            procedure output interface declaration itself.
        """
        response = await super().submit()

        return IMrsProcedureResponse[
            IMrsProcedureOutParameters, IMrsProcedureResultSet
        ](data=response, type_hint_struct=self._result_type_hint_struct)


class MrsBaseObjectFunctionCall(
    Generic[IMrsRoutineInParameters, IMrsFunctionResult],
    MrsBaseObjectRoutineCall[
        IMrsRoutineInParameters,
        IMrsFunctionResponse[IMrsFunctionResult],
        FunctionResponseTypeHintStruct,
    ],
):
    """Implements the core logic utilized by function objects."""

    async def submit(self) -> IMrsFunctionResult:  # type: ignore[override]
        """Submit the request to the Router to invoke the corresponding
        MySQL function.

        Reurns:
            A value which type complies with the corresponding MySQL
            function declaration.
        """
        response = await super().submit()
        return MrsJSONDataDecoder.convert_field_value(
            response["result"], dst_type=self._result_type_hint_struct["result"]
        )


####################################################################################
#                               REST Views
####################################################################################
class MrsBaseObjectQuery(Generic[Data, DataDetails]):
    """Implements the core logic utilized by the `find*` commands."""

    @staticmethod
    def __snake_to_camel_field(field: str) -> str:
        """Convert `field` from snake to camel case.

        Args:
            field: it might include several subfields (separated by `.`).
                   E.g., `field_a.field_b.field_c`.

        Returns:
            `field` and subfields (if any) are converted.
            E.g., `field_a.field_b.field_c` -> `fieldA.fieldB.fieldC`.
        """
        return ".".join(
            [MrsJSONDataEncoder.snake_to_camel(field) for field in field.split(".")]
        )

    def __init__(
        self,
        schema: MrsBaseSchema,
        request_path: str,
        options: Optional[Union[FindManyOptions, FindFirstOptions, FindUniqueOptions]],
    ) -> None:
        """Constructor.

        During this stage, query options are parsed and save in the inner state
        of this instance.

        Args:
            schema: instance of the corresponding MRS schema
            request_path: the base endpoint to the resource (database table).
            options: See FindManyOptions, FindFirstOptions and FindUniqueOptions
                    to know more about the options.
        """
        self._schema: MrsBaseSchema = schema
        self.request_path: str = request_path
        self._where: Optional[dict] = None
        self.exclude: list[str] = []
        self.include: list[str] = []
        self.offset: Optional[int] = None
        self.limit: Optional[int] = None
        self.cursor: Optional[dict] = None
        self._read_own_writes: bool = False

        if options is None:
            return

        all_available_options = cast(FindManyOptions, options)

        where = all_available_options.get("where")
        order_by = all_available_options.get("order_by")

        if where:
            if order_by:
                where.update({"order_by": order_by})
            self._where = where
        else:
            self._where = {"order_by": order_by} if order_by else {}

        select = all_available_options.get("select")

        if isinstance(select, list):
            self.include = select
            self.exclude = []
        elif isinstance(select, dict):
            self.include = [key for key, value in select.items() if value is True]
            self.exclude = [key for key, value in select.items() if value is False]

        self.limit = all_available_options.get("take")
        self.offset = all_available_options.get("skip")

        self.cursor = all_available_options.get("cursor")
        if self.cursor is not None:
            self._where.update(
                {key: {"gt": value} for key, value in self.cursor.items()}
            )

        self._read_own_writes = all_available_options.get("read_own_writes", False)
        if self._read_own_writes is True:
            gtid = self._schema._service._session["gtid"]
            if gtid is not None:
                self._where.update({"asof": gtid})

    async def submit(self) -> IMrsResourceCollectionData:
        """Fetch a result set (page). The page size is as `take` if specified,
        otherwise it is as configured (default) in the MRS SDK application.

        Returns:
            A dictionary with the following keys:
            ```
                items: list[IMrsResourceDetails]
                limit: int
                offset: int
                has_more: bool
                count: int
                links: list[MrsResourceLink]
            ```
        """
        query: dict[str, object] = {}

        if self._where:
            query["q"] = json.dumps(
                obj=self._where, cls=MrsQueryEncoder, separators=(",", ":")
            )

        if len(self.exclude) > 0:
            query["f"] = ",".join(
                [
                    f"!{MrsBaseObjectQuery.__snake_to_camel_field(field)}"
                    for field in self.exclude
                ]
            )
        elif len(self.include) > 0:
            query["f"] = ",".join(
                [
                    MrsBaseObjectQuery.__snake_to_camel_field(field)
                    for field in self.include
                ]
            )

        if self.limit:
            query["limit"] = self.limit

        if self.offset and self.cursor is None:
            query["offset"] = self.offset

        querystring = urlencode(query, quote_via=quote)
        url = f"{self.request_path}?{querystring}"

        headers = {"Accept": "application/json"}
        access_token = self._schema._service._session.get("access_token")

        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"

        req = Request(
            url=url,
            headers=headers,
            method="GET",
        )
        context = ssl.create_default_context()
        response = await asyncio.to_thread(urlopen, req, context=context)

        return json.loads(response.read(), object_hook=MrsJSONDataDecoder.convert_keys)

    async def fetch_all(
        self, progress: Optional[ProgressCallback] = None
    ) -> IMrsResourceCollectionData:
        """Fetch all result sets (pages). Unlike `submit()`, this method loads
        all pages matching the query `options`.

        Returns:
            A dictionary with the following keys:
            ```
                items: list[IMrsResourceDetails]
                limit: int
                offset: int
                has_more: bool
                count: int
                links: list[MrsResourceLink]
            ```
        """
        has_more = True
        res: IMrsResourceCollectionData = {
            "count": 0,
            "has_more": False,
            "items": [],
            "limit": 25,
            "links": [],
            "offset": 0,
        }

        while has_more:
            current = await self.submit()

            if current is None:
                break

            has_more = current["has_more"]

            if res is None:
                res = current
            else:
                # increase the global response count
                res["count"] += current["count"]
                res["has_more"] = has_more
                # add the remaining items
                res["items"].extend(current["items"])
                res["limit"] = current["limit"]
                res["links"] = current["links"]
                res["offset"] = current["offset"]

            if progress:
                # callback with the current status
                progress([cast(Data, item) for item in res["items"]])

            self.offset = res["count"]

        return res

    async def fetch_one(self) -> Optional[DataDetails]:
        """Fetch a single document.

        Returns:
            A dictionary with hypermedia-related and metadata-related keys:
            ```
                _metadata: MrsResourceMetadata
                links: list[MrsResourceLink]
            ```
            Additionally, specific fields are included, but these depend on the
            document type itself. E.g., for a fictional `ActorDetails` data type:
            ```
                actor_id: int
                first_name: str
                last_name: str
                last_update: str
            ```
        """
        # impose artificial limit
        self.limit = 1

        response = await self.submit()

        if len(response["items"]) == 0:
            return None

        return cast(DataDetails, response["items"][0])


class MrsBaseObjectCreate(Generic[Data, DataDetails]):
    """Implements the core logic utilized by the `create*` commands."""

    def __init__(self, schema: MrsBaseSchema, request_path: str, data: Data) -> None:
        """Constructor.

        Args:
            request_path: the base endpoint to the resource (database table).
            data: document to be created.
        """
        self._schema: MrsBaseSchema = schema
        self._request_path: str = request_path
        self._data: Data = data

    async def submit(self) -> DataDetails:
        """Submit the request to the Router to create a new document
        as of `data` specified at construction time.

        Returns:
            A dictionary representing the newly created resource
            with hypermedia-related and metadata-related keys:
            ```
                _metadata: MrsResourceMetadata
                links: list[MrsResourceLink]
            ```
            Additionally, specific fields are included, but these depend on the
            document type itself. E.g., for a fictional `ActorDetails` data type:
            ```
                actor_id: int
                first_name: str
                last_name: str
                last_update: str
            ```
        """
        headers = {"Accept": "application/json"}
        access_token = self._schema._service._session.get("access_token")

        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"

        req = Request(
            url=self._request_path,
            headers=headers,
            data=json.dumps(obj=self._data, cls=MrsJSONDataEncoder).encode(),
            method="POST",
        )
        context = ssl.create_default_context()
        response = await asyncio.to_thread(urlopen, req, context=context)

        mrs_document = cast(
            DataDetails,
            json.loads(response.read(), object_hook=MrsJSONDataDecoder.convert_keys),
        )

        # track the latest GTID
        try:
            self._schema._service._session["gtid"] = mrs_document["_metadata"]["gtid"]
        except KeyError:
            pass

        return mrs_document


class MrsBaseObjectUpdate(Generic[DataClass, DataDetails]):
    """Implements the core logic utilized by the `update*` commands."""

    def __init__(
        self, schema: MrsBaseSchema, request_path: str, data: DataClass
    ) -> None:
        """Constructor.

        Args:
            schema: instance of the corresponding MRS schema
            request_path: the base endpoint to the resource (database table).
            data: document updated details.
        """
        self._schema: MrsBaseSchema = schema
        self._request_path: str = request_path
        self._data: DataClass = data

    async def submit(self) -> DataDetails:
        """Submit the request to the Router to update a new document
        as of `data` specified at construction time.

        Returns:
            A dictionary representing the updated resource
            with hypermedia-related and metadata-related keys:
            ```
                _metadata: MrsResourceMetadata
                links: list[MrsResourceLink]
            ```
            Additionally, specific fields are included, but these depend on the
            document type itself. E.g., for a fictional `ActorDetails` data type:
            ```
                actor_id: int
                first_name: str
                last_name: str
                last_update: str
            ```
        """
        try:
            etag = self._data.__dict__["_metadata"]["etag"]
        except (KeyError, TypeError):
            # `KeyError` means that key "etag" doesn't exist.

            # `TypeError` means that "_metadata" is None. This is expected when
            # data flows from the user app to the router because users won't
            # include metadata information as part of the data payload.
            etag = ""

        headers = {"Accept": "application/json", "If-Match": etag}
        access_token = self._schema._service._session.get("access_token")

        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"

        # This is a temporary workaround to avoid update conflicts.
        # The "If-Match" is ignored and the ETag should be sent in the request body.
        # Should be removed once BUG#37716405 is addressed.
        body = asdict(self._data)
        if etag:
            body.update({"_metadata": {"etag": etag}})

        req = Request(
            url=self._request_path,
            headers=headers,
            data=json.dumps(obj=body, cls=MrsJSONDataEncoder).encode(),
            method="PUT",
        )
        context = ssl.create_default_context()
        response = await asyncio.to_thread(urlopen, req, context=context)

        mrs_document = cast(
            DataDetails,
            json.loads(response.read(), object_hook=MrsJSONDataDecoder.convert_keys),
        )

        # track the latest GTID
        try:
            self._schema._service._session["gtid"] = mrs_document["_metadata"]["gtid"]
        except KeyError:
            pass

        return mrs_document


class MrsBaseObjectDelete(Generic[Filterable]):
    """Implements the core logic utilized by the `delete*` commands."""

    def __init__(
        self,
        schema: MrsBaseSchema,
        request_path: str,
        options: DeleteOptions,
    ) -> None:
        """Constructor.

        During this stage, query options are parsed and save in the inner state
        of this instance.

        Args:
            schema: instance of the corresponding MRS schema.
            request_path: the base endpoint to the resource (database table).
            options: See `DeleteOptions` to know more about the options.

        """
        self._schema: MrsBaseSchema = schema
        self._request_path: str = request_path
        self._where: dict = cast(dict, options["where"])

        if options.get("read_own_writes", False) is True:
            gtid = self._schema._service._session["gtid"]
            if gtid is not None:
                self._where.update({"asof": gtid})

    async def submit(self) -> IMrsDeleteResponse:
        """Submit the request to the Router to delete a document
        as of `where` specified at construction time.

        Returns:
            A dictionary with information about the
            number of items deleted.
            ```
            items_deleted: int
            ```
        """
        query: dict[str, object] = {}

        if self._where:
            query["q"] = json.dumps(
                obj=self._where, cls=MrsQueryEncoder, separators=(",", ":")
            )
            querystring = urlencode(query, quote_via=quote)
            url = f"{self._request_path}?{querystring}"
        else:
            url = self._request_path

        headers = {"Accept": "application/json"}
        access_token = self._schema._service._session.get("access_token")

        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"

        req = Request(
            url=url,
            headers=headers,
            method="DELETE",
        )
        context = ssl.create_default_context()
        response = await asyncio.to_thread(urlopen, req, context=context)

        delete_response = json.loads(
            response.read(), object_hook=MrsJSONDataDecoder.convert_keys
        )

        # track the latest GTID
        try:
            self._schema._service._session["gtid"] = delete_response["_metadata"][
                "gtid"
            ]
        except KeyError:
            pass

        return delete_response


####################################################################################
#                              Authenticating
####################################################################################
class MrsAuthenticate:
    def __init__(
        self,
        service: Authenticating,
        request_path: str,
        app: str,
        user: str,
        password: str = "",
        vendor_id: Optional[str] = None,
    ) -> None:
        self._service: Authenticating = service
        self._request_path: str = request_path
        self._vendor_id: Optional[str] = vendor_id
        self._app: str = app
        self._user: str = user
        self._password: str = password

    @staticmethod
    def _hmac_sign(secret: bytes, data: bytes) -> bytes:
        return hmac.HMAC(key=secret, msg=data, digestmod=hashlib.sha256).digest()

    @staticmethod
    def _xor(key: bytes, data: bytes) -> Sequence[int]:
        buffer = list(data if len(data) >= len(key) else key)
        for i in range(min(len(data), len(key))):
            buffer[i] = key[i] ^ data[i]
        return tuple(buffer)

    @staticmethod
    def _compute_client_proof(
        password: str, salt: bytes, iterations: int, auth_message: str
    ) -> Sequence[int]:
        salted_password = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), salt, iterations
        )

        client_key = MrsAuthenticate._hmac_sign(salted_password, b"Client Key")
        stored_key = hashlib.sha256(client_key, usedforsecurity=True).digest()
        client_signature = MrsAuthenticate._hmac_sign(
            stored_key, auth_message.encode("utf-8")
        )

        return MrsAuthenticate._xor(client_signature, client_key)  # client_proof

    @staticmethod
    def _nonce() -> str:
        return "".join(["%02x" % random.randint(0, 255) for i in range(10)])

    async def _submit_mrs_native(self) -> IMrsTokenBasedAuthenticationResponse:
        """Implements MRS-based authentication.

        The MySQL Router supports MRS-based authentication via the
        HTTP Bearer authentication authentication scheme. The bearer
        token is provided after a successful SCRAM exchange between
        the client and the router.
        """
        nonce = MrsAuthenticate._nonce()
        ssl_context = ssl.create_default_context()
        auth_data: dict[str, Any] = {
            "auth_app": self._app,
            "nonce": nonce,
            "session_type": "bearer",
            "user": self._user,
        }

        req = Request(
            url=self._request_path,
            headers={"Accept": "application/json"},
            data=json.dumps(obj=auth_data, cls=MrsJSONDataEncoder).encode(),
            method="POST",
        )

        response = await asyncio.to_thread(urlopen, req, context=ssl_context)

        if response.status != 200:
            raise HTTPError(
                url=response.url,
                code=response.status,
                msg=response.msg,
                hdrs=response.headers,
                fp=None,
            )

        # `salt` is delivered as a `list[int]`; converting to `bytes`.
        challenge: IMrsAuthenticationStartResponse = json.loads(response.read())
        challenge["salt"] = bytes(challenge["salt"])

        client_first, client_final = (
            f"n={self._user},r={nonce}",
            f"r={challenge['nonce']}",
        )
        server_first = (
            f"r={challenge['nonce']},"
            f"s={base64.b64encode(cast(bytes, challenge["salt"])).decode('utf-8')},"
            f"i={challenge['iterations']}"
        )

        client_proof = MrsAuthenticate._compute_client_proof(
            password=self._password,
            salt=bytes(challenge["salt"]),
            iterations=challenge["iterations"],
            auth_message=f"{client_first},{server_first},{client_final}",
        )

        auth_data = {
            "client_proof": client_proof,
            "nonce": challenge["nonce"],
            "state": "response",
        }

        req = Request(
            url=self._request_path,
            headers={"Accept": "application/json"},
            data=json.dumps(obj=auth_data, cls=MrsJSONDataEncoder).encode(),
            method="POST",
        )

        response = await asyncio.to_thread(urlopen, req, context=ssl_context)

        if response.status != 200:
            raise HTTPError(
                url=response.url,
                code=response.status,
                msg=response.msg,
                hdrs=response.headers,
                fp=None,
            )

        return cast(
            IMrsTokenBasedAuthenticationResponse,
            json.loads(response.read(), object_hook=MrsJSONDataDecoder.convert_keys),
        )

    async def _submit_mysql_internal(self) -> IMrsTokenBasedAuthenticationResponse:
        """Implements the MySQL Internal Authentication Mechanism.

        The MySQL Router supports authentication using a MySQL server
        account via the HTTP Bearer authentication scheme. The bearer
        token is provided in response to valid credentials sent by the
        client on the JSON request body.
        """
        data_auth = {
            "username": self._user,
            "password": self._password,
            "authApp": self._app,
            "sessionType": "bearer",
        }

        req = Request(
            url=self._request_path,
            headers={"Accept": "application/json"},
            data=json.dumps(data_auth).encode(),
            method="POST",
        )

        response = await asyncio.to_thread(
            urlopen, req, context=ssl.create_default_context()
        )

        if response.status != 200:
            raise HTTPError(
                url=response.url,
                code=response.status,
                msg=response.msg,
                hdrs=response.headers,
                fp=None,
            )

        auth_response = cast(
            IMrsTokenBasedAuthenticationResponse,
            json.loads(response.read(), object_hook=MrsJSONDataDecoder.convert_keys),
        )

        if auth_response.get("access_token") is None:
            raise AuthenticationError(
                msg="Authentication app does not match the given vendor id."
            )

        return auth_response

    async def submit(self) -> None:
        """Authenticate user to access protected REST resources.

        This method returns nothing, however the relevant (based on the
        requested authentication option) service session variables are
        updated in-place.

        Raises:
            AuthenticationError: If something goes wrong during the authentication workflow.
        """
        try:
            if self._vendor_id is None:
                # vendor lookup
                for auth_app in await self._service.get_auth_apps():
                    if auth_app["name"] == self._app:
                        self._vendor_id = auth_app["vendor_id"]
                        break
                if self._vendor_id is None:
                    raise AuthenticationError(msg="Authentication app does not exist.")

            # choose auth workflow based on the vendor ID
            if self._vendor_id == "0x30000000000000000000000000000000":
                self._service._session["access_token"] = (
                    await self._submit_mrs_native()
                )["access_token"]
            else:
                self._service._session["access_token"] = (
                    await self._submit_mysql_internal()
                )["access_token"]
        except HTTPError as err:
            raise AuthenticationError(msg=str(err))


class MrsDeauthenticate:
    def __init__(
        self,
        service: Authenticating,
        request_path: str,
    ) -> None:
        self._service: Authenticating = service
        self._request_path: str = request_path

    async def submit(self) -> None:
        """Logs you out (deauthenticate) from an authenticated service.

        Raises:
            DeauthenticationError: if no user is currently authenticated.
        """
        if not self._service._session.get("access_token"):
            raise DeauthenticationError(msg="No user is currently authenticated")

        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self._service._session.get("access_token")}",
        }

        req = Request(
            url=self._request_path,
            headers=headers,
            method="POST",
        )

        try:
            response = await asyncio.to_thread(
                urlopen, req, context=ssl.create_default_context()
            )

            if response.status != 200:
                raise HTTPError(
                    url=response.url,
                    code=response.status,
                    msg=response.msg,
                    hdrs=response.headers,
                    fp=None,
                )
        except HTTPError as err:
            raise DeauthenticationError(msg=str(err))

        # If deauthentication completes successfully, then
        # let's reset `access_token`.
        self._service._session["access_token"] = ""

        return None


####################################################################################
#                               REST Service
####################################################################################
class MrsService(ABC):
    """`Service` Interface."""

    @abstractmethod
    def __init__(self, service_url: str) -> None:
        self._service_url: str = service_url
        self._auth_path: str = "/authentication/login"
        self._deauth_path: str = "/authentication/logout"
        self._session: MrsBaseSession = {"access_token": None, "gtid": None}

    async def get_metadata(self) -> JsonObject:
        """Get the underlying MRS metadata information of the REST service.

        Returns:
            metadata: A dictionary.

        Raises:
            HTTPError: If something goes wrong while trying to retrieve
                the data.
        """
        return await _get_metadata(url=self._service_url)


class Authenticating(MrsService):
    """Extends the service interface by adding the authentication interface."""

    async def get_auth_apps(self) -> AuthApps:
        """Get a list containing the authentication apps and vendor IDs
        registered for the service.

        Returns:
            auth_apps: A list of 2-key dictionaries, where keys are
                `name` and `vendor_id`.

        Raises:
            HTTPError: If something goes wrong while trying to retrieve
                the data.
        """
        req = Request(
            url=f"{self._service_url}/authentication/authApps",
            headers={"Accept": "application/json"},
            method="GET",
        )
        response = await asyncio.to_thread(
            urlopen, req, context=ssl.create_default_context()
        )
        if response.status != 200:
            raise HTTPError(
                url=response.url,
                code=response.status,
                msg=response.msg,
                hdrs=response.headers,
                fp=None,
            )

        return cast(
            AuthApps,
            json.loads(response.read(), object_hook=MrsJSONDataDecoder.convert_keys),
        )

    async def authenticate(self, **options: Unpack[AuthenticateOptions]) -> None:
        """Authenticate user to access protected REST resources.

        Raises:
            AuthenticationError: If something goes wrong during the authentication workflow.
        """
        request = MrsAuthenticate(
            service=self,
            request_path=f"{self._service_url}{self._auth_path}",
            **options,
        )
        return await request.submit()

    async def deauthenticate(self) -> None:
        """Logs you out (deauthenticate) from an authenticated service.

        Raises:
            DeauthenticationError: if no user is currently authenticated.
        """
        request = MrsDeauthenticate(
            service=self, request_path=f"{self._service_url}{self._deauth_path}"
        )
        return await request.submit()
