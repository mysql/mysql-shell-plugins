# Copyright (c) 2025, Oracle and/or its affiliates.
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

import os
import pytest
import migration_plugin.lib.core as core

class TestPathFunctions:

    def test_get_plugin_data_path(self):
        result_default = core.get_plugin_data_path()
        result_create_false = core.get_plugin_data_path(create=False)
        result_create_true = core.get_plugin_data_path(create=True)

        for result in [result_default, result_create_false, result_create_true]:
            assert isinstance(result, str)
            assert len(result) > 0
            assert os.path.isabs(result)
            assert "migration_plugin" in result

        assert os.path.exists(result_default)
        assert os.path.exists(result_create_true)
        assert os.path.isdir(result_create_true)

    def test_default_projects_directory(self):
        result_create_true = core.default_projects_directory(create=True)
        result_create_false = core.default_projects_directory(create=False)

        for result in [result_create_true, result_create_false]:
            assert isinstance(result, str)
            assert len(result) > 0
            assert os.path.isabs(result)

        assert "migration_plugin" in result_create_true
        assert os.path.exists(result_create_true)
        assert os.path.isdir(result_create_true)

    def test_default_shared_ssh_key_directory(self):
        result_create_true = core.default_shared_ssh_key_directory(create=True)
        result_create_false = core.default_shared_ssh_key_directory(create=False)

        for result in [result_create_true, result_create_false]:
            assert isinstance(result, str)
            assert len(result) > 0
            assert os.path.isabs(result)

        assert "migration_plugin" in result_create_true
        assert "ssh" in result_create_true
        assert os.path.exists(result_create_true)
        assert os.path.isdir(result_create_true)



class TestInteractiveFunctions:

    def test_get_interactive_default(self):
        result = core.get_interactive_default()

        assert isinstance(result, bool)
        assert result in [True, False]

    def test_get_interactive_result(self):
        result = core.get_interactive_result()

        assert isinstance(result, bool)
        assert result in [True, False]




class TestScriptPath:

    def test_script_path(self):
        result_default = core.script_path()
        result_with_suffixes = core.script_path("test", "subfolder")

        for result in [result_default, result_with_suffixes]:
            assert isinstance(result, str)
            assert len(result) > 0
            assert os.path.isabs(result)

        assert "test" in result_with_suffixes
        assert "subfolder" in result_with_suffixes




class TestMakeStringValidForFilesystem:

    def test_make_string_valid_for_filesystem(self):
        test_cases = [
            ('test<>:"/\\|?*file', "testfile"),
            ("test_file-123_ABC", "test_file-123_ABC"),
            ("", ""),
            ('<>:"/\\|?*', ""),
            ("my<>file:name/with\\invalid|chars?*", "myfilenamewithinvalidchars"),
            ("test_文件_файл_파일", "test_文件_файл_파일")
        ]

        for input_string, expected in test_cases:
            result = core.make_string_valid_for_filesystem(input_string)
            assert result == expected

            if input_string != expected:
                invalid_chars = ['<', '>', ':', '"', '/', '\\', '|', '?', '*']
                for char in invalid_chars:
                    assert char not in result




class TestUtilityFunctions:


    def test_string_escape_and_quote_functions(self):
        assert core.escape_str("test'quote\"double\\backslash") == "test\\'quote\\\"double\\\\backslash"
        assert core.unescape_str("test\\'quote\\\"double\\\\backslash") == "test'quote\"double\\backslash"

        assert core.quote_str("test") == '"test"'
        assert core.quote_str("test'quote") == '"test\\\'quote"'

        assert core.unquote_str('"test"') == "test"
        assert core.unquote_str("'test'") == "test"
        assert core.unquote_str("test") == "test"

    def test_identifier_functions(self):
        result_quote = core.quote_ident("test_table")
        result_unquote = core.unquote_ident("`test_table`")

        assert isinstance(result_quote, str)
        assert len(result_quote) > 0
        assert isinstance(result_unquote, str)
        assert len(result_unquote) > 0










class TestEdgeCases:

    def test_edge_cases(self):
        unicode_string = "test_文件_файл_파일"
        assert core.make_string_valid_for_filesystem(unicode_string) == unicode_string

        assert core.escape_str("") == ""
        assert core.quote_str("") == '""'
        assert core.unquote_str("") == ""
        assert core.unquote_str('""') == ""
        assert core.unquote_str("''") == ""
