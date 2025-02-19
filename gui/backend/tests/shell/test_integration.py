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

import pytest

try:
    import mysqlsh
    has_gui_plugin = "gui" in dir(mysqlsh.globals)
except ModuleNotFoundError:
    has_gui_plugin = False


@pytest.mark.skipif(not has_gui_plugin, reason="This test should be run with the gui plugin installed on the real shell.")
def test_gui():
    help_text = '''NAME
      gui - MySQL Shell GUI backend plugin.

DESCRIPTION
      This plugin serves as the backend for the MySQL Shell GUI projects.

PROPERTIES
      cluster
            The InnoDB Cluster MySQL Shell GUI backend module

      core
            The Core MySQL Shell GUI backend module

      db
            Used to retrieve metadata from database

      db_connections
            The DB Connections MySQL Shell GUI backend module

      debugger
            The websocket debugger module

      mds
            The MySQL Database Service MySQL Shell GUI backend module

      modeler
            The Modeler MySQL Shell GUI backend module

      modules
            The Modules MySQL Shell GUI backend module

      shell
            The Shell MySQL Shell GUI backend module

      sql_editor
            The SQL Editor MySQL Shell GUI backend module

      start
            Used to start the MySQL Shell GUI

      users
            The Users MySQL Shell GUI backend module

FUNCTIONS
      help([member])
            Provides help about this object and it's members

      info()
            Returns basic information about this plugin.

      version()
            Returns the version number of the plugin'''

    assert help_text == mysqlsh.globals.gui.help() # pylint: disable=no-member


@pytest.mark.skipif(not has_gui_plugin, reason="This test should be run with the gui plugin installed on the real shell.")
def test_gui_cluster():
    help_text = '''NAME
      cluster - The InnoDB Cluster MySQL Shell GUI backend module

SYNTAX
      gui.cluster

DESCRIPTION
      This extension object holds the backend implementation of the InnoDB
      Cluster MySQL Shell GUI module

FUNCTIONS
      get_gui_module_display_info()
            Returns display information about the module

      help([member])
            Provides help about this object and it's members

      is_gui_module_backend()
            Indicates whether this module is a GUI backend module'''

    assert help_text == mysqlsh.globals.gui.cluster.help() # pylint: disable=no-member
    info = mysqlsh.globals.gui.cluster.get_gui_module_display_info() # pylint: disable=no-member
    assert info["name"] == "InnoDB Cluster Manager"
    assert info["description"] == "An graphical manager for InnoDB Clusters"


@pytest.mark.skipif(not has_gui_plugin, reason="This test should be run with the gui plugin installed on the real shell.")
def test_gui_core():
    help_text = '''NAME
      core - The Core MySQL Shell GUI backend module

SYNTAX
      gui.core

DESCRIPTION
      This extension object holds the backend implementation of the Core MySQL
      Shell GUI module

FUNCTIONS
      convert_all_workbench_sql_files_to_sqlite([directory])
            Converts all MySQL SQL file of the gui module to Sqlite.

      convert_workbench_sql_file_to_sqlite(mysql_sql_file_path)
            Converts a MySQL SQL file to Sqlite syntax.

      help([member])
            Provides help about this object and it's members

      install_shell_web_certificate([kwargs])
            Installs the MySQL Shell GUI webserver certificate

      is_shell_web_certificate_installed([kwargs])
            Checks if the MySQL Shell GUI webserver certificate is installed

      remove_shell_web_certificate()
            Removes the MySQL Shell GUI webserver certificate'''

    assert help_text == mysqlsh.globals.gui.core.help() # pylint: disable=no-member


