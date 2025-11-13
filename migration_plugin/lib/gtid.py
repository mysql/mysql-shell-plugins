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

from typing import Dict, List, Tuple


def parse_gtid_set(gtid_set: str) -> Dict[str, List[Tuple[int, int]]]:
    """Parse a MySQL GTID set into a dict: {UUID: [(start, end), ...]}"""
    result: Dict[str, List[Tuple[int, int]]] = {}
    if not gtid_set.strip():
        return result
    members = [s.strip() for s in gtid_set.split(",") if s.strip()]
    for member in members:
        fields = member.split(":")
        uuid, interval_fields = fields[0], fields[1:]
        intervals: List[Tuple[int, int]] = []
        for val in interval_fields:
            for seg in val.split(":"):
                if not seg:
                    continue
                if "-" in seg:
                    start, end = map(int, seg.split("-"))
                else:
                    start = end = int(seg)
                intervals.append((start, end))
        if intervals:
            result.setdefault(uuid, []).extend(intervals)
    return result


def serialize_gtid_set(gtid_dict: Dict[str, List[Tuple[int, int]]]) -> str:
    """Converts dict back to GTID set string."""
    parts: List[str] = []
    for uuid, intervals in gtid_dict.items():
        pieces = [f"{start}-{end}" if start !=
                  end else str(start) for start, end in sorted(intervals)]
        if pieces:
            parts.append(f"{uuid}:{':'.join(pieces)}")
    return ",".join(parts)


def interval_subtract(intervals1: List[Tuple[int, int]], intervals2: List[Tuple[int, int]]) -> List[Tuple[int, int]]:
    """Subtract intervals2 from intervals1."""
    result: List[Tuple[int, int]] = intervals1.copy()
    for del_start, del_end in intervals2:
        new_result: List[Tuple[int, int]] = []
        for start, end in result:
            # No overlap
            if del_end < start or del_start > end:
                new_result.append((start, end))
            else:
                # Pre-overlap
                if del_start > start:
                    new_result.append((start, del_start - 1))
                # Post-overlap
                if del_end < end:
                    new_result.append((del_end + 1, end))
        result = new_result
    return [interval for interval in result if interval[0] <= interval[1]]


def gtid_subtract(gtid_set1: str, gtid_set2: str) -> str:
    """Subtract gtid_set2 from gtid_set1."""
    gdict1 = parse_gtid_set(gtid_set1)
    gdict2 = parse_gtid_set(gtid_set2)
    result: Dict[str, List[Tuple[int, int]]] = {}

    for uuid, intervals1 in gdict1.items():
        intervals2 = gdict2.get(uuid, [])
        res_intervals = interval_subtract(intervals1, intervals2)
        if res_intervals:
            result[uuid] = res_intervals

    return serialize_gtid_set(result)


def gtid_count(gtid_set: str) -> int:
    """Count transactions in a GTID set."""
    gtid_dict = parse_gtid_set(gtid_set)
    count = 0
    for intervals in gtid_dict.values():
        for start, end in intervals:
            count += end - start + 1
    return count


def gtid_contains(gtid_set: str, gtid: str) -> bool:
    """
    Returns True if the given GTID (with tags allowed) is present in the GTID set.
    GTID format: uuid:tag1:tag2:...:txn
    """
    gtid_dict = parse_gtid_set(gtid_set)
    fields = gtid.split(":")
    if len(fields) < 2:
        return False
    uuid = fields[0]
    txn_str = fields[-1]
    try:
        txn = int(txn_str)
    except ValueError:
        return False
    # Look for uuid and matching interval
    for start, end in gtid_dict.get(uuid, []):
        if start <= txn <= end:
            return True
    return False
