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

import json
import os
import ssl
from dataclasses import asdict, dataclass
from typing import (
    Any,
    Callable,
    Generic,
    Literal,
    Optional,
    TypeAlias,
    TypedDict,
    Union,
    cast,
)
from unittest.mock import MagicMock
from urllib.parse import quote, urlencode
from urllib.request import HTTPError

import pytest  # type: ignore[import-not-found]

from ..mrs_base_classes import (
    _MrsDocumentDeleteMixin,
    _MrsDocumentUpdateMixin,
    AuthAppNotFoundError,
    AuthenticateOptions,
    BoolField,
    DeleteOptions,
    Filterable,
    FindAllOptions,
    FindFirstOptions,
    FindManyOptions,
    FindUniqueOptions,
    HighOrderOperator,
    IMrsResourceDetails,
    IntField,
    MrsAuthenticate,
    MrsBaseObjectCreate,
    MrsBaseObjectDelete,
    MrsBaseObjectFunctionCall,
    MrsBaseObjectProcedureCall,
    MrsBaseObjectQuery,
    MrsBaseObjectUpdate,
    MrsBaseSchema,
    MrsBaseService,
    MrsDocumentBase,
    MrsJSONDataDecoder,
    MrsJSONDataEncoder,
    MrsProcedureResultSet,
    MrsQueryEncoder,
    MrsDocument,
    MrsDocumentNotFoundError,
    MrsBaseSession,
    StringField,
    UndefinedDataClassField,
    UndefinedField,
    JsonObject,
)

