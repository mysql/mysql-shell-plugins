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
# separately licensed software that they have either included with the
# program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

from migration_plugin.lib.gtid import (
    parse_gtid_set, serialize_gtid_set, interval_subtract,
    gtid_subtract, gtid_count, gtid_contains
)


class TestParseGtidSet:

    def test_parse_gtid_set(self):
        assert parse_gtid_set("") == {}
        assert parse_gtid_set("   \t\n  ") == {}

        result = parse_gtid_set("12345678-1234-1234-1234-123456789abc:1")
        expected = {"12345678-1234-1234-1234-123456789abc": [(1, 1)]}
        assert result == expected

        result = parse_gtid_set("12345678-1234-1234-1234-123456789abc:1-5")
        expected = {"12345678-1234-1234-1234-123456789abc": [(1, 5)]}
        assert result == expected

        result = parse_gtid_set("12345678-1234-1234-1234-123456789abc:1-5:10-15:20")
        expected = {"12345678-1234-1234-1234-123456789abc": [(1, 5), (10, 15), (20, 20)]}
        assert result == expected

        result = parse_gtid_set("12345678-1234-1234-1234-123456789abc:1-5,87654321-4321-4321-4321-cba987654321:10-15")
        expected = {
            "12345678-1234-1234-1234-123456789abc": [(1, 5)],
            "87654321-4321-4321-4321-cba987654321": [(10, 15)]
        }
        assert result == expected

        result = parse_gtid_set(" 12345678-1234-1234-1234-123456789abc:1-5 , 87654321-4321-4321-4321-cba987654321:10-15 ")
        expected = {
            "12345678-1234-1234-1234-123456789abc": [(1, 5)],
            "87654321-4321-4321-4321-cba987654321": [(10, 15)]
        }
        assert result == expected

        result = parse_gtid_set("12345678-1234-1234-1234-123456789abc:1::5")
        expected = {"12345678-1234-1234-1234-123456789abc": [(1, 1), (5, 5)]}
        assert result == expected

        result = parse_gtid_set("12345678-1234-1234-1234-123456789abc:1-1:2-2:3-3")
        expected = {"12345678-1234-1234-1234-123456789abc": [(1, 1), (2, 2), (3, 3)]}
        assert result == expected


class TestSerializeGtidSet:

    def test_serialize_gtid_set(self):
        assert serialize_gtid_set({}) == ""

        gtid_dict = {"12345678-1234-1234-1234-123456789abc": [(1, 1)]}
        result = serialize_gtid_set(gtid_dict)
        assert result == "12345678-1234-1234-1234-123456789abc:1"

        gtid_dict = {"12345678-1234-1234-1234-123456789abc": [(1, 5)]}
        result = serialize_gtid_set(gtid_dict)
        assert result == "12345678-1234-1234-1234-123456789abc:1-5"

        gtid_dict = {"12345678-1234-1234-1234-123456789abc": [(1, 5), (10, 15), (20, 20)]}
        result = serialize_gtid_set(gtid_dict)
        assert result == "12345678-1234-1234-1234-123456789abc:1-5:10-15:20"

        gtid_dict = {
            "12345678-1234-1234-1234-123456789abc": [(1, 5)],
            "87654321-4321-4321-4321-cba987654321": [(10, 15)]
        }
        result = serialize_gtid_set(gtid_dict)
        assert ("12345678-1234-1234-1234-123456789abc:1-5" in result and
                "87654321-4321-4321-4321-cba987654321:10-15" in result)

        original = "12345678-1234-1234-1234-123456789abc:1-5:10-15,87654321-4321-4321-4321-cba987654321:20-25"
        parsed = parse_gtid_set(original)
        serialized = serialize_gtid_set(parsed)
        reparsed = parse_gtid_set(serialized)
        assert reparsed == parsed


