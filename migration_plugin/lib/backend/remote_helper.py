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


from datetime import datetime
import errno
import json
import os
import re
import tempfile
import zipfile
import pathlib
import time
from typing import Callable, Optional

from . import model
from .. import logging, errors
from mds_plugin.compute import SshConnection

# path to rpm of mysqlsh to upload directly to the jump host, in case the
# version we expect can't be downloaded directly from there
k_bundled_mysqlsh_rpm = {
    "aarch64": "mysql-shell.aarch64.rpm",
    "x86_64": "mysql-shell.x86_64.rpm",
}

k_repo_mysqlsh_url = {
    "aarch64": "https://cdn.mysql.com/Downloads/MySQL-Shell/mysql-shell-9.5.2-1.el8.aarch64.rpm",
    "x86_64": "https://cdn.mysql.com/Downloads/MySQL-Shell/mysql-shell-9.5.2-1.el8.x86_64.rpm",
}


def setup_mysqlsh(ssh, sftp, local_basedir: str, target_basedir: str,
                  progress_fn: Callable[[str], None]):
    def run(cmd) -> tuple[int, str]:
        logging.debug(f"jumphost: executing {cmd}...")
        rc, data = ssh.executeWithStdin(cmd, "")
        logging.info(f"jumphost: {cmd}: rc={rc} '''{data}'''")
        return rc, data

    # rpm can randomly fail with a lock error if there's some other process opening the rpmdb:
    #   Info: jumphost: sudo rpm -Uvh mysql-shell.x86_64.rpm: status=False '''error: can't create transaction lock on /var/lib/rpm/.rpm.lock (Resource temporarily unavailable)	'''
    # or
    #  Curl error (6): Couldn't resolve host name for ...
    # retry all rpm cmds just in case
    def run_rpm(cmd) -> tuple[int, str]:
        def should_retry(output):
            return ("transaction lock" in data or "Curl error" in data)

        attempt = 100
        while True:
            logging.debug(f"jumphost: executing {cmd}...")
            rc, data = ssh.executeWithStdin(cmd, "")
            logging.info(f"jumphost: {cmd}: rc={rc} '''{data}'''")
            if rc != 0 and should_retry(data) and attempt > 0:
                attempt -= 1
                logging.warning(
                    f"jumphost: error, retrying rpm command after 5s...")
                time.sleep(5)
            else:
                return rc, data

    status, arch = run("arch")
    if arch.strip() in ["arm64", "aarch64"]:
        arch = "aarch64"
    else:
        arch = "x86_64"

    bundled_rpm_name = k_bundled_mysqlsh_rpm.get(arch)

    if bundled_rpm_name:
        bundled_path = os.path.join(local_basedir, "data", bundled_rpm_name)
        logging.debug(
            f"checking for bundled mysqlsh package at {bundled_path}")
    else:
        bundled_path = None
    if bundled_path and os.path.exists(bundled_path):
        logging.info(f"Uploading bundled mysqlsh {bundled_path}")
        # upload mysqlsh package
        sftp.put(localpath=bundled_path, remotepath=bundled_rpm_name)
        logging.info(f"jumphost: Upload done, uninstalling old package...")
        # uninstall old package
        status, data = run_rpm(
            f"sudo rpm -e mysql-shell || sudo rpm -e mysql-shell-commercial")

        progress_fn("Installing mysqlsh")
        # install new package
        status, data = run_rpm(f"sudo rpm -Uvh {bundled_rpm_name}")
        if status != 0:
            raise errors.RemoteHelperFailed(
                f"Could not install {bundled_rpm_name} on jump host")
    elif arch in k_repo_mysqlsh_url:
        progress_fn("Installing mysqlsh")
        # if there's no bundled mysqlsh, install it from repo
        status, data = run_rpm(
            f"sudo yum -y install {k_repo_mysqlsh_url[arch]}")
        if status != 0:
            raise errors.RemoteHelperFailed(
                "Could not install mysql-shell on jump host")
    else:
        raise errors.RemoteHelperFailed(
            f"Could not find mysql-shell {arch} to install on jump host"
        )


