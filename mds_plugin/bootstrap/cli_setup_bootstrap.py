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


# NOTE: The functions in this file were taken from the cli_setup_bootstrap.py
#       file in the python OCI CLI at version 3.64.1, changes applied correspond
#       to te input (prompts) and output mechanisms (to use shell standard ones)

import base64
import errno
import os
import os.path
import sys
import uuid
import webbrowser
import time
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlencode, urlparse


from mds_plugin.bootstrap.cli_setup import DEFAULT_KEY_NAME, PUBLIC_KEY_FILENAME_SUFFIX, PRIVATE_KEY_FILENAME_SUFFIX


import oci
from oci import identity


import mds_plugin.bootstrap.cli_setup as cli_setup
import mds_plugin.bootstrap.cli_util as cli_util

BOOTSTRAP_SERVICE_PORT = 8181
BOOTSTRAP_PROCESS_CANCELED_MESSAGE = "Bootstrap process canceled."
CONSOLE_AUTH_URL_FORMAT = "https://login.{region}.{realm}/v1/oauth2/authorize"
CONSOLE_AUTH_URL_GENERIC = "https://login.oci.oraclecloud.com/v1/oauth2/authorize"
DEFAULT_CONNECTION_TIMEOUT = 10  # seconds
DEFAULT_READ_TIMEOUT = 60  # seconds

httpd = None


def create_user_session(region: str, report_cb, tenancy_name=None):
    # try to set up http server so we can fail early if the required port is in use
    attempts = 1
    global httpd
    if httpd is not None:
        httpd.shutdown()
        httpd = None
        attempts = 40

    while attempts:
        try:
            server_address = ("", BOOTSTRAP_SERVICE_PORT)
            httpd = StoppableHttpServer(
                server_address, StoppableHttpRequestHandler)
            break
        except OSError as e:
            # Reached when a previous server is shutting down, but still not
            # released the port
            if e.errno == errno.EADDRINUSE:
                attempts = attempts - 1
                if attempts:
                    time.sleep(3)
                else:
                    raise RuntimeError(
                        f"Could not complete bootstrap process because port {BOOTSTRAP_SERVICE_PORT} is already in use.")
            else:
                raise e

    assert httpd

    # create new key pair
    # this key pair is used to get the initial token and also uploaded as a new
    # API key for the user
    private_key = cli_util.generate_key()
    public_key = private_key.public_key()

    fingerprint = cli_setup.public_key_to_fingerprint(public_key)
    key = cli_util.to_jwk(public_key)
    jwk_content = key

    bytes_jwk_content = jwk_content.encode("UTF-8")
    b64_jwk_content = base64.urlsafe_b64encode(
        bytes_jwk_content).decode("UTF-8")
    public_key_jwk = b64_jwk_content

    query = {
        "action": "login",
        "client_id": "iaas_console",
        "response_type": "token id_token",
        "nonce": uuid.uuid4(),
        "scope": "openid",
        "public_key": public_key_jwk,
        "redirect_uri": "http://localhost:{}".format(BOOTSTRAP_SERVICE_PORT),
    }

    if tenancy_name:
        query["tenant"] = tenancy_name

    if region:
        console_url = CONSOLE_AUTH_URL_FORMAT.format(
            region=region, realm=oci.regions.REALMS[oci.regions.REGION_REALMS[region]]
        )
    else:
        console_url = CONSOLE_AUTH_URL_GENERIC

    query_string = urlencode(query)
    url = "{console_auth_url}?{query_string}".format(
        console_auth_url=console_url, query_string=query_string
    )

    # attempt to open browser to console log in page
    try:
        if webbrowser.open_new(url):
            report_cb("Please switch to the newly opened browser window to login.",
                      {"url": url})
        else:
            report_cb("Please open the following URL in a browser to login and continue.",
                      {"url": url})
    except webbrowser.Error as e:
        raise RuntimeError(
            "Could not launch web browser to complete login process, exiting bootstrap command. Error: {exc_info}.".format(
                exc_info=str(e)
            )
        )

    # start up http server which will handle capturing auth redirect from console
    token = httpd.serve_forever()

    if token is None:
        raise RuntimeError(
            "Unable to complete browser authentication, exiting bootstrap command.")

    report_cb("Completed browser authentication process")

    # get user / tenant info out of token
    security_token_container = oci.auth.security_token_container.SecurityTokenContainer(
        None, security_token=token
    )
    token_data = security_token_container.get_jwt()
    user_ocid = token_data["sub"]
    tenancy_ocid = token_data["tenant"]
    expiration = token_data["exp"]

    return UserSession(
        user_ocid, tenancy_ocid, region, token, expiration, public_key, private_key, fingerprint
    )


