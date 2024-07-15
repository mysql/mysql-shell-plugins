# Copyright (c) 2024, Oracle and/or its affiliates.
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

from dataclasses import asdict, dataclass
import json
import os
import ssl
from typing import Any, Callable, Generic, NotRequired, Optional, TypedDict, cast
from unittest.mock import MagicMock

import pytest

from python.mrs_base_classes import BoolField, Filterable, HighOrderOperator, IMrsResourceDetails, IntField, MrsBaseObjectCreate, MrsBaseObjectDelete, MrsBaseObjectQuery, MrsBaseObjectUpdate, MrsJSONDataDecoder, MrsJSONDataEncoder, MrsQueryEncoder, Record, RecordNotFoundError, StringField, UndefinedDataClassField, UndefinedField  # type: ignore


####################################################################################
#                               Sample Data
####################################################################################
MRS_SERVICE_PORT = os.environ.get("MRS_SERVICE_PORT", "8445")
MRS_SERVICE_NAME = os.environ.get("MRS_SERVICE_NAME", "myService")
DATABASE = os.environ.get("MRS_SERVICE_NAME", "sakila")

TEST_FETCH_SAMPLE_DATA = [
    (  # multiple items
        {"where": {"first_name": {"like": "%%MA%%"}}},
        {
            "count": 3,
            "has_more": False,
            "items": [
                {
                    "actorId": 18,
                    "lastName": "RAMON",
                    "firstName": "MARTINEZ",
                    "lastUpdate": "2012-08-13 04:34:33.000000",
                },
                {
                    "actorId": 3,
                    "lastName": "CHASE",
                    "firstName": "AMACH",
                    "lastUpdate": "2006-02-15 04:34:33.000000",
                },
                {
                    "actorId": 7,
                    "lastName": "PEREZ",
                    "firstName": "MARIANO",
                    "lastUpdate": "2003-08-31 03:54:12.000000",
                },
            ],
            "limit": 25,
            "links": [],
            "offset": 0,
        },
    ),
    (  # zero items
        {"where": {"first_name": {"like": "%%MA%%"}}},
        {
            "count": 0,
            "has_more": False,
            "items": [],
            "limit": 25,
            "links": [],
            "offset": 0,
        },
    ),
    (  # one item
        {"where": {"first_name": {"like": "%%MA%%"}}},
        {
            "count": 1,
            "has_more": False,
            "items": [
                {
                    "actorId": 3,
                    "lastName": "CHASE",
                    "firstName": "AMACH",
                    "lastUpdate": "2006-02-15 04:34:33.000000",
                }
            ],
            "limit": 25,
            "links": [],
            "offset": 0,
        },
    ),
]

TEST_DATA_ENCODE_SAMPLE_DATA = [
    (
        {
            "player_id": 65,
            "gamer_tag": "Killerpollo",
            "favorite_game": "Gears of War 2",
            "friends": [
                {
                    "player_id": 33,
                    "gamer_tag": "Dr. Winner",
                    "favorite_game": "Halo 3",
                    "friends": None,
                },
                {
                    "player_id": 2,
                    "gamer_tag": "Speedy",
                    "favorite_game": "Resident Evil 4",
                    "friends": [
                        {
                            "player_id": 87,
                            "gamer_tag": "Mr. Ripper",
                            "favorite_game": "Dead Space",
                            "friends": [
                                {
                                    "player_id": 134,
                                    "gamer_tag": "KalJu",
                                    "favorite_game": "Mario Kart",
                                    "friends": None,
                                }
                            ],
                        }
                    ],
                },
            ],
        },
        {
            "playerId": 65,
            "gamerTag": "Killerpollo",
            "favoriteGame": "Gears of War 2",
            "friends": [
                {
                    "playerId": 33,
                    "gamerTag": "Dr. Winner",
                    "favoriteGame": "Halo 3",
                    "friends": None,
                },
                {
                    "playerId": 2,
                    "gamerTag": "Speedy",
                    "favoriteGame": "Resident Evil 4",
                    "friends": [
                        {
                            "playerId": 87,
                            "gamerTag": "Mr. Ripper",
                            "favoriteGame": "Dead Space",
                            "friends": [
                                {
                                    "playerId": 134,
                                    "gamerTag": "KalJu",
                                    "favoriteGame": "Mario Kart",
                                    "friends": None,
                                }
                            ],
                        }
                    ],
                },
            ],
        },
    ),
]