class RemoteHelperClient:
    def __init__(self, ssh_session: SshConnection, token: str) -> None:
        self.ssh = ssh_session
        self.token = token
        self.basedir = "./mysql-migration"
        self.local_basedir = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "../..")
        )
        self.mysqlsh = f"mysqlsh --log-level=debug --disable-plugins --disable-builtin-plugins --log-file={self.basedir}/helper-client.log"

        self.helper_zip_path = None

    def __del__(self):
        self.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        self.close()

        if self.helper_zip_path and os.path.exists(self.helper_zip_path):
            os.remove(self.helper_zip_path)

    def _command(self, cmd: str, input: dict, on_output=None) -> dict:
        assert self.ssh

        logging.debug(f"remote executing {cmd}")
        status, data = self.ssh.executeAndSendOnStdin(
            f"{self.mysqlsh} -f ./mysql-migration/helper.py -- {cmd}",
            json.dumps(input),
            on_output=on_output,
        )
        if not status:
            logging.error(
                f"remote helper cmd={cmd} exited with an error: {data}")
            raise errors.RemoteHelperFailed("Remote helper error")
        else:
            logging.devdebug(
                f"remote helper cmd={cmd} result={data}", iftag="helper")
        if data:
            try:
                d = json.loads(data)
            except json.JSONDecodeError:
                logging.error(f"remote helper output un-parseable: {data}")
                raise errors.RemoteHelperFailed()

            logging.debug(
                f"remote helper cmd={cmd} status={d.get("status")} error={d.get("error")}")
            if d["status"] == "fail":
                raise errors.RemoteHelperFailed(
                    f"Remote helper error: {d['error']}")
            return d
        return {}

    def close(self):
        if self.ssh:
            self.ssh.close()
        self.ssh = None

    def ensure_running(self):
        if self.exists():
            status = self.check_helper()
            logging.info(f"remote helper self-status: up-to-date={status}")
            if status:
                return

        logging.error(f"remote helper expected to be running, but is not")
        raise errors.RemoteHelperFailed(
            "Jump host helper process not running")

    def exists(self):
        assert self.ssh

        try:
            logging.debug(
                "checking if remote mysql-migration/helper.pid exists")
            pid = self.ssh.get_remote_file_contents(
                "./mysql-migration/helper.pid")
            logging.debug("it does")
            return True
        except IOError as e:
            if e.errno == errno.ENOENT:
                return False
            logging.exception(f"error fetching helper.pid")
            raise

    def try_helper_status(self) -> Optional[dict]:
        assert self.ssh

        status, data = self.ssh.executeAndSendOnStdin(
            f"{self.mysqlsh} -f ./mysql-migration/helper.py -- self-status", ""
        )
        if not status or not data or data[0] != "{":
            logging.error(f"unexpected remote helper output: '{data}'")
            return None
        return json.loads(data)

    def check_helper(self):
        logging.debug("remote helper: checking if installed")
        data = self.try_helper_status()
        if not data or "error" in data:
            return False
        if data["token"] != self.token:
            return False
        # TODO find a way to check whether the zip is up-to-date (checksum of a zip created every time will never match)
        return False
        return True

    def helper_status(self) -> dict:
        return self._command("self-status", {})

    def shutdown(self):
        res = self._command("quit", {})
        logging.info(f"remote helper shutting down: {res}")
        # TODO ensure it's dead, killall if it fails

    def create_zip(self):
        if self.helper_zip_path:
            return
        # Create a temporary file for the zip archive
        temp = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
        temp.close()  # Close the file so zipfile can write to it
        zip_path = temp.name

        import migration_plugin

        source_path = os.path.dirname(migration_plugin.__file__)
        directory_path = os.path.dirname(source_path)

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
            for plugin_path in [source_path, os.path.join(directory_path, "mds_plugin")]:
                for root, dirs, files in os.walk(plugin_path):
                    for d in list(dirs):
                        if d.startswith(".") or d in ["__pycache__", "htmlcov"]:
                            dirs.remove(d)
                    for file in files:
                        if file.endswith(".zip") or file.endswith(".rpm") or file.startswith("."):
                            continue
                        abs_path = os.path.join(root, file)
                        # Add file with a relative path
                        rel_path = os.path.relpath(
                            abs_path, start=directory_path)
                        zipf.write(abs_path, arcname=rel_path)

        self.helper_zip_path = zip_path
        return zip_path

    def _upload_scripts(self, sftp, basedir: str, target_basedir: str):
        self.create_zip()

        for file_name, source_path in [
            ("helper.py", os.path.join(basedir, "helper/helper.py")),
            ("helper.zip", self.helper_zip_path),
        ]:
            target_path = os.path.join(target_basedir, file_name)
            posix_path = pathlib.Path(target_path).as_posix()
            logging.info(f"uploading {source_path} to {posix_path}")
            sftp.put(localpath=source_path, remotepath=posix_path)

    def setup(self, basedir: str, progress_fn: Callable[[str], None]):
        assert self.ssh

        target_basedir = "./mysql-migration"
        target_basedir_backup = f"./mysql-migration-backup-{datetime.now().isoformat()}"

        try:
            logging.info(f"close old remote helper")
            self.shutdown()
        except:
            pass

        progress_fn("Uploading remote helper agent...")
        sftp = self.ssh.open_sftp()
        try:
            # rename whatever is there to a backup
            try:
                sftp.rename(target_basedir, target_basedir_backup)
                logging.debug(
                    f"renamed remote helper directory from {target_basedir} to {target_basedir_backup}"
                )
            except IOError as e:
                if e.errno != errno.ENOENT:
                    logging.exception(
                        f"error backing up {target_basedir} to {target_basedir_backup}"
                    )
                    raise

            sftp.mkdir(target_basedir)

            # Install/Upload mysqlsh itself
            setup_mysqlsh(ssh=self.ssh, sftp=sftp, local_basedir=self.local_basedir,
                          target_basedir=target_basedir,
                          progress_fn=progress_fn)

            # Upload helper scripts
            self._upload_scripts(sftp=sftp, basedir=basedir,
                                 target_basedir=target_basedir)
        finally:
            sftp.close()

        debug_helper = "--log-level=debug"

        progress_fn("Starting remote helper agent...")
        out = self.ssh.execute(
            f"mysqlsh {debug_helper} --disable-plugins --disable-builtin-plugins --log-file={target_basedir}/helper.log -f {target_basedir}/helper.py --helper {self.token}"
        )
        progress_fn("Remote helper agent started")
        logging.info(f"remote helper started: {out}")

    def fetch_logs(self, to_path: str):
        assert self.ssh
        logging.info(f"Downloading remote helper logs")

        sftp = self.ssh.open_sftp()
        try:
            for f in ["helper.log", "helper-client.log"]:
                src_path = os.path.join("mysql-migration", f)
                dst_path = os.path.join(to_path, f)
                try:
                    self.ssh.get_remote_file(src_path, dst_path, sftp=sftp)
                    logging.info(f"Downloaded {src_path} to {dst_path}")
                except Exception as e:
                    logging.info(f"Could not download {src_path}: {e}")
        finally:
            sftp.close()

    #

    def connect_mysql(self, connection_options: dict) -> model.ConnectionCheckResult:
        res = self._command("connect-mysql", connection_options)
        if res["status"] == "ok":
            return model.ConnectionCheckResult()
        return model.parse(res["result"])

    def load_dump(self, options: dict):
        return self._command("load-dump", options)

    def load_status(self, callback):
        logging.debug(f"load_status begin")
        load_status_buffer = ""

        # TODO handle aborted remote load because of error
        def on_output(data: str):
            nonlocal load_status_buffer

            load_status_buffer += data
            while True:
                line, nl, rest = load_status_buffer.partition("\n")
                if nl:
                    load_status_buffer = rest
                    if not line:
                        continue
                    logging.devdebug(f"remote helper output: {line}")
                    try:
                        d = json.loads(line)
                    except json.decoder.JSONDecodeError as e:
                        logging.error(
                            f"Unexpected output from remote helper: {e}: {line}")
                        raise
                    callback(d)
                else:
                    break

        self._command("load-status", input={}, on_output=on_output)
        logging.debug(f"load_status end")

    def enable_tunneling(self):
        logging.debug(f"enable_tunneling begin")
        res = self._command("enable-tunneling", {})
        logging.debug(f"enable_tunneling: {res}")
        if res["status"] == "error":
            logging.error(
                f"Could not enable SSH tunneling at jump host: {res}")
            raise errors.RemoteHelperFailed(
                "Could not enable SSH tunneling at jump host")
        else:
            logging.info("SSH tunneling enabled at jump just")

    def test_tunnel(self, user: str, password: str) -> bool:
        logging.debug(f"test_tunnel begin")
        res = self._command(
            "test-tunnel", {"user": user, "password": password})
        logging.debug(f"test_tunnel: {res}")
        if res["status"] == "error":
            logging.error(f"remote tunnel test failed with an error: {res}")
            raise RuntimeError("Error in remote SSH tunnel test")

        if res["status"] == "ok":
            return True

        logging.info(f"remote tunnel test: {res}")

        return False

    def channel_status(self, connect_options: dict) -> dict:
        logging.debug(f"channel_status begin")
        res = self._command("channel-status", connect_options)
        if res["status"] == "error":
            logging.error(f"channel status check failed with an error: {res}")
            raise RuntimeError("Error in remote channel status check")

        return res["channel"]

    def target_run_sql(self, sql: str, args: list, connect_options: dict):
        logging.debug(f"run_sql remotely at target: {sql}")
        res = self._command(
            "target-run-sql", {"sql": sql, "args": args, "connection": connect_options})
        if res["status"] == "error":
            logging.error(f"remote run_sql failed with an error: {res}")
            raise RuntimeError("Error running SQL remotely at target")

        return res["result"]