def persist_user_session(user_session, config_location, overwrite_config,
                         profile_name, key_passphrase=None, persist_passphrase=False,
                         persist_token=False, bootstrap=False, persist_only_public_key=False,
                         session_auth_root=None):
    # prompt for directory to place keys
    if session_auth_root is None:
        session_auth_location = os.path.abspath(os.path.join(
            cli_setup.DEFAULT_TOKEN_DIRECTORY, profile_name))
    else:
        session_auth_location = os.path.abspath(
            os.path.join(session_auth_root, "sessions", profile_name))

    if not os.path.exists(session_auth_location):
        cli_util.create_directory(session_auth_location)

    public_key_file_path = os.path.join(
        session_auth_location, DEFAULT_KEY_NAME + PUBLIC_KEY_FILENAME_SUFFIX)
    if not persist_only_public_key:
        private_key_file_path = os.path.join(
            session_auth_location, DEFAULT_KEY_NAME + PRIVATE_KEY_FILENAME_SUFFIX)
    if not cli_setup.write_public_key_to_file(public_key_file_path, user_session.public_key, overwrite_config, True):
        raise RuntimeError(BOOTSTRAP_PROCESS_CANCELED_MESSAGE)
    cli_util.apply_user_only_access_permissions(public_key_file_path)

    if not persist_only_public_key:
        if not cli_setup.write_private_key_to_file(private_key_file_path, user_session.private_key, key_passphrase, overwrite_config, True):
            raise RuntimeError(BOOTSTRAP_PROCESS_CANCELED_MESSAGE)
        cli_util.apply_user_only_access_permissions(private_key_file_path)

    # write token to a file so we can refresh it without having to read / write the entire config
    if persist_token:
        token_location = os.path.join(session_auth_location, 'token')
        with open(token_location, 'w') as security_token_file:
            security_token_file.write(user_session.token)
        cli_util.apply_user_only_access_permissions(token_location)

    # remove conflicting profile entry if exists
    if overwrite_config and os.path.exists(config_location):
        os.unlink(config_location)
    else:
        cli_setup.remove_profile_from_config(config_location, profile_name)

    userId = None
    if bootstrap:
        userId = user_session.user_ocid

    if not persist_passphrase:
        key_passphrase = None

    cli_setup.write_config(
        filename=config_location,
        user_id=userId,
        fingerprint=user_session.fingerprint,
        key_file=os.path.abspath(
            private_key_file_path) if not persist_only_public_key else "Update_private_key_path",
        tenancy=user_session.tenancy_ocid,
        region=user_session.region,
        pass_phrase=key_passphrase,
        profile_name=profile_name,
        security_token_file=token_location if persist_token else None
    )

    return profile_name, config_location


class StoppableHttpRequestHandler(BaseHTTPRequestHandler):
    """http request handler with ability to stop the server"""

    def log_message(self, format, *args):
        return

    def do_GET(self):
        """send 200 OK response, and set server.stop to True"""

        self.send_response(200)
        self.end_headers()

        if self.path == "/":
            javascript = """
            <script type='text/javascript'>
                hash = window.location.hash

                // remove leading '#' so that python can detect it
                if (hash[0] === '#') {
                    hash = hash.substr(1)
                }

                console.log(hash)

                function reqListener () {
                    console.log(this.responseText);
                    document.write('Authorization completed! Please close this window and return to your terminal to finish the bootstrap process.')
                }

                var oReq = new XMLHttpRequest();
                oReq.addEventListener("load", reqListener);
                oReq.open("GET", "/token?" + hash);
                oReq.send();
            </script>
            """
            try:
                self.wfile.write(javascript)
            except TypeError:
                self.wfile.write(bytes(javascript, "UTF-8"))
        else:
            query_components = parse_qs(urlparse(self.path).query)
            if "security_token" in query_components:
                security_token = query_components["security_token"][0]
                self.server.ret_value = security_token


class StoppableHttpServer(HTTPServer):
    """http server that reacts to self.stop flag"""

    def __init__(self, server_address, RequestHandlerClass, timeout=3600):  # 1 h default timeout
        super().__init__(server_address, RequestHandlerClass)
        self.timeout = timeout
        self.last_request_time = time.time()
        self.ret_value = None
        self.completion_thread = None

    def serve_forever(self, poll_interval=0.5):
        super().serve_forever(poll_interval)
        if self.completion_thread is not None:
            self.completion_thread.join()
        return self.ret_value

    def handle_request(self):
        self.last_request_time = time.time()
        super().handle_request()

    def service_actions(self):
        """Called by the serve_forever() loop.

        May be overridden by a subclass / Mixin to implement any code that
        needs to be run during the loop.
        """
        if self.ret_value is not None:
            # Since shutting down is a blocking call, it needs to be done from
            # a separate thread
            self.completion_thread = threading.Thread(
                target=lambda: self.shutdown())
            self.completion_thread.start()
        elif time.time() - self.last_request_time > self.timeout:
            raise RuntimeError(
                f"Timeout: No requests received for {self.timeout} seconds. Stopping server.")


class UserSession(object):
    def __init__(
        self,
        user_ocid,
        tenancy_ocid,
        region,
        token,
        token_expiration,
        public_key,
        private_key,
        fingerprint,
    ):
        self.user_ocid = user_ocid
        self.tenancy_ocid = tenancy_ocid
        self.region = region
        self.token = token
        self.token_expiration = token_expiration
        self.public_key = public_key
        self.private_key = private_key
        self.fingerprint = fingerprint