TEST_DATA_DECODE_SAMPLE_DATA = [
    (TEST_DATA_ENCODE_SAMPLE_DATA[0][1], TEST_DATA_ENCODE_SAMPLE_DATA[0][0])
]


####################################################################################
#                               Custom Types
####################################################################################
class ActorDetails(IMrsResourceDetails):
    actor_id: int
    first_name: str
    last_name: str
    last_update: str


class ActorData(TypedDict):
    actor_id: NotRequired[int]
    first_name: str
    last_name: str
    last_update: NotRequired[str]


@dataclass(init=False, repr=True)
class Actor(Record):

    # For data attributes, `None` means "NULL" and
    # `UndefinedField` means "not set or undefined"
    actor_id: int | UndefinedDataClassField
    first_name: str | UndefinedDataClassField
    last_name: str | UndefinedDataClassField
    last_update: str | UndefinedDataClassField

    def __init__(self, data: ActorData) -> None:
        """Actor data class."""
        self._request_path: str = "https://localhost:8444/myService/sakila/actor"
        self.__load_fields(data)

    def __load_fields(self, data: ActorData) -> None:
        """Refresh data fields based on the input data."""
        self.actor_id = data.get("actor_id", UndefinedField)
        self.first_name = data.get("first_name", UndefinedField)
        self.last_name = data.get("last_name", UndefinedField)
        self.last_update = data.get("last_update", UndefinedField)

        for key in Record._reserved_keys:
            self.__dict__.update({key: data.get(key)})

    @classmethod
    def get_primary_key_name(cls) -> Optional[str]:
        """Get primary key name (Class Method)."""
        return "actor_id"


class Obj1Details(IMrsResourceDetails):
    an_int: int
    a_str: str
    a_bool: bool
    a_list_of_types: list["Obj2Data"]


class Obj1Data(TypedDict, total=False):
    an_int: int
    a_str: str
    a_bool: bool
    a_list_of_types: list["Obj2Data"]


class Obj1Filterable(Generic[Filterable], HighOrderOperator[Filterable], total=False):
    an_int: IntField
    a_str: StringField
    a_bool: BoolField
    a_list_of_types: list["Obj2Data"]


class Obj2Details(IMrsResourceDetails):
    an_int: int
    a_str: str
    a_type: "Obj3Data"


class Obj2Data(TypedDict, total=False):
    an_int: int
    a_str: str
    a_type: "Obj3Data"


class Obj3Details(IMrsResourceDetails):
    an_int: int
    a_str: str


class Obj3Data(TypedDict, total=False):
    an_int: int
    a_str: str


####################################################################################
#                               Utilities
####################################################################################
@pytest.fixture
def service_url():
    return f"https://localhost:{MRS_SERVICE_PORT}/{MRS_SERVICE_NAME}/{DATABASE}"


@pytest.fixture
def mock_urlopen(mocker) -> MagicMock:
    return mocker.patch("python.mrs_base_classes.urlopen")


@pytest.fixture
def mock_request_class(mocker) -> MagicMock:
    return mocker.patch("python.mrs_base_classes.Request")


@pytest.fixture
def urlopen_simulator() -> Callable[[dict], MagicMock]:
    """Construction to mock the method 'urlopen'."""

    def _urlopen_simulator(urlopen_read: dict) -> MagicMock:
        """urlopen will return whatever 'urlopen_read' is assigned to"""
        simulator = MagicMock()
        simulator.read.return_value = json.dumps(urlopen_read).encode()
        return simulator

    return _urlopen_simulator


@pytest.fixture
def mock_create_default_context(mocker) -> MagicMock:
    return mocker.patch("python.mrs_base_classes.ssl.create_default_context")


