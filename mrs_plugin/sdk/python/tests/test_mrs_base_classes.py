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

import json
import os
import ssl
from datetime import datetime
from typing import Any, Callable, Type, TypedDict
from unittest.mock import MagicMock

import pytest

from python.mrs_base_classes import MrsBaseObjectQuery, Record  # type: ignore

MRS_SERVICE_PORT = os.environ.get("MRS_SERVICE_PORT", "8445")
MRS_SERVICE_NAME = os.environ.get("MRS_SERVICE_NAME", "myService")
DATABASE = os.environ.get("MRS_SERVICE_NAME", "sakila")


class Actor(TypedDict, total=False):
    actor_id: int
    first_name: str
    last_name: str
    last_update: datetime


class DbObject1(TypedDict, total=False):
    an_int: int
    a_str: str
    a_bool: bool
    a_list_of_types: list["DbObject2"]


class DbObject2(TypedDict, total=False):
    an_int: int
    a_str: str
    a_type: "DbObject3"


class DbObject3(TypedDict, total=False):
    an_int: int
    a_str: str


@pytest.fixture
def my_obj_query_cls():
    return MrsBaseObjectQuery


@pytest.fixture
def service_url():
    return f"https://localhost:{MRS_SERVICE_PORT}/{MRS_SERVICE_NAME}/{DATABASE}"


@pytest.fixture
def mock_urlopen(mocker) -> MagicMock:
    return mocker.patch("python.mrs_base_classes.urlopen")


@pytest.fixture
def urlopen_simulator() -> Callable[[dict], MagicMock]:

    def _urlopen_simulator(urlopen_read: dict) -> MagicMock:
        simulator = MagicMock()
        simulator.read.return_value = json.dumps(urlopen_read).encode()
        return simulator

    return _urlopen_simulator


@pytest.fixture
def mock_create_default_context(mocker) -> MagicMock:
    return mocker.patch("python.mrs_base_classes.ssl.create_default_context")


@pytest.mark.parametrize(
    "query", [{"select": ["a_str", "a_list_of_types.a_type.a_str"]}]
)
async def test_sdk_select_include_field_names(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    my_obj_query_cls: Type[MrsBaseObjectQuery],
    service_url: str,
    query: dict[str, Any],
):
    expected_url = f"{service_url}/dbobject?f=aStr%2CaListOfTypes.aType.aStr"

    request = my_obj_query_cls[DbObject1](f"{service_url}/dbobject", options=query)
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=None)
    mock_create_default_context.return_value = expected_context = (
        ssl.create_default_context()
    )

    await request.fetch()
    mock_urlopen.DbObject2(expected_url, context=expected_context)


@pytest.mark.parametrize(
    "query", [{"select": {"a_str": True, "a_list_of_types.a_type.a_str": True}}]
)
async def test_sdk_select_field_mapper(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    my_obj_query_cls: Type[MrsBaseObjectQuery],
    service_url: str,
    query: dict[str, Any],
):
    expected_url = f"{service_url}/dbobject?f=aStr%2CaListOfTypes.aType.aStr"

    request = my_obj_query_cls[DbObject1](f"{service_url}/dbobject", options=query)
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=None)
    mock_create_default_context.return_value = expected_context = (
        ssl.create_default_context()
    )

    await request.fetch()
    mock_urlopen.DbObject2(expected_url, context=expected_context)


@pytest.mark.parametrize(
    "query", [{"select": {"a_str": False, "a_list_of_types.a_type.a_str": False}}]
)
async def test_sdk_omit_field_mapper(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    my_obj_query_cls: Type[MrsBaseObjectQuery],
    service_url: str,
    query: dict[str, Any],
):
    expected_url = f"{service_url}/dbobject?f=%21aStr%2C%21aListOfTypes.aType.aStr"

    request = my_obj_query_cls[DbObject1](f"{service_url}/dbobject", options=query)
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=None)
    mock_create_default_context.return_value = expected_context = (
        ssl.create_default_context()
    )

    await request.fetch()
    mock_urlopen.DbObject2(expected_url, context=expected_context)


@pytest.mark.parametrize(
    "query",
    [{"where": {"an_int": 10}}],
)
async def test_fetch_implicit_filter(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    my_obj_query_cls: Type[MrsBaseObjectQuery],
    service_url: str,
    query: dict[str, Any],
):
    expected_url = f"{service_url}/dbobject?q=%7B%22anInt%22%3A10%7D"

    request = my_obj_query_cls[DbObject1](f"{service_url}/dbobject", options=query)
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=None)
    mock_create_default_context.return_value = expected_context = (
        ssl.create_default_context()
    )

    await request.fetch()
    mock_urlopen.assert_called_once_with(expected_url, context=expected_context)


@pytest.mark.parametrize(
    "query",
    [{"where": {"an_int": {"equals": 10}}}],
)
async def test_fetch_explicit_filter(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    my_obj_query_cls: Type[MrsBaseObjectQuery],
    service_url: str,
    query: dict[str, Any],
):
    expected_url = (
        f"{service_url}/dbobject?q=%7B%22anInt%22%3A%7B%22%24eq%22%3A10%7D%7D"
    )

    request = my_obj_query_cls[DbObject1](f"{service_url}/dbobject", options=query)
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=None)
    mock_create_default_context.return_value = expected_context = (
        ssl.create_default_context()
    )

    await request.fetch()
    mock_urlopen.assert_called_once_with(expected_url, context=expected_context)


