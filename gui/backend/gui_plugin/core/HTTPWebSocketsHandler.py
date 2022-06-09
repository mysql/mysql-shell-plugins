# Copyright (c) 2020, 2022, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is also distributed with certain software (including
# but not limited to OpenSSL) that is licensed under separate terms, as
# designated in a particular file or component or in included license
# documentation.  The authors of MySQL hereby grant you an additional
# permission to link the program and your derivative works with the
# separately licensed software that they have included with MySQL.
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
import threading
import socket
import base64
from hashlib import sha1
from http.server import SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qsl
import json
import time
from queue import Queue
import gui_plugin.core.Logger as logger
import gui_plugin.core.WebSocketCommon as WebSocket


class HTTPWebSocketsHandler(SimpleHTTPRequestHandler):
    _ws_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
    _single_instance_token = None

    mutex = threading.Lock()

    def on_ws_message(self, message):
        """Override this handler to process incoming websocket messages."""
        pass  # pragma: no cover

    def on_ws_connected(self):
        """Override this handler."""
        pass  # pragma: no cover

    def on_ws_closed(self):
        """Override this handler."""
        pass  # pragma: no cover

    def send_message(self, message):
        with self.mutex:
            try:
                message = self.on_ws_sending_message(
                    message)  # pylint: disable=no-member
                if message is not None:
                    packet = WebSocket.Packet(message)
                    packet.send(self.request)
                    logger.debug2(message=packet.message,
                                  sensitive=True, prefix="-> ")
            except Exception as e:
                logger.error(f"Exception sending a message. {e}")

    def setup(self):
        self.protocol_version = "HTTP/1.1"
        SimpleHTTPRequestHandler.setup(self)
        self.connected = False
        self.cached_successful_auth = None

        # Disable the support for basic http auth
        self.server.perform_auth = False

    def check_credentials(self, auth_header):
        """Override this handler to perform the credentials check."""
        return False  # pragma: no cover

    def send_auth_header(self):
        self.send_response(401)
        self.send_header('WWW-Authenticate', 'Basic realm="Please enter '
                         'your MySQL GUI Shell credentials."')
        self.send_header('Content-type', 'text/html')
        self.end_headers()

    def do_GET(self):
        query = urlparse(self.path).query

        url_params = dict(parse_qsl(query))
        if "token" in url_params:
            self._single_instance_token = url_params['token']

        auth_header = None
        if self.server.perform_auth:
            auth_header = self.headers.get('Authorization')

        self.cookies = {}
        cookieString = self.headers.get('Cookie', '').strip()
        if len(cookieString) > 0:
            for cookie in cookieString.split(';'):
                cookie = cookie.strip()
                if '=' in cookie:
                    key, value = cookie.split('=')
                    self.cookies[key] = value
                else:
                    self.cookies[cookie] = None

        # No authentication check for websocket upgrades as the session will
        # authenticated later on
        if self.headers.get("Upgrade", None) == "websocket":
            self._handshake()
            # This handler is in websocket mode now.
            # do_GET only returns after client close or socket error.
            self._read_messages()
        # if authentication is required and there was no auth in the header
        elif self.server.perform_auth and auth_header is None:
            self.send_auth_header()
            self.wfile.write(b'no auth header received')
        # if authentication is required and auth data was provided, check it
        elif not self.server.perform_auth or (self.server.perform_auth and
                                              self.check_credentials(auth_header)):
            SimpleHTTPRequestHandler.do_GET(self)
        # if the auth data provided was incorrect
        else:
            self.send_auth_header()
            self.wfile.write(b'not authenticated')

    def _read_messages(self):
        while self.connected == True:
            try:
                self._read_next_message()
            except Exception as e:
                logger.error(f"Error reading from the web socket: {str(e)}")

                if 'Websocket read aborted while listening' in str(e):
                    self._ws_close()

    def _read_next_message(self):
        frame = WebSocket.FrameReceiver(self.rfile)

        # Process control frames even if in the middle of
        # packet fragments
        if frame.is_control_message:
            self._on_control_message(frame)
        else:
            self.on_ws_message(frame)

    def _handshake(self):
        if self.is_local_session:
            if not self.verify_token():
                self.send_error(400, "Provided token is wrong.")
                self._ws_close()
                return
        headers = self.headers
        if headers.get("Upgrade", None) != "websocket":
            return
        key = headers['Sec-WebSocket-Key']
        k = key.encode('ascii') + self._ws_GUID.encode('ascii')
        digest = base64.b64encode(sha1(k).digest()).decode('ascii')
        self.send_response(101, 'Switching Protocols')
        self.send_header('Upgrade', 'websocket')
        self.send_header('Connection', 'Upgrade')
        self.send_header('Sec-WebSocket-Accept', str(digest))
        self.end_headers()
        self.connected = True
        self.on_ws_connected()

    def _ws_close(self):
        if not self.connected:
            logger.info(
                "Closing the already closed socket connection. Ignore.")
            return

        self.connected = False

        with self.mutex:
            try:
                WebSocket.FrameSender(
                    WebSocket.Operation.Close, buffer=self.request)
            except Exception as e:
                logger.exception(e, "Exception while sending close request.")

        self.on_ws_closed()

    def _on_control_message(self, frame):
        # Process a control request (Close, Ping and Pong)
        if frame.opcode == WebSocket.Operation.Close:
            self._ws_close()
        elif frame.opcode == WebSocket.Operation.Ping:
            with self.mutex:
                WebSocket.FrameSender(
                    WebSocket.Operation.Pong, message=frame.message, buffer=self.request)
        elif frame.opcode == WebSocket.Operation.Pong:
            pass

    @property
    def is_local_session(self):
        return self.server.single_instance_token != None

    def verify_token(self):
        return self._single_instance_token == self.server.single_instance_token

    def log_message(self, format, *args):
        logger.debug(format % args, sensitive=self.is_local_session)