####################################################################################
#                               Sample Data
####################################################################################
MRS_SERVICE_PORT = os.environ.get("MRS_SERVICE_PORT", "8444")
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
            "first_key": "value1",
            "second_key": {
                "second_first_key": "value2",
                "second_second_key": {"second_second_first_key": "value3"},
                "second_third_key": ["value3", "value4"],
            },
            "third_key": [
                {
                    "third_first_first_key": "value5",
                    "third_first_second_key": "value6",
                },
                {"third_second_first_key": "value7"},
            ],
        },
        {
            "firstKey": "value1",
            "secondKey": {
                "secondFirstKey": "value2",
                "secondSecondKey": {"secondSecondFirstKey": "value3"},
                "secondThirdKey": ["value3", "value4"],
            },
            "thirdKey": [
                {
                    "thirdFirstFirstKey": "value5",
                    "thirdFirstSecondKey": "value6",
                },
                {"thirdSecondFirstKey": "value7"},
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
class ActorDetails(IMrsResourceDetails, total=False):
    actor_id: int
    first_name: str
    last_name: str
    last_update: str


class ActorData(TypedDict, total=False):
    actor_id: int
    first_name: str
    last_name: str
    last_update: str


class ActorFilterable(Generic[Filterable], HighOrderOperator[Filterable], total=False):
    last_name: StringField
    last_update: StringField
    first_name: StringField
    actor_id: IntField


@dataclass(init=False, repr=True)
class Actor(MrsDocument[ActorData]):

    # For data attributes, `None` means "NULL" and
    # `UndefinedField` means "not set or undefined"
    actor_id: int | UndefinedDataClassField
    first_name: str | UndefinedDataClassField
    last_name: str | UndefinedDataClassField
    last_update: str | UndefinedDataClassField

    def __init__(self, schema: MrsBaseSchema, data: ActorData) -> None:
        """Actor data class."""
        super().__init__(
            schema, data, obj_endpoint="https://localhost:8444/myService/sakila/actor"
        )

    def _load_fields(self, data: ActorData) -> None:
        """Refresh data fields based on the input data."""
        self.actor_id = data.get("actor_id", UndefinedField)
        self.first_name = data.get("first_name", UndefinedField)
        self.last_name = data.get("last_name", UndefinedField)
        self.last_update = data.get("last_update", UndefinedField)

        for key in MrsDocumentBase._reserved_keys:
            self.__dict__.update({key: data.get(key)})

    @classmethod
    def get_primary_key_name(cls) -> Optional[str]:
        """Get primary key name (Class Method)."""
        return "actor_id"


@dataclass(init=False, repr=True)
class ActorWithUpdateBehavior(
    _MrsDocumentUpdateMixin[ActorData, Actor, ActorDetails],
    Actor,
):
    """Add `update()` to data class."""


@dataclass(init=False, repr=True)
class ActorWithDeleteBehavior(
    _MrsDocumentDeleteMixin[ActorData, ActorFilterable],
    Actor,
):
    """Add `delete()` to data class."""


@dataclass(init=False, repr=True)
class ActorWithUpdateAndDeleteBehavior(
    _MrsDocumentUpdateMixin[ActorData, Actor, ActorDetails],
    _MrsDocumentDeleteMixin[ActorData, ActorFilterable],
    Actor,
):
    """Add `delete()` to data class."""


class Obj1Details(IMrsResourceDetails, total=False):
    an_int: int
    a_str: str
    a_bool: bool
    a_list_of_types: list["Obj2Data"]


class Obj1Data(TypedDict, total=False):
    an_int: int
    a_str: str
    a_bool: bool
    a_list_of_types: list["Obj2Data"]


class Obj1Filterable(HighOrderOperator[Filterable], total=False):
    an_int: IntField
    a_str: StringField
    a_bool: BoolField
    a_list_of_types: list["Obj2Data"]


class Obj2Details(IMrsResourceDetails, total=False):
    an_int: int
    a_str: str
    a_type: "Obj3Data"


class Obj2Data(TypedDict, total=False):
    an_int: int
    a_str: str
    a_type: "Obj3Data"


class Obj3Details(IMrsResourceDetails, total=False):
    an_int: int
    a_str: str


class Obj3Data(TypedDict, total=False):
    an_int: int
    a_str: str


class HelloFuncFuncParameters(TypedDict, total=False):
    name: str


class SumFuncFuncParameters(TypedDict, total=False):
    a: int
    b: int


class MyBirthdayFuncFuncParameters(TypedDict, total=False):
    pass


class MirrorProcParams(TypedDict, total=False):
    channel: str


class MirrorProcParamsOut(TypedDict, total=False):
    channel: str


MirrorProcResultSet: TypeAlias = MrsProcedureResultSet[str, JsonObject, JsonObject]


class TwiceProcParams(TypedDict, total=False):
    number: Optional[int]


class TwiceProcParamsOut(TypedDict, total=False):
    number_twice: Optional[int]


TwiceProcResultSet: TypeAlias = MrsProcedureResultSet[str, JsonObject, JsonObject]


class SampleProcParams(TypedDict, total=False):
    arg1: Optional[str]
    arg2: Optional[str]


class SampleProcParamsOut(TypedDict, total=False):
    arg2: Optional[str]
    arg3: Optional[float]


SampleProcResultSet1Type: TypeAlias = Literal["SampleProcResultSet1"]


class SampleProcResultSet1(TypedDict, total=False):
    name: Optional[str]
    age: Optional[int]


class TaggedSampleProcResultSet1(TypedDict):
    type: Literal["SampleProcResultSet1",]
    items: list[SampleProcResultSet1]


SampleProcResultSet2Type: TypeAlias = Literal["SampleProcResultSet2"]


class SampleProcResultSet2(TypedDict, total=False):
    something: Optional[str]


class TaggedSampleProcResultSet2(TypedDict):
    type: Literal["SampleProcResultSet2",]
    items: list[SampleProcResultSet2]


SampleProcResultSet: TypeAlias = Union[
    MrsProcedureResultSet[
        SampleProcResultSet1Type, SampleProcResultSet1, TaggedSampleProcResultSet1
    ],
    MrsProcedureResultSet[
        SampleProcResultSet2Type, SampleProcResultSet2, TaggedSampleProcResultSet2
    ],
]


IMyServiceAuthApp: TypeAlias = Literal["MRS",]


####################################################################################
#                               Utilities
####################################################################################
@pytest.fixture
def schema():
    service_url = f"https://localhost:{MRS_SERVICE_PORT}/{MRS_SERVICE_NAME}"
    schema_url = f"{service_url}/{DATABASE}"

    return MrsBaseSchema(
        service=MrsBaseService(service_url=service_url), request_path=schema_url
    )


@pytest.fixture
def schema_on_service_with_session() -> MrsBaseSchema:
    service_url = f"https://localhost:{MRS_SERVICE_PORT}/{MRS_SERVICE_NAME}"
    schema_url = f"{service_url}/{DATABASE}"
    session: MrsBaseSession = {"access_token": ""}
    session.update({"access_token": "foo"})
    service = MrsBaseService(service_url=service_url)
    service._session = session
    return MrsBaseSchema(service=service, request_path=schema_url)


@pytest.fixture
def mock_urlopen(mocker) -> MagicMock:
    return mocker.patch("python.mrs_base_classes.urlopen")


@pytest.fixture
def mock_request_class(mocker) -> MagicMock:
    return mocker.patch("python.mrs_base_classes.Request")


@pytest.fixture
def mock_authenticate_nonce(mocker) -> MagicMock:
    return mocker.patch("python.mrs_base_classes.MrsAuthenticate._nonce")


@pytest.fixture
def urlopen_simulator() -> Callable[[dict], MagicMock]:
    """Construction to mock the method 'urlopen'."""

    def _urlopen_simulator(
        urlopen_read: dict,
        url: str = "foo",
        status: int = 200,
        msg: str = "Error",
        headers: dict[str, str] = {"header": "value"},
    ) -> MagicMock:
        """urlopen will return whatever 'urlopen_read' is assigned to"""
        simulator = MagicMock()
        simulator.read.return_value = json.dumps(urlopen_read).encode()
        simulator.url = url
        simulator.status = status
        simulator.msg = msg
        simulator.headers = headers

        return simulator

    return _urlopen_simulator


@pytest.fixture
def mock_create_default_context(mocker) -> MagicMock:
    return mocker.patch("python.mrs_base_classes.ssl.create_default_context")


async def validate_url(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    request: MrsBaseObjectQuery | MrsBaseObjectDelete | ActorWithDeleteBehavior,
    expected_url: str,
    mock_request_class: MagicMock,
    expected_header: Optional[dict] = None,
    fictional_response_from_router: Optional[dict] = None,
) -> None:
    """Check final URL is built correctly.

    fictional_response_from_router (dict | None): `urlopen.read()` is brainwashed to
        return the provided fictional payload. If `None` is provided,
        the used payload is `{"_metadata": {"etag": "foo"}}`.
    """
    if expected_header is None:
        expected_header = {"Accept": "application/json"}
    if fictional_response_from_router is None:
        fictional_response_from_router = {"_metadata": {"etag": "foo"}}

    # Let urlopen return whatever 'urlopen_read' is assigned to
    mock_urlopen.return_value = urlopen_simulator(
        urlopen_read=fictional_response_from_router
    )
    mock_create_default_context.return_value = expected_context = (
        ssl.create_default_context()
    )

    if isinstance(request, MrsBaseObjectQuery):
        # Returns `fictional_response_from_router` because urlopen was mocked to return it.
        # The returned data is not important in this case.
        _ = await request.submit()

        # check urlopen was called once and the url that was built matches the expected
        # mock_urlopen.assert_called_once_with(ANY, context=expected_context)
        mock_request_class.assert_called_with(
            url=expected_url, headers=expected_header, method="GET"
        )
    elif isinstance(request, MrsBaseObjectDelete):
        # Returns `fictional_response_from_router` because urlopen was mocked to return it.
        # The returned data is not important in this case.
        _ = await request.submit()

        mock_request_class.assert_called_with(
            url=expected_url, headers=expected_header, method="DELETE"
        )
    else:
        # request is a MRS document
        await request.delete()

        mock_request_class.assert_called_with(
            url=expected_url, headers=expected_header, method="DELETE"
        )


####################################################################################
#                     Test GTID Tracking And Synchronization
####################################################################################
@pytest.mark.parametrize(
    "query, query_url, fictional_response, gtid_epoch_0",
    [
        # when `read_own_writes` is defined and set to `True`
        (
            {"where": {"an_int": 10}, "read_own_writes": True},
            "q=%7B%22anInt%22%3A10%2C%22%24asof%22%3A%22gtid_A%22%7D",
            {"_metadata": {"gtid": "gtid_A"}},
            "foo",
        ),
        (
            {"where": {"an_int": 37}, "read_own_writes": True},
            "q=%7B%22anInt%22%3A37%2C%22%24asof%22%3A%22gtid_B%22%7D",
            {"_metadata": {"gtid": "gtid_B"}},
            "bar",
        ),
        (
            {"where": {"an_int": 41}, "read_own_writes": True},
            "q=%7B%22anInt%22%3A41%7D",
            {"_metadata": {"etag": "#$661&28"}},
            None,
        ),
        (
            {"where": {"an_int": 76}, "read_own_writes": True},
            "q=%7B%22anInt%22%3A76%2C%22%24asof%22%3A%22gtid_C%22%7D",
            {"_metadata": {"gtid": "gtid_C"}},
            None,
        ),
        # when `read_own_writes` is defined and set to `False`
        (
            {"where": {"an_int": 10}, "read_own_writes": False},
            "q=%7B%22anInt%22%3A10%7D",
            {"_metadata": {"etag": "foo"}},
            "foo",
        ),
        (
            {"where": {"an_int": 37}, "read_own_writes": False},
            "q=%7B%22anInt%22%3A37%7D",
            {"_metadata": {"gtid": "gtid_A"}},
            "bar",
        ),
        (
            {"where": {"an_int": 41}, "read_own_writes": False},
            "q=%7B%22anInt%22%3A41%7D",
            {"_metadata": {"gtid": "gtid_B"}},
            None,
        ),
        # when `read_own_writes` is not defined
        (
            {"where": {"an_int": 10}},
            "q=%7B%22anInt%22%3A10%7D",
            {"_metadata": {"etag": "foo"}},
            "foo",
        ),
        (
            {"where": {"an_int": 37}},
            "q=%7B%22anInt%22%3A37%7D",
            {"_metadata": {"gtid": "gtid_A"}},
            "bar",
        ),
        (
            {"where": {"an_int": 41}},
            "q=%7B%22anInt%22%3A41%7D",
            {"_metadata": {"gtid": "gtid_B"}},
            None,
        ),
    ],
)
async def test_gtid_track_and_sync(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    query: dict[str, Any],
    query_url: str,
    fictional_response: dict[str, Any],
    gtid_epoch_0: Optional[str],
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
):
    """This test covers the following checks:

    * when `read_own_writes` is not defined, the query filter does not
    include a `$asof` operator for READ and DELETE HTTP requests.

    * when `read_own_writes` is `False` the query filter does not include
    a `$asof` operator for READ and DELETE HTTP requests.

    * when a GTID is not available (aka, it's `None`), the query filter
    does not include a `$asof` operator for READ and DELETE HTTP requests.

    * when a GTID is being tracked and `read_own_writes` is `True`, the query
    filter includes a `$asof` operator with the tracked GTID for READ and
    DELETE HTTP requests.

    * when DELETE, CREATE and UPDATE response include gtid in metadata, the latest GTID is updated.

    * when FUNCTION and PROCEDURES responses include the gtid metadata, the latest GTID is updated.
    """
    # dummy data
    data_create: ActorData = {"first_name": "Shigeru", "last_name": "Miyamoto"}
    data_update = Actor(
        schema=schema,
        data=cast(
            ActorData,
            ActorDetails(
                {
                    "links": [],
                    "first_name": "Shigeru",
                    "last_name": "Miyamoto",
                    "_metadata": {
                        "etag": "33ED258BECDF269717782F5569C69F88CCCA2DF11936108C68C44100FF063D4D"
                    },
                }
            ),
        ),
    )

    for cls_ in (
        MrsBaseObjectCreate,
        MrsBaseObjectUpdate,
        MrsBaseObjectDelete,
        MrsBaseObjectFunctionCall,
        MrsBaseObjectProcedureCall,
    ):
        # set latest GTID
        schema._service._session["gtid"] = gtid_epoch_0

        request: (
            MrsBaseObjectQuery
            | MrsBaseObjectCreate
            | MrsBaseObjectUpdate
            | MrsBaseObjectDelete
            | MrsBaseObjectFunctionCall
            | MrsBaseObjectProcedureCall
        )

        # ------------------------------- GTID Tracking -------------------------------
        # Checking CREATE/UPDATE/DELETE/FUNCTION/PROCEDURE HTTP requests
        if cls_ == MrsBaseObjectCreate:
            request_path = f"{schema._request_path}/actor"
            request = MrsBaseObjectCreate[ActorData, ActorDetails](
                schema=schema, request_path=request_path, data=data_create
            )
        elif cls_ == MrsBaseObjectUpdate:
            prk = cast(str, data_update.get_primary_key_name())
            request_path = f"{schema._request_path}/actor/{getattr(data_update, prk)}"
            request = MrsBaseObjectUpdate[Actor, ActorDetails](
                schema=schema, request_path=request_path, data=data_update
            )
        elif cls_ == MrsBaseObjectDelete:
            request = MrsBaseObjectDelete[Obj1Filterable](
                schema=schema,
                request_path=request_path,
                options=cast(DeleteOptions, query),
            )
        elif cls_ == MrsBaseObjectFunctionCall:
            request_path = f"{schema._request_path}/SumFunc"
            request = MrsBaseObjectFunctionCall[SumFuncFuncParameters, int](
                schema=schema,
                request_path=request_path,
                parameters=cast(SumFuncFuncParameters, {"a": 2, "b": 3}),
            )
        elif cls_ == MrsBaseObjectProcedureCall:
            request_path = f"{schema._request_path}/TwiceProc"
            request = MrsBaseObjectProcedureCall[
                TwiceProcParams, TwiceProcParamsOut, TwiceProcResultSet
            ](
                schema=schema,
                request_path=request_path,
                parameters=cast(TwiceProcParams, {"number": 13}),
            )

        # expand the fictional response of function and procedure mrs-base objects
        if cls_ == MrsBaseObjectProcedureCall:
            mock_urlopen.return_value = urlopen_simulator(
                urlopen_read={
                    **fictional_response,
                    **{"result_sets": [], "out_parameters": {"number_twice": 26}},
                }
            )
        elif cls_ == MrsBaseObjectFunctionCall:
            mock_urlopen.return_value = urlopen_simulator(
                urlopen_read={
                    **fictional_response,
                    **{"result": 5},
                }
            )
        else:
            mock_urlopen.return_value = urlopen_simulator(
                urlopen_read=fictional_response
            )

        mock_create_default_context.return_value = ssl.create_default_context()

        _ = await request.submit()

        # ------------------------------- GTID Synchronization -------------------------------
        # Internally, the tracked gtid should have been updated if new gtid comes
        # in the response, else, update should have been skipped:
        #   gtid_epoch_1 = fictional_response["_metadata"].get("gtid", gtid_epoch_0)
        request_path = f"{schema._request_path}/dbobject"
        # Checking GET/DELETE HTTP requests
        for my_cls in (MrsBaseObjectQuery, MrsBaseObjectDelete):
            if my_cls == MrsBaseObjectQuery:
                request = MrsBaseObjectQuery[Obj1Data, Obj1Details](
                    schema=schema,
                    request_path=request_path,
                    options=cast(FindManyOptions, query),
                )
            else:
                request = MrsBaseObjectDelete[Obj1Filterable](
                    schema=schema,
                    request_path=request_path,
                    options=cast(DeleteOptions, query),
                )

            await validate_url(
                mock_urlopen=mock_urlopen,
                urlopen_simulator=urlopen_simulator,
                mock_create_default_context=mock_create_default_context,
                request=request,
                expected_url=f"{request_path}?{query_url}",
                mock_request_class=mock_request_class,
                fictional_response_from_router={"field": "value"},
            )


####################################################################################
#               Test "submit_mrs_native" Method (authenticate*'s backbone)
####################################################################################
@pytest.mark.parametrize(
    "options, vendor_id, nonce, fictional_payload, client_proof",
    [
        (
            {
                "app_name": "MRS",
                "user": "furbo",
                "password": "s3cr3t",
            },
            "0x30000000000000000000000000000000",
            "419eebd0e8722f4c77a9",
            {
                "session": "2024-08-22 13:06:45-3",
                "iterations": 5000,
                "nonce": "419eebd0e8722f4c77a9JLEwx;*?o9bH",
                "salt": list(
                    b"c_\xa5nC\xe9e\x06%.\xce\xe7\xc8\xe1\xdd\x1e\xa8v\xa7\xba"
                ),
                "access_token": "123456789",
            },
            tuple(
                b"8\x16\xa5\x8d\xf4]\xad\x16\xfb\x9a\xf5I\xa82\xed\x03c\xc0\x8c\xf1\xff\x1e\xd7\x12\xa2\xdf\xee.S(\xa4\xa3"
            ),
        ),
    ],
)
async def test_authenticate_submit_mrs_native(
    mock_urlopen: MagicMock,
    mock_request_class: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    mock_authenticate_nonce: MagicMock,
    options: AuthenticateOptions[IMyServiceAuthApp],
    vendor_id: str,
    nonce: str,
    fictional_payload: dict[str, Any],
    client_proof: bytes,
    schema: MrsBaseSchema,
):
    """Check `MrsAuthenticate.submit()`."""
    request_path = f"{schema._service._service_url}{schema._service._auth_path}"

    request = MrsAuthenticate[IMyServiceAuthApp](
        service=schema._service,
        request_path=request_path,
        vendor_id=vendor_id,
        **options,
    )

    # mocking
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=fictional_payload)
    mock_create_default_context.return_value = ssl.create_default_context()
    mock_authenticate_nonce.return_value = nonce

    # do auth
    await request.submit()

    # check the access token is updated
    assert schema._service._session["access_token"] == fictional_payload["access_token"]

    # check two requests happened
    assert mock_request_class.call_count == 2

    # check first request
    mock_request_class.assert_any_call(
        url=request_path,
        headers={"Accept": "application/json"},
        data=json.dumps(
            {
                "authApp": options["app_name"],
                "nonce": nonce,
                "sessionType": "bearer",
                "user": options["user"],
            }
        ).encode(),
        method="POST",
    )

    # check last request
    data = json.dumps(
        {
            "clientProof": client_proof,
            "nonce": fictional_payload["nonce"],
            "state": "response",
        }
    ).encode()
    mock_request_class.assert_called_with(
        url=request_path,
        headers={"Accept": "application/json"},
        data=data,
        method="POST",
    )

    # check an error is raised when response isn't `OK`
    mock_urlopen.return_value = urlopen_simulator(
        urlopen_read={"foo": "bar"}, status=400, msg="Bad response"
    )
    with pytest.raises(HTTPError, match="Bad response"):
        # do auth
        await request.submit()


####################################################################################
#               Test "submit_mysql_internal" Method (authenticate*'s backbone)
####################################################################################
@pytest.mark.parametrize(
    "options, vendor_id, fictional_payload",
    [
        (
            {
                "app_name": "MySQL Internal",
                "user": "furbo",
                "password": "s3cr3t",
            },
            "0x31000000000000000000000000000000",
            {
                "access_token": "85888969",
            },
        ),
    ],
)
async def test_authenticate_submit_mysql_internal(
    mock_urlopen: MagicMock,
    mock_request_class: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    options: AuthenticateOptions[IMyServiceAuthApp],
    vendor_id: str,
    fictional_payload: dict[str, Any],
    schema: MrsBaseSchema,
):
    """Check `MrsAuthenticate.submit()`."""
    request_path = f"{schema._service._service_url}{schema._service._auth_path}"

    request = MrsAuthenticate[IMyServiceAuthApp](
        service=schema._service,
        request_path=request_path,
        vendor_id=vendor_id,
        **options,
    )

    # mocking
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=fictional_payload)
    mock_create_default_context.return_value = ssl.create_default_context()

    # do auth
    await request.submit()

    # check the access token is updated
    assert schema._service._session["access_token"] == fictional_payload["access_token"]

    # check one request happened
    assert mock_request_class.call_count == 1

    # check that request is issued as expected
    data_auth = {
        "username": options["user"],
        "password": options["password"],
        "authApp": options["app_name"],
        "sessionType": "bearer",
    }
    mock_request_class.assert_called_with(
        url=f"{request_path}",
        headers={"Accept": "application/json"},
        data=json.dumps(data_auth).encode(),
        method="POST",
    )

    # check an error is raised when response isn't `OK`
    mock_urlopen.return_value = urlopen_simulator(
        urlopen_read={"foo": "bar"}, status=400, msg="Bad response"
    )
    with pytest.raises(HTTPError, match="Bad response"):
        # do auth
        await request.submit()


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
    data: ActorData,
    urlopen_read: dict[str, Any],
    schema: MrsBaseSchema,
    schema_on_service_with_session: MrsBaseSchema,
):
    """Check `MrsBaseObjectCreate.submit()`."""
    request_path = f"{schema._request_path}/actor"
    request = MrsBaseObjectCreate[ActorData, ActorDetails](
        schema=schema, request_path=request_path, data=data
    )

    mock_urlopen.return_value = urlopen_simulator(urlopen_read=urlopen_read)
    mock_create_default_context.return_value = ssl.create_default_context()

    response = await request.submit()

    mock_request_class.assert_called_once_with(
        url=request_path,
        headers={"Accept": "application/json"},
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

    # Check authenticated `MrsBaseObjectCreate.submit()`
    request = MrsBaseObjectCreate[ActorData, ActorDetails](
        schema=schema_on_service_with_session, request_path=request_path, data=data
    )

    _ = await request.submit()

    mock_request_class.assert_called_with(
        url=request_path,
        headers={"Accept": "application/json", "Authorization": "Bearer foo"},
        data=json.dumps(obj=data, cls=MrsJSONDataEncoder).encode(),
        method="POST",
    )
    assert mock_urlopen.call_count == 2


####################################################################################
#                      Test "submit" Method (update*'s backbone)
####################################################################################
@pytest.mark.parametrize(
    "data_details, urlopen_read",
    [
        (
            ActorDetails(
                {
                    "links": [],
                    "first_name": "Shigeru",
                    "last_name": "Miyamoto",
                    "_metadata": {
                        "etag": "33ED258BECDF269717782F5569C69F88CCCA2DF11936108C68C44100FF063D4D"
                    },
                }
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
    data_details: ActorDetails,
    urlopen_read: dict[str, Any],
    schema: MrsBaseSchema,
    schema_on_service_with_session: MrsBaseSchema,
):
    """Check `MrsBaseObjectUpdate.submit()`."""
    data = Actor(schema=schema, data=cast(ActorData, data_details))

    prk = cast(str, data.get_primary_key_name())
    rest_document_id = getattr(data, prk)
    request_path = f"{schema._request_path}/actor/{rest_document_id}"
    request = MrsBaseObjectUpdate[Actor, ActorDetails](
        schema=schema, request_path=request_path, data=data
    )

    mock_urlopen.return_value = urlopen_simulator(urlopen_read=urlopen_read)
    mock_create_default_context.return_value = ssl.create_default_context()

    response = await request.submit()

    mock_request_class.assert_called_once_with(
        url=request_path,
        headers={
            "Accept": "application/json",
            "If-Match": data.__dict__["_metadata"]["etag"],
        },
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

    # Check authenticated `MrsBaseObjectUpdate.submit()`
    request = MrsBaseObjectUpdate[Actor, ActorDetails](
        schema=schema_on_service_with_session,
        request_path=request_path,
        data=data,
    )

    _ = await request.submit()

    mock_request_class.assert_called_with(
        url=request_path,
        headers={
            "Accept": "application/json",
            "If-Match": data.__dict__["_metadata"]["etag"],
            "Authorization": "Bearer foo",
        },
        data=json.dumps(obj=asdict(data), cls=MrsJSONDataEncoder).encode(),
        method="PUT",
    )
    assert mock_urlopen.call_count == 2


####################################################################################
#                      Test "submit" Method (function-call's backbone)
####################################################################################
@pytest.mark.parametrize(
    "func_name, parameters, urlopen_read, func_params_type, func_result_type",
    [
        (
            "sumFunc",  # f(i1, i2) -> i3
            {"a": 2, "b": 3},
            {"result": 5},
            SumFuncFuncParameters,
            int,
        ),
        (
            "helloFunc",  # f(s) -> s
            {"name": "Rui"},
            {"result": "Hello Rui!"},
            HelloFuncFuncParameters,
            str,
        ),
        (
            "myBirthdayFunc",  # f() -> s
            {},
            {"result": "2024-07-23 00:00:00"},
            MyBirthdayFuncFuncParameters,
            str,
        ),
    ],
)
async def test_function_call_submit(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    func_name: str,
    parameters: dict,
    urlopen_read: dict,
    func_params_type: TypeAlias,
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
    schema_on_service_with_session: MrsBaseSchema,
    func_result_type: TypeAlias,
):
    """Check `MrsBaseObjectFunctionCall.submit()`."""
    request_path = f"{schema._request_path}/{func_name}"
    request = MrsBaseObjectFunctionCall[func_params_type, func_result_type](
        schema=schema,
        request_path=request_path,
        parameters=cast(func_params_type, parameters),
    )

    mock_urlopen.return_value = urlopen_simulator(urlopen_read=urlopen_read)
    mock_create_default_context.return_value = ssl.create_default_context()

    assert await request.submit() == urlopen_read["result"]

    mock_request_class.assert_called_once_with(
        url=request_path,
        headers={"Accept": "application/json"},
        data=json.dumps(obj=parameters, cls=MrsJSONDataEncoder).encode(),
        method="PUT",
    )
    mock_urlopen.assert_called_once()

    # Check authenticated `MrsBaseObjectFunctionCall.submit()`
    request = MrsBaseObjectFunctionCall[func_params_type, func_result_type](
        schema=schema_on_service_with_session,
        request_path=request_path,
        parameters=cast(func_params_type, parameters),
    )

    _ = await request.submit()

    mock_request_class.assert_called_with(
        url=request_path,
        headers={"Accept": "application/json", "Authorization": "Bearer foo"},
        data=json.dumps(obj=parameters, cls=MrsJSONDataEncoder).encode(),
        method="PUT",
    )
    assert mock_urlopen.call_count == 2


####################################################################################
#                      Test "submit" Method (procedure-call's backbone)
####################################################################################
@pytest.mark.parametrize(
    "proc_name, parameters, urlopen_read, in_interface, out_interface, result_sets_interface",
    [
        (
            "TwiceProc",  # p(number) -> 2*number
            {"number": 13},
            {"result_sets": [], "out_parameters": {"number_twice": 26}},
            TwiceProcParams,
            TwiceProcParamsOut,
            TwiceProcResultSet,
        ),
        (
            "MirrorProc",  # p(string) -> reversed string
            {"channel": "roma"},
            {"result_sets": [], "out_parameters": {"channel": "amor"}},
            MirrorProcParams,
            MirrorProcParamsOut,
            MirrorProcResultSet,
        ),
        (
            "SampleProc",
            {"arg1": "", "arg2": "foo"},
            {
                "result_sets": [
                    {
                        "type": "SampleProcResultSet1",
                        "items": [{"name": "foo", "age": 42}],
                        "_metadata": {
                            "columns": [
                                {"name": "name", "type": "VARCHAR(3)"},
                                {"name": "age", "type": "BIGINT"},
                            ]
                        },
                    },
                    {
                        "type": "SampleProcResultSet2",
                        "items": [{"something": "bar"}],
                        "_metadata": {
                            "columns": [{"name": "something", "type": "VARCHAR(3)"}]
                        },
                    },
                ],
                "out_parameters": {"arg2": "foo", "arg3": None},
            },
            SampleProcParams,
            SampleProcParamsOut,
            SampleProcResultSet,
        ),
    ],
)
async def test_procedure_call_submit(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    proc_name: str,
    parameters: dict,
    urlopen_read: dict,
    in_interface: TypeAlias,
    out_interface: TypeAlias,
    result_sets_interface: TypeAlias,
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
):
    """Check `MrsBaseObjectProcedureCall.submit()`."""
    request_path = f"{schema._request_path}/{proc_name}"
    request = MrsBaseObjectProcedureCall[
        in_interface, out_interface, result_sets_interface
    ](
        schema=schema,
        request_path=request_path,
        parameters=cast(in_interface, parameters),
    )

    mock_urlopen.return_value = urlopen_simulator(urlopen_read=urlopen_read)
    mock_create_default_context.return_value = ssl.create_default_context()

    procedure_result = await request.submit()

    assert procedure_result.out_parameters == urlopen_read["out_parameters"]
    assert procedure_result.result_sets == [
        MrsProcedureResultSet(result_set) for result_set in urlopen_read["result_sets"]
    ]

    mock_request_class.assert_called_once_with(
        url=request_path,
        headers={"Accept": "application/json"},
        data=json.dumps(obj=parameters, cls=MrsJSONDataEncoder).encode(),
        method="PUT",
    )
    mock_urlopen.assert_called_once()


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
    query: FindFirstOptions | FindManyOptions | FindUniqueOptions,
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
):
    """Specifying `select` as a list. Checking `include` mechanism."""
    request_path = f"{schema._request_path}/dbobject"

    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[Obj1Data, Obj1Details](
            schema=schema, request_path=request_path, options=query
        ),
        expected_url=f"{request_path}?f=aStr%2CaListOfTypes.aType.aStr",
        mock_request_class=mock_request_class,
    )


@pytest.mark.parametrize(
    "query", [{"select": {"a_str": True, "a_list_of_types.a_type.a_str": True}}]
)
async def test_select_with_mapper_for_inclusion(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    query: FindFirstOptions | FindManyOptions | FindUniqueOptions,
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
):
    """Specifying `select` as a dictionary. Checking `include` mechanism."""
    request_path = f"{schema._request_path}/dbobject"

    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[Obj1Data, Obj1Details](
            schema=schema, request_path=request_path, options=query
        ),
        expected_url=f"{request_path}?f=aStr%2CaListOfTypes.aType.aStr",
        mock_request_class=mock_request_class,
    )


@pytest.mark.parametrize(
    "query", [{"select": {"a_str": False, "a_list_of_types.a_type.a_str": False}}]
)
async def test_select_with_mapper_for_exclusion(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    query: FindFirstOptions | FindManyOptions | FindUniqueOptions,
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
):
    """Specifying `select` as a dictionary. Checking `exclude` mechanism."""
    request_path = f"{schema._request_path}/dbobject"

    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[Obj1Data, Obj1Details](
            schema=schema, request_path=request_path, options=query
        ),
        expected_url=f"{request_path}?f=%21aStr%2C%21aListOfTypes.aType.aStr",
        mock_request_class=mock_request_class,
    )


####################################################################################
#                               Test "where" Option
####################################################################################
@pytest.mark.parametrize(
    "query, expected_q_url",
    [
        ({"where": {"an_int": 10}}, "q=%7B%22anInt%22%3A10%7D"),
        (
            {"where": {"last_name": "This is a   test "}},
            "q=%7B%22lastName%22%3A%22This%20is%20a%20%20%20test%20%22%7D",
        ),
        (
            {"where": {"first_name": "I am MySQL"}},
            "q=%7B%22firstName%22%3A%22I%20am%20MySQL%22%7D",
        ),
        (
            {"where": {"last_name": ". * ;;; @11dk"}},
            "q=%7B%22lastName%22%3A%22.%20%2A%20%3B%3B%3B%20%4011dk%22%7D",
        ),
        (
            {
                "where": {
                    "OR": [
                        {"first_name": "Hello Word!"},
                        {"first_name": "I am MySQL"},
                        {"first_name": "A B c D E f G"},
                    ]
                }
            },
            "q=%7B%22%24or%22%3A%5B%7B%22firstName%22%3A%22Hello%20Word%21%22"
            "%7D%2C%7B%22firstName%22%3A%22I%20am%20MySQL%22%7D%2C%7B%22"
            "firstName%22%3A%22A%20B%20c%20D%20E%20f%20G%22%7D%5D%7D",
        ),
    ],
)
async def test_where_field_is_equal_with_implicit_filter(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    query: dict[str, Any],
    expected_q_url: str,
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
):
    """Specifying `where`. Checking implicit filter."""
    request_path = f"{schema._request_path}/dbobject"
    request: MrsBaseObjectQuery | MrsBaseObjectDelete

    for cls_ in (MrsBaseObjectQuery, MrsBaseObjectDelete):
        if cls_ == MrsBaseObjectQuery:
            request = MrsBaseObjectQuery[Obj1Data, Obj1Details](
                schema=schema,
                request_path=request_path,
                options=cast(
                    FindFirstOptions | FindManyOptions | FindUniqueOptions, query
                ),
            )
        else:
            request = MrsBaseObjectDelete[Obj1Filterable](
                schema=schema,
                request_path=request_path,
                options=cast(DeleteOptions, query),
            )

        await validate_url(
            mock_urlopen=mock_urlopen,
            urlopen_simulator=urlopen_simulator,
            mock_create_default_context=mock_create_default_context,
            request=request,
            expected_url=f"{request_path}?{expected_q_url}",
            mock_request_class=mock_request_class,
        )


@pytest.mark.parametrize(
    "query, expected_q_url",
    [
        (
            {"where": {"an_int": {"equals": 10}}},
            "q=%7B%22anInt%22%3A%7B%22%24eq%22%3A10%7D%7D",
        ),
        (
            {"where": {"last_name": {"equals": "This is a   test "}}},
            "q=%7B%22lastName%22%3A%7B%22%24eq%22%3A%22This%20is%20a%20%20%20test%20%22%7D%7D",
        ),
        (
            {"where": {"first_name": {"equals": "I am MySQL"}}},
            "q=%7B%22firstName%22%3A%7B%22%24eq%22%3A%22I%20am%20MySQL%22%7D%7D",
        ),
        (
            {"where": {"last_name": {"equals": ". * ;;; @11dk"}}},
            "q=%7B%22lastName%22%3A%7B%22%24eq%22%3A%22.%20%2A%20%3B%3B%3B%20%4011dk%22%7D%7D",
        ),
        (
            {
                "where": {
                    "OR": [
                        {"first_name": {"equals": "Hello Word!"}},
                        {"first_name": {"equals": "I am MySQL"}},
                        {"first_name": {"equals": "A B c D E f G"}},
                    ]
                }
            },
            "q=%7B%22%24or%22%3A%5B%7B%22firstName%22%3A%7B%22%24eq%22%3A%22Hello%20Word"
            "%21%22%7D%7D%2C%7B%22firstName%22%3A%7B%22%24eq%22%3A%22I%20am%20MySQL%22%7D"
            "%7D%2C%7B%22firstName%22%3A%7B%22%24eq%22%3A%22A%20B%20c%20D%20E%20f%20G%22%7D%7D%5D%7D",
        ),
    ],
)
async def test_where_field_is_equal_with_explicit_filter(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    query: dict[str, Any],
    expected_q_url: str,
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
):
    """Specifying `where`. Checking explicit filter."""
    request_path = f"{schema._request_path}/dbobject"
    request: MrsBaseObjectQuery | MrsBaseObjectDelete

    for cls_ in (MrsBaseObjectQuery, MrsBaseObjectDelete):
        if cls_ == MrsBaseObjectQuery:
            request = MrsBaseObjectQuery[Obj1Data, Obj1Details](
                schema=schema,
                request_path=request_path,
                options=cast(
                    FindFirstOptions | FindManyOptions | FindUniqueOptions, query
                ),
            )
        else:
            request = MrsBaseObjectDelete[Obj1Filterable](
                schema=schema,
                request_path=request_path,
                options=cast(DeleteOptions, query),
            )

        await validate_url(
            mock_urlopen=mock_urlopen,
            urlopen_simulator=urlopen_simulator,
            mock_create_default_context=mock_create_default_context,
            request=request,
            expected_url=f"{request_path}?{expected_q_url}",
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
    query: dict[str, Any],
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
):
    """Specifying `where`. Checking filter where field is NULL."""
    request_path = f"{schema._request_path}/dbobject"
    request: MrsBaseObjectQuery | MrsBaseObjectDelete

    for cls_ in (MrsBaseObjectQuery, MrsBaseObjectDelete):
        if cls_ == MrsBaseObjectQuery:
            request = MrsBaseObjectQuery[Obj1Data, Obj1Details](
                schema=schema,
                request_path=request_path,
                options=cast(
                    FindFirstOptions | FindManyOptions | FindUniqueOptions, query
                ),
            )
        else:
            request = MrsBaseObjectDelete[Obj1Filterable](
                schema=schema,
                request_path=request_path,
                options=cast(DeleteOptions, query),
            )

        await validate_url(
            mock_urlopen=mock_urlopen,
            urlopen_simulator=urlopen_simulator,
            mock_create_default_context=mock_create_default_context,
            request=request,
            expected_url=f"{request_path}?q=%7B%22aStr%22%3A%7B%22%24null%22%3Anull%7D%7D",
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
    query: dict[str, Any],
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
):
    """Specifying `where`. Checking filter where field isn't NULL."""
    request_path = f"{schema._request_path}/dbobject"
    request: MrsBaseObjectQuery | MrsBaseObjectDelete

    for cls_ in (MrsBaseObjectQuery, MrsBaseObjectDelete):
        if cls_ == MrsBaseObjectQuery:
            request = MrsBaseObjectQuery[Obj1Data, Obj1Details](
                schema=schema,
                request_path=request_path,
                options=cast(FindManyOptions, query),
            )
        else:
            request = MrsBaseObjectDelete[Obj1Filterable](
                schema=schema,
                request_path=request_path,
                options=cast(DeleteOptions, query),
            )

        await validate_url(
            mock_urlopen=mock_urlopen,
            urlopen_simulator=urlopen_simulator,
            mock_create_default_context=mock_create_default_context,
            request=request,
            expected_url=f"{request_path}?q=%7B%22aStr%22%3A%7B%22%24notnull%22%3Anull%7D%7D",
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
    query: FindFirstOptions | FindManyOptions | FindUniqueOptions,
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
):
    """Specifying `skip`. It represents the `offset`."""
    request_path = f"{schema._request_path}/dbobject"

    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[Obj1Data, Obj1Details](
            schema=schema, request_path=request_path, options=query
        ),
        expected_url=f"{request_path}?offset=7",
        mock_request_class=mock_request_class,
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
    query: FindFirstOptions | FindManyOptions | FindUniqueOptions,
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
):
    """Check cursor-based pagination."""
    request_path = f"{schema._request_path}/actor"

    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[ActorData, ActorDetails](
            schema=schema, request_path=request_path, options=query
        ),
        expected_url=f"{request_path}?q=%7B%22actorId%22%3A%7B%22%24gt%22%3A13%7D%7D",
        mock_request_class=mock_request_class,
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
    query: FindFirstOptions | FindManyOptions | FindUniqueOptions,
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
):
    """Specifying `take`. It represents the `limit`."""
    request_path = f"{schema._request_path}/dbobject"

    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[Obj1Data, Obj1Details](
            schema=schema, request_path=request_path, options=query
        ),
        expected_url=f"{request_path}?limit=3",
        mock_request_class=mock_request_class,
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
    query: FindFirstOptions | FindManyOptions | FindUniqueOptions,
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
):
    """Check `order_by` option."""
    request_path = f"{schema._request_path}/actor"

    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[ActorData, ActorDetails](
            schema=schema, request_path=request_path, options=query
        ),
        expected_url=f"{request_path}?q=%7B%22%24orderby%22%3A%7B%22firstName%22%3A%22ASC%22%7D%7D",
        mock_request_class=mock_request_class,
    )


