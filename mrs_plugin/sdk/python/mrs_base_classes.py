# Copyright (c) 2024, Oracle and/or its affiliates.

import asyncio
import json
import ssl
from datetime import datetime
from collections.abc import Iterable
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Generic,
    Literal,
    Mapping,
    Optional,
    Sequence,
    TypeAlias,
    TypedDict,
    TypeVar,
    Union,
    cast,
)
from urllib.parse import urlencode
from urllib.request import urlopen


####################################################################################
#               Custom exceptions utilized by the MRS Python SDK
####################################################################################
class MrsError(Exception):
    """Base class for `MySQL Rest Service` errors."""


class RecordNotFoundError(MrsError):
    """Raised when a record doesn't exist in the database."""


####################################################################################
#                                 Custom Types
####################################################################################
EqOperand = TypeVar("EqOperand", bound=str | int | float | datetime)


class EqOperator(Generic[EqOperand], TypedDict):
    equals: EqOperand


RangeOperand = TypeVar("RangeOperand", bound=int | float | datetime)


class GtOperator(Generic[RangeOperand], TypedDict):
    gt: RangeOperand


class GteOperator(Generic[RangeOperand], TypedDict):
    gte: RangeOperand


class LtOperator(Generic[RangeOperand], TypedDict):
    lt: RangeOperand


class LteOperator(Generic[RangeOperand], TypedDict):
    lte: RangeOperand


NotOperator = TypedDict("NotOperator", {"not": None})


PatternOperand = TypeVar("PatternOperand", bound=str)


class PatternOperator(Generic[PatternOperand], TypedDict):
    like: PatternOperand


IntField: TypeAlias = (
    int
    | EqOperator[int]
    | GtOperator[int]
    | GteOperator[int]
    | LtOperator[int]
    | LteOperator[int]
    | NotOperator
)
DatetimeField: TypeAlias = (
    datetime
    | EqOperator[datetime]
    | GtOperator[datetime]
    | GteOperator[datetime]
    | LtOperator[datetime]
    | LteOperator[datetime]
    | NotOperator
)
StringField: TypeAlias = str | EqOperator[str] | PatternOperator[str] | NotOperator
BoolField: TypeAlias = bool | EqOperator[bool] | NotOperator


Filterable = TypeVar("Filterable", bound=Optional[Mapping])
Selectable = TypeVar("Selectable", bound=Optional[Mapping | Sequence])
Sortable = TypeVar("Sortable", bound=Optional[Mapping])
Field = TypeVar("Field", bound=Optional[str])
NestedField = TypeVar("NestedField", bound=Optional[str])


class HighOrderOperator(Generic[Filterable], TypedDict, total=False):
    AND: list[Filterable]
    OR: list[Filterable]


Order: TypeAlias = Literal["ASC", "DESC"]


class FindUniqueOptions(
    Generic[Filterable, Selectable, Field, NestedField], TypedDict, total=False
):
    select: list[Field | NestedField] | Selectable


class FindFirstOptions(
    Generic[Filterable, Selectable, Sortable, Field, NestedField],
    FindUniqueOptions[Filterable, Selectable, Field, NestedField],
    total=False,
):
    where: Filterable
    skip: int
    order_by: Sortable


Item = TypeVar("Item", bound=Mapping)
ProgressCallback: TypeAlias = Callable[[list[Item]], None]


class FindManyOptions(
    Generic[Item, Filterable, Selectable, Sortable, Field, NestedField],
    FindFirstOptions[Filterable, Selectable, Sortable, Field, NestedField],
    total=False,
):
    take: int
    iterator: bool


class FindAllOptions(
    Generic[Item, Filterable, Selectable, Sortable, Field, NestedField],
    FindFirstOptions[Filterable, Selectable, Sortable, Field, NestedField],
    total=False,
):
    progress: ProgressCallback


####################################################################################
#                               Core Implementation
####################################################################################
def pascal_to_camel(name):
    return name[0].lower() + name[1:]


def snake_to_camel(name):
    return pascal_to_camel(snake_to_pascal(name))


def snake_to_pascal(name):
    return "".join(name.title().split("_"))


class MrsJSONEncoder(json.JSONEncoder):
    _ords_keyword = {
        "AND": "$and",
        "OR": "$or",
        "equals": "$eq",
        "gt": "$gt",
        "gte": "$gte",
        "like": "$like",
        "lt": "$lt",
        "lte": "$lte",
        "not": "$notnull",
        "orderBy": "$orderby",
    }

    def encode(self, o: Any) -> str:
        if isinstance(o, dict):
            json_obj = {}
            for key_item, value_item in o.items():
                key_in_camel_case = snake_to_camel(key_item)
                json_key = self._ords_keyword.get(key_in_camel_case, key_in_camel_case)
                # handle $null vs $notnull
                if value_item is None and json_key != self._ords_keyword.get("not"):
                    json_obj.update({json_key: {"$null": None}})
                elif isinstance(value_item, dict):
                    json_obj.update({json_key: json.loads(self.encode(value_item))})
                else:
                    json_obj.update({json_key: value_item})
            return super().encode(json_obj)
        return super().encode(o)