@pytest.mark.skipif(not has_gui_plugin, reason="This test should be run with the gui plugin installed on the real shell.")
def test_gui_db_connections():
    help_text = '''NAME
      db_connections - The DB Connections MySQL Shell GUI backend module

SYNTAX
      gui.db_connections

DESCRIPTION
      This extension object holds the backend implementation of the DB
      Connections MySQL Shell GUI module

FUNCTIONS
      add_db_connection(profile_id, connection[, folder_path][, be_session])
            Add a new db_connection and associate the connection with a profile

      delete_credential(url)
            Deletes the password of a db_connection url

      get_db_connection(db_connection_id[, be_session])
            Get the db_connection

      get_db_types()
            Get the list of db_types

      help([member])
            Provides help about this object and it's members

      list_credentials()
            Lists the db_connection urls that have a password stored

      list_db_connections(profile_id[, folder_path][, be_session])
            Lists the db_connections for the given profile

      remove_db_connection(profile_id, connection_id[, be_session])
            Remove a db_connection by disassociating the connection from a
            profile

      set_credential(url, password)
            Set the password of a db_connection url

      test_connection(connection[, password])
            Opens test connection

      update_db_connection(profile_id, connection_id, connection[, folder_path][, be_session])
            Update the data for a database connection'''


    assert help_text == mysqlsh.globals.gui.db_connections.help() # pylint: disable=no-member


@pytest.mark.skipif(not has_gui_plugin, reason="This test should be run with the gui plugin installed on the real shell.")
def test_gui_mds():
    help_text = '''NAME
      mds - The MySQL Database Service MySQL Shell GUI backend module

SYNTAX
      gui.mds

DESCRIPTION
      This extension object holds the backend implementation of the MySQL
      Database Service MySQL Shell GUI module

FUNCTIONS
      get_gui_module_display_info()
            Returns display information about the module

      help([member])
            Provides help about this object and it's members

      is_gui_module_backend()
            Indicates whether this module is a GUI backend module'''

    assert help_text == mysqlsh.globals.gui.mds.help() # pylint: disable=no-member
    info = mysqlsh.globals.gui.mds.get_gui_module_display_info() # pylint: disable=no-member
    assert info["name"] == "MySQL Database Service Manager"
    assert info["description"] == "A management frontend for MDS on OCI"


@pytest.mark.skipif(not has_gui_plugin, reason="This test should be run with the gui plugin installed on the real shell.")
def test_gui_modeler():
    help_text = '''NAME
      modeler - The Modeler MySQL Shell GUI backend module

SYNTAX
      gui.modeler

DESCRIPTION
      This extension object holds the backend implementation of the Modeler
      MySQL Shell GUI module

FUNCTIONS
      get_gui_module_display_info()
            Returns display information about the module

      help([member])
            Provides help about this object and it's members

      is_gui_module_backend()
            Indicates whether this module is a GUI backend module'''

    assert help_text == mysqlsh.globals.gui.modeler.help() # pylint: disable=no-member
    info = mysqlsh.globals.gui.modeler.get_gui_module_display_info() # pylint: disable=no-member
    assert info["name"] == "EER Modeler"
    assert info["description"] == "An advanced designer for ERR Diagrams"


@pytest.mark.skipif(not has_gui_plugin, reason="This test should be run with the gui plugin installed on the real shell.")
def test_gui_modules():
    help_text = '''NAME
      modules - The Modules MySQL Shell GUI backend module

SYNTAX
      gui.modules

DESCRIPTION
      This extension object holds the backend implementation of the Modules
      MySQL Shell GUI module

FUNCTIONS
      help([member])
            Provides help about this object and it's members'''

    assert help_text == mysqlsh.globals.gui.modules.help() # pylint: disable=no-member


@pytest.mark.skipif(not has_gui_plugin, reason="This test should be run with the gui plugin installed on the real shell.")
def test_gui_shell():
    help_text = '''NAME
      shell - The Shell MySQL Shell GUI backend module

SYNTAX
      gui.shell

DESCRIPTION
      This extension object holds the backend implementation of the Shell MySQL
      Shell GUI module

FUNCTIONS
      get_gui_module_display_info()
            Returns display information about the module

      help([member])
            Provides help about this object and it's members

      is_gui_module_backend()
            Indicates whether this module is a GUI backend module'''

    assert help_text == mysqlsh.globals.gui.shell.help() # pylint: disable=no-member
    info = mysqlsh.globals.gui.shell.get_gui_module_display_info() # pylint: disable=no-member
    assert info["name"] == "MySQL Shell Console"
    assert info["description"] == "A graphical MySQL Shell Console"


