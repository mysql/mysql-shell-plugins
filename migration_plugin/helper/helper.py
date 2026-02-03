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

# Main script for the migration helper to run in the remote compute
# Expects helper.zip to be in the same directory, containing the
# rest of the migration_plugin

import mysqlsh  # type: ignore
from queue import Empty, Queue
import urllib.error
import urllib.request
from collections.abc import Callable
from typing import Optional
import subprocess
import signal
import traceback
import time
import threading
import json
import sys
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
import datetime
import warnings

warnings.filterwarnings("ignore")


shell = mysqlsh.globals.shell

g_basedir = os.path.dirname(os.path.abspath(sys.argv[0]))

# allow import of the rest of the migration plugin
sys.path.insert(0, os.path.join(g_basedir, "helper.zip"))

from migration_plugin.lib.backend import submysqlsh  # nopep8
from migration_plugin.lib.backend.source_check import MySQLSourceCheck  # nopep8


k_bind_address = ("localhost", 8888)


def http_get(url, headers=None) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers=headers or {}, method='GET')
    with urllib.request.urlopen(req) as response:
        status_code = response.getcode()
        data = response.read()
    return status_code, data


def http_post(url, payload: Optional[dict] = None) -> tuple[int, bytes]:
    # data must be bytes, for form-encoded data use urllib.parse.urlencode()
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8") if payload else payload,
        method='POST')
    with urllib.request.urlopen(req) as response:
        status_code = response.getcode()
        data = response.read()
    return status_code, data


def http_post_stream(handle_line: Callable, url, payload: dict = {}):
    # data must be bytes, for form-encoded data use urllib.parse.urlencode()
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8") if payload else payload,
        method='POST')
    with urllib.request.urlopen(req) as response:
        for line in response:
            if line.strip():
                handle_line(line.decode("utf-8"))


def enable_replication_tunneling():
    """
    Setup the host for inbound replication tunneling:
    - enable GatewayPorts for sshd (to allow the dbsystem to connect to the
    tunnel from outside localhost)
    - configure the firewall to allow connections to 3306
    """
    try:
        subprocess.run(["sudo", "sed",
                        "-e", r"s/^#\?GatewayPorts.*/GatewayPorts yes/",
                        "-i", "/etc/ssh/sshd_config"],
                       check=True,
                       text=True,
                       capture_output=True)
        subprocess.run(["sudo", "service", "sshd", "restart"],
                       check=True,
                       text=True,
                       capture_output=True)
    except subprocess.CalledProcessError as e:
        shell.log("error", f"error enabling GatewayPorts for sshd: {e.stdout}")
        raise RuntimeError(
            f"Error updating sshd configuration: {e.stdout} {e.stderr}")

    try:
        subprocess.run(
            ["sudo", "firewall-cmd", "--add-port=3306/tcp", "--permanent"],
            check=True,
            text=True,
            capture_output=True)
        subprocess.run(["sudo", "firewall-cmd", "--reload"],
                       check=True,
                       text=True,
                       capture_output=True)
    except subprocess.CalledProcessError as e:
        shell.log(
            "error", f"error adding tunnel port to firewall rules: stdout={e.stdout} stderr={e.stderr}")
        raise RuntimeError(
            f"Error updating firewall configuration: {e.stdout} {e.stderr}")


def get_channel_status(sess) -> dict:
    status = {}
    gtid_executed, gtid_purged = sess.run_sql(
        "select @@gtid_executed, @@gtid_purged").fetch_one()
    status["gtid_executed"] = gtid_executed
    status["gtid_purged"] = gtid_purged

    status["connection_status"] = []
    res = sess.run_sql(
        "select * from performance_schema.replication_connection_status")
    for row in iter(res.fetch_one_object, None):
        status["connection_status"].append(row)

    status["applier_status_by_worker"] = []
    res = sess.run_sql(
        "select * from performance_schema.replication_applier_status_by_worker")
    for row in iter(res.fetch_one_object, None):
        status["applier_status_by_worker"].append(row)

    status["applier_status_by_coordinator"] = []
    res = sess.run_sql(
        "select * from performance_schema.replication_applier_status_by_coordinator")
    for row in iter(res.fetch_one_object, None):
        status["applier_status_by_coordinator"].append(row)

    def flatten(d):
        for k, v in list(d.items()):
            if isinstance(v, datetime.datetime):
                d[k] = str(v)
            elif isinstance(v, dict):
                d[k] = flatten(v)
            elif isinstance(v, list):
                l = []
                for i in v:
                    l.append(flatten(i))
                d[k] = l
        return d

    return flatten(status)


