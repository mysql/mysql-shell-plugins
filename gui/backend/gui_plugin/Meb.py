# Copyright (c) 2026, Oracle and/or its affiliates.
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
# separately licensed software that they have either included with the
# program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful,  but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

from __future__ import annotations

from mysqlsh.plugin_manager.registrar import plugin_function

from .meb.backup_home import (
    backup_path_for_activity,
    get_status as get_backup_home_status,
    read_log as read_backup_home_log,
)
from .meb.models import (
    MebBackupContent,
    MebBackupHomeValidation,
    MebPrerequisitesValidation,
    MebLogContent,
    MebMysqlBackupUserValidation,
    MebBackupProfile,
    MebRestoreProgress,
    MebRestoreResult,
    MebSetupState,
    MebStatus,
)
from .meb.setup import (
    abort_activity_backup_restore as abort_meb_activity_backup_restore,
    apply_activity_backup_logs as apply_meb_activity_backup_logs,
    apply_setup as apply_meb_setup,
    create_backup_home as create_meb_backup_home,
    create_backup_mysql_user as create_meb_backup_mysql_user,
    delete_activity_backup as delete_meb_activity_backup,
    delete_profile as delete_meb_profile,
    get_activity_restore_progress as get_meb_activity_restore_progress,
    get_setup_state as get_meb_setup_state,
    fix_backup_mysql_user as fix_meb_backup_mysql_user,
    read_activity_backup_content as read_meb_activity_backup_content,
    reset_backup_mysql_user_password as reset_meb_backup_mysql_user_password,
    restore_activity_backup as restore_meb_activity_backup,
    save_profile as save_meb_profile,
    start_profile_execution as start_meb_profile_execution,
    validate_backup_home as validate_meb_backup_home,
    validate_backup_mysql_user as validate_meb_backup_mysql_user,
    validate_local_backup_access as validate_meb_local_backup_access,
    verify_activity_backup as verify_meb_activity_backup,
)


@plugin_function("gui.meb.getStatus", shell=False, cli=False, web=True)
def get_status(backup_home_path: str | None = None) -> MebStatus:
    """Returns local MySQL Enterprise Backup configuration and profile status.

    Args:
        backup_home_path (str): The local backup home directory.

    Returns:
        MebStatus: Local MySQL Enterprise Backup status information.
    """

    return get_backup_home_status(backup_home_path)


@plugin_function("gui.meb.getSetupState", shell=False, cli=False, web=True)
def get_setup_state(
    session: object,
    backup_home_path: str | None = None,
) -> MebSetupState:
    """Returns the local MEB setup state for the connected MySQL server.

    Args:
        session (object): The session used to inspect the connected MySQL server.
        backup_home_path (str): The local backup home directory from connection metadata.

    Returns:
        MebSetupState: Current setup state and configured status when available.
    """

    return get_meb_setup_state(session, backup_home_path)


@plugin_function("gui.meb.validateLocalBackupAccess", shell=False, cli=False, web=True)
def validate_local_backup_access(session: object) -> MebPrerequisitesValidation:
    """Validates current-user access for local backup operations.

    Args:
        session (object): The session used to inspect the connected MySQL server.

    Returns:
        MebPrerequisitesValidation: Current user, datadir and mysqlbackup validation state.
    """

    return validate_meb_local_backup_access(session)


@plugin_function("gui.meb.validateBackupHome", shell=False, cli=False, web=True)
def validate_backup_home(
    session: object,
    backup_home_path: str,
) -> MebBackupHomeValidation:
    """Validates a local backup home path for the connected MySQL server.

    Args:
        session (object): The session used to inspect the connected MySQL server.
        backup_home_path (str): The local backup home directory to validate.

    Returns:
        MebBackupHomeValidation: Backup home ownership, permissions, access and reuse validation state.
    """

    return validate_meb_backup_home(session, backup_home_path)


@plugin_function("gui.meb.createBackupHome", shell=False, cli=False, web=True)
def create_backup_home(
    session: object,
    backup_home_path: str,
) -> MebBackupHomeValidation:
    """Creates a local backup home directory and validates it.

    Args:
        session (object): The session used to inspect the connected MySQL server.
        backup_home_path (str): The local backup home directory to create.

    Returns:
        MebBackupHomeValidation: Backup home ownership, permissions, access and reuse validation state.
    """

    return create_meb_backup_home(session, backup_home_path)


@plugin_function("gui.meb.validateBackupMysqlUser", shell=False, cli=False, web=True)
def validate_backup_mysql_user(
    session: object,
    backup_home_path: str,
    mysql_user: str,
    password: str | None = None,
) -> MebMysqlBackupUserValidation:
    """Validates and stores credentials for an existing MySQL backup account.

    Args:
        session (object): The session used to inspect the connected MySQL server.
        backup_home_path (str): The local backup home directory.
        mysql_user (str): The MySQL account used by mysqlbackup.
        password (str): Optional MySQL account password to validate and store.

    Returns:
        MebMysqlBackupUserValidation: MySQL account existence and credential storage state.
    """

    return validate_meb_backup_mysql_user(session, backup_home_path, mysql_user, password)


