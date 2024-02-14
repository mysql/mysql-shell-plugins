# Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import os
from configparser import ConfigParser


class Config:
    __instance = None

    @staticmethod
    def get_instance() -> 'Config':
        if Config.__instance == None:
            Config()
        return Config.__instance

    def __init__(self):
        if Config.__instance != None:
            raise Exception(
                "This class is a singleton, use get_instance function to get an instance.")
        else:
            Config.__instance = self

        path, _ = os.path.split(os.path.abspath(__file__))
        pyini_file = os.path.join(path, "pytest.ini")

        if not os.path.exists(pyini_file):
            raise FileNotFoundError(f"File {pyini_file} does not exist")

        self.config = ConfigParser()
        self.config.read(pyini_file)

        if "server" in self.config:
            server_section = self.config["server"]
            self.port = server_section.getint("port", fallback=8000)
            self.nossl = server_section.getboolean("nossl", fallback=False)

        # All sections starting with mysql-server define the configuration for
        # a mysql server to be used on the test suite.
        mysql_default_port = 3306
        if 'MYSQL_PORT' in os.environ:
            try:
                mysql_default_port = int(os.environ['MYSQL_PORT'])
            except:
                pass
        mysqlx_default_port = mysql_default_port * 10
        if 'MYSQLX_PORT' in os.environ:
            try:
                mysqlx_default_port = int(os.environ['MYSQLX_PORT'])
            except:
                pass

        mysql_default_host = os.environ['MYSQL_HOST'] if 'MYSQL_HOST' in os.environ else 'localhost'
        mysql_default_user = os.environ['MYSQL_USER'] if 'MYSQL_USER' in os.environ else 'root'
        mysql_default_password = os.environ['MYSQL_PASSWORD'] if 'MYSQL_PASSWORD' in os.environ else ''
        mysql_default_scheme = os.environ['MYSQL_SCHEME'] if 'MYSQL_SCHEME' in os.environ else 'mysql'

        self.database_connections = []
        for section in self.config.sections():
            if section.startswith("mysql-server"):
                connection = {}
                name = section[13:]
                if name == "":
                    name = "DEFAULT"
                connection["name"] = name
                connection["type"] = "MySQL"
                connection["options"] = {}

                connection["options"]["host"] = self.config.get(
                    section, "host", fallback=mysql_default_host)
                connection["options"]["user"] = self.config.get(
                    section, "user", fallback=mysql_default_user)
                connection["options"]["password"] = self.config.get(
                    section, "password", fallback=mysql_default_password)
                connection["options"]["scheme"] = self.config.get(
                    section, "scheme", fallback=mysql_default_scheme)
                connection["options"]["port"] = self.config.getint(
                    section, "port", fallback=mysql_default_port
                    if connection["options"]["scheme"] == 'mysql'
                    else mysqlx_default_port)
                connection["options"]["portStr"] = str(self.config.get(
                    section, "port", fallback=mysql_default_port
                    if connection["options"]["scheme"] == 'mysql'
                    else mysqlx_default_port))

                self.database_connections.append(connection)

        if len(self.database_connections) == 0:
            raise Exception(
                "No connections were supplied in the configuration data.")

    def get_server_params(self):
        return (self.port, self.nossl)

    def get_default_mysql_connection_string(self):
        default_options = self.database_connections[0]['options']
        return f"{default_options['user']}:@{default_options['host']}:{default_options['port']}"
