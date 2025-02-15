# Copyright (c) 2020, 2025, Oracle and/or its affiliates.
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
# Implementation of the MySQL Shell GUI web server

from dataclasses import replace
import subprocess
from mysqlsh.plugin_manager import plugin_function  # pylint: disable=no-name-in-module
from gui_plugin.core.ShellGuiWebSocketHandler import ShellGuiWebSocketHandler
from gui_plugin.core.ThreadedHTTPServer import ThreadedHTTPServer
from gui_plugin.core.Certificates import is_shell_web_certificate_installed
from gui_plugin.core.lib import SystemUtils
import mysqlsh
import ssl
import os
from os import path
import json
import socket
from contextlib import closing
import uuid
from subprocess import Popen
import time
import platform
import sys
import tempfile
import shutil
import signal
import gui_plugin.core.Logger as logger
from gui_plugin.core import Filtering


@plugin_function('gui.start.webServer', cli=True)
def web_server(port=None, secure=None, webrootpath=None,
               single_instance_token=None, read_token_on_stdin=False,
               accept_remote_connections=False):
    """Starts a web server that will serve the MySQL Shell GUI

    Args:
        port (int): The optional port the web server should be running on,
            defaults to 8000
        secure (dict): A dict with keyfile and certfile keys and values. An
            empty dict will use the default key and certificate files. If
            'None' is passed, then SSL will not be used.
        webrootpath (str): The optional web root path that will be used
            by the web server to serve files
        single_instance_token (str): A token string used to establish
            local user mode.
        read_token_on_stdin (bool): If set to True, the token will be read
            from STDIN
        accept_remote_connections (bool): If set to True, the web server will
            accept remote connections

    Allowed options for secure:
        keyfile (str): The path to the server private key file
        certfile (str): The path to the server certificate file

    Returns:
        Nothing
    """

    import mysqlsh.plugin_manager.general

    # TODO: TEMPORARY HACK!!
    # import gc
    # gc.disable()

    # Read single_instance_token from STDIN if read_token_on_stdin is True
    if read_token_on_stdin:
        single_instance_token = input(
            'Please enter the single instance token: ').strip()
        if not single_instance_token:
            raise ValueError("No single instance token given on STDIN.")
        logger.info('Token read from STDIN')

    if platform.system() == 'Darwin':
        result = subprocess.run(['ulimit', '-a'], stdout=subprocess.PIPE)
        logger.debug(f"ULIMIT:\n{result.stdout.decode('utf-8')}")

    # Start the web server
    logger.info('Starting MySQL Shell GUI web server...')

    server = None
    try:
        core_path = os.path.abspath(os.path.join(
            os.path.dirname(__file__), '..', 'core'))
        cert_path = mysqlsh.plugin_manager.general.get_shell_user_dir(
            "plugin_data", "gui_plugin", "web_certs")

        # Set defaults when necessary
        if port is None:
            port = 8000

        if webrootpath is None:
            webrootpath = os.path.join(core_path, 'webroot')

        # cspell:ignore chdir
        if not os.path.isdir(webrootpath):
            raise Exception(
                'Cannot start webserver. Root directory does not '
                f'exist({webrootpath}).')

        os.chdir(webrootpath)

        # Check if we can supply a default page
        if not os.path.isfile("index.html"):
            raise Exception(
                'Cannot start webserver. The "index.html" file does not '
                f'exist in {webrootpath}.')

        if secure is not None:
            # try to cast from shell.Dict to dict
            try:
                secure = json.loads(str(secure))
            except:
                pass

            default_cert_used = False
            if type(secure) is dict:
                if 'keyfile' not in secure or secure['keyfile'] == "default":
                    default_cert_used = True
                    secure['keyfile'] = path.join(*[
                        cert_path,
                        'server.key'])
                if 'certfile' not in secure or secure['certfile'] == "default":
                    default_cert_used = True
                    secure['certfile'] = path.join(*[
                        cert_path,
                        'server.crt'])
            else:
                raise ValueError('If specified, the secure parameter need to '
                                 'be of type dict')

            # If the default cert is used, check if it is already installed
            if not accept_remote_connections:
                logger.info('\tChecking web server certificate...')
                if default_cert_used:
                    try:
                        if not is_shell_web_certificate_installed(check_keychain=True):
                            logger.info('\tCertificate is not installed. '
                                        'Use gui.core.installShellWebCertificate() to install one.')
                            return
                    except Exception as e:
                        logger.info('\tCertificate is not correctly installed. '
                                    'Use gui.core.installShellWebCertificate() to fix the installation.')
                        logger.exception(e)
                        return

                logger.info('\tCertificate is installed.')

        # Replace WSSimpleEcho with your own subclass of HTTPWebSocketHandler
        server = ThreadedHTTPServer(
            ('127.0.0.1' if not accept_remote_connections else '0.0.0.0', port), ShellGuiWebSocketHandler)
        server.daemon_threads = True
        server.host = (
            f'{"https" if secure else "http"}://'
            f'{"127.0.0.1" if not accept_remote_connections else socket.getfqdn()}')
        server.port = port
        server.single_instance_token = single_instance_token

        if secure:
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain(
                certfile=secure['certfile'], keyfile=secure['keyfile'])
            server.socket = context.wrap_socket(
                server.socket,
                server_side=True)

        def user_signal_handler(signum, frame):
            server.force_stop()

        # Register signal handler for SIGINT (handle ctrl+c)
        signal.signal(signal.SIGINT, user_signal_handler)

        try:
            logger.info(
                f"Server started [port:{port}, "
                f"secure:{'version' in dir(server.socket)}, "
                f"single user: {server.single_instance_token is not None}]",
                ['session'])

            # Log server start
            logger.info(f"\tPort: {port}")
            logger.info(f"\tSecure: {'version' in dir(server.socket)}")
            logger.info(f"\tWebroot: {webrootpath}")
            logger.info(
                f"\tMode: {f'Single user' if server.single_instance_token is not None else 'Multi-user'}")

            if server.single_instance_token:
                logger.add_filter({
                    "type": "substring",
                    "start": "token=",
                    "end": " HTTP",
                    "expire": Filtering.FilterExpire.OnUse if SystemUtils.in_vs_code() else Filtering.FilterExpire.Never
                })
            # Start web server
            server.serve_forever()
            # TODO(anyone): Using the 'session' tag here causes database locks
            # logger.info("Web server is down.", ['session'])
            logger.info("Web server is down.")
        except Exception as e:  # pragma: no cover
            logger.error(f'Log message could not be inserted into db. {e}')
    except KeyboardInterrupt:  # pragma: no cover
        logger.info('^C received, shutting down server')
        if server:
            server.socket.close()