@plugin_function("gui.meb.createBackupMysqlUser", shell=False, cli=False, web=True)
def create_backup_mysql_user(
    session: object,
    backup_home_path: str,
    mysql_user: str,
) -> MebMysqlBackupUserValidation:
    """Creates the MySQL backup account, grants privileges, and stores credentials.

    Args:
        session (object): The session used to inspect and modify the connected MySQL server.
        backup_home_path (str): The local backup home directory.
        mysql_user (str): The MySQL account to create for mysqlbackup.

    Returns:
        MebMysqlBackupUserValidation: Created account and credential storage state.
    """

    return create_meb_backup_mysql_user(session, backup_home_path, mysql_user)


@plugin_function("gui.meb.fixBackupMysqlUser", shell=False, cli=False, web=True)
def fix_backup_mysql_user(
    session: object,
    backup_home_path: str,
    mysql_user: str,
) -> MebMysqlBackupUserValidation:
    """Reapplies the required privileges and limits for an existing backup account.

    Args:
        session (object): The session used to inspect and modify the connected MySQL server.
        backup_home_path (str): The local backup home directory.
        mysql_user (str): The MySQL account to repair for mysqlbackup.

    Returns:
        MebMysqlBackupUserValidation: Revalidated account and credential storage state.
    """

    return fix_meb_backup_mysql_user(session, backup_home_path, mysql_user)


@plugin_function("gui.meb.resetBackupMysqlUserPassword", shell=False, cli=False, web=True)
def reset_backup_mysql_user_password(
    session: object,
    backup_home_path: str,
    mysql_user: str,
    password: str | None = None,
) -> MebMysqlBackupUserValidation:
    """Resets the MySQL backup account password and stores the credential.

    Args:
        session (object): The session used to inspect and modify the connected MySQL server.
        backup_home_path (str): The local backup home directory.
        mysql_user (str): The MySQL account to reset for mysqlbackup.
        password (str): Optional explicit new password. If omitted, one is generated.

    Returns:
        MebMysqlBackupUserValidation: Reset account and credential storage state.
    """

    return reset_meb_backup_mysql_user_password(session, backup_home_path, mysql_user, password)


@plugin_function("gui.meb.applySetup", shell=False, cli=False, web=True)
def apply_setup(
    session: object,
    backup_home_path: str,
    mysql_user: str,
) -> MebSetupState:
    """Persists local MEB support configuration in the backup home.

    Args:
        session (object): The session used to inspect the connected MySQL server.
        backup_home_path (str): The local backup home directory.
        mysql_user (str): The MySQL account used by mysqlbackup.

    Returns:
        MebSetupState: Refreshed setup state after applying configuration.
    """

    return apply_meb_setup(session, backup_home_path, mysql_user)


@plugin_function("gui.meb.saveProfile", shell=False, cli=False, web=True)
def save_profile(
    session: object,
    backup_home_path: str,
    profile: MebBackupProfile,
) -> MebStatus:
    """Creates or updates a MySQL Enterprise Backup profile.

    Args:
        session (object): The session used to inspect the connected MySQL server.
        backup_home_path (str): The local backup home directory.
        profile (object): Profile fields collected by the frontend.

    Returns:
        MebStatus: Refreshed local MySQL Enterprise Backup status information.
    """

    return save_meb_profile(session, backup_home_path, profile)


@plugin_function("gui.meb.deleteProfile", shell=False, cli=False, web=True)
def delete_profile(
    session: object,
    backup_home_path: str,
    profile_uuid: str,
) -> MebStatus:
    """Deletes a MySQL Enterprise Backup profile.

    Args:
        session (object): The session used to inspect the connected MySQL server.
        backup_home_path (str): The local backup home directory.
        profile_uuid (str): The backup profile UUID to delete.

    Returns:
        MebStatus: Refreshed local MySQL Enterprise Backup status information.
    """

    return delete_meb_profile(session, backup_home_path, profile_uuid)


@plugin_function("gui.meb.startProfileExecution", shell=False, cli=False, web=True)
def start_profile_execution(
    session: object,
    backup_home_path: str,
    profile_uuid: str,
    backup_mode: str,
) -> MebStatus:
    """Starts executing a MySQL Enterprise Backup profile immediately.

    Args:
        session (object): The session used to inspect the connected MySQL server.
        backup_home_path (str): The local backup home directory.
        profile_uuid (str): The backup profile UUID to execute.
        backup_mode (str): Backup mode to execute: full or incremental.

    Returns:
        MebStatus: Refreshed local MySQL Enterprise Backup status with running progress.
    """

    return start_meb_profile_execution(session, backup_home_path, profile_uuid, backup_mode)


