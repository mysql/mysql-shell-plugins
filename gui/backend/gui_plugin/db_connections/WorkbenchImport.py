# Copyright (c) 2026, Oracle and/or its affiliates.
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

"""Safe parsing and shared import of classic Workbench connection XML."""

import re

from typing import Any, Dict, List, Optional, Tuple
from xml.etree import ElementTree

MAX_XML_SIZE = 8 * 1024 * 1024
MAX_CONNECTIONS = 5000
MAX_DEPTH = 16
MAX_TEXT_LENGTH = 16 * 1024

SUPPORTED_DRIVERS = {
    "native",
    "native_socket",
    "native_sshtun",
}
SQL_MODE_PATTERN = re.compile(r"[A-Za-z0-9_]+")
SSL_MODES = (
    "DISABLED",
    "PREFERRED",
    "REQUIRED",
    "VERIFY_CA",
    "VERIFY_IDENTITY",
)
SECRET_PARAMETERS = {
    "password",
    "sshPassword",
    "sshKeyFilePassword",
}


class WorkbenchImportError(ValueError):
    """Raised when a Workbench XML document cannot be safely imported."""


def _bounded_text(element: ElementTree.Element) -> str:
    value = (element.text or "").strip()
    if len(value) > MAX_TEXT_LENGTH:
        raise WorkbenchImportError("Workbench XML text value is too large")

    return value


def _validate_tree(root: ElementTree.Element) -> None:
    stack = [(root, 1)]
    while stack:
        element, depth = stack.pop()
        if depth > MAX_DEPTH:
            raise WorkbenchImportError("Workbench XML nesting is too deep")
        _bounded_text(element)
        stack.extend((child, depth + 1) for child in element)


def _driver_name(record: ElementTree.Element) -> str:
    for child in record:
        if child.tag == "link" and child.attrib.get("key") == "driver":
            return _bounded_text(child).rsplit(".", 1)[-1]

    return ""


def _record_values(
    record: ElementTree.Element,
) -> Tuple[Dict[str, str], Dict[str, str]]:
    values: Dict[str, str] = {}
    parameters: Dict[str, str] = {}
    for child in record:
        if child.tag != "value":
            continue
        key = child.attrib.get("key", "")
        if key == "parameterValues":
            for parameter in child:
                if parameter.tag != "value":
                    continue
                parameter_key = parameter.attrib.get("key", "")
                if parameter_key and parameter_key not in SECRET_PARAMETERS:
                    parameters[parameter_key] = _bounded_text(parameter)
        elif key:
            values[key] = _bounded_text(child)

    return values, parameters


def _parse_integer(value: str, field: str) -> int:
    try:
        return int(value)
    except ValueError as error:
        raise WorkbenchImportError(
            f"Invalid integer value for Workbench field {field}"
        ) from error


def _connection_description(driver: str, options: Dict[str, Any]) -> str:
    user = str(options.get("user") or "").strip()
    if driver == "native_socket":
        socket = str(options.get("socket") or "").strip()
        if not socket:
            return ""

        return f"{user} via {socket}" if user else socket

    host = str(options.get("host") or "").strip()
    if not host:
        return ""
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    endpoint = f"{host}:{options.get('port', 3306)}"
    description = f"{user}@{endpoint}" if user else endpoint

    if driver == "native_sshtun":
        ssh = str(options.get("ssh") or "").strip()
        if ssh:
            description = f"{description} via {ssh}"

    return description


