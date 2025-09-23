# Copyright (c) 2022, 2025, Oracle and/or its affiliates.
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

import tempfile
import os
import json
import zipfile
import filecmp
import datetime
import difflib
import pytest

from mrs_plugin import lib
from mrs_plugin.tests.unit.helpers import (
    ServiceCT,
    SchemaCT,
    DbObjectCT,
    TableContents,
    get_default_db_object_init,
    create_test_db,
)
from lib.core import MrsDbSession


def test_get_service(phone_book, table_contents):
    with MrsDbSession(session=phone_book["session"]) as session:
        service_table: TableContents = table_contents("service")
        service1 = lib.services.get_service(session=session, url_context_root="/test")

        assert service1 is not None
        assert service1 == {
            "id": phone_book["service_id"],
            "parent_id": None,
            "enabled": 1,
            "url_protocol": ["HTTP"],
            "url_host_name": "",
            "url_context_root": "/test",
            "url_host_id": phone_book["url_host_id"],
            "comments": "Test service",
            "host_ctx": "/test",
            "auth_completed_page_content": None,
            "auth_completed_url": None,
            "auth_completed_url_validation": None,
            "auth_path": "/authentication",
            "options": lib.services.DEFAULT_OPTIONS,
            "metadata": None,
            "is_current": 1,
            "in_development": None,
            "full_service_path": "/test",
            "published": 0,
            "sorted_developers": None,
            "name": "mrs",
            "auth_apps": ["MRS Auth App"],
        }

        with ServiceCT(session, "/service2") as service_id:
            assert service_table.count == service_table.snapshot.count + 1

            service2 = lib.services.get_service(
                session=session, url_context_root="/service2"
            )

            assert service2 is not None
            assert service2 == {
                "id": service_id,
                "parent_id": None,
                "enabled": 1,
                "url_protocol": ["HTTP"],
                "url_host_name": "",
                "url_context_root": "/service2",
                "url_host_id": service2["url_host_id"],
                "comments": "",
                "host_ctx": "/service2",
                "auth_completed_page_content": None,
                "auth_completed_url": None,
                "auth_completed_url_validation": None,
                "auth_path": "/authentication",
                "options": lib.services.DEFAULT_OPTIONS,
                "metadata": None,
                "in_development": None,
                "is_current": 0,
                "full_service_path": "/service2",
                "published": 0,
                "sorted_developers": None,
                "name": "mrs",
                "auth_apps": None,
            }

            assert service_table.get("id", service_id) == {
                "comments": "",
                "enabled": 1,
                "id": service_id,
                "parent_id": None,
                "url_context_root": "/service2",
                "url_host_id": service2["url_host_id"],
                "url_protocol": ["HTTP"],
                "auth_completed_page_content": None,
                "auth_completed_url": None,
                "auth_completed_url_validation": None,
                "auth_path": "/authentication",
                "options": lib.services.DEFAULT_OPTIONS,
                "metadata": None,
                "in_development": None,
                "custom_metadata_schema": None,
                "enable_sql_endpoint": 0,
                "published": 0,
                "name": "mrs",
            }

            with pytest.raises(Exception) as exc_info:
                lib.services.get_service(session=session, url_context_root="service2")
            assert str(exc_info.value) == "The url_context_root has to start with '/'."

        # Test getting the default service
        result = lib.services.get_service(
            session=session, url_context_root="/service2", get_default=False
        )
        assert result is None

        result = lib.services.get_service(
            session=session, url_context_root="/service2", get_default=True
        )
        assert result is not None

        with ServiceCT(session, "/service2") as service_id:
            lib.services.set_current_service_id(session, service_id)

        result = lib.services.get_service(
            session=session, url_context_root="/service2", get_default=False
        )
        assert result is None

        result = lib.services.get_service(
            session=session, url_context_root="/service2", get_default=True
        )
        assert result is None

        lib.services.set_current_service_id(session, phone_book["service_id"])

        result = lib.services.get_service(
            session=session, url_context_root="/service2", get_default=True
        )
        assert result is not None