@pytest.mark.skipif(not has_gui_plugin, reason="This test should be run with the gui plugin installed on the real shell.")
def test_gui_sql_editor():
    help_text = '''NAME
      sql_editor - The SQL Editor MySQL Shell GUI backend module

SYNTAX
      gui.sql_editor

DESCRIPTION
      This extension object holds the backend implementation of the SQL Editor
      MySQL Shell GUI module

FUNCTIONS
      execute(session, sql[, params][, options])
            Executes the given SQL.

      get_auto_commit(session)
            Requests the auto-commit status for this module.

      get_current_schema(session)
            Requests the current schema for this module.

      get_gui_module_display_info()
            Returns display information about the module

      help([member])
            Provides help about this object and it's members

      is_gui_module_backend()
            Indicates whether this module is a GUI backend module

      set_auto_commit(session, state)
            Requests to change the auto-commit status for this module.

      set_current_schema(session, schema_name)
            Requests to change the current schema for this module.'''

    assert help_text == mysqlsh.globals.gui.sql_editor.help() # pylint: disable=no-member
    info = mysqlsh.globals.gui.sql_editor.get_gui_module_display_info() # pylint: disable=no-member
    assert info["name"] == "SQL Editor"
    assert info["description"] == "A graphical SQL Editor"


@pytest.mark.skipif(not has_gui_plugin, reason="This test should be run with the gui plugin installed on the real shell.")
def test_gui_users():
    help_text = '''NAME
      users - The Users MySQL Shell GUI backend module

SYNTAX
      gui.users

DESCRIPTION
      This extension object holds the backend implementation of the Users MySQL
      Shell GUI module

FUNCTIONS
      add_profile(user_id, profile[, be_session])
            Returns the specified profile.

      add_user_to_group(member_id, group_id[, owner][, be_session])
            Adds user to user group.

      create_user(username, password[, role][, allowed_hosts][, be_session])
            Creates a new user account

      create_user_group(name, description[, be_session])
            Creates user group.

      delete_profile(user_id, profile_id[, be_session])
            Deletes a profile for the current user.

      delete_user(username[, be_session])
            Deletes a user account

      get_default_profile(user_id[, be_session])
            Returns the default profile for the given user.

      get_profile(profile_id[, be_session])
            Returns the specified profile.

      get_user_id(username[, be_session])
            Gets the id for a given user.

      grant_role(username, role[, be_session])
            Grant the given roles to the user.

      help([member])
            Provides help about this object and it's members

      list_profiles(user_id[, be_session])
            Returns the list of profile for the given user

      list_role_privileges(role[, be_session])
            Lists all privileges of a role.

      list_roles([be_session])
            Lists all roles that can be assigned to users.

      list_user_groups([member_id][, be_session])
            Returns the list of all groups or list all groups that given user
            belongs.

      list_user_privileges(username[, be_session])
            Lists all privileges assigned to a user.

      list_user_roles(username[, be_session])
            List the granted roles for a given user.

      list_users([be_session])
            Lists all user accounts.

      remove_user_from_group(member_id, group_id[, be_session])
            Removes user from user group.

      remove_user_group(group_id[, be_session])
            Removes given user group.

      set_allowed_hosts(user_id, allowed_hosts[, be_session])
            Sets the allowed hosts for the given user.

      set_current_profile(profile_id)
            Sets the profile of the user's current web session.

      set_default_profile(user_id, profile_id[, be_session])
            Sets the default profile for the given user.

      update_profile(profile[, be_session])
            Updates a user profile.

      update_user_group(group_id[, name][, description][, be_session])
            Updates user group.'''

    assert help_text == mysqlsh.globals.gui.users.help() # pylint: disable=no-member

# cSpell:ignore webrootpath
@pytest.mark.skipif(not has_gui_plugin, reason="This test should be run with the gui plugin installed on the real shell.")
def test_gui_start():
    help_text = '''NAME
      start - Used to start the MySQL Shell GUI

SYNTAX
      gui.start

DESCRIPTION
      The MySQL Shell GUI can be started as a native application or as a web
      application served by a web server.

FUNCTIONS
      help([member])
            Provides help about this object and it's members

      native_ui()
            Starts the native Shell GUI client

      web_server([port][, secure][, webrootpath][, single_instance_token][, read_token_on_stdin][, accept_remote_connections])
            Starts a web server that will serve the MySQL Shell GUI'''

    assert help_text == mysqlsh.globals.gui.start.help() # pylint: disable=no-member
