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

import logging
import os
import socket
from pathlib import Path
import select
import threading
from typing import Optional
import paramiko
import paramiko.client
import paramiko.ssh_exception
from mds_plugin import compute
from . import errors, logging, util

import socket

# Ciphers are listed in order of preference
ALLOWED_CIPHERS = [
    "chacha20-poly1305@openssh.com",
    "aes256-gcm",
    "aes256-gcm@openssh.com",
    "aes128-gcm",
    "aes128-gcm@openssh.com",
    "aes256-ctr",
    "aes192-ctr",
    "aes128-ctr"]

DEPRECATED_CIPHERS = [
    "aes256-cbc",
    "aes192-cbc",
    "aes128-cbc"]


def get_preferred_cipher_list():
    """Returns the valid ciphers to be used in SSH connections"""
    preferred = paramiko.Transport._preferred_ciphers
    ciphers = []
    for cipher in ALLOWED_CIPHERS:
        if cipher in preferred:
            ciphers.append(cipher)

    for cipher in DEPRECATED_CIPHERS:
        if cipher in preferred:
            ciphers.append(cipher)

    return ciphers


def create_ssh_key_pair(private_key_path: str, public_key_path: str = "",
                        passphrase: str = "") -> str:
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.asymmetric import rsa
    import stat

    key = rsa.generate_private_key(
        public_exponent=65537, key_size=2048, backend=default_backend()
    )
    # cSpell:ignore PKCS
    private_key = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.BestAvailableEncryption(
            passphrase.encode())
        if passphrase else serialization.NoEncryption(),
    )

    public_key = key.public_key().public_bytes(
        serialization.Encoding.OpenSSH, serialization.PublicFormat.OpenSSH
    )

    if not public_key_path:
        public_key_path = private_key_path + ".pub"

    # Create path
    key_path = os.path.dirname(os.path.abspath(private_key_path))
    Path(key_path).mkdir(parents=True, exist_ok=True)

    # Write out keys
    with open(private_key_path, mode="wb") as file:
        file.write(private_key)
    with open(public_key_path, mode="wb") as file:
        file.write(public_key)

    # Fix permissions
    util.apply_user_only_access_permissions(private_key_path)
    util.apply_user_only_access_permissions(public_key_path)

    # Encode public_key to string
    public_key_pem = public_key.decode("utf-8")

    return public_key_pem


def connect_ssh(user: str, host: str,
                private_key_file_path: str,
                private_key_passphrase: Optional[str] = None) -> compute.SshConnection:
    assert private_key_file_path

    try:
        logging.info(f"Establishing SSH connection to {user}@{host}...")
        return compute.SshConnection(username=user, host=host,
                                     private_key_file_path=private_key_file_path,
                                     private_key_passphrase=private_key_passphrase)
    except paramiko.ssh_exception.NoValidConnectionsError as e:
        raise errors.SSHError(
            f"Could not open SSH connection to {user}@{host}") from e
    except paramiko.AuthenticationException as e:
        raise errors.SSHError(
            f"Could not authenticate SSH connection to {user}@{host}") from e
    except paramiko.BadHostKeyException as e:
        raise errors.SSHError(
            f"Bad host key error opening SSH connection to {user}@{host}") from e
    except paramiko.SSHException as e:
        raise errors.SSHError(
            f"SSH error connecting to {user}@{host}") from e
    # TODO what can these be?
    #    except socket.error as e:
    #        raise errors.SSHError(
    #            f"SSH error connecting to {user}@{host}") from e