@plugin_function('gui.start.nativeUi', cli=True)
def native_ui():
    """Starts the native Shell GUI client

    Returns:
        Nothing
    """

    wrappers_path = os.path.abspath(os.path.join(
        os.path.dirname(__file__), "..", "wrappers"))

    if platform.system() == "Linux":
        browser_app()
        return
    elif platform.system() == "Windows":
        browser_app()
        return
    elif platform.system() == "Darwin":
        executable_path = os.path.join(
            wrappers_path, "macos", "MySQL Shell GUI.app", "Contents", "MacOS", "MySQL Shell GUI")

    try:
        process = Popen(executable_path)
    except Exception as e:
        logger.exception(e, "Unable to launch the native application")
        return

    logger.info(f"The native client was launched with the PID: {process.pid}")


def browser_app():
    """Starts the browser application in single user mode

    Returns:
        Nothing
    """
    browser_executable = ""
    if platform.system() == "Linux":
        browser_executable = "chromium"
        try:
            Popen([browser_executable, "--version"], stdin=subprocess.PIPE,
                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, encoding="UTF-8")
        except FileNotFoundError:
            logger.error(
                f"Can't find installed Chromium browser. Install it first and then try again.")
            return

    elif platform.system() == "Windows":
        browser_executable = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
        if not os.path.exists(browser_executable):
            logger.error("Unable to find the Microsoft Edge browser.")
            return
    else:
        logger.error("This function is only available on Linux and Windows")

    port = None
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        s.bind(('localhost', 0))
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        _, port = s.getsockname()

    token = str(uuid.uuid1())
    certs = {}
    url = f"https://localhost:{port}?token={token}"

    executable = sys.executable
    if 'executable' in dir(mysqlsh):
        executable = mysqlsh.executable

    command = executable if executable.endswith(
        "mysqlsh") or executable.endswith("mysqlsh.exe") else "mysqlsh"

    p_web_server = Popen(
        [command, '--py', '-e', f'gui.start.web_server(port={port}, secure={certs}, single_instance_token="{token}")'])

    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as s:
        while s.connect_ex(('localhost', port)) != 0:
            time.sleep(1)

    leftover_path = ""
    try:
        # In order to support running more than one instance of the application it is required to use a different user data dir
        # for this reason we create a temporary directory every time the application is launched
        data_dir_path = mysqlsh.plugin_manager.general.get_shell_user_dir(  # pylint: disable=no-member
            'plugin_data', 'gui_plugin')
        with tempfile.TemporaryDirectory(dir=data_dir_path) as data_path:
            leftover_path = data_path

            p_application = None

            # The --allow-insecure-localhost is used to have the application bypass ERR_CERT_AUTHORITY_INVALID
            # Note the only differences on the calls below is how the --user-data-dir is passed, it is on purpose
            # Both OS's seem to dislike the other way
            if platform.system() == "Linux":
                p_application = Popen([
                    browser_executable, '--user-data-dir', data_path, '--allow-insecure-localhost', '--new-window', '--ignore-certificate-errors', '--ignore-ssl-errors', f'--app={url}'])
            else:
                p_application = Popen([
                    browser_executable, f'--user-data-dir={data_path}', '--allow-insecure-localhost', '--new-window', '--ignore-certificate-errors', '--ignore-ssl-errors', f'--app={url}'])

            p_application.communicate()
            p_application.wait()
    except PermissionError:
        # In Windows, it is possible that the file handles on the data dir are not released when the temporary directory is cleaned up
        # for that reason, we need this fallback cleanup logic to make it succeed
        done = False
        attempt = 0
        while not done and attempt < 5:
            try:
                time.sleep(1)
                shutil.rmtree(leftover_path)
                done = True
            except PermissionError:
                attempt += 1

    p_web_server.kill()