class TestIntervalSubtract:

    def test_interval_subtract(self):
        intervals1 = [(1, 5), (10, 15)]
        intervals2 = [(20, 25), (30, 35)]
        result = interval_subtract(intervals1, intervals2)
        assert result == [(1, 5), (10, 15)]

        intervals1 = [(1, 5), (10, 15)]
        intervals2 = [(1, 5), (10, 15)]
        result = interval_subtract(intervals1, intervals2)
        assert result == []

        intervals1 = [(1, 10)]
        intervals2 = [(1, 5)]
        result = interval_subtract(intervals1, intervals2)
        assert result == [(6, 10)]

        intervals1 = [(1, 10)]
        intervals2 = [(6, 10)]
        result = interval_subtract(intervals1, intervals2)
        assert result == [(1, 5)]

        intervals1 = [(1, 10)]
        intervals2 = [(4, 7)]
        result = interval_subtract(intervals1, intervals2)
        assert result == [(1, 3), (8, 10)]

        intervals1 = [(1, 10)]
        intervals2 = [(3, 8)]
        result = interval_subtract(intervals1, intervals2)
        assert result == [(1, 2), (9, 10)]

        intervals1 = [(3, 8)]
        intervals2 = [(1, 10)]
        result = interval_subtract(intervals1, intervals2)
        assert result == []

        intervals1 = []
        intervals2 = [(1, 5)]
        result = interval_subtract(intervals1, intervals2)
        assert result == []

        intervals1 = [(1, 5), (10, 15)]
        intervals2 = []
        result = interval_subtract(intervals1, intervals2)
        assert result == [(1, 5), (10, 15)]

        intervals1 = [(1, 1), (3, 3), (5, 5)]
        intervals2 = [(2, 2), (4, 4)]
        result = interval_subtract(intervals1, intervals2)
        assert result == [(1, 1), (3, 3), (5, 5)]

        intervals1 = [(1, 20)]
        intervals2 = [(5, 8), (12, 15)]
        result = interval_subtract(intervals1, intervals2)
        assert result == [(1, 4), (9, 11), (16, 20)]


class TestGtidSubtract:

    def test_gtid_subtract(self):
        assert gtid_subtract("", "") == ""

        result = gtid_subtract("", "12345678-1234-1234-1234-123456789abc:1-5")
        assert result == ""

        result = gtid_subtract("12345678-1234-1234-1234-123456789abc:1-5", "")
        assert result == "12345678-1234-1234-1234-123456789abc:1-5"

        gtid_set = "12345678-1234-1234-1234-123456789abc:1-5"
        result = gtid_subtract(gtid_set, gtid_set)
        assert result == ""

        gtid1 = "12345678-1234-1234-1234-123456789abc:1-10"
        gtid2 = "12345678-1234-1234-1234-123456789abc:5-15"
        result = gtid_subtract(gtid1, gtid2)
        assert result == "12345678-1234-1234-1234-123456789abc:1-4"

        gtid1 = "12345678-1234-1234-1234-123456789abc:1-5"
        gtid2 = "87654321-4321-4321-4321-cba987654321:1-5"
        result = gtid_subtract(gtid1, gtid2)
        assert result == "12345678-1234-1234-1234-123456789abc:1-5"

        gtid1 = "12345678-1234-1234-1234-123456789abc:1-5,87654321-4321-4321-4321-cba987654321:10-15"
        gtid2 = "12345678-1234-1234-1234-123456789abc:3-7,87654321-4321-4321-4321-cba987654321:12-17"
        result = gtid_subtract(gtid1, gtid2)
        parsed = parse_gtid_set(result)
        assert "12345678-1234-1234-1234-123456789abc" in parsed
        assert "87654321-4321-4321-4321-cba987654321" in parsed


class TestGtidCount:

    def test_gtid_count(self):
        assert gtid_count("") == 0

        assert gtid_count("12345678-1234-1234-1234-123456789abc:1") == 1

        assert gtid_count("12345678-1234-1234-1234-123456789abc:1-5") == 5

        assert gtid_count("12345678-1234-1234-1234-123456789abc:1-5:10-15:20") == 12  # 5 + 6 + 1

        assert gtid_count("12345678-1234-1234-1234-123456789abc:1-5,87654321-4321-4321-4321-cba987654321:10-15") == 11  # 5 + 6

        assert gtid_count("12345678-1234-1234-1234-123456789abc:1-1000") == 1000

        assert gtid_count("12345678-1234-1234-1234-123456789abc:1:2:3:4:5") == 5