@pytest.mark.parametrize(
    "query",
    [{"where": {"actor_id": 10}, "order_by": {"first_name": "ASC"}}],
)
async def test_order_by_asc_with_filter(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    query: FindFirstOptions | FindManyOptions | FindUniqueOptions,
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
):
    """Check `order_by` and `where` options."""
    request_path = f"{schema._request_path}/actor"

    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[ActorData, ActorDetails](
            schema=schema, request_path=request_path, options=query
        ),
        expected_url=f"{request_path}?q=%7B%22actorId%22%3A10%2C%22%24orderby%22%3A%7B%22firstName%22%3A%22ASC%22%7D%7D",
        mock_request_class=mock_request_class,
    )


@pytest.mark.parametrize(
    "query",
    [{"where": {"actor_id": 10}, "order_by": {"first_name": "DESC"}}],
)
async def test_order_by_desc_with_filter(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    query: FindFirstOptions | FindManyOptions | FindUniqueOptions,
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
):
    """Check `order_by` and `where` options."""
    request_path = f"{schema._request_path}/actor"

    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=MrsBaseObjectQuery[ActorData, ActorDetails](
            schema=schema, request_path=request_path, options=query
        ),
        expected_url=f"{request_path}?q=%7B%22actorId%22%3A10%2C%22%24orderby%22%3A%7B%22firstName%22%3A%22DESC%22%7D%7D",
        mock_request_class=mock_request_class,
    )


