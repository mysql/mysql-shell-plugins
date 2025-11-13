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

import six
import os
import stat
import subprocess
import sys
import base64
import struct
import json

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


def generate_key(key_size=2048):
    return rsa.generate_private_key(
        public_exponent=65537, key_size=key_size, backend=default_backend()
    )


def is_windows():
    return sys.platform == 'win32' or sys.platform == 'cygwin'


def bytes_from_int(val):
    # Use int.to_bytes if it exists (Python 3)
    if getattr(int, 'to_bytes', None):
        remaining = val
        byte_length = 0

        while remaining != 0:
            remaining = remaining >> 8
            byte_length += 1
        return val.to_bytes(byte_length, 'big', signed=False)
    else:
        buf = []
        while val:
            val, remainder = divmod(val, 256)
            buf.append(remainder)

        buf.reverse()
        return struct.pack('%sB' % len(buf), *buf)


def force_unicode(value):
    return value.decode('utf-8')


def base64url_encode(input):
    return base64.urlsafe_b64encode(input).replace(b'=', b'')


def to_base64url_uint(val):
    if val < 0:
        raise ValueError('Must be a positive integer')

    int_bytes = bytes_from_int(val)

    if len(int_bytes) == 0:
        int_bytes = b'\x00'

    return base64url_encode(int_bytes)


def to_jwk(key_obj):
    numbers = key_obj.public_numbers()

    obj = {
        'kty': 'RSA',
        'n': force_unicode(to_base64url_uint(numbers.n)),
        'e': force_unicode(to_base64url_uint(numbers.e)),
        'kid': 'Ignored'  # field expected but value is not in the publickey entry for SOUP
    }
    return json.dumps(obj)


def serialize_key(private_key=None, public_key=None, passphrase=None):
    """
    >>> private_key = generate_key(2048)
    >>> public_key = private_key.public()
    >>> serialize_key(public_key=public_key)
    >>> serialize_key(private_key=private_key)
    """

    if private_key:
        if passphrase:
            if isinstance(passphrase, six.string_types):
                passphrase = passphrase.encode("ascii")
            encryption_algorithm = serialization.BestAvailableEncryption(
                passphrase)
        else:
            encryption_algorithm = serialization.NoEncryption()
        return private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=encryption_algorithm)
    else:
        return public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo)


def create_directory(dirname):
    os.makedirs(dirname)
    apply_user_only_access_permissions(dirname)


def apply_user_only_access_permissions(path):
    if not os.path.exists(path):
        raise RuntimeError(
            "Failed attempting to set permissions on path that does not exist: {}".format(path))

    if is_windows():
        # General permissions strategy is:
        #   - if we create a new folder (e.g. C:\Users\opc\.oci), set access to allow full control for current user and no access for anyone else
        #   - if we create a new file, set access to allow full control for current user and no access for anyone else
        #   - thus if the user elects to place a new file (config or key) in an existing directory, we will not change the
        #     permissions of that directory but will explicitly set the permissions on that file
        username = os.environ['USERNAME']
        userdomain = os.environ['UserDomain']
        userWithDomain = os.environ['USERNAME']
        if userdomain:
            userWithDomain = userdomain + "\\" + username
        admin_grp = '*S-1-5-32-544'
        system_usr = '*S-1-5-18'
        try:
            if os.path.isfile(path):
                subprocess.check_output(
                    'icacls "{path}" /reset'.format(path=path), stderr=subprocess.STDOUT)
                try:
                    subprocess.check_output('icacls "{path}" /inheritance:r /grant:r "{username}:F" /grant {admin_grp}:F /grant {system_usr}:F'.format(
                        path=path, username=userWithDomain, admin_grp=admin_grp, system_usr=system_usr), stderr=subprocess.STDOUT)
                except subprocess.CalledProcessError:
                    subprocess.check_output('icacls "{path}" /inheritance:r /grant:r "{username}:F" /grant {admin_grp}:F /grant {system_usr}:F'.format(
                        path=path, username=username, admin_grp=admin_grp, system_usr=system_usr), stderr=subprocess.STDOUT)
            else:
                if os.listdir(path):
                    # safety check to make sure we aren't changing permissions of existing files
                    raise RuntimeError(
                        "Failed attempting to set permissions on existing folder that is not empty.")
                subprocess.check_output(
                    'icacls "{path}" /reset'.format(path=path), stderr=subprocess.STDOUT)
                try:
                    subprocess.check_output('icacls "{path}" /inheritance:r /grant:r "{username}:(OI)(CI)F"  /grant:r {admin_grp}:(OI)(CI)F /grant:r {system_usr}:(OI)(CI)F'.format(
                        path=path, username=userWithDomain, admin_grp=admin_grp, system_usr=system_usr), stderr=subprocess.STDOUT)
                except subprocess.CalledProcessError:
                    subprocess.check_output('icacls "{path}" /inheritance:r /grant:r "{username}:(OI)(CI)F"  /grant:r {admin_grp}:(OI)(CI)F /grant:r {system_usr}:(OI)(CI)F'.format(
                        path=path, username=username, admin_grp=admin_grp, system_usr=system_usr), stderr=subprocess.STDOUT)
        except subprocess.CalledProcessError as exc_info:
            print("Error occurred while attempting to set permissions for {path}: {exception}".format(
                path=path, exception=str(exc_info)))
            sys.exit(exc_info.returncode)
    else:
        if os.path.isfile(path):
            os.chmod(path, stat.S_IRUSR | stat.S_IWUSR)
        else:
            # For directories, we need to apply S_IXUSER otherwise it looks like on Linux/Unix/macOS if we create the directory then
            # it won't behave like a directory and let files be put into it
            os.chmod(path, stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR)
