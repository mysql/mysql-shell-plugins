# Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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
# separately licensed software that they have either included with the
# program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR PARTICULAR PURPOSE.  See
# GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

from migration_plugin.lib.util import (
    sanitize_par_uri, sanitize_dict, sanitize_connection_dict,
    sanitize_dict_any_pass, k_san_dict_par, k_san_dict_connection
)


class TestSanitizeParUri:

    def test_sanitize_par_uri(self):
        par_uri = "https://objectstorage.us-ashburn-1.oraclecloud.com/p/abc123def456/n/namespace/b/bucket/o/object"
        result = sanitize_par_uri(par_uri)
        expected = "https://objectstorage.us-ashburn-1.oraclecloud.com/p/<redacted>/n/namespace/b/bucket/o/object"
        assert result == expected

        par_uri = "https://objectstorage.eu-frankfurt-1.oraclecloud.com/p/xyz789/n/namespace/b/bucket/o/object"
        result = sanitize_par_uri(par_uri)
        expected = "https://objectstorage.eu-frankfurt-1.oraclecloud.com/p/<redacted>/n/namespace/b/bucket/o/object"
        assert result == expected

        par_uri = "https://objectstorage.us-ashburn-1.oraclecloud.com/p/very-long-par-id-with-special-chars-123/n/namespace/b/bucket/o/object"
        result = sanitize_par_uri(par_uri)
        expected = "https://objectstorage.us-ashburn-1.oraclecloud.com/p/<redacted>/n/namespace/b/bucket/o/object"
        assert result == expected

        non_par_uri = "https://objectstorage.us-ashburn-1.oraclecloud.com/n/namespace/b/bucket/o/object"
        result = sanitize_par_uri(non_par_uri)
        assert result == non_par_uri

        result = sanitize_par_uri("")
        assert result == ""

        par_uri = "https://objectstorage.us-ashburn-1.oraclecloud.com/p/abc123/n/namespace/b/bucket/o/object/p/def456"
        result = sanitize_par_uri(par_uri)
        expected = "https://objectstorage.us-ashburn-1.oraclecloud.com/p/<redacted>/n/namespace/b/bucket/o/object/p/def456"
        assert result == expected


class TestSanitizeDict:

    def test_sanitize_dict(self):
        data = {
            "access_uri": "https://objectstorage.us-ashburn-1.oraclecloud.com/p/abc123/n/namespace/b/bucket/o/object",
            "full_path": "https://objectstorage.us-ashburn-1.oraclecloud.com/p/def456/n/namespace/b/bucket/o/object",
            "other_field": "should_remain_unchanged"
        }

        result = sanitize_dict(data, k_san_dict_par)
        expected = {
            "access_uri": "https://objectstorage.us-ashburn-1.oraclecloud.com/p/<redacted>/n/namespace/b/bucket/o/object",
            "full_path": "https://objectstorage.us-ashburn-1.oraclecloud.com/p/<redacted>/n/namespace/b/bucket/o/object",
            "other_field": "should_remain_unchanged"
        }
        assert result == expected

        data = {
            "password": "secret123",
            "username": "user",
            "host": "localhost"
        }

        result = sanitize_dict(data, k_san_dict_connection)
        expected = {
            "password": "****",
            "username": "user",
            "host": "localhost"
        }
        assert result == expected

        result = sanitize_dict({}, k_san_dict_connection)
        assert result == {}

        custom_sanitizers = {
            "sensitive": lambda s: "REDACTED",
            "normal": lambda s: s
        }

        data = {
            "sensitive": "secret_data",
            "normal": "public_data"
        }

        result = sanitize_dict(data, custom_sanitizers)
        expected = {
            "sensitive": "REDACTED",
            "normal": "public_data"
        }
        assert result == expected