async def validate_url(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    request: MrsBaseObjectQuery | MrsBaseObjectDelete,
    expected_url: str,
    mock_request_class: Optional[MagicMock] = None,
) -> None:
    """Check final URL is built correctly."""
    # Let urlopen return whatever 'urlopen_read' is assigned to
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=None)
    mock_create_default_context.return_value = expected_context = (
        ssl.create_default_context()
    )

    if isinstance(request, MrsBaseObjectQuery):
        _ = (
            await request.fetch()
        )  # returns None because urlopen was mocked to return None
        # check urlopen was called once and the url that was built matches the expected
        mock_urlopen.assert_called_once_with(expected_url, context=expected_context)
    else:
        _ = await request.submit()
        mock_request_class.assert_called_once_with(url=expected_url, method="DELETE")


####################################################################################
#                      Test "submit" Method (create*'s backbone)
####################################################################################
@pytest.mark.parametrize(
    "data, urlopen_read",
    [
        (
            {"first_name": "Shigeru", "last_name": "Miyamoto"},
            {
                "actorId": 65,
                "firstName": "Shigeru",
                "lastName": "Miyamoto",
                "lastUpdate": "2006-02-15 04:34:33.000000",
            },
        ),
    ],
)
async def test_create_submit(
    mock_urlopen: MagicMock,
    mock_request_class: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    data: dict[str, Any],
    urlopen_read: dict[str, Any],
):
    """Check `MrsBaseObjectCreate.submit()`."""
    request = MrsBaseObjectCreate[ActorData, ActorDetails](f"{service_url}/actor", data)

    mock_urlopen.return_value = urlopen_simulator(urlopen_read=urlopen_read)
    mock_create_default_context.return_value = ssl.create_default_context()

    response = await request.submit()

    mock_request_class.assert_called_once_with(
        url=f"{service_url}/actor",
        data=json.dumps(obj=data, cls=MrsJSONDataEncoder).encode(),
        method="POST",
    )
    mock_urlopen.assert_called_once()

    assert (
        response["first_name"]
        == MrsJSONDataDecoder.convert_keys(urlopen_read)["first_name"]
    )
    assert (
        response["last_name"]
        == MrsJSONDataDecoder.convert_keys(urlopen_read)["last_name"]
    )


####################################################################################
#                      Test "submit" Method (update*'s backbone)
####################################################################################
@pytest.mark.parametrize(
    "data, urlopen_read",
    [
        (
            Actor(
                cast(
                    ActorData,
                    ActorDetails(
                        {
                            "first_name": "Shigeru",
                            "last_name": "Miyamoto",
                            "_metadata": {
                                "etag": "33ED258BECDF269717782F5569C69F88CCCA2DF11936108C68C44100FF063D4D"
                            },
                        }
                    ),
                )
            ),
            {
                "actorId": 65,
                "firstName": "Shigeru",
                "lastName": "Miyamoto",
                "lastUpdate": "2006-02-15 04:34:33.000000",
                "_metadata": {
                    "etag": "33ED258BECDF269717782F5569C69F88CCCA2DF11936108C68C44100FF063D4D"
                },
            },
        ),
    ],
)
async def test_update_submit(
    mock_urlopen: MagicMock,
    mock_request_class: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    data: Actor,
    urlopen_read: dict[str, Any],
):
    """Check `MrsBaseObjectUpdate.submit()`."""
    prk = cast(str, data.get_primary_key_name())

    record_id = getattr(data, prk)
    request = MrsBaseObjectUpdate[Actor, ActorDetails](
        f"{service_url}/actor/{record_id}", data
    )

    mock_urlopen.return_value = urlopen_simulator(urlopen_read=urlopen_read)
    mock_create_default_context.return_value = ssl.create_default_context()

    response = await request.submit()

    mock_request_class.assert_called_once_with(
        url=f"{service_url}/actor/{record_id}",
        headers={"If-Match": data.__dict__["_metadata"]["etag"]},
        data=json.dumps(obj=asdict(data), cls=MrsJSONDataEncoder).encode(),
        method="PUT",
    )
    mock_urlopen.assert_called_once()

    assert (
        response["first_name"]
        == MrsJSONDataDecoder.convert_keys(urlopen_read)["first_name"]
    )
    assert (
        response["last_name"]
        == MrsJSONDataDecoder.convert_keys(urlopen_read)["last_name"]
    )