@pytest.mark.parametrize(
    "query",
    [{"take": 3}],
)
async def test_fetch_limit(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    my_obj_query_cls: Type[MrsBaseObjectQuery],
    service_url: str,
    query: dict[str, Any],
):
    expected_url = f"{service_url}/dbobject?limit=3"

    request = my_obj_query_cls[DbObject1](f"{service_url}/dbobject", options=query)
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=None)
    mock_create_default_context.return_value = expected_context = (
        ssl.create_default_context()
    )

    await request.fetch()
    mock_urlopen.assert_called_once_with(expected_url, context=expected_context)


@pytest.mark.parametrize(
    "query",
    [{"where": {"a_str": None}}],
)
async def test_fetch_null(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    my_obj_query_cls: Type[MrsBaseObjectQuery],
    service_url: str,
    query: dict[str, Any],
):
    expected_url = (
        f"{service_url}/dbobject?q=%7B%22aStr%22%3A%7B%22%24null%22%3Anull%7D%7D"
    )

    request = my_obj_query_cls[DbObject1](f"{service_url}/dbobject", options=query)
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=None)
    mock_create_default_context.return_value = expected_context = (
        ssl.create_default_context()
    )

    await request.fetch()
    mock_urlopen.assert_called_once_with(expected_url, context=expected_context)


@pytest.mark.parametrize(
    "query",
    [{"where": {"a_str": {"not": None}}}],
)
async def test_fetch_not_null(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    my_obj_query_cls: Type[MrsBaseObjectQuery],
    service_url: str,
    query: dict[str, Any],
):
    expected_url = (
        f"{service_url}/dbobject?q=%7B%22aStr%22%3A%7B%22%24notnull%22%3Anull%7D%7D"
    )

    request = my_obj_query_cls[DbObject1](f"{service_url}/dbobject", options=query)
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=None)
    mock_create_default_context.return_value = expected_context = (
        ssl.create_default_context()
    )

    await request.fetch()
    mock_urlopen.assert_called_once_with(expected_url, context=expected_context)


@pytest.mark.parametrize(
    "query",
    [{"order_by": {"first_name": "ASC"}}],
)
async def test_fetch_order_by_without_filter(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    my_obj_query_cls: Type[MrsBaseObjectQuery],
    service_url: str,
    query: dict[str, Any],
):
    expected_url = f"{service_url}/actor?q=%7B%22%24orderby%22%3A%7B%22firstName%22%3A%22ASC%22%7D%7D"

    request = my_obj_query_cls[Actor](f"{service_url}/actor", options=query)
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=None)
    mock_create_default_context.return_value = expected_context = (
        ssl.create_default_context()
    )

    await request.fetch()
    mock_urlopen.assert_called_once_with(expected_url, context=expected_context)


@pytest.mark.parametrize(
    "query",
    [{"where": {"actor_id": 10}, "order_by": {"first_name": "ASC"}}],
)
async def test_fetch_order_by_with_filter(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    my_obj_query_cls: Type[MrsBaseObjectQuery],
    service_url: str,
    query: dict[str, Any],
):
    expected_url = f"{service_url}/actor?q=%7B%22actorId%22%3A10%2C%22%24orderby%22%3A%7B%22firstName%22%3A%22ASC%22%7D%7D"

    request = my_obj_query_cls[Actor](f"{service_url}/actor", options=query)
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=None)
    mock_create_default_context.return_value = expected_context = (
        ssl.create_default_context()
    )

    await request.fetch()
    mock_urlopen.assert_called_once_with(expected_url, context=expected_context)


@pytest.mark.parametrize(
    "query, urlopen_read",
    [
        (  # multiple item
            {"where": {"first_name": {"like": "%MA%"}}},
            {
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
                ]
            },
        ),
        (  # zero items
            {"where": {"first_name": {"like": "%MA%"}}},
            {"items": []},
        ),
        (  # one item
            {"where": {"first_name": {"like": "%MA%"}}},
            {
                "items": [
                    {
                        "actorId": 3,
                        "lastName": "CHASE",
                        "firstName": "AMACH",
                        "lastUpdate": "2006-02-15 04:34:33.000000",
                    }
                ]
            },
        ),
    ],
)
async def test_fetch_one(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    my_obj_query_cls: Type[MrsBaseObjectQuery],
    service_url: str,
    query: dict[str, Any],
    urlopen_read: dict[str, Any],
):

    request = my_obj_query_cls[Actor](f"{service_url}/actor", options=query)
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=urlopen_read)
    mock_create_default_context.return_value = ssl.create_default_context()

    response = await request.fetch_one()
    mock_urlopen.assert_called_once()
    if not urlopen_read["items"]:
        assert response is None
    else:
        assert response == urlopen_read["items"][0]


def test_hypermedia_property_access():
    class SubjectUnderTest(Record):
        def __init__(self) -> None:
            self.__dict__.update({"_metadata": "foo", "links": "bar"})

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
    class SubjectUnderTest(Record):
        def __init__(self) -> None:
            self.__dict__.update({"_metadata": "foo", "links": "bar"})

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
    class SubjectUnderTest(Record):
        def __init__(self) -> None:
            self.__dict__.update({"_metadata": "foo", "links": "bar"})

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
    class SubjectUnderTest(Record):
        def __init__(self) -> None:
            self.__dict__.update({"_metadata": "foo", "links": "bar"})

    sut = SubjectUnderTest()

    assert "_metadata" not in dir(sut)
    assert "links" not in dir(sut)