####################################################################################
#                      Test "submit" Method (find*'s backbone)
####################################################################################
@pytest.mark.parametrize("query, urlopen_read", TEST_FETCH_SAMPLE_DATA)
async def test_submit(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    query: FindFirstOptions | FindManyOptions | FindUniqueOptions,
    urlopen_read: dict[str, Any],
    schema: MrsBaseSchema,
):
    """Check `MrsBaseObjectQuery.submit()`."""
    request_path = f"{schema._request_path}/actor"
    request = MrsBaseObjectQuery[ActorData, ActorDetails](
        schema=schema, request_path=request_path, options=query
    )
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=urlopen_read)
    mock_create_default_context.return_value = ssl.create_default_context()

    response = await request.submit()
    mock_urlopen.assert_called_once()
    assert response["items"] == MrsJSONDataDecoder.convert_keys(urlopen_read)["items"]


@pytest.mark.parametrize("query, urlopen_read", TEST_FETCH_SAMPLE_DATA)
async def test_fetch_one(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    query: FindFirstOptions,
    urlopen_read: dict[str, Any],
    schema: MrsBaseSchema,
):
    """Check `MrsBaseObjectQuery.fetch_one()`."""
    request_path = f"{schema._request_path}/actor"
    request = MrsBaseObjectQuery[ActorData, ActorDetails](
        schema=schema, request_path=request_path, options=query
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
    query: FindAllOptions,
    urlopen_read: dict[str, Any],
    schema: MrsBaseSchema,
):
    """Check `MrsBaseObjectQuery.fetch_all()`."""
    request_path = f"{schema._request_path}/actor"
    request = MrsBaseObjectQuery[ActorData, ActorDetails](
        schema=schema, request_path=request_path, options=query
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
#                    Test Data Classes (table records)
####################################################################################
@pytest.mark.parametrize(
    "data_details, urlopen_read",
    [
        (
            ActorDetails(
                {
                    "links": [],
                    "actor_id": 65,
                    "first_name": "Shigeru",
                    "last_name": "Miyamoto",
                    "_metadata": {
                        "etag": "33ED258BECDF269717782F5569C69F88CCCA2DF11936108C68C44100FF063D4D"
                    },
                }
            ),
            {
                "actorId": 65,
                "firstName": "Foo",
                "lastName": "Miyamoto",
                "lastUpdate": "2006-02-15 04:34:33.000000",
                "_metadata": {
                    "etag": "33ED258BECDF269717782F5569C69F88CCCA2DF11936108C68C44100FF063D4D"
                },
            },
        ),
    ],
)
async def test_dataclass_update(
    mock_urlopen: MagicMock,
    mock_request_class: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    data_details: ActorDetails,
    urlopen_read: dict[str, Any],
    schema: MrsBaseSchema,
    schema_on_service_with_session: MrsBaseSchema,
):
    """Check `DataClass.update()`."""
    # Produce table record
    document = ActorWithUpdateBehavior(
        schema=schema, data=cast(ActorData, data_details)
    )

    # get request path
    rest_document_id = getattr(document, cast(str, document.get_primary_key_name()))
    request_path = f"{schema._request_path}/actor/{rest_document_id}"

    # mock request
    mock_urlopen.return_value = urlopen_simulator(urlopen_read=urlopen_read)
    mock_create_default_context.return_value = ssl.create_default_context()

    # update document
    document.first_name = "Foo"
    await document.update()

    # verify
    mock_request_class.assert_called_once_with(
        url=request_path,
        headers={
            "Accept": "application/json",
            "If-Match": document.__dict__["_metadata"]["etag"],
        },
        data=json.dumps(obj=asdict(document), cls=MrsJSONDataEncoder).encode(),
        method="PUT",
    )
    mock_urlopen.assert_called_once()

    assert (
        document.first_name
        == MrsJSONDataDecoder.convert_keys(urlopen_read)["first_name"]
    )
    assert (
        document.last_name == MrsJSONDataDecoder.convert_keys(urlopen_read)["last_name"]
    )

    # Check authenticated
    document = ActorWithUpdateBehavior(
        schema=schema_on_service_with_session, data=cast(ActorData, data_details)
    )
    document.first_name = "Foo"
    await document.update()

    mock_request_class.assert_called_with(
        url=request_path,
        headers={
            "Accept": "application/json",
            "If-Match": document.__dict__["_metadata"]["etag"],
            "Authorization": "Bearer foo",
        },
        data=json.dumps(obj=asdict(document), cls=MrsJSONDataEncoder).encode(),
        method="PUT",
    )
    assert mock_urlopen.call_count == 2


@pytest.mark.parametrize(
    "data_details, expected_q_url",
    [
        (
            ActorDetails(
                {
                    "links": [],
                    "actor_id": 65,
                    "first_name": "Shigeru",
                    "last_name": "Miyamoto",
                    "_metadata": {
                        "etag": "33ED258BECDF269717782F5569C69F88CCCA2DF11936108C68C44100FF063D4D"
                    },
                }
            ),
            "q=%7B%22actorId%22%3A65%7D",
        ),
    ],
)
async def test_dataclass_delete(
    mock_urlopen: MagicMock,
    urlopen_simulator: MagicMock,
    mock_create_default_context: MagicMock,
    data_details: ActorDetails,
    expected_q_url: str,
    mock_request_class: MagicMock,
    schema: MrsBaseSchema,
):
    """Specifying `where`. Checking implicit filter."""
    document = ActorWithDeleteBehavior(
        schema=schema, data=cast(ActorData, data_details)
    )

    await validate_url(
        mock_urlopen=mock_urlopen,
        urlopen_simulator=urlopen_simulator,
        mock_create_default_context=mock_create_default_context,
        request=document,
        expected_url=f"{schema._request_path}/actor?{expected_q_url}",
        mock_request_class=mock_request_class,
    )

    # Misc: simply verify the ultimate mixin works
    document2 = ActorWithUpdateAndDeleteBehavior(
        schema=schema, data=cast(ActorData, data_details)
    )
    assert hasattr(document2, "update") == True
    assert hasattr(document2, "delete") == True


####################################################################################
#           Test "MrsDocumentBase" Abstract Class (Data Class Objects' backbone)
####################################################################################
def test_hypermedia_property_access():
    """Check hypermedia information is inaccessible."""

    class SubjectUnderTest(MrsDocumentBase):
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

    class SubjectUnderTest(MrsDocumentBase):
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

    class SubjectUnderTest(MrsDocumentBase):
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

    class SubjectUnderTest(MrsDocumentBase):
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
    sample_filter: FindFirstOptions | FindManyOptions | FindUniqueOptions,
    expected_payload: str,
    schema: MrsBaseSchema,
):
    """Check the custom query encoder parses and serializes the query filter ('where') correctly."""
    request_path = f"{schema._request_path}/actor"
    request = MrsBaseObjectQuery[ActorData, ActorDetails](
        schema=schema, request_path=request_path, options=sample_filter
    )

    assert (
        json.dumps(obj=request._where, cls=MrsQueryEncoder, separators=(",", ":"))
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
def test_mrs_document_not_found_exception():
    """Check custom message is shown when raising `MrsDocumentNotFoundError"""
    with pytest.raises(
        MrsDocumentNotFoundError,
        match=MrsDocumentNotFoundError._default_msg,
    ):
        raise MrsDocumentNotFoundError


def test_auth_app_not_found_exception():
    """Check custom message is shown when raising `AuthAppNotFoundError"""
    with pytest.raises(
        AuthAppNotFoundError,
        match=AuthAppNotFoundError._default_msg,
    ):
        raise AuthAppNotFoundError