class MrsResourceLink(TypedDict):
    rel: str
    href: str


class MrsResourceMetadata(TypedDict):
    etag: str


class IMrsResourceData(TypedDict):
    _metadata: MrsResourceMetadata
    links: list[MrsResourceLink]


class IMrsResourceCollectionData(TypedDict):
    items: list[IMrsResourceData]
    limit: int
    offset: int
    # the keys in the JSON response are lowerCamelCase
    hasMore: bool
    count: int
    links: list[MrsResourceLink]


class Record:
    _reserved_keys = ("_reserved_keys", "_metadata", "links")

    if not TYPE_CHECKING:

        def __getattribute__(self, name: str) -> Any:
            if name in Record._reserved_keys:
                raise AttributeError(
                    f"'{type(self).__name__}' object has no attribute '{name}'"
                )
            return super(Record, self).__getattribute__(name)

        def __setattr__(self, name: str, value: Any) -> None:
            if name in Record._reserved_keys:
                raise AttributeError(
                    f"Attribute '{name}' of '{type(self).__name__}' object cannot be changed."
                )
            super(Record, self).__setattr__(name, value)

        def __delattr__(self, name: str) -> None:
            if name in Record._reserved_keys:
                raise AttributeError(
                    f"Attribute '{name}' of '{type(self).__name__}' object cannot be deleted."
                )
            super(Record, self).__delattr__(name)

    def __dir__(self) -> Iterable[str]:
        return [
            key
            for key in super(Record, self).__dir__()
            if key not in Record._reserved_keys
        ]


class MrsBaseSession:
    pass


class MrsBaseService:
    def __init__(self, service_url: str, auth_path: Optional[str] = None) -> None:
        self.service_url = service_url
        self.auth_path = auth_path
        self.session = MrsBaseSession()


class MrsBaseSchema:
    def __init__(self, service: MrsBaseService, request_path: str) -> None:
        self.service = service
        self.request_path = request_path


# the name is not good, but for now we keep the same terminology used in TS
class MrsBaseObjectQuery(Generic[Item]):
    @staticmethod
    def __snake_to_camel_field(field: str) -> str:
        return ".".join([snake_to_camel(field) for field in field.split(".")])

    def __init__(
        self,
        request_path: str,
        options: Optional[Union[FindManyOptions, FindFirstOptions, FindUniqueOptions]],
    ) -> None:
        self.request_path: str = request_path
        self.where: Optional[dict] = None
        self.exclude: list[str] = []
        self.include: list[str] = []
        self.offset: Optional[int] = None
        self.limit: Optional[int] = None

        if options is None:
            return

        all_available_options = cast(FindManyOptions, options)

        where = all_available_options.get("where")
        order_by = all_available_options.get("order_by")

        if where:
            if order_by:
                where.update({"order_by": order_by})
            self.where = where
        elif order_by:
            self.where = {"order_by": order_by}

        select = all_available_options.get("select")

        if isinstance(select, list):
            self.include = select
            self.exclude = []
        elif isinstance(select, dict):
            self.include = [key for key, value in select.items() if value is True]
            self.exclude = [key for key, value in select.items() if value is False]

        self.limit = all_available_options.get("take")
        self.offset = all_available_options.get("skip")

    async def fetch(self) -> IMrsResourceCollectionData:
        query: dict[str, object] = {}

        if self.where:
            query["q"] = json.dumps(
                obj=self.where, cls=MrsJSONEncoder, separators=(",", ":")
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

        if self.offset:
            query["offset"] = self.offset

        querystring = urlencode(query)
        url = f"{self.request_path}?{querystring}"

        context = ssl.create_default_context()

        data = await asyncio.to_thread(urlopen, url, context=context)

        return json.loads(data.read())

    async def fetch_all(
        self, progress: Optional[ProgressCallback] = None
    ) -> IMrsResourceCollectionData:
        has_more = True
        res: IMrsResourceCollectionData = {
            "count": 0,
            "hasMore": False,
            "items": [],
            "limit": 25,
            "links": [],
            "offset": 0,
        }

        while has_more:
            current = await self.fetch()

            if current is None:
                break

            has_more = current["hasMore"]

            if res is None:
                res = current
            else:
                # increase the global response count
                res["count"] += current["count"]
                res["hasMore"] = has_more
                # add the remaining items
                res["items"].extend(current["items"])
                res["limit"] = current["limit"]
                res["links"] = current["links"]
                res["offset"] = current["offset"]

            if progress:
                # callback with the current status
                progress([cast(Item, item) for item in res["items"]])

            self.offset = res["count"]

        return res

    async def fetch_one(self) -> Optional[IMrsResourceData]:
        # impose artificial limit
        self.limit = 1

        response = await self.fetch()

        if len(response["items"]) == 0:
            return None

        return response["items"][0]