@plugin_function("gui.meb.deleteBackup", shell=False, cli=False, web=True)
def delete_backup(
    backup_home_path: str,
    activity_id: str,
) -> MebStatus:
    """Deletes backup data associated with a recent activity log entry.

    Args:
        backup_home_path (str): The local backup home directory.
        activity_id (str): Opaque identifier returned in recent activity.

    Returns:
        MebStatus: Refreshed local MySQL Enterprise Backup status information.
    """

    return delete_meb_activity_backup(backup_home_path, activity_id)


@plugin_function("gui.meb.verifyBackup", shell=False, cli=False, web=True)
def verify_backup(
    backup_home_path: str,
    activity_id: str,
) -> MebLogContent:
    """Runs mysqlbackup validation and returns its direct output.

    Args:
        backup_home_path (str): The local backup home directory.
        activity_id (str): Opaque identifier returned in recent activity.

    Returns:
        MebLogContent: Verification output for display.
    """

    return verify_meb_activity_backup(backup_home_path, activity_id)


@plugin_function("gui.meb.applyBackupLogs", shell=False, cli=False, web=True)
def apply_backup_logs(
    backup_home_path: str,
    activity_id: str,
) -> MebStatus:
    """Applies pending redo logs to a recent activity backup.

    Args:
        backup_home_path (str): The local backup home directory.
        activity_id (str): Opaque identifier returned in recent activity.

    Returns:
        MebStatus: Refreshed local MySQL Enterprise Backup status information.
    """

    return apply_meb_activity_backup_logs(backup_home_path, activity_id)


@plugin_function("gui.meb.restoreBackup", shell=False, cli=False, web=True)
def restore_backup(
    backup_home_path: str,
    activity_id: str,
    operation_id: str,
    force: bool = False,
) -> MebRestoreResult:
    """Restores local backup data associated with a recent activity log entry.

    Args:
        backup_home_path (str): The local backup home directory.
        activity_id (str): Opaque identifier returned in recent activity.
        operation_id (str): Unique identifier correlating progress and abort requests.
        force (bool): Whether mysqlbackup should force the copy-back operation.

    Returns:
        MebRestoreResult: Restore outcome, raw mysqlbackup output on failure,
            and refreshed status on success.
    """

    return restore_meb_activity_backup(backup_home_path, activity_id, operation_id, force)


@plugin_function("gui.meb.getRestoreProgress", shell=False, cli=False, web=True)
def get_restore_progress(
    backup_home_path: str,
    operation_id: str,
) -> MebRestoreProgress:
    """Returns live output and state for a matching restore operation.

    Args:
        backup_home_path (str): The local backup home directory.
        operation_id (str): Unique restore operation identifier.

    Returns:
        MebRestoreProgress: Current restore state and bounded mysqlbackup output.
    """

    return get_meb_activity_restore_progress(backup_home_path, operation_id)


@plugin_function("gui.meb.abortBackupRestore", shell=False, cli=False, web=True)
def abort_backup_restore(
    backup_home_path: str,
    operation_id: str,
) -> MebRestoreProgress:
    """Aborts the matching active restore operation.

    Args:
        backup_home_path (str): The local backup home directory.
        operation_id (str): Unique restore operation identifier.

    Returns:
        MebRestoreProgress: Aborting state and current bounded mysqlbackup output.
    """

    return abort_meb_activity_backup_restore(backup_home_path, operation_id)


@plugin_function("gui.meb.readBackupContent", shell=False, cli=False, web=True)
def read_backup_content(
    backup_home_path: str,
    activity_id: str,
) -> MebBackupContent:
    """Reads the table contents represented by a recent activity backup.

    Args:
        backup_home_path (str): The local backup home directory.
        activity_id (str): Opaque identifier returned in recent activity.
    Returns:
        MebBackupContent: Backup table content and restore impact rows.
    """

    return read_meb_activity_backup_content(None, backup_home_path, activity_id)


@plugin_function("gui.meb.getBackupPath", shell=False, cli=False, web=True)
def get_backup_path(backup_home_path: str, activity_id: str) -> str:
    """Returns the local directory path represented by a recent activity backup.

    Args:
        backup_home_path (str): The local backup home directory.
        activity_id (str): Opaque identifier returned in recent activity.
    Returns:
        str: Canonical local backup directory path.
    """

    return backup_path_for_activity(backup_home_path, activity_id)


@plugin_function("gui.meb.readLog", shell=False, cli=False, web=True)
def read_log(backup_home_path: str, activity_id: str) -> MebLogContent:
    """Reads a mysqlbackup log file discovered below a configured backup home.

    Args:
        backup_home_path (str): The local backup home directory.
        activity_id (str): Opaque identifier returned in recent activity.

    Returns:
        MebLogContent: Activity identifier and log content.
    """

    return read_backup_home_log(backup_home_path, activity_id)