class TestSanitizeConnectionDict:

    def test_sanitize_connection_dict(self):
        connection_options = {
            "password": "secret123",
            "username": "user",
            "host": "localhost",
            "port": 3306
        }

        result = sanitize_connection_dict(connection_options)
        expected = {
            "password": "****",
            "username": "user",
            "host": "localhost",
            "port": 3306
        }
        assert result == expected

        connection_options = {
            "username": "user",
            "host": "localhost",
            "port": 3306
        }

        result = sanitize_connection_dict(connection_options)
        assert result == connection_options

        result = sanitize_connection_dict({})
        assert result == {}

        connection_options = {
            "password": "secret123",
            "username": "user",
            "host": "localhost",
            "port": 3306,
            "database": "testdb",
            "ssl_mode": "REQUIRED"
        }

        result = sanitize_connection_dict(connection_options)
        expected = {
            "password": "****",
            "username": "user",
            "host": "localhost",
            "port": 3306,
            "database": "testdb",
            "ssl_mode": "REQUIRED"
        }
        assert result == expected


class TestSanitizeDictAnyPass:

    def test_sanitize_dict_any_pass(self):
        data = {
            "password": "secret123",
            "username": "user",
            "host": "localhost"
        }

        result = sanitize_dict_any_pass(data)
        expected = {
            "password": "****",
            "username": "user",
            "host": "localhost"
        }
        assert result == expected

        data = {
            "PASSWORD": "secret123",
            "userPassword": "secret456",
            "admin_password": "secret789",
            "username": "user"
        }

        result = sanitize_dict_any_pass(data)
        expected = {
            "PASSWORD": "****",
            "userPassword": "****",
            "admin_password": "****",
            "username": "user"
        }
        assert result == expected

        data = {
            "connection": {
                "password": "secret123",
                "username": "user"
            },
            "other_field": "value"
        }

        result = sanitize_dict_any_pass(data)
        expected = {
            "connection": {
                "password": "****",
                "username": "user"
            },
            "other_field": "value"
        }
        assert result == expected

        data = {
            "level1": {
                "level2": {
                    "password": "secret123",
                    "level3": {
                        "admin_password": "secret456"
                    }
                }
            }
        }

        result = sanitize_dict_any_pass(data)
        expected = {
            "level1": {
                "level2": {
                    "password": "****",
                    "level3": {
                        "admin_password": "****"
                    }
                }
            }
        }
        assert result == expected

        data = {
            "users": [
                {"username": "user1", "password": "secret1"},
                {"username": "user2", "password": "secret2"}
            ],
            "admin_password": "admin_secret"
        }

        result = sanitize_dict_any_pass(data)
        expected = {
            "users": [
                {"username": "user1", "password": "****"},
                {"username": "user2", "password": "****"}
            ],
            "admin_password": "****"
        }
        assert result == expected

        data = {
            "items": [
                {"password": "secret1"},
                "not_a_dict",
                {"username": "user", "password": "secret2"}
            ]
        }

        result = sanitize_dict_any_pass(data)
        expected = {
            "items": [
                {"password": "****"},
                "not_a_dict",
                {"username": "user", "password": "****"}
            ]
        }
        assert result == expected

    def test_sanitize_dict_any_pass_edge_cases(self):
        result = sanitize_dict_any_pass(None)
        assert result is None

        result = sanitize_dict_any_pass({})
        assert result == {}

        data = {
            "username": "user",
            "host": "localhost",
            "port": 3306
        }

        result = sanitize_dict_any_pass(data)
        assert result == data

        data = {
            "password": "",
            "username": "user"
        }

        result = sanitize_dict_any_pass(data)
        expected = {
            "password": "****",
            "username": "user"
        }
        assert result == expected

        data = {
            "password": None,
            "username": "user"
        }

        result = sanitize_dict_any_pass(data)
        expected = {
            "password": "****",
            "username": "user"
        }
        assert result == expected

        data = {
            "password": 12345,
            "username": "user"
        }

        result = sanitize_dict_any_pass(data)
        expected = {
            "password": "****",
            "username": "user"
        }
        assert result == expected


