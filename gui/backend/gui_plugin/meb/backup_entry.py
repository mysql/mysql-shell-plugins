# Copyright (c) 2012, 2026, Oracle and/or its affiliates.
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
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

from __future__ import annotations

import configparser
import io
import os
from typing import Any
from xml.dom.minidom import parseString



class BackupEntry:
    def __init__(self, context: Any, data_path: str | None, log_path: str | None, is_image: bool = False) -> None:
        self.context: Any = context
        if is_image:
            self.image_path: str | None = data_path
            self.data_path: str | None = data_path.replace(".mbi", "") if data_path else None
        else:
            self.image_path = ""
            self.data_path = data_path

        self.log_path: str | None = log_path
        self.error: str | None = "Backup data missing" if not data_path else None
        self.metadata: dict[str, str] = {}
        self.other_metadata: dict[str, Any] = {}
        self.manifest: dict[str, Any] | None = None
        self.is_image: bool = is_image
        self.content_unpacked: bool = False
        self.variables_unpacked: bool = False

    def __eq__(self, other: object) -> bool:
        return other and self.data_path == other.data_path

    def set_error(self, err: str) -> None:
        self.error = err

    def process_variables_txt(self, data: str) -> None:
        doc = configparser.ConfigParser()
        try:
            buf = io.StringIO(data)
            doc.read_file(buf)
        except Exception as e:
            self.set_error("Could not parse backup metadata: %s" % e)
        if not doc.has_section('backup_variables'):
            self.set_error("Backup metadata in unexpected format")
        else:
            self.metadata = dict(doc.items('backup_variables'))

    def process_metadata(self, xmldata: str) -> None:
        doc = parseString(xmldata)
        elem = doc.getElementsByTagName("other_metadata")
        if not elem:
            raise Exception("Backup metadata not in expected format")
        elem = elem[0]
        for ch in elem.childNodes:
            if not ch.nodeName.startswith("#"):
                self.other_metadata[ch.nodeName] = ch.firstChild.nodeValue

    def process_contents(self, xmldata: str) -> None:
        doc = parseString(xmldata)

        def process(node: Any) -> dict[str, Any] | str | None:
            value = None

            if getattr(node, "nodeType", None) == node.DOCUMENT_NODE:
                value = {}
                for ch in node.childNodes:
                    if not ch.nodeName.startswith("#"):
                        value[ch.nodeName] = process(ch)
            elif len(node.childNodes) == 1 and node.firstChild.nodeName.startswith("#"):
                value = node.firstChild.nodeValue
            else:
                value = {}
                for ch in node.childNodes:
                    if not ch.nodeName.startswith("#"):
                        child_value = process(ch)

                        if ch.nodeName in value:
                            # Converts the value into a list with the first element
                            if not isinstance(value[ch.nodeName], list):
                                value[ch.nodeName] = [value[ch.nodeName]]

                            # Inserts the new element
                            value[ch.nodeName].append(child_value)
                        else:
                            value[ch.nodeName] = child_value

            return value

        manifest = process(doc)
        if not isinstance(manifest, dict):
            raise ValueError("Backup contents manifest is not in the expected format")

        backup_manifest = manifest.get('manifest_backup_content', {})
        if not isinstance(backup_manifest, dict):
            raise ValueError("Backup contents manifest is not in the expected format")

        self.manifest = backup_manifest

    @property
    def timestamp(self) -> str:
        if self.data_path:
            date, _, time_stamp = os.path.split(self.data_path)[1].partition("_")
        else:
            tmp = os.path.splitext(self.log_path)[0]
            date, _, time_stamp = os.path.split(tmp)[1].partition("_")
        return date + " " + time_stamp.replace("-", ":")


    @property
    def start_time(self) -> str | None:
        # requires self.process_contents() to have been called previously
        if self.manifest:
            return self.manifest['backup_content']['other_metadata']['start_time']
        return None


    @property
    def valid(self) -> bool:
        return self.error is None and self.data_path is not None


    @property
    def is_partial(self) -> bool:
        return self.metadata.get('is_partial') == '1'

    @property
    def apply_log_done(self) -> bool:
        return self.metadata.get('apply_log_done') == '1'