class TestGtidContains:

    def test_gtid_contains(self):
        gtid_set = "12345678-1234-1234-1234-123456789abc:1-5"

        assert gtid_contains(gtid_set, "12345678-1234-1234-1234-123456789abc:3") is True
        assert gtid_contains(gtid_set, "12345678-1234-1234-1234-123456789abc:1") is True  # at start
        assert gtid_contains(gtid_set, "12345678-1234-1234-1234-123456789abc:5") is True  # at end

        assert gtid_contains(gtid_set, "12345678-1234-1234-1234-123456789abc:10") is False

        assert gtid_contains(gtid_set, "87654321-4321-4321-4321-cba987654321:3") is False

        assert gtid_contains(gtid_set, "12345678-1234-1234-1234-123456789abc:tag1:tag2:3") is True

        assert gtid_contains(gtid_set, "invalid-format") is False
        assert gtid_contains(gtid_set, "12345678-1234-1234-1234-123456789abc:abc") is False

        assert gtid_contains("", "12345678-1234-1234-1234-123456789abc:1") is False

        gtid_set_multi = "12345678-1234-1234-1234-123456789abc:1-5:10-15:20-25"
        assert gtid_contains(gtid_set_multi, "12345678-1234-1234-1234-123456789abc:12") is True
        assert gtid_contains(gtid_set_multi, "12345678-1234-1234-1234-123456789abc:8") is False


class TestEdgeCases:

    def test_edge_cases(self):
        result = parse_gtid_set("12345678-1234-1234-1234-123456789abc:1-999999999")
        expected = {"12345678-1234-1234-1234-123456789abc": [(1, 999999999)]}
        assert result == expected

        result = parse_gtid_set("12345678-1234-1234-1234-123456789abc:0-0")
        expected = {"12345678-1234-1234-1234-123456789abc": [(0, 0)]}
        assert result == expected

        result = parse_gtid_set("12345678-1234-1234-1234-123456789abc:1-5,12345678-1234-1234-1234-123456789abc:10-15")
        expected = {"12345678-1234-1234-1234-123456789abc": [(1, 5), (10, 15)]}
        assert result == expected

        gtid_dict = {"12345678-1234-1234-1234-123456789abc": [(1, 5), (10, 15)]}
        result = serialize_gtid_set(gtid_dict)
        assert "12345678-1234-1234-1234-123456789abc:1-5:10-15" in result

        intervals1 = [(1, 5)]
        intervals2 = [(10, 5)]  # Invalid: start > end
        result = interval_subtract(intervals1, intervals2)
        assert result == [(1, 5)]  # Should filter out invalid intervals

        result = parse_gtid_set("invalid-uuid:1-5")
        expected = {"invalid-uuid": [(1, 5)]}
        assert result == expected

        gtid_set = "12345678-1234-1234-1234-123456789abc:1-5"
        assert gtid_contains(gtid_set, "invalid-uuid:3") is False

        assert gtid_count("12345678-1234-1234-1234-123456789abc:0-4") == 5
        gtid_set = "12345678-1234-1234-1234-123456789abc:0-4"
        assert gtid_contains(gtid_set, "12345678-1234-1234-1234-123456789abc:2") is True

        original = "12345678-1234-1234-1234-123456789abc:1-5:10-15:20,87654321-4321-4321-4321-cba987654321:100-200:300-400"
        parsed = parse_gtid_set(original)
        serialized = serialize_gtid_set(parsed)
        reparsed = parse_gtid_set(serialized)

        for uuid, intervals in parsed.items():
            assert uuid in reparsed
            assert reparsed[uuid] == intervals