def test_get_services(phone_book, table_contents):
    with MrsDbSession(session=phone_book["session"]) as session:
        service_table: TableContents = table_contents("service")
        services = lib.services.get_services(session=session)

        assert len(service_table.items) == len(services)
        assert len(services) == 1

        with ServiceCT(session, "/service2") as service2_id:
            services = lib.services.get_services(session=session)
            assert len(service_table.items) == len(services)
            assert len(services) == 2

            with ServiceCT(session, "/service3") as service3_id:
                services = lib.services.get_services(session=session)
                assert len(service_table.items) == len(services)
                assert len(services) == 3

            services = lib.services.get_services(session=session)
            assert len(service_table.items) == len(services)
            assert len(services) == 2

        services = lib.services.get_services(session=session)
        assert len(service_table.items) == len(services)
        assert len(services) == 1


def test_change_service(phone_book, table_contents):
    service_table = table_contents("service")
    auth_app_table = table_contents("auth_app")

    with MrsDbSession(session=phone_book["session"]) as session:
        with pytest.raises(Exception) as exc_info:
            lib.services.update_services(
                session=session, service_ids=[1000], value={"enabled": True}
            )
        assert str(exc_info.value) == "'int' object has no attribute 'hex'"

        with ServiceCT(session, "/service2") as service_id:
            value = {"comments": "This is the updated comment."}
            lib.services.update_services(
                session=session, service_ids=[service_id], value=value
            )

    assert service_table.same_as_snapshot
    assert auth_app_table.same_as_snapshot

@pytest.mark.skipif(os.getcwd() == "/environment/shell-plugins/mrs_plugin",
                    reason="Test skipped when running on jenkins")