def _convert_record(record: ElementTree.Element, driver: str) -> Dict[str, Any]:
    values, parameters = _record_values(record)
    options: Dict[str, Any] = {
        "scheme": "mysql",
        "host": parameters.get("hostName", ""),
    }
    string_options = {
        "schema": "schema",
        "sslCA": "ssl-ca",
        "sslCert": "ssl-cert",
        "sslKey": "ssl-key",
        "sslCipher": "ssl-cipher",
        "userName": "user",
        "socket": "socket",
        "sshKeyFile": "ssh-identity-file",
    }
    for parameter_name, option_name in string_options.items():
        value = parameters.get(parameter_name, "")
        if value:
            options[option_name] = value

    port = parameters.get("port", "")
    if port:
        options["port"] = _parse_integer(port, "port")

    sql_mode = parameters.get("SQL_MODE", "")
    if sql_mode:
        modes = [
            mode
            for mode in sql_mode.split(",")
            if SQL_MODE_PATTERN.fullmatch(mode)
        ]
        options["sql-mode"] = modes

    ssl_mode = parameters.get("useSSL", "")
    if ssl_mode:
        ssl_index = _parse_integer(ssl_mode, "useSSL")
        if ssl_index < 0 or ssl_index >= len(SSL_MODES):
            raise WorkbenchImportError("Invalid Workbench useSSL value")
        options["ssl-mode"] = SSL_MODES[ssl_index]

    compression = parameters.get("CLIENT_COMPRESS", "")
    if compression:
        options["compression"] = (
            "PREFERRED" if compression == "1" else "DISABLED"
        )

    ssh_host = parameters.get("sshHost", "")
    ssh_user = parameters.get("sshUserName", "")
    if ssh_host:
        options["ssh"] = (
            f"{ssh_user}@{ssh_host}" if ssh_user else ssh_host
        )

    return {
        "db_type": "MySQL",
        "caption": values.get("name", "").strip(),
        "description": _connection_description(driver, options),
        "options": options,
        "settings": {},
    }


def parse_workbench_document(
    xml_content: str,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, str]]]:
    """Parse supported records and return bounded issues for skipped records."""
    if not isinstance(xml_content, str):
        raise WorkbenchImportError("Workbench XML content must be text")
    if len(xml_content.encode("utf8")) > MAX_XML_SIZE:
        raise WorkbenchImportError("Workbench XML document is too large")
    if "<!DOCTYPE" in xml_content.upper():
        raise WorkbenchImportError("Workbench XML DOCTYPE declarations are not allowed")

    try:
        root = ElementTree.fromstring(xml_content)
    except ElementTree.ParseError as error:
        raise WorkbenchImportError(
            f"Malformed Workbench XML: {error}"
        ) from error

    _validate_tree(root)
    if root.tag != "data":
        raise WorkbenchImportError("Invalid Workbench XML root element")

    connection_lists = [
        child
        for child in root
        if (
            child.tag == "value"
            and child.attrib.get("content-struct-name")
            == "db.mgmt.Connection"
        )
    ]
    if len(connection_lists) != 1:
        raise WorkbenchImportError(
            "Workbench XML does not contain one db.mgmt.Connection list"
        )

    records = [
        child
        for child in connection_lists[0]
        if child.tag == "value"
    ]
    if len(records) > MAX_CONNECTIONS:
        raise WorkbenchImportError("Workbench XML contains too many connections")

    connections = []
    issues = []
    for index, record in enumerate(records):
        driver = _driver_name(record)
        if driver not in SUPPORTED_DRIVERS:
            issues.append(
                {
                    "item": f"connection {index + 1}",
                    "message": (
                        "Unsupported MySQL Workbench driver "
                        f"{driver or '(missing)'}"
                    ),
                }
            )
            continue

        try:
            connection = _convert_record(record, driver)
            if not connection["caption"]:
                raise WorkbenchImportError("Connection caption is empty")
        except WorkbenchImportError as error:
            issues.append(
                {
                    "item": f"connection {index + 1}",
                    "message": str(error),
                }
            )
            continue
        connections.append(connection)

    return connections, issues[:100]


def import_workbench_xml(
    db,
    profile_id: int,
    xml_content: str,
    source: str,
    source_mappings: Optional[dict] = None,
) -> dict:
    """Parse and merge Workbench XML into an existing backend transaction."""
    from gui_plugin.legacy.connections import merge_connections

    connections, issues = parse_workbench_document(xml_content)
    report = merge_connections(
        db,
        profile_id,
        source,
        connections,
        source_mappings,
    )
    report["skipped"] += len(issues)
    report["warnings"].extend(issues)

    return report