class RemoteSSHTunnel:
    """
    Remote port forwarding over SSH:
      On Host B (from_host), listen on bind_address:from_port and forward to (to_host:to_port).
    Run this class on the machine that can SSH to from_host.

    Requirements on Host B (sshd):
      - AllowTcpForwarding yes
      - For non-local bind (0.0.0.0), GatewayPorts yes
    """

    def __init__(
        self,
        user: str,
        from_host: str,
        from_port: int,
        to_host: str,
        to_port: int,
        *,
        key_filename: Optional[str] = None,
        passphrase: Optional[str] = None,
        allow_agent: bool = False,
        look_for_keys: bool = False,
        bind_address: str = "127.0.0.1",
        timeout: int = 15,
        keepalive: int = 30,
        missing_host_key_policy: paramiko.client.MissingHostKeyPolicy = paramiko.AutoAddPolicy(),
    ):
        self.user = user
        self.from_host = from_host
        self.from_port = from_port
        self.to_host = to_host
        self.to_port = to_port
        self.key_filename = key_filename
        self.passphrase = passphrase
        self.allow_agent = allow_agent
        self.look_for_keys = look_for_keys
        self.bind_address = bind_address
        self.timeout = timeout
        self.keepalive = keepalive
        self.missing_host_key_policy = missing_host_key_policy

        self._client: Optional[paramiko.SSHClient] = None
        self._transport: Optional[paramiko.Transport] = None
        self._thread: Optional[threading.Thread] = None
        self._stop_evt = threading.Event()
        self._started = False

    def _connect(self):
        client = paramiko.SSHClient()

        client.set_missing_host_key_policy(self.missing_host_key_policy)
        logging.info(
            f"Connecting to {self.user}@{self.from_host} ({self.key_filename})")

        # Create a socket and transport object manually to set ciphers
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        sock.connect((self.from_host, 22))

        # Create Transport with preferred ciphers using disabled_algorithms
        transport = paramiko.Transport(sock)
        transport.get_security_options().ciphers = get_preferred_cipher_list()
        transport.use_compression(compress=True)

        # TODO: enable using agent and automatic key lookup
        private_key = paramiko.RSAKey.from_private_key_file(
            self.key_filename, password=self.passphrase)

        # Start the client and authenticate
        transport.start_client()
        transport.auth_publickey(self.user, private_key)

        if not transport.is_active():
            transport.close()
            raise RuntimeError(
                "Failed to establish transport for SSH tunnel")

        # Keepalive to maintain connection across idle periods
        transport.set_keepalive(self.keepalive)

        # Request remote port forwarding (server-side listen on Host B)
        try:
            transport.request_port_forward(self.bind_address, self.from_port)
        except Exception:
            transport.close()
            raise

        self._transport = transport

        # Attach the transport to the SSHClient
        client._transport = transport

        return client

    def start(self):
        if self._started:
            logging.warning("sshtunnel: Tunnel already started")
            return
        self._stop_evt.clear()
        self._client = self._connect()

        self._thread = threading.Thread(
            target=self._accept_loop, name="RemoteSSHTunnel", daemon=True)
        self._thread.start()
        self._started = True
        logging.info(
            f"sshtunnel: Started remote SSH tunnel: {self.from_host}:{self.from_port} -> {self.to_host}:{self.to_port} (listening on {self.bind_address} on Host B)")

    def stop(self, wait: bool = True, join_timeout: Optional[float] = 5.0):
        if not self._started:
            return
        self._stop_evt.set()

        # Closing the transport will unblock accept()
        try:
            if self._transport is not None:
                self._transport.close()
        except Exception as e:
            logging.debug(f"sshtunnel: Transport close error: {e}")

        try:
            if self._client is not None:
                self._client.close()
        except Exception as e:
            logging.debug(f"sshtunnel: Client close error: {e}")

        if wait and self._thread is not None and self._thread.is_alive():
            self._thread.join(join_timeout)

        self._client = None
        self._transport = None
        self._thread = None
        self._started = False
        logging.info("sshtunnel: Stopped remote SSH tunnel")

    def _accept_loop(self):
        assert self._transport is not None
        while not self._stop_evt.is_set():
            try:
                # 1s timeout to check stop flag
                chan = self._transport.accept(1000)
                if chan is None:
                    continue
            except Exception as e:
                if not self._stop_evt.is_set():
                    logging.warning(f"sshtunnel: Accept loop error: {e}")
                break
            # Handle each incoming connection in its own thread
            t = threading.Thread(
                target=self._handle_connection, args=(chan,), daemon=True)
            t.start()

    def _handle_connection(self, chan: paramiko.Channel):
        dst = (self.to_host, self.to_port)
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.connect(dst)
            logging.debug(
                f"sshtunnel: Forwarding established to {dst[0]}:{dst[1]}")
        except Exception as e:
            logging.error(
                f"sshtunnel: Failed to connect to destination {self.to_host}:{self.to_port}: {e}")
            try:
                chan.close()
            finally:
                sock.close()
            return

        try:
            while not self._stop_evt.is_set():
                r, _, _ = select.select([chan, sock], [], [], 1.0)
                if not r:
                    continue
                if chan in r:
                    data = chan.recv(32768)
                    if not data:
                        break
                    sock.sendall(data)
                if sock in r:
                    data = sock.recv(32768)
                    if not data:
                        break
                    chan.sendall(data)
        except Exception as e:
            logging.debug(f"sshtunnel: Handler loop error: {e}")
        finally:
            try:
                chan.close()
            except Exception:
                pass
            try:
                sock.close()
            except Exception:
                pass
            logging.debug(f"sshtunnel: Forwarding closed to {dst[0]}:{dst[1]}")

    def is_running(self) -> bool:
        return self._started and self._thread is not None and self._thread.is_alive()