def test_service_as_project(phone_book, table_contents):
    session = phone_book["session"]

    create_test_db(session, "MyTestDb1")
    create_test_db(session, "MyTestDb2")

    services = [
        {
            "name": "/myService1",
            "include_database_endpoints": False,
            "include_static_endpoints": False,
            "include_dynamic_endpoints": False,
        },
        {
            "name": "/myService2",
            "include_database_endpoints": False,
            "include_static_endpoints": False,
            "include_dynamic_endpoints": False,
        },
    ]

    schemas = [
        {
            "name": "MyTestDb1",
            "file_path": None,
        },
        {
            "name": "MyTestDb2",
            "file_path": None,
        },
    ]

    project_settings = {
        "name": "testProject",
        "icon_path": None,
        "description": "This is a test project",
        "publisher": "Oracle",
        "version": "1.0.0",
    }

    service1 = ServiceCT(session, "/myService1")
    schema1 = SchemaCT(session, service1.id, "MyTestDb1", "/MyTestDb1")
    DbObjectCT(
        session,
        **get_default_db_object_init(session, schema1.id, "Contacts", "/Contacts"),
    )
    DbObjectCT(
        session,
        **get_default_db_object_init(session, schema1.id, "Addresses", "/Addresses"),
    )
    DbObjectCT(
        session,
        **get_default_db_object_init(
            session,
            schema1.id,
            "GetAllContacts",
            "/GetAllContacts",
            db_object_type="PROCEDURE",
        ),
    )

    service2 = ServiceCT(session, "/myService2")
    schema2 = SchemaCT(session, service2.id, "MyTestDb2", "/MyTestDb2")
    DbObjectCT(
        session,
        **get_default_db_object_init(session, schema2.id, "Contacts", "/Contacts"),
    )
    DbObjectCT(
        session,
        **get_default_db_object_init(session, schema2.id, "Addresses", "/Addresses"),
    )
    DbObjectCT(
        session,
        **get_default_db_object_init(
            session,
            schema2.id,
            "GetAllContacts",
            "/GetAllContacts",
            db_object_type="PROCEDURE",
        ),
    )
    DbObjectCT(
        session,
        **get_default_db_object_init(
            session, schema2.id, "ContactBasicInfo", "/ContactBasicInfo"
        ),
    )

    # Test storing the project into a directory
    with tempfile.TemporaryDirectory(delete=False) as directory_1:
        project_settings["icon_path"] = os.path.join(directory_1, "icon1.svg")
        project_file_path = os.path.join(directory_1, "mrs.package.json")
        service1_service_path = os.path.join(directory_1, "myService1.service.mrs.sql")
        service2_service_path = os.path.join(directory_1, "myService2.service.mrs.sql")
        test_schema1_dir = os.path.join(directory_1, "MyTestDb1")
        test_schema2_dir = os.path.join(directory_1, "MyTestDb2")

        with open(project_settings["icon_path"], "w") as iconFile:
            iconFile.write(" ")

        lib.services.store_project(
            session, directory_1, services, schemas, project_settings, False
        )

        assert os.path.isfile(project_file_path)
        with open(project_file_path, "r") as f:
            data = json.load(f)

            assert data == {
                "name": project_settings["name"],
                "version": project_settings["version"],
                "restServices": [
                    {
                        "fileName": "myService1.service.mrs.sql",
                        "serviceName": "/myService1",
                    },
                    {
                        "fileName": "myService2.service.mrs.sql",
                        "serviceName": "/myService2",
                    },
                ],
                "schemas": [
                    {
                        "path": "MyTestDb1",
                        "schemaName": "MyTestDb1",
                        "format": "dump",
                    },
                    {
                        "path": "MyTestDb2",
                        "schemaName": "MyTestDb2",
                        "format": "dump",
                    },
                ],
                "creationDate": data["creationDate"],
                "publisher": project_settings["publisher"],
                "description": project_settings["description"],
                "icon": "appIcon.svg",
            }

        assert os.path.isfile(service1_service_path)
        assert os.path.isfile(service2_service_path)
        assert os.path.isdir(test_schema1_dir)
        assert os.path.isdir(test_schema2_dir)

    # Test storing the project into a zip file
    with tempfile.TemporaryDirectory(delete=False) as directory_zip_1:
        project_settings["icon_path"] = os.path.join(directory_zip_1, "icon1.svg")
        project_file_path = os.path.join(directory_zip_1, "mrs.package.json")
        service1_service_path = os.path.join(
            directory_zip_1, "myService1.service.mrs.sql"
        )
        service2_service_path = os.path.join(
            directory_zip_1, "myService2.service.mrs.sql"
        )
        test_schema1_dir = os.path.join(directory_zip_1, "MyTestDb1")
        test_schema2_dir = os.path.join(directory_zip_1, "MyTestDb2")

        with open(project_settings["icon_path"], "w") as iconFile:
            iconFile.write(" ")

        zip_path = os.path.join(directory_zip_1, "project.mrs.zip")
        lib.services.store_project(
            session, zip_path, services, schemas, project_settings, True
        )

        assert os.path.isfile(zip_path)

        assert zipfile.is_zipfile(zip_path)

        with zipfile.ZipFile(zip_path) as myzip:
            assert zipfile.Path(myzip, "mrs.package.json").is_file
            with myzip.open("mrs.package.json") as f:
                data = json.load(f)

                assert data == {
                    "name": project_settings["name"],
                    "version": project_settings["version"],
                    "restServices": [
                        {
                            "fileName": "myService1.service.mrs.sql",
                            "serviceName": "/myService1",
                        },
                        {
                            "fileName": "myService2.service.mrs.sql",
                            "serviceName": "/myService2",
                        },
                    ],
                    "schemas": [
                        {
                            "path": "MyTestDb1",
                            "schemaName": "MyTestDb1",
                            "format": "dump",
                        },
                        {
                            "path": "MyTestDb2",
                            "schemaName": "MyTestDb2",
                            "format": "dump",
                        },
                    ],
                    "creationDate": data["creationDate"],
                    "publisher": project_settings["publisher"],
                    "description": project_settings["description"],
                    "icon": "appIcon.svg",
                }

    for service_data in services:
        service = lib.services.get_service(
            session, url_context_root=service_data["name"]
        )

        lib.services.delete_service(session, service["id"])

    for schema_data in schemas:
        session.run_sql(f"DROP SCHEMA {schema_data["name"]}")

    lib.services.load_project(session, directory_1)

    with tempfile.TemporaryDirectory(delete=False) as directory_2:
        lib.services.store_project(
            session, directory_2, services, schemas, project_settings, False
        )

    compare = filecmp.dircmp(directory_1, directory_2)

    for file in compare.diff_files:
        with open(os.path.join(directory_1, file)) as f1:
            with open(os.path.join(directory_2, file)) as f2:
                if file == "mrs.package.json":
                    json1 = json.load(f1)
                    json2 = json.load(f2)

                    assert "creationDate" in json1
                    assert "creationDate" in json2

                    assert datetime.datetime.strptime(
                        json1.get("creationDate"), "%Y-%m-%d %H:%M:%S"
                    )
                    assert datetime.datetime.strptime(
                        json2.get("creationDate"), "%Y-%m-%d %H:%M:%S"
                    )

                    # make these dates the same, so we can compare the json objects
                    json1["creationDate"] = json2["creationDate"]

                    assert json1 == json2

                    compare.diff_files.remove("mrs.package.json")
                else:
                    file1_content = f1.read()
                    file2_content = f2.read()

                    for line in difflib.unified_diff(
                        file1_content,
                        file2_content,
                        os.path.join(directory_1, file),
                        os.path.join(directory_2, file),
                        lineterm="",
                    ):
                        print(line)

    assert not compare.diff_files

    for service_name in ["myService1", "myService2"]:
        service = lib.services.get_service(session, url_context_root=f"/{service_name}")
        lib.services.delete_service(session, service["id"])

    # test loading from GitHub
    lib.services.load_project(session, "github.com/migueltadeu/tests-mrs-project|main")

    with tempfile.TemporaryDirectory(delete=False) as directory_3:
        lib.services.store_project(
            session, directory_3, services, schemas, project_settings, False
        )

    compare = filecmp.dircmp(directory_1, directory_3)

    for file in compare.diff_files:
        with open(os.path.join(directory_1, file)) as f1:
            with open(os.path.join(directory_3, file)) as f2:
                if file == "mrs.package.json":
                    json1 = json.load(f1)
                    json2 = json.load(f2)

                    assert "creationDate" in json1
                    assert "creationDate" in json2

                    assert datetime.datetime.strptime(
                        json1.get("creationDate"), "%Y-%m-%d %H:%M:%S"
                    )
                    assert datetime.datetime.strptime(
                        json2.get("creationDate"), "%Y-%m-%d %H:%M:%S"
                    )

                    # make these dates the same, so we can compare the json objects
                    json1["creationDate"] = json2["creationDate"]

                    assert json1 == json2

                    compare.diff_files.remove("mrs.package.json")
                else:
                    file1_content = f1.read()
                    file2_content = f2.read()

                    for line in difflib.unified_diff(
                        file1_content,
                        file2_content,
                        os.path.join(directory_1, file),
                        os.path.join(directory_3, file),
                        lineterm="",
                    ):
                        print(line)

    assert not compare.diff_files

    for service_name in ["myService1", "myService2"]:
        service = lib.services.get_service(session, url_context_root=f"/{service_name}")
        lib.services.delete_service(session, service["id"])


    # test loading from GitHub
    lib.services.load_project(session, "github/migueltadeu/tests-mrs-project")

    with tempfile.TemporaryDirectory(delete=False) as directory_3:
        lib.services.store_project(
            session, directory_3, services, schemas, project_settings, False
        )

    compare = filecmp.dircmp(directory_1, directory_3)

    for file in compare.diff_files:
        with open(os.path.join(directory_1, file)) as f1:
            with open(os.path.join(directory_3, file)) as f2:
                if file == "mrs.package.json":
                    json1 = json.load(f1)
                    json2 = json.load(f2)

                    assert "creationDate" in json1
                    assert "creationDate" in json2

                    assert datetime.datetime.strptime(
                        json1.get("creationDate"), "%Y-%m-%d %H:%M:%S"
                    )
                    assert datetime.datetime.strptime(
                        json2.get("creationDate"), "%Y-%m-%d %H:%M:%S"
                    )

                    # make these dates the same, so we can compare the json objects
                    json1["creationDate"] = json2["creationDate"]

                    assert json1 == json2

                    compare.diff_files.remove("mrs.package.json")
                else:
                    file1_content = f1.read()
                    file2_content = f2.read()

                    for line in difflib.unified_diff(
                        file1_content,
                        file2_content,
                        os.path.join(directory_1, file),
                        os.path.join(directory_3, file),
                        lineterm="",
                    ):
                        print(line)

    assert not compare.diff_files

    for service_name in ["myService1", "myService2"]:
        service = lib.services.get_service(session, url_context_root=f"/{service_name}")
        lib.services.delete_service(session, service["id"])

