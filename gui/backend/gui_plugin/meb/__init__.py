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

from .backend_controller import (
    InvalidPasswordError,
    LocalMebServerHelper,
    MebControllerBackend,
    PermissionDeniedError,
    Users,
)
from .backup_entry import BackupEntry
from .content import BackupContent
from .context import BackupContext, create_local_backup_context
from .models import MebBackupContent
from .target import BackupTarget
from .backup_home import (
    get_status,
    read_log,
)
from .setup import (
    apply_setup,
    apply_activity_backup_logs as apply_backup_logs,
    abort_activity_backup_restore as abort_backup_restore,
    create_backup_home,
    create_backup_mysql_user,
    delete_activity_backup as delete_backup,
    delete_profile,
    get_activity_restore_progress as get_restore_progress,
    get_setup_state,
    fix_backup_mysql_user,
    read_activity_backup_content as _read_activity_backup_content,
    reset_backup_mysql_user_password,
    restore_activity_backup as restore_backup,
    save_profile,
    start_profile_execution,
    validate_backup_home,
    validate_backup_mysql_user,
    validate_local_backup_access,
    verify_activity_backup as verify_backup,
)


def read_backup_content(backup_home_path: str, activity_id: str) -> MebBackupContent:
    return _read_activity_backup_content(None, backup_home_path, activity_id)