class BackgroundThread:
    def __init__(self) -> None:
        self._output = Queue()

        self._process: Optional[submysqlsh.SubMysqlsh] = None
        self._thread = None

    def is_running(self) -> bool:
        return self._process is not None

    def start(self, create_process: Callable[[Callable[[dict], None]], submysqlsh.SubMysqlsh]):
        def do_start():
            self._process = create_process(self._on_stdout)
            rc = self._process.process()
            self._on_stdout({"status": "DONE", "returncode": rc})
            self._process = None

        self._thread = threading.Thread(target=do_start)
        self._thread.start()

    def terminate(self):
        if self._process:
            self._process.terminate()

    def has_output(self) -> bool:
        return not self._output.empty()

    def read_output(self) -> list[dict]:
        out = []

        while True:
            try:
                item = self._output.get_nowait()
            except Empty:
                break

            out.append(item)

        return out

    def _on_stdout(self, data: dict):
        self._output.put(data)


class Helper:
    def __init__(self, instance_token) -> None:
        # arbitrary token to identify the helper process with its owner
        self.instance_token = instance_token

        self._dump_thread = BackgroundThread()
        self._load_thread = BackgroundThread()

    def handle_connect_mysql(self, data: dict) -> dict:
        check_result, has_ssl, session = MySQLSourceCheck.try_connect(data)
        if session:
            session.close()

        if check_result.connectErrno:
            return {"status": "error", "result": check_result._json(noclass=False)}
        elif not has_ssl:
            return {"status": "error", "error": "Could not connect to DB instance using SSL."}
        else:
            return {"status": "ok"}

    def handle_test_tunnel(self, data: dict) -> dict:
        """
        Test that the compute the helper is running on is setup for
        tunneling (at least for connections from the compute's subnet).
        """
        user = data["user"]
        password = data["password"]

        ssh_conn = os.getenv("SSH_CONNECTION")
        shell.log("info", f"SSH_CONNECTION={ssh_conn}")
        if not ssh_conn:
            return {"status": "error", "error": "SSH_CONNECTION not set"}
        parts = ssh_conn.split(" ")
        if len(parts) != 4:
            return {"status": "error",
                    "error": f"SSH_CONNECTION has unexpected format {ssh_conn}"}
        my_ip = parts[2]

        # first try through localhost
        try:
            sess = shell.connect(
                {
                    "user": user,
                    "password": password,
                    "host": "localhost",
                    "port": 3306,
                    "ssl-mode": "REQUIRED",
                }
            )
            local_server_uuid = sess.run_sql(
                "select @@server_uuid").fetch_one()[0]
            shell.log("info",
                      f"server_uuid through localhost:3306 is {local_server_uuid}")
        except Exception as e:
            shell.log("info", f"tunnel test through localhost failed: {e}")
            return {"status": "fail", "error": str(e)}

        # then through the VNIC's IP
        try:
            sess = shell.connect(
                {
                    "user": user,
                    "password": password,
                    "host": my_ip,
                    "port": 3306,
                    "ssl-mode": "REQUIRED",
                }
            )
            ip_server_uuid = sess.run_sql(
                "select @@server_uuid").fetch_one()[0]
            shell.log("info",
                      f"server_uuid through {my_ip}:3306 is {ip_server_uuid}")
        except Exception as e:
            shell.log("error", f"tunnel test through {my_ip} failed: {e}")
            return {"status": "fail", "error": str(e)}

        if local_server_uuid != ip_server_uuid:
            return {"status": "fail",
                    "error": f"Unexpected MySQL tunnel behavior: server at localhost is {local_server_uuid} but at {my_ip} is {ip_server_uuid}"}

        return {"status": "ok", "server_uuid": local_server_uuid}

    def handle_channel_status(self, data: dict):
        try:
            sess = shell.connect(data | {"ssl-mode": "REQUIRED"})
        except Exception as e:
            shell.log(
                "info", f"channel status check could not connect to DBSystem: {e}")
            return {"status": "error", "error": str(e)}

        try:
            status = get_channel_status(sess)

            return {"status": "ok", "channel": status}

        except Exception as e:
            shell.log(
                "info", f"channel status check could not connect to DBSystem: {e}")

            return {"status": "error", "error": str(e)}
        finally:
            sess.close()

    def _compute_threads(self, data: dict, context: str) -> int:
        ncpu = os.cpu_count()
        max_threads = data.get("max_threads")

        if ncpu:
            threads = ncpu * 2
        else:
            threads = 1

        threads = min(threads, max_threads if max_threads else 2)

        shell.log(
            "info", f"Host has {ncpu} cpus, max_threads={max_threads} will {context} using {threads} threads"
        )

        return threads

    def handle_dump_instance(self, data: dict) -> dict:
        if self.is_dumping():
            return {"status": "ALREADY_RUNNING"}

        shell.log("info", f"dumpInstance: {json.dumps(data)}")

        threads = self._compute_threads(data, "dump")

        self._dump_thread.start(lambda on_output: submysqlsh.dump_instance(
            on_output,
            connection_params=data["connection_params"] | {
                "ssl-mode": "REQUIRED"
            },
            storage_prefix=data["storage_prefix"],
            storage_args=data["storage_args"],
            compatibility_args=data["compatibility_args"],
            extra_args=data["extra_args"],
            target_version=data["target_version"],
            threads=threads
        ))

        return {"status": "STARTED"}

    def handle_stop_dump_instance(self, data: dict) -> dict:
        if not self.is_dumping():
            return {"status": "NOT_RUNNING"}

        self._dump_thread.terminate()

        return {"status": "ok"}

    def handle_load_dump(self, data: dict) -> dict:
        if self.is_loading():
            return {"status": "ALREADY_RUNNING"}

        shell.log("info", f"loadDump: {json.dumps(data)}")

        threads = self._compute_threads(data, "load")

        self._load_thread.start(lambda on_output: submysqlsh.load_dump(
            on_output,
            connection_params=data["connection_params"] | {
                "ssl-mode": "REQUIRED"
            },
            storage_prefix=data["storage_prefix"],
            storage_args=data["storage_args"],
            progress_path=os.path.join(g_basedir, "load_progress.json"),
            extra_args=data["extra_args"],
            threads=threads
        ))

        return {"status": "STARTED"}

    def handle_stop_load_dump(self, data: dict) -> dict:
        if not self.is_loading():
            return {"status": "NOT_RUNNING"}

        self._load_thread.terminate()

        return {"status": "ok"}

    def handle_target_run_sql(self, data: dict) -> dict:
        shell.log("info", f"targetRunSql: {data}")
        sql = data["sql"]
        args = data["args"]

        try:
            sess = shell.connect(data["connection"] | {"ssl-mode": "REQUIRED"})
        except Exception as e:
            shell.log(
                "info", f"target_run_sql could not connect to DBSystem: {e}")
            return {"status": "error", "error": str(e)}

        try:
            res = sess.run_sql(sql, args)

            return {"status": "ok", "result": res.fetch_all()}

        except Exception as e:
            shell.log(
                "info", f"target_run_sql error running SQL: {e}")

            return {"status": "error", "error": str(e)}
        finally:
            sess.close()

    def is_dumping(self) -> bool:
        return self._dump_thread.is_running()

    @property
    def has_dump_output(self) -> bool:
        return self._dump_thread.has_output()

    def dump_status(self) -> list[dict]:
        return self._dump_thread.read_output()

    def is_loading(self) -> bool:
        return self._load_thread.is_running()

    @property
    def has_load_output(self) -> bool:
        return self._load_thread.has_output()

    def load_status(self) -> list[dict]:
        return self._load_thread.read_output()

    def get_self_status(self):
        return {
            "status": "RUNNING",
            "token": self.instance_token,
        }