####################################################################################
#                               Test "select" Option
####################################################################################
@pytest.mark.parametrize(
    "query", [{"select": ["a_str", "a_list_of_types.a_type.a_str"]}]
)
async def test_select_with_list_for_inclusion(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    query: dict[str, Any],
):
    """Specifying `select` as a list. Checking `include` mechanism."""
    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[Obj1Data, Obj1Details](
            f"{service_url}/dbobject", options=query
        ),
        expected_url=f"{service_url}/dbobject?f=aStr%2CaListOfTypes.aType.aStr",
    )


@pytest.mark.parametrize(
    "query", [{"select": {"a_str": True, "a_list_of_types.a_type.a_str": True}}]
)
async def test_select_with_mapper_for_inclusion(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    query: dict[str, Any],
):
    """Specifying `select` as a dictionary. Checking `include` mechanism."""
    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[Obj1Data, Obj1Details](
            f"{service_url}/dbobject", options=query
        ),
        expected_url=f"{service_url}/dbobject?f=aStr%2CaListOfTypes.aType.aStr",
    )


@pytest.mark.parametrize(
    "query", [{"select": {"a_str": False, "a_list_of_types.a_type.a_str": False}}]
)
async def test_select_with_mapper_for_exclusion(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    query: dict[str, Any],
):
    """Specifying `select` as a dictionary. Checking `exclude` mechanism."""
    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[Obj1Data, Obj1Details](
            f"{service_url}/dbobject", options=query
        ),
        expected_url=f"{service_url}/dbobject?f=%21aStr%2C%21aListOfTypes.aType.aStr",
    )


####################################################################################
#                               Test "where" Option
####################################################################################
@pytest.mark.parametrize(
    "query",
    [{"where": {"an_int": 10}}],
)
async def test_where_field_is_equal_with_implicit_filter(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    query: dict[str, Any],
    mock_request_class: MagicMock
):
    """Specifying `where`. Checking implicit filter."""
    for cls_ in (MrsBaseObjectQuery, MrsBaseObjectDelete):
        if cls_ == MrsBaseObjectQuery:
            request = cls_[Obj1Data, Obj1Details](
                f"{service_url}/dbobject", options=query
            )
        else:
            request = cls_[Obj1Filterable](f"{service_url}/dbobject", where=query.get("where"))

        await validate_url(
            mock_urlopen=mock_urlopen,
            urlopen_simulator=urlopen_simulator,
            mock_create_default_context=mock_create_default_context,
            request=request,
            expected_url=f"{service_url}/dbobject?q=%7B%22anInt%22%3A10%7D",
            mock_request_class=mock_request_class,
        )


@pytest.mark.parametrize(
    "query",
    [{"where": {"an_int": {"equals": 10}}}],
)
async def test_where_field_is_equal_with_explicit_filter(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    query: dict[str, Any],
    mock_request_class: MagicMock
):
    """Specifying `where`. Checking explicit filter."""
    for cls_ in (MrsBaseObjectQuery, MrsBaseObjectDelete):
        if cls_ == MrsBaseObjectQuery:
            request = cls_[Obj1Data, Obj1Details](
                f"{service_url}/dbobject", options=query
            )
        else:
            request = cls_[Obj1Filterable](f"{service_url}/dbobject", where=query.get("where"))

        await validate_url(
            mock_urlopen=mock_urlopen,
            urlopen_simulator=urlopen_simulator,
            mock_create_default_context=mock_create_default_context,
            request=request,
            expected_url=f"{service_url}/dbobject?q=%7B%22anInt%22%3A%7B%22%24eq%22%3A10%7D%7D",
            mock_request_class=mock_request_class,
        )


@pytest.mark.parametrize(
    "query",
    [{"where": {"a_str": None}}],
)
async def test_where_field_is_null(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    query: dict[str, Any],
    mock_request_class: MagicMock
):
    """Specifying `where`. Checking filter where field is NULL."""
    for cls_ in (MrsBaseObjectQuery, MrsBaseObjectDelete):
        if cls_ == MrsBaseObjectQuery:
            request = cls_[Obj1Data, Obj1Details](
                f"{service_url}/dbobject", options=query
            )
        else:
            request = cls_[Obj1Filterable](f"{service_url}/dbobject", where=query.get("where"))

        await validate_url(
            mock_urlopen=mock_urlopen,
            urlopen_simulator=urlopen_simulator,
            mock_create_default_context=mock_create_default_context,
            request=request,
            expected_url=f"{service_url}/dbobject?q=%7B%22aStr%22%3A%7B%22%24null%22%3Anull%7D%7D",
            mock_request_class=mock_request_class,
        )