class TestConstants:

    def test_k_san_dict_par(self):
        assert "access_uri" in k_san_dict_par
        assert "full_path" in k_san_dict_par
        assert callable(k_san_dict_par["access_uri"])
        assert callable(k_san_dict_par["full_path"])

        test_uri = "https://objectstorage.us-ashburn-1.oraclecloud.com/p/abc123/n/namespace/b/bucket/o/object"
        result = k_san_dict_par["access_uri"](test_uri)
        expected = "https://objectstorage.us-ashburn-1.oraclecloud.com/p/<redacted>/n/namespace/b/bucket/o/object"
        assert result == expected

    def test_k_san_dict_connection(self):
        assert "password" in k_san_dict_connection
        assert callable(k_san_dict_connection["password"])

        result = k_san_dict_connection["password"]("secret123")
        assert result == "****"


class TestEdgeCases:

    def test_sanitize_par_uri_edge_cases(self):
        result = sanitize_par_uri("https://example.com/p/")
        assert result == "https://example.com/p/"

        result = sanitize_par_uri("https://example.com/p/abc123")
        assert result == "https://example.com/p/abc123"

        result = sanitize_par_uri("https://example.com/p/abc123/")
        assert result == "https://example.com/p/<redacted>/"

        result = sanitize_par_uri(
            "https://example.com/p/abc123/n/namespace/p/def456/")
        expected = "https://example.com/p/<redacted>/n/namespace/p/<redacted>/"
        assert result == expected

        result = sanitize_par_uri("just a regular string")
        assert result == "just a regular string"

        result = sanitize_par_uri(
            "https://example.com/p/abc-123_def/n/namespace")
        expected = "https://example.com/p/<redacted>/n/namespace"
        assert result == expected

        result = sanitize_par_uri("https://example.com/p//n/namespace")
        expected = "https://example.com/p/<redacted>/n/namespace"
        assert result == expected

        long_par_id = "a" * 100
        result = sanitize_par_uri(
            f"https://example.com/p/{long_par_id}/n/namespace")
        expected = "https://example.com/p/<redacted>/n/namespace"
        assert result == expected

    def test_sanitize_dict_edge_cases(self):
        data = {"password": None, "username": "user"}
        result = sanitize_dict(data, k_san_dict_connection)
        expected = {"password": "****", "username": "user"}
        assert result == expected

        data = {"password": "", "username": "user"}
        result = sanitize_dict(data, k_san_dict_connection)
        expected = {"password": "****", "username": "user"}
        assert result == expected

        data = {"password": 12345, "username": "user"}
        result = sanitize_dict(data, k_san_dict_connection)
        expected = {"password": "****", "username": "user"}
        assert result == expected

        data = {"password": "secret", "username": "user"}
        result = sanitize_dict(data, {})
        assert result == data

    def test_sanitize_dict_any_pass_complex_structures(self):
        data = {
            "config": {
                "database": {
                    "password": "db_secret",
                    "connections": [
                        {"host": "db1", "password": "conn1_secret"},
                        {"host": "db2", "password": "conn2_secret"}
                    ]
                },
                "api": {
                    "api_password": "api_secret",
                    "endpoints": [
                        {"url": "/users", "auth_password": "endpoint_secret"}
                    ]
                }
            },
            "admin_password": "admin_secret"
        }

        result = sanitize_dict_any_pass(data)
        expected = {
            "config": {
                "database": {
                    "password": "****",
                    "connections": [
                        {"host": "db1", "password": "****"},
                        {"host": "db2", "password": "****"}
                    ]
                },
                "api": {
                    "api_password": "****",
                    "endpoints": [
                        {"url": "/users", "auth_password": "****"}
                    ]
                }
            },
            "admin_password": "****"
        }
        assert result == expected

        data = {
            "items": [
                "string_item",
                {"password": "secret1"},
                123,
                {"username": "user", "password": "secret2"},
                None
            ]
        }

        result = sanitize_dict_any_pass(data)
        expected = {
            "items": [
                "string_item",
                {"password": "****"},
                123,
                {"username": "user", "password": "****"},
                None
            ]
        }
        assert result == expected
