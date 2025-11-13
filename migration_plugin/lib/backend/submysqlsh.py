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


import subprocess
import os
import json
from typing import List
from .. import logging
from ..util import sanitize_par_uri


class SubMysqlsh:
    def __init__(self, name: str, connection_params={}, args=[]):
        # should not be at top level or it breaks import from helper.py
        import mysqlsh  # type: ignore

        self.name = name
        env = os.environ.copy()
        env["MYSQLSH_TERM_COLOR_MODE"] = "nocolor"
        env["PYTHONWARNINGS"] = "ignore"

        argv = [mysqlsh.executable, "--json=raw"]
        pwd = ""
        if connection_params:
            connection_params = connection_params.copy()
            pwd = connection_params.pop("password", "")
            # always require SSL if ssl-mode is not set
            connection_params.setdefault("ssl-mode", "REQUIRED")

            argv.append("--passwords-from-stdin")
            argv.append(mysqlsh.globals.shell.unparse_uri(connection_params))
        logging.info(
            f"Popen {self.name}: {[sanitize_par_uri(s) for s in argv+args]}")
        self.p = subprocess.Popen(
            argv + args,
            stderr=subprocess.STDOUT,
            stdout=subprocess.PIPE,
            stdin=subprocess.PIPE,
            text=True,
            env=env,
        )
        assert self.p.stdin
        if connection_params:
            self.p.stdin.write(pwd + "\n")
        self.p.stdin.close()

    def on_output(self, j: dict):
        print(j)

    def process(self):
        assert self.p.stdout
        packet = None
        while True:
            line = self.p.stdout.readline()
            logging.debug(f"{self.name}: {line}")
            if not line:
                break
            line = line.rstrip()
            if line.startswith("{") and line.endswith("}"):
                try:
                    self.on_output(json.loads(line))
                except Exception as e:
                    logging.error(f"Error processing output: {line} - {e}")
            elif line == "{":
                packet = []
                packet.append(line)
            elif line == "}" and packet:
                packet.append(line)
                self.on_output(json.loads("".join(packet)))
                packet = None
            elif packet is not None:
                packet.append(line)
            elif line:
                logging.warning(f"Popen {self.name}: bad output: {line}")
        self.p.wait()
        logging.info(f"Popen {self.name}: returncode={self.p.returncode}")

        return self.p.returncode

    def terminate(self):
        self.p.terminate()


def list_upgrade_checks():
    checks = []

    def handle_output(j: dict):
        if "included" in j:
            checks.extend(j["included"])

    sub = SubMysqlsh(
        "upgrade-checker",
        args=[
            "--",
            "util",
            "check-for-server-upgrade",
            "--list",
            "--outputFormat=JSON",
        ],
    )
    sub.on_output = handle_output
    rc = sub.process()
    if rc != 0:
        raise RuntimeError("Could not get list of upgrade checker checks")

    return checks


def check_for_server_upgrade(
    connection_params: dict,
    args: list,
    targetVersion: str = "8.4.6",
    exclude: list = [],
):
    issues = []

    def handle_output(j: dict):
        if "prompt" in j:
            return
        if "checksPerformed" in j:
            for check in j["checksPerformed"]:
                if "detectedProblems" in check and check["detectedProblems"]:
                    issues.append(check)

    # if not exclude:
    #    exclude = ["sysVars"]

    sub = SubMysqlsh(
        "upgrade-checker",
        connection_params,
        [
            "--",
            "util",
            "check-for-server-upgrade",
            "--targetVersion=" + targetVersion,
            "--outputFormat=JSON",
            "--exclude=" + ",".join(exclude),
        ]
        + args,
    )
    sub.on_output = handle_output
    rc = sub.process()

    return {"status": rc, "issues": issues}


def dump_instance_dry_run(
    connection_params: dict,
    args: List[str] = [],
    compatibility: List[str] = [],
    targetVersion: str = "8.4.6",
):
    issues = []
    errors = []
    warnings = []
    notes = []

    def handle_output(j: dict):
        if "prompt" in j:
            return
        if "compatibilityIssue" in j:
            issues.append(j)
        elif "error" in j:
            errors.append(j["error"].rstrip())
        elif "warning" in j:
            warnings.append(j["warning"].rstrip())
        elif "note" in j:
            notes.append(j["note"].rstrip())

    compat_args = []
    if compatibility:
        compat_args = ["--compatibility=" + ",".join(compatibility)]

    sub = SubMysqlsh(
        "dump-instance-dryrun",
        connection_params,
        [
            "--",
            "util",
            "dump-instance",
            "/dev/null",
            "--dry-run",
            "--ocimds",
            "--skipUpgradeChecks",
            f"--targetVersion={targetVersion}",
        ]
        + compat_args
        + args,
    )
    sub.on_output = handle_output
    rc = sub.process()

    error_code = None
    if errors and "MYSQLSH" in errors[-1]:
        error_code = errors[-1].split(":")[0]

    return {
        "status": rc,
        "errorCode": error_code,
        "issues": issues,
        "errors": errors,
        "warnings": warnings,
        "notices": notes,
    }


def dump_instance(
    listener,
    connection_params: dict,
    storage_prefix: str,
    storage_args: list,
    compatibility_args: list,
    extra_args: list,
    target_version: str,
    threads: int
):
    compat_args = []
    if compatibility_args:
        compat_args = ["--compatibility=" + ",".join(compatibility_args)]

    sub = SubMysqlsh(
        "dump-instance",
        connection_params,
        [
            "--",
            "util",
            "dump-instance",
            storage_prefix,
            "--ocimds",
            "--skipUpgradeChecks",
            f"--targetVersion={target_version}",
            "--showProgress",
            f"--threads={threads}"
        ]
        + storage_args
        + compat_args
        + extra_args,
    )
    sub.on_output = listener

    return sub


def load_dump(
    listener,
    connection_params: dict,
    storage_prefix: str,
    storage_args: list,
    progress_path: str,
    extra_args: list,
    threads: int = 4
):
    sub = SubMysqlsh(
        "load-dump",
        connection_params,
        [
            "--",
            "util",
            "load-dump",
            storage_prefix,
            "--showProgress",
            f"--progressFile={progress_path}",
            "--waitDumpTimeout=3600",
            "--showMetadata=1",
            "--loadUsers=1",
            f"--threads={threads}"
        ]
        + storage_args
        + extra_args,
    )
    sub.on_output = listener

    return sub


if __name__ == "__main__":
    res = check_for_server_upgrade(
        {"user": "root", "host": "0", "password": ""}, [])
    # res = dump_instance_dry_run(
    #     {"user": "root", "host": "0", "password": ""},
    #     # args=["--exclude-tables=test.au"],
    #     # compatibility=["create_invisible_pks", "skip_invalid_accounts"],
    # )
    print()
    print(json.dumps(res, indent=2))