@pytest.mark.parametrize(
    "query",
    [{"where": {"a_str": {"not": None}}}],
)
async def test_where_field_is_not_null(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    query: dict[str, Any],
    mock_request_class: MagicMock
):
    """Specifying `where`. Checking filter where field isn't NULL."""
    for cls_ in (MrsBaseObjectQuery, MrsBaseObjectDelete):
        if cls_ == MrsBaseObjectQuery:
            request = cls_[Obj1Data, Obj1Details](
                f"{service_url}/dbobject", options=query
            )
        else:
            request = cls_[Obj1Filterable](f"{service_url}/dbobject", where=query.get("where"))

        await validate_url(
            mock_urlopen=mock_urlopen,
            urlopen_simulator=urlopen_simulator,
            mock_create_default_context=mock_create_default_context,
            request=request,
            expected_url=f"{service_url}/dbobject?q=%7B%22aStr%22%3A%7B%22%24notnull%22%3Anull%7D%7D",
            mock_request_class=mock_request_class,
        )


####################################################################################
#                               Test "skip" Option
####################################################################################
@pytest.mark.parametrize(
    "query",
    [{"skip": 7}],
)
async def test_skip(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    query: dict[str, Any],
):
    """Specifying `skip`. It represents the `offset`."""
    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[Obj1Data, Obj1Details](
            f"{service_url}/dbobject", options=query
        ),
        expected_url=f"{service_url}/dbobject?offset=7",
    )


####################################################################################
#                               Test "cursor" Option
####################################################################################
@pytest.mark.parametrize(
    "query",
    [{"cursor": {"actor_id": 13}}],  # cursor is exclusive
)
async def test_cursor(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    query: dict[str, Any],
):
    """Check cursor-based pagination."""
    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[ActorData, ActorDetails](
            f"{service_url}/actor", options=query
        ),
        expected_url=f"{service_url}/actor?q=%7B%22actorId%22%3A%7B%22%24gt%22%3A13%7D%7D",
    )


####################################################################################
#                               Test "take" Option
####################################################################################
@pytest.mark.parametrize(
    "query",
    [{"take": 3}],
)
async def test_take(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    query: dict[str, Any],
):
    """Specifying `take`. It represents the `limit`."""
    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[Obj1Data, Obj1Details](
            f"{service_url}/dbobject", options=query
        ),
        expected_url=f"{service_url}/dbobject?limit=3",
    )


####################################################################################
#                               Test "order_by" Option
####################################################################################
@pytest.mark.parametrize(
    "query",
    [{"order_by": {"first_name": "ASC"}}],
)
async def test_order_by_asc_without_filter(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    query: dict[str, Any],
):
    """Check `order_by` option."""
    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[ActorData, ActorDetails](
            f"{service_url}/actor", options=query
        ),
        expected_url=f"{service_url}/actor?q=%7B%22%24orderby%22%3A%7B%22firstName%22%3A%22ASC%22%7D%7D",
    )


@pytest.mark.parametrize(
    "query",
    [{"where": {"actor_id": 10}, "order_by": {"first_name": "ASC"}}],
)
async def test_order_by_asc_with_filter(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    query: dict[str, Any],
):
    """Check `order_by` and `where` options."""
    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[ActorData, ActorDetails](
            f"{service_url}/actor", options=query
        ),
        expected_url=f"{service_url}/actor?q=%7B%22actorId%22%3A10%2C%22%24orderby%22%3A%7B%22firstName%22%3A%22ASC%22%7D%7D",
    )