class HelperCommandHandler(BaseHTTPRequestHandler):
    def _stream_status(self, status: Callable[[], list[dict]]):
        context = f"HelperCommandHandler.stream_status({status.__name__})"

        shell.log("info", context)

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

        def send(item: dict):
            data = json.dumps(item)
            self.wfile.write((data + "\n").encode("utf-8"))

        try:
            shell.log("info", f"{context}: entering loop")
            done = False
            while not done:
                data = status()
                for item in data:
                    send(item)
                    if item.get("status") in ("DONE", "ERROR"):
                        done = True
                        break

                self.wfile.flush()

                time.sleep(1)
        except (BrokenPipeError, ConnectionResetError):
            shell.log("info", f"{context}: client disconnected")

        shell.log("info", f"{context}: exited loop")

    def _respond(self, code: int, result: dict):
        self.send_response(code)
        self.send_header("Content-type", "text/json")
        self.end_headers()
        self.wfile.write(json.dumps(result).encode("utf-8"))

    def do_GET(self):
        try:
            shell.log("info", f"handling GET {self.path}")

            command = self.path[1:].replace("-", "_")
            if command == "quit":
                threading.Thread(target=self.server.shutdown,
                                 daemon=True).start()
                self._respond(200, {"status": "quitting..."})
            else:
                attr = getattr(g_helper, f"get_{command}")
                if attr:
                    self._respond(200, attr())
                else:
                    self._respond(
                        404, {"status": "error", "error": f"unhandled {self.path}"})
        except Exception:
            shell.log("error", str(traceback.format_exc()))
            self._respond(
                500, {"status": "error", "error": str(traceback.format_exc())})
            raise

    def do_POST(self):
        try:
            shell.log("info", f"handling POST {self.path} {self.headers}")

            if self.headers["Content-Length"] is not None:
                content_length = int(self.headers["Content-Length"])
                data = json.loads(self.rfile.read(content_length))
            else:
                data = {}

            command = self.path[1:].replace("-", "_")
            shell.log("info", "start " + command)
            if command == "dump_status":
                if g_helper.is_dumping() or g_helper.has_dump_output:
                    self._stream_status(g_helper.dump_status)
                else:
                    self._respond(
                        425, {"status": "error", "error": "dump not running"}
                    )
            elif command == "load_status":
                if g_helper.is_loading() or g_helper.has_load_output:
                    self._stream_status(g_helper.load_status)
                else:
                    self._respond(
                        425, {"status": "error", "error": "load not running"}
                    )
            else:
                attr = getattr(g_helper, f"handle_{command}")
                if attr:
                    self._respond(200, attr(data))
                else:
                    self._respond(
                        404, {
                            "status": "error",
                            "error": f"unhandled {self.path}",
                        }
                    )
        except Exception:
            shell.log("error", str(traceback.format_exc()))
            self._respond(
                500, {"status": "error", "error": str(traceback.format_exc())})
            raise


