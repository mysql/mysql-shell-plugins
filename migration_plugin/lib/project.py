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

import json
import os
import pathlib
import threading
from typing import Optional, cast
import datetime

import oci.exceptions

from . import core, logging, oci_utils, errors, ssh_utils, util
from .backend import model
from .backend.model import WorkStatusInfo, SubStepId, WorkStatus, WorkStatusEvent


class AttributeWatchProxy:
    def __init__(self, target, callback):
        super().__setattr__('_target', target)
        super().__setattr__('_callback', callback)

    def __setattr__(self, name, value):
        # Avoid recursing for our own internal attributes
        if name in ('_target', '_callback'):
            super().__setattr__(name, value)
        else:
            setattr(self._target, name, value)
            self._callback(name, value)

    def __getattr__(self, name):
        # Forward attribute access to the target
        return getattr(self._target, name)

# TODO add a directory for saving common defaults, like contact emails list


class Project:
    _oci_config: dict = {}
    _source_info: Optional[model.ServerInfo] = None
    _region: str = ""
    _ssh_public_key_path: str = ""
    _ssh_private_key_path: str = ""
    _create_time: str = ""
    _replication_coordinates: dict = {}
    _ssh_private_key_path_shared: str = ""

    user_email: str = ""

    @classmethod
    def create(cls, name: str) -> "Project":
        norm_name = core.make_string_valid_for_filesystem(name)
        timestamp = datetime.datetime.now().strftime(r"%Y%m%d %H%M%S")
        timestamp = timestamp.replace(":", "").replace("-", "")
        id = f"{norm_name}-{timestamp}"
        path = pathlib.Path(core.default_projects_directory(create=True)) / id

        path.mkdir(mode=0o700, parents=True, exist_ok=True)

        project = Project(id=id, path=path, name=name)
        project._create_time = datetime.datetime.now().isoformat()
        try:
            project.open_oci_profile()
        except Exception as e:
            logging.error(
                f"Could not open OCI profile {project._oci_profile} from {project._oci_config_file}: {e}")

        project.save()
        return project

    @classmethod
    def open(cls, id: str) -> "Project":
        path = pathlib.Path(core.default_projects_directory(create=True)) / id
        project = Project(id=id, path=path)
        project.load()
        return project

    def __init__(self, id: str, path: pathlib.Path, name: str = "") -> None:
        self.id = id
        self._name = name

        self._basedir = path
        self._options = model.MigrationOptions()
        self._resources = model.CloudResources()
        self._resources_proxy = AttributeWatchProxy(
            self._resources, self._on_resources_change)
        self._options.targetHostingOptions = model.OCIHostingOptions()
        self._options.targetMySQLOptions = model.DBSystemOptions()

        self._shared_ssh_key_directory = core.default_shared_ssh_key_directory(
            create=True)

        self._oci_config_file = os.path.expanduser(
            core.default_oci_config_file())
        self._oci_profile = core.default_oci_profile()
        self._oci_config_owned = False
        self._data_migration_did_finish = False

        self._work_status_mutex = threading.Lock()
        self._work_status = WorkStatusInfo()
        self._last_modify_time = ""

        self._plan_step_data = {}

    def set_source(self, source: dict):
        self._options.sourceConnectionOptions = source
        self.save()

    def is_valid(self) -> bool:
        return self._basedir.exists()

    @property
    def name(self) -> str:
        assert self._name
        return self._name

    @property
    def path(self) -> pathlib.Path:
        return self._basedir

    @property
    def modifyTime(self) -> str:
        return self._last_modify_time

    def clear_passwords(self):
        """Release references to cached passwords"""
        if self._options.sourceConnectionOptions:
            self._options.sourceConnectionOptions["password"] = ""
        if self._options.targetMySQLOptions:
            self._options.targetMySQLOptions.adminPassword = ""
            self._options.targetMySQLOptions.adminPasswordConfirm = ""

    def summary_info(self) -> model.MigrationSummaryInfo:
        info = model.MigrationSummaryInfo()

        info.migrationType = self._options.migrationType
        info.cloudConnectivity = self._options.cloudConnectivity

        info.region = self._options.region
        if self._options.targetMySQLOptions:
            info.adminUser = self._options.targetMySQLOptions.adminUsername
            info.dbSystemName = self._options.targetMySQLOptions.name
        info.dbSystemId = self._resources.dbSystemId
        info.dbSystemIP = self._resources.dbSystemIP
        info.dbSystemVersion = self._resources.dbSystemVersion
        info.channelId = self._resources.channelId
        info.bucketNamespace = self._resources.bucketNamespace
        info.bucketName = self._resources.bucketName
        info.createdBucket = self._resources.bucketCreated

        info.compartmentName = self._resources.compartmentName
        info.jumpHostName = self._resources.computeName
        info.jumpHostId = self._resources.computeId
        info.jumpHostPrivateIP = self._resources.computePrivateIP
        info.jumpHostPublicIP = self._resources.computePublicIP
        if self._resources.computeId:
            info.jumpHostKeyPath = self.ssh_key_private
        info.createdJumpHost = self._resources.computeCreated

        if self._options.sourceConnectionOptions:
            info.sourceHost = self._options.sourceConnectionOptions.get(
                "host", "")
            info.sourcePort = self._options.sourceConnectionOptions.get(
                "port", 3306)
        if self._source_info:
            info.sourceVersion = self._source_info.version

        return info

    def save(self):
        self._last_modify_time = datetime.datetime.now().isoformat()
        clean_options = util.sanitize_dict_any_pass(
            self.options._json(noclass=False), delete=True)
        state = {
            "version": "1.0.0",
            "id": self.id,
            "name": self._name,
            "options": clean_options,
            "ociConfigFile": self._oci_config_file,
            "ociProfile": self._oci_profile,
            "ociConfigOwned": self._oci_config_owned,
            "sshSharedKeyFile": self._ssh_private_key_path_shared,
            "sshPrivateKeyFile": self._ssh_private_key_path,
            "sshPublicKeyFile": self._ssh_public_key_path,
            "replicationCoordinates": self._replication_coordinates,
            "planStepData": self._plan_step_data,
            "createTime": self._create_time,
            "modifyTime": self._last_modify_time,
            "dataMigrationDidFinish": self._data_migration_did_finish
        }

        data_path = self._basedir / "data.json"

        with open(data_path, "w") as f:
            f.write(json.dumps(state))

        util.apply_user_only_access_permissions(data_path)

    def save_resources(self):
        resources_path = self._basedir / "resources.json"

        with open(resources_path, "w") as f:
            data = self._resources._json(noclass=False)
            # TODO mark data that shouldn't be persisted directly in the model
            if "bucketPar" in data:
                del data["bucketPar"]
            f.write(json.dumps(data))

        util.apply_user_only_access_permissions(resources_path)

    def save_progress(self):
        with self._work_status_mutex:
            progress_data = json.dumps(self._work_status._json(noclass=False))

        progress_path = self._basedir / "progress.json"

        with open(progress_path, "w") as f:
            f.write(progress_data+"\n")

        util.apply_user_only_access_permissions(progress_path)

    def load(self):
        self._resources = model.CloudResources()
        resources_file = self._basedir / "resources.json"
        if resources_file.exists():
            with open(resources_file, "r") as f:
                data = json.loads(f.read())
            self._resources._parse(data)

        self._resources_proxy = AttributeWatchProxy(
            self._resources, self._on_resources_change)

        with open(self._basedir / "data.json") as f:
            state = json.loads(f.read())

        self._name = state["name"]
        self._options = model.parse(state["options"])
        self._oci_config_file = state["ociConfigFile"]
        self._oci_profile = state["ociProfile"]
        self._oci_config_owned = state["ociConfigOwned"]
        self._ssh_private_key_path_shared = state["sshSharedKeyFile"]
        self._ssh_private_key_path = state["sshPrivateKeyFile"]
        self._ssh_public_key_path = state["sshPublicKeyFile"]
        self._create_time = state["createTime"]
        self._last_modify_time = state["modifyTime"]
        self._replication_coordinates = state.get("replicationCoordinates")
        self._plan_step_data = state.get("planStepData", {})
        self._data_migration_did_finish = state.get(
            "dataMigrationDidFinish", False)

        progress_file = self._basedir / "progress.json"
        if progress_file.exists():
            with open(progress_file) as f:
                self._work_status = model.parse(
                    json.loads(f.read()), [WorkStatusInfo])

            self.reset_work_status()

    def close(self):
        pass

    @property
    def region(self) -> str:
        return self._options.region

    @region.setter
    def region(self, value: str):
        self._options.region = value

    @property
    def options(self) -> model.MigrationOptions:
        return self._options

    @property
    def resources(self) -> model.CloudResources:
        return cast(model.CloudResources, self._resources_proxy)

    @property
    def oci_config_file(self) -> str:
        return self._oci_config_file

    @oci_config_file.setter
    def oci_config_file(self, value: str):
        self._oci_config_file = os.path.expanduser(value)

    @property
    def oci_profile(self) -> str:
        return self._oci_profile

    @oci_profile.setter
    def oci_profile(self, value: str):
        self._oci_profile = value

    @property
    def oci_config(self) -> dict:
        return self._oci_config

    @oci_config.setter
    def oci_config(self, value: dict):
        self._oci_config = value

    @property
    def source_connection_options(self) -> dict:
        assert self._options.sourceConnectionOptions
        return self._options.sourceConnectionOptions

    @property
    def source_password(self) -> str:
        assert "password" in self.source_connection_options

        return self.source_connection_options["password"]

    @property
    def source_info(self) -> model.ServerInfo:
        assert self._source_info
        return self._source_info

    @source_info.setter
    def source_info(self, value: model.ServerInfo):
        self._source_info = value

    @property
    def ssh_key_private(self) -> str:
        if self._ssh_private_key_path_shared:
            return self._ssh_private_key_path_shared

        return self._ssh_private_key_path

    @property
    def ssh_key_public(self) -> str:
        # not supposed to be called if we're using a shared key
        assert not self._ssh_private_key_path_shared
        assert self._ssh_public_key_path

        return self._ssh_public_key_path

    @property
    def dump_prefix(self) -> str:
        return self.source_info.serverUuid

    @property
    def replication_coordinates(self) -> dict:
        return self._replication_coordinates

    @replication_coordinates.setter
    def replication_coordinates(self, value: dict):
        self._replication_coordinates = value
        self.save()

    @property
    def work_status(self) -> WorkStatusInfo:
        return self._work_status

    def plan_step_data(self, step_id: SubStepId) -> dict:
        return self._plan_step_data.get(step_id, {})

    def set_plan_step_data(self, step_id: SubStepId, data: dict):
        self._plan_step_data[step_id] = data
        self.save()

    def _on_resources_change(self, name: str, value):
        # called whenever self.resources.something is set
        self.save_resources()

    def log_work(self, stage: SubStepId, status: WorkStatusEvent, data: dict, message: str = ""):
        assert isinstance(data, dict), data

        with self._work_status_mutex:
            if stage == SubStepId.ORCHESTRATION:
                if status == WorkStatusEvent.BEGIN:
                    self._work_status.status = WorkStatus.IN_PROGRESS
                elif status == WorkStatusEvent.END:
                    self._work_status.status = WorkStatus.FINISHED
                elif status == WorkStatusEvent.ERROR:
                    self._work_status.status = WorkStatus.ERROR
                elif status == WorkStatusEvent.ABORTED:
                    self._work_status.status = WorkStatus.ABORTED
            else:
                if stage == SubStepId.CONGRATS and status == WorkStatusEvent.BEGIN:
                    self._work_status.status = WorkStatus.READY

                work_stage = model.SubStepId(stage)

                info = self._work_status._stage(work_stage)

                if message:
                    info.message = message
                if data:
                    info.info = data

                if status == WorkStatusEvent.BEGIN:
                    info.status = WorkStatus.IN_PROGRESS
                elif status == WorkStatusEvent.END:
                    info.status = WorkStatus.FINISHED
                elif status == WorkStatusEvent.ERROR:
                    info.status = WorkStatus.ERROR
                    if not message and data and "error" in data and "message" in data["error"]:
                        info.message = data["error"]["message"]

                    if "error" in data:
                        info.errors.append(data["error"])
                    elif "errors" in data:
                        info.errors.extend(data["errors"])
                elif status == WorkStatusEvent.ABORTED:
                    info.status = WorkStatus.ABORTED

        self.save_progress()

    def log_work_progress(self, stage: SubStepId, message: str, data: Optional[dict] = None):
        assert isinstance(data, dict), data

        with self._work_status_mutex:
            info = self._work_status._stage(stage)
            if message:
                info.message = message
            if data:
                info.current = data.get("stageCurrent")
                info.total = data.get("stageTotal")
                info.eta = data.get("stageEta")
                # TODO: this should include only useful information
                info.info = data

        self.save_progress()

    def reset_work_status(self):
        for info in self._work_status.stages:
            info.errors = []

    def snapshot_status(self) -> WorkStatusInfo:
        with self._work_status_mutex:
            copy = self._work_status._snapshot()
            copy.summary = self.summary_info()
            return copy

    def _make_oci_config_error(self, msg, *args):
        if not self._oci_config:
            return errors.OCIConfigError(f"{msg} (path={self._oci_config_file})")
        else:
            return errors.OCIConfigError(f"{msg} (path={self._oci_config_file} profile={self._oci_config.get('profile')})")

    def check_oci_config(self, retry_strategy=None):
        if not self._oci_config:
            raise self._make_oci_config_error(
                "No valid OCI API configuration found")

        logging.info(
            f"Checking OCI profile API key of {self._oci_profile} from {self._oci_config_file}")

        try:
            tenancy = oci_utils.Compartment(
                self._oci_config, retry_strategy=retry_strategy
            )

            logging.info(f"Tenancy for profile is {tenancy}")
        except Exception as e:
            logging.error(f"Loaded OCI profile didn't work: {e}")
            raise self._make_oci_config_error(
                f"OCI profile is not functional") from e

        try:
            # this is non-fatal
            user = oci_utils.OCIUser(self._oci_config, use_home_region=False)
            self.user_email = user.email
            logging.info(f"User email is {self.user_email}")
        except Exception as e:
            logging.warning(f"get_user did not work: {e}")

    @classmethod
    def oci_config_exists(cls) -> bool:
        if not os.path.exists(os.path.expanduser(core.default_oci_config_file())):
            return False
        try:
            oci_utils.get_config(
                path=os.path.expanduser(core.default_oci_config_file()),
                profile=core.default_oci_profile())
            return True
        except:
            logging.info(
                f"OCI profile {core.default_oci_profile()} not found at {core.default_oci_config_file()}")
            return False

    def open_oci_profile(self) -> bool:
        logging.debug(
            f"Trying to open OCI profile '{self._oci_profile}' from '{self._oci_config_file}'"
        )
        if not os.path.exists(self._oci_config_file):
            logging.info(f"No OCI config file at {self._oci_config_file}")
            return False

        try:
            self._oci_config = oci_utils.get_config(
                path=self._oci_config_file,
                profile=self._oci_profile)
            logging.info(
                f"Loaded OCI profile from {self._oci_config_file} profile={self._oci_profile}: {util.sanitize_dict_any_pass(self._oci_config)}"
            )
        except oci.exceptions.ProfileNotFound as e:
            self._oci_config = {}
            logging.info(
                f"{e}: config={self._oci_config_file} profile={self._oci_profile}")
            return False

        self.region = self.oci_config["region"]
        return True

    def create_ssh_key_pair(self):
        key_name = "ssh_rsa"
        private_key_path = str(self._basedir / key_name)
        public_key_path = private_key_path + ".pub"

        ssh_utils.create_ssh_key_pair(private_key_path=private_key_path,
                                      public_key_path=public_key_path)
        self._ssh_private_key_path = private_key_path
        self._ssh_public_key_path = public_key_path
        logging.debug(f"SSH key pair written to {self.ssh_key_private}")

    def delete_ssh_key_pair(self):
        logging.info(
            f"Deleting SSH key pair from {self._ssh_private_key_path_shared}")
        os.remove(self._ssh_private_key_path_shared)
        os.remove(self._ssh_private_key_path_shared+".pub")

    def save_shared_ssh_key_pair(self, compute_id: str):
        assert compute_id

        short_compute_id = compute_id.split(".")[-1]

        # ssh key is already reused
        if self._ssh_private_key_path_shared:
            return

        self._ssh_private_key_path_shared = os.path.join(
            self._shared_ssh_key_directory, short_compute_id)
        logging.info(
            f"Moving SSH keys for {compute_id} to {self._ssh_private_key_path_shared}")

        os.rename(self._ssh_private_key_path,
                  self._ssh_private_key_path_shared)
        os.rename(self._ssh_public_key_path,
                  self._ssh_private_key_path_shared+".pub")

    def find_shared_ssh_key(self, compute_id: str) -> str | None:
        compute_id = compute_id.split(".")[-1]

        path = os.path.join(self._shared_ssh_key_directory, compute_id)
        if os.path.exists(path):
            logging.info(f"Shared SSH key for {compute_id} exists")
            self._ssh_private_key_path_shared = path
            return path
        else:
            logging.error(
                f"Shared SSH key for {compute_id} not found at {path}")
            return None