@pytest.mark.parametrize(
    "query",
    [{"where": {"actor_id": 10}, "order_by": {"first_name": "DESC"}}],
)
async def test_order_by_desc_with_filter(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    query: dict[str, Any],
):
    """Check `order_by` and `where` options."""
    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[ActorData, ActorDetails](
            f"{service_url}/actor", options=query
        ),
        expected_url=f"{service_url}/actor?q=%7B%22actorId%22%3A10%2C%22%24orderby%22%3A%7B%22firstName%22%3A%22DESC%22%7D%7D",
    )


####################################################################################
#                      Test "fetch" Method (find*'s backbone)
####################################################################################
@pytest.mark.parametrize("query, urlopen_read", TEST_FETCH_SAMPLE_DATA)
async def test_fetch(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    query: dict[str, Any],
    urlopen_read: dict[str, Any],
):
    """Check `MrsBaseObjectQuery.fetch()`."""
    request = MrsBaseObjectQuery[ActorData, ActorDetails](
        f"{service_url}/actor", options=query
    )
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=urlopen_read)
    mock_create_default_context.return_value = ssl.create_default_context()

    response = await request.fetch()
    mock_urlopen.assert_called_once()
    assert response["items"] == MrsJSONDataDecoder.convert_keys(urlopen_read)["items"]


@pytest.mark.parametrize("query, urlopen_read", TEST_FETCH_SAMPLE_DATA)
async def test_fetch_one(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    query: dict[str, Any],
    urlopen_read: dict[str, Any],
):
    """Check `MrsBaseObjectQuery.fetch_one()`."""
    request = MrsBaseObjectQuery[ActorData, ActorDetails](
        f"{service_url}/actor", options=query
    )
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=urlopen_read)
    mock_create_default_context.return_value = ssl.create_default_context()

    response = await request.fetch_one()
    mock_urlopen.assert_called_once()

    if not urlopen_read["items"]:
        assert response is None
    else:
        assert response == MrsJSONDataDecoder.convert_keys(urlopen_read)["items"][0]


@pytest.mark.parametrize("query, urlopen_read", TEST_FETCH_SAMPLE_DATA)
async def test_fetch_all(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    query: dict[str, Any],
    urlopen_read: dict[str, Any],
):
    """Check `MrsBaseObjectQuery.fetch_all()`."""
    request = MrsBaseObjectQuery[ActorData, ActorDetails](
        f"{service_url}/actor", options=query
    )
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=urlopen_read)
    mock_create_default_context.return_value = ssl.create_default_context()

    response = await request.fetch_all()
    mock_urlopen.assert_called_once()

    if not urlopen_read["items"]:
        assert response["items"] == []
    else:
        assert (
            response["items"] == MrsJSONDataDecoder.convert_keys(urlopen_read)["items"]
        )


####################################################################################
#           Test "Record" Abstract Class (Data Class Objects' backbone)
####################################################################################
def test_hypermedia_property_access():
    """Check hypermedia information is inaccessible."""

    class SubjectUnderTest(Record):
        def __init__(self) -> None:
            self.__dict__.update({"_metadata": "foo", "links": "bar"})

        @classmethod
        def get_primary_key_name(cls) -> Optional[str]:
            return "dummy"

    sut = SubjectUnderTest()

    with pytest.raises(
        AttributeError, match="'SubjectUnderTest' object has no attribute '_metadata'"
    ):
        print(sut._metadata)

    with pytest.raises(
        AttributeError, match="'SubjectUnderTest' object has no attribute 'links'"
    ):
        print(sut.links)


def test_hypermedia_property_modifications():
    """Check hypermedia information cannot be modified."""

    class SubjectUnderTest(Record):
        def __init__(self) -> None:
            self.__dict__.update({"_metadata": "foo", "links": "bar"})

        @classmethod
        def get_primary_key_name(cls) -> Optional[str]:
            return "dummy"

    sut = SubjectUnderTest()

    with pytest.raises(
        AttributeError,
        match="Attribute '_metadata' of 'SubjectUnderTest' object cannot be changed.",
    ):
        sut._metadata = "baz"

    with pytest.raises(
        AttributeError,
        match="Attribute 'links' of 'SubjectUnderTest' object cannot be changed.",
    ):
        sut.links = "baz"