class HelperClient:
    def __init__(self):
        self.url = "http://localhost:8888"

    def _get(self, path, **kwargs):
        shell.log("debug", f"GET {path}")
        status, response = http_get(f"{self.url}{path}", **kwargs)
        shell.log("debug", f"{status} {response}")
        return json.loads(response)

    def _post(self, path, data: dict, **kwargs):
        shell.log("debug", f"POST {path}")
        status, response = http_post(
            f"{self.url}{path}", payload=data, **kwargs)
        shell.log("debug", f"{status} {response}")
        return json.loads(response)

    def cmd_dump_instance(self, data: dict):
        return self._post("/dump-instance", data=data)

    def cmd_stop_dump_instance(self, data: dict):
        return self._post("/stop-dump-instance", data=data)

    def cmd_load_dump(self, data: dict):
        return self._post("/load-dump", data=data)

    def cmd_stop_load_dump(self, data: dict):
        return self._post("/stop-load-dump", data=data)

    def cmd_connect_mysql(self, data: dict):
        return self._post("/connect-mysql", data=data)

    def cmd_enable_tunneling(self, data: dict):
        # No need to do this in the server
        enable_replication_tunneling()
        return {"status": "ok"}

    def cmd_test_tunnel(self, data: dict):
        return self._post("/test-tunnel", data=data)

    def cmd_channel_status(self, data: dict):
        return self._post("/channel-status", data=data)

    def cmd_target_run_sql(self, data: dict):
        return self._post("/target-run-sql", data=data)

    def cmd_dump_status(self, data: dict):
        return self._cmd_stream_status(data, "dump-status")

    def cmd_load_status(self, data: dict):
        return self._cmd_stream_status(data, "load-status")

    def _cmd_stream_status(self, data: dict, cmd: str):
        shell.log("debug", f"POST /{cmd} (stream)")

        def on_status(line: str):
            try:
                json.loads(line)  # validate json
                print(line)
            except json.JSONDecodeError:
                shell.log("error", f"Unexpected data from server: {line}")

        timeout = 60
        while True:
            try:
                http_post_stream(
                    on_status, f"{self.url}/{cmd}", payload=data
                )
                break
            except urllib.error.HTTPError as e:
                timeout -= 1
                if timeout > 0 and e.status == 425:
                    shell.log("info", f"{cmd} not ready, retrying...")
                    time.sleep(3)
                    continue
                raise
        return {"helper": "done"}

    def cmd_self_status(self, data: dict):
        return self._get(f"/self-status")

    def cmd_quit(self, data: dict):
        try:
            return self._get("/quit")
        except:
            pid_file = os.path.join(g_basedir, "helper.pid")
            shell.log(
                "error", f"error trying to quit server, checking {pid_file}")
            if os.path.exists(pid_file):
                with open(pid_file) as f:
                    pid = int(f.read().strip())
                shell.log("info", f"killing process {pid}")
                try:
                    os.kill(pid, signal.SIGTERM)
                    return {"status": "ok"}
                except Exception as e:
                    shell.log("error", f"error killing process {pid}: {e}")
            return {"status": "error"}