def test_hypermedia_property_removal():
    """Check hypermedia information cannot be deleted."""

    class SubjectUnderTest(Record):
        def __init__(self) -> None:
            self.__dict__.update({"_metadata": "foo", "links": "bar"})

        @classmethod
        def get_primary_key_name(cls) -> Optional[str]:
            return "dummy"

    sut = SubjectUnderTest()

    with pytest.raises(
        AttributeError,
        match="Attribute '_metadata' of 'SubjectUnderTest' object cannot be deleted.",
    ):
        del sut._metadata

    with pytest.raises(
        AttributeError,
        match="Attribute 'links' of 'SubjectUnderTest' object cannot be deleted.",
    ):
        del sut.links


def test_hypermedia_property_indexing():
    """Check hypermedia information is hidden."""

    class SubjectUnderTest(Record):
        def __init__(self) -> None:
            self.__dict__.update({"_metadata": "foo", "links": "bar"})

        @classmethod
        def get_primary_key_name(cls) -> Optional[str]:
            return "dummy"

    sut = SubjectUnderTest()

    assert "_metadata" not in dir(sut)
    assert "links" not in dir(sut)


####################################################################################
#                        Test Data Encoder & Decoder
####################################################################################
@pytest.mark.parametrize("data, converted_data", TEST_DATA_ENCODE_SAMPLE_DATA)
def test_encode_data(data: dict[str, Any], converted_data: dict[str, Any]):
    """Check encoder converts keys from snake to camel case recursively.

    Encoding happens when sending data out to the Router.
    """
    assert MrsJSONDataEncoder.convert_keys(data) == converted_data


@pytest.mark.parametrize("data, converted_data", TEST_DATA_DECODE_SAMPLE_DATA)
def test_decode_data(data: dict[str, Any], converted_data: dict[str, Any]):
    """Check decoder converts keys from camel to snake case recursively.

    Decoding happens when parsing data received from to the Router.
    """
    assert MrsJSONDataDecoder.convert_keys(data) == converted_data


####################################################################################
#                           Test Query Encoder
####################################################################################
@pytest.mark.parametrize(
    "sample_filter, expected_payload",
    [
        (
            {
                "where": {
                    "AND": [
                        {"first_name": "PENELOPE"},
                        {"actor_id": {"gte": 3}},
                        {"actor_id": {"ne": 54}},
                    ],
                }
            },
            '{"$and":[{"firstName":"PENELOPE"},{"actorId":{"$gte":3}},{"actorId":{"$ne":54}}]}',
        ),
        (
            {
                "where": {
                    "OR": [{"first_name": "MICHAEL"}, {"last_name": {"like": "%%AB%%"}}]
                }
            },
            '{"$or":[{"firstName":"MICHAEL"},{"lastName":{"$like":"%%AB%%"}}]}',
        ),
        (
            {
                "where": {"first_name": {"like": "%%ED%%"}},
                "order_by": {"actor_id": "DESC"},
            },
            '{"firstName":{"$like":"%%ED%%"},"$orderby":{"actorId":"DESC"}}',
        ),
        (
            {"where": {"last_update": None}},
            '{"lastUpdate":{"$null":null}}',
        ),
    ],
)
async def test_query_encoder(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    service_url: str,
    sample_filter: dict[str, Any],
    expected_payload: str,
):
    """Check the custom query encoder parses and serializes the query filter ('where') correctly."""
    request = MrsBaseObjectQuery[ActorData, ActorDetails](
        f"{service_url}/actor", options=sample_filter
    )

    assert (
        json.dumps(obj=request.where, cls=MrsQueryEncoder, separators=(",", ":"))
        == expected_payload
    )


####################################################################################
#                    Test "UndefinedDataClassField" Class
####################################################################################
def test_undefined_is_singleton():
    """Check a single instance of `UndefinedDataClassField` exist at any given time.

    In other words, all existing instances must point to the same memory address.
    """
    identity = id(UndefinedDataClassField())
    for instance in (UndefinedDataClassField() for _ in range(1000)):
        assert id(instance) == identity


####################################################################################
#                           Test Custom Exceptions
####################################################################################
def test_record_not_found_exception():
    """Check custom message is shown when raising `RecordNotFoundError"""
    with pytest.raises(
        RecordNotFoundError,
        match=RecordNotFoundError._default_msg,
    ):
        raise RecordNotFoundError