def daemonize():
    try:
        # Fork the process
        pid = os.fork()
        if pid > 0:
            # Parent process exits
            sys.exit(0)
    except OSError as e:
        print(f"Fork failed: {e}")
        sys.exit(1)

    # Create a new session
    os.setsid()

    try:
        # Fork again
        pid = os.fork()
        if pid > 0:
            # Parent process exits
            sys.exit(0)
    except OSError as e:
        print(f"Second fork failed: {e}")
        sys.exit(1)

    # Change the working directory
    os.chdir("/")

    # Set umask
    os.umask(0)

    print("starting helper daemon...")

    # Close file descriptors
    sys.real_stdout.flush()  # type: ignore
    sys.real_stderr.flush()  # type: ignore
    si = open(os.devnull, "r")
    so = open(os.devnull, "a+")
    se = open(os.devnull, "a+")
    os.dup2(si.fileno(), sys.real_stdin.fileno())  # type: ignore
    os.dup2(so.fileno(), sys.real_stdout.fileno())  # type: ignore
    os.dup2(se.fileno(), sys.real_stderr.fileno())  # type: ignore


class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True


def helper(instance_token: str, detach: bool = True):
    global g_helper

    g_helper = Helper(instance_token=instance_token)

    if detach:
        print("Running as daemon...")
        daemonize()
    else:
        print("Starting helper server...")

    pid_file = None
    try:
        pid_file = os.path.join(g_basedir, "helper.pid")
        with open(pid_file, "w+") as f:
            f.write(f"{os.getpid()}\n")

        httpd = ThreadedHTTPServer(k_bind_address, HelperCommandHandler)
        shell.log("info", f"starting http server at {k_bind_address}")
        httpd.serve_forever()
        shell.log("info", "http shutdown")
    except:
        shell.log("error", traceback.format_exc())
    finally:
        if pid_file:
            os.remove(pid_file)


def client(cmd):
    data = sys.stdin.read().strip()
    try:
        # should be importing from the zip when running in the jump host
        if "helper.zip" not in submysqlsh.__file__:
            raise Exception(
                f"Internal error: submysqlsh module is {submysqlsh.__file__}")

        client = HelperClient()

        shell.log("info", f"executing cmd={cmd} payload='{data}'")

        handler = getattr(client, f"cmd_{cmd.replace('-', '_')}")

        print(json.dumps(handler(json.loads(data) if data else {})))
    except Exception as e:
        shell.log(
            "error", f"exception executing {cmd}: {traceback.format_exc()}"
        )
        print(json.dumps(
            {"status": "error", "error": f"internal error executing {cmd}: {e}"}
        ))


if __name__ == "__main__":
    if len(sys.argv) <= 1:
        sys.exit(1)

    shell.log("info", " ".join(sys.argv))

    if sys.argv[1] == "--helper":
        helper(detach=True, instance_token=sys.argv[2])
    elif sys.argv[1] == "--helper-test":
        helper(detach=False, instance_token=sys.argv[2])
    elif sys.argv[1] == "--":
        client(sys.argv[2])
    else:
        print("Invalid arguments", sys.argv[1:])
        sys.exit(1)
