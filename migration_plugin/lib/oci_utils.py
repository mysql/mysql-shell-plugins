# Copyright (c) 2025, 2026, Oracle and/or its affiliates.
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

from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
import copy
from datetime import datetime
import random
import time
from types import MethodType
from typing import Any, Optional, cast
from enum import Enum
import functools
import threading

import oci.util
import oci.mysql

from . import logging, ssh_utils, util
from .backend.api_metadata import k_configuration_variables_metadata
from mds_plugin import core, configuration, compute

import oci
import oci.core.models as oci_models


k_my_id_tag_name = "mysql-migration-assistant-id"
k_oracle_tags = "Oracle-Tags"

k_oci_profile_name = "DEFAULT"

k_work_request_header = "opc-work-request-id"

# deprecated since 8.0.27
k_deprecated_variables = ["default_authentication_plugin"]


def make_freeform_tags(migrator_id: str):
    return {k_my_id_tag_name: migrator_id}


def match_freeform_tags(d1: dict, obj: object) -> bool:
    assert obj
    if not hasattr(obj, "freeform_tags"):
        return False

    object_tags: dict = getattr(obj, "freeform_tags")

    for k, value in d1.items():
        if k not in object_tags or object_tags[k] != value:
            return False

    return True


def freeform_tag(obj: object, tag: str = k_my_id_tag_name):
    assert obj
    if hasattr(obj, "freeform_tags") and obj.freeform_tags:  # type: ignore
        return obj.freeform_tags.get(tag)  # type: ignore
    return None


def defined_tag(obj: object, namespace: str = k_oracle_tags, tag: str = k_my_id_tag_name):
    assert obj
    if hasattr(obj, "defined_tags") and obj.defined_tags and namespace in obj.defined_tags:  # type: ignore
        return obj.defined_tags[namespace].get(tag)  # type: ignore
    return None


def get_config(path: Optional[str] = None, profile: Optional[str] = None) -> dict:
    return configuration.get_current_config(config_profile=profile,
                                            config_file_path=path,
                                            interactive=False)


class ComputeAction(Enum):
    START = 0
    STOP = 1


def log(func):
    # TODO keep a separate log of all resources we create

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            # Log before calling the function

            # logging.debug(f"Calling {func.__name__}")

            result = func(*args, **kwargs)

            # logging.debug(f"Calling {func.__name__} done")
            return result
        except Exception as e:
            logging.error(f"Exception in {func.__name__}: {e}")
            raise

    return wrapper


def format_description(obj) -> str:
    # description = f"{obj.display_name} ({obj.id})"
    description = f"{obj.display_name}"

    if hasattr(obj, "lifecycle_state"):
        description += f" state={obj.lifecycle_state}"

    description += " tag="

    if hasattr(obj, "freeform_tag"):
        description += f"'{obj.freeform_tag()}'"
    else:
        description += f"'{freeform_tag(obj)}'"

    creator = defined_tag(obj, tag="CreatedBy")
    if creator:
        description += " CreatedBy=" + str(creator)

    return description


def filter_sql_mode(sql_mode):
    """
    Remove SQL modes which are not available in 8.0+.
    """
    modes: list[str] = sql_mode.split(",")
    invalid_modes = [
        "POSTGRESQL",
        "ORACLE",
        "MSSQL",
        "DB2",
        "MAXDB",
        "NO_KEY_OPTIONS",
        "NO_TABLE_OPTIONS",
        "NO_FIELD_OPTIONS",
        "MYSQL323",
        "MYSQL40",
        "NO_AUTO_CREATE_USER",
    ]
    modes = [
        mode for mode in modes if mode and mode.upper() not in invalid_modes
    ]
    return ",".join(modes)


def filter_optimizer_switch(optimizer_switch):
    """
    Remove unknown optimizer_switch flags.
    """
    flags: list[str] = optimizer_switch.split(",")
    known_flags = [
        "batched_key_access",
        "block_nested_loop",
        "condition_fanout_filter",
        "derived_condition_pushdown",  # 8.0
        "derived_merge",
        "engine_condition_pushdown",
        "hash_join",  # 8.0
        "index_condition_pushdown",
        "use_index_extensions",
        "index_merge",
        "index_merge_intersection",
        "index_merge_sort_union",
        "index_merge_union",
        "use_invisible_indexes",  # 8.0
        "prefer_ordering_index",
        "mrr",
        "mrr_cost_based",
        "duplicateweedout",
        "firstmatch",
        "loosescan",
        "semijoin",
        "hash_set_operations",  # 8.4
        "skip_scan",  # 8.0
        "materialization",
        "subquery_materialization_cost_based",
        "subquery_to_derived",  # 8.0
    ]
    flags = [
        flag for flag in flags if flag and flag.split("=")[0].lower() in known_flags
    ]
    return ",".join(flags)


def fixup_sysvar_value(name, value):
    """
    Return a Python value for the given sysvar value according to what
    ConfigurationVariables expects.

    Also performs various normalizations required to make the sysvar values
    acceptable to MDS.

    Raises an exception if the variable is not configurable.
    """
    if value is None:
        return None

    if not name in k_configuration_variables_metadata:
        assert not "unsupported sysvar", f"{value} var={name}"

    info = k_configuration_variables_metadata[name]
    type_name = info["type"]

    if type_name == "boolean":
        if value == "ON" or value is True:
            return True
        elif value == "OFF" or value is False:
            return False
        assert not "unexpected bool value", f"{value} var={name}"
    elif type_name == "integer":
        # long_query_time is float in mysqld, but API requires int
        if name == "long_query_time":
            value = float(value)
        value = int(value)

        if "minimum" in info:
            value = max(info["minimum"], value)
        if "maximum" in info:
            value = min(info["maximum"], value)

        # The maximum value of ints in OCI API is 2**63-1 (the maximum value of
        # a Java long), these values are not displayed properly in the OCI
        # Console due to JS rounding errors, however they are correctly set in
        # the created DB system. We don't enforce the limit here, as it's
        # already taken into account in the swagger spec file.
        return value
    elif type_name != "string":
        assert not "unexpected sysvar type", f"{type_name} for {name}"

    # normalize enum string values
    if "enum" in info:
        if not isinstance(value, str):
            assert not "unexpected ENUM type", f"{type_name} for {name}"

        value_upper = value.upper()

        for v in info["enum"]:
            if v.upper() == value_upper:
                return v

        return info["default"]
    elif "sql_mode" == name:
        return filter_sql_mode(value)
    elif "optimizer_switch" == name:
        return filter_optimizer_switch(value)
    else:
        return value


def get_regions() -> list[str]:
    return oci.regions.REGIONS


def wait_for_work_requests(work_requests: list[Any], context: str, sleep_for=60, show_fn=None):
    show = show_fn or logging.info
    pending = {}
    work_id = 1

    for work in work_requests:
        pending[f"{work.operation_type} ({work.resources[0].identifier if work.resources else work_id})"] = work
        work_id += 1

    while pending:
        show(f"Waiting for {len(pending)} work requests ({context})...")

        done: list[str] = []

        for desc, work in pending.items():
            work.refresh()

            match work.status:
                case work.STATUS_ACCEPTED:
                    show(f"Work request '{desc}' still pending...")

                case work.STATUS_IN_PROGRESS:
                    show(
                        f"Work request '{desc}' progress: {work.percent_complete}%")

                case work.STATUS_CANCELING | work.STATUS_CANCELED:
                    done.append(desc)
                    show(f"Work request '{desc}' has been cancelled.")

                case work.STATUS_SUCCEEDED:
                    done.append(desc)
                    show(f"Work request '{desc}' has finished.")

                case work.STATUS_FAILED:
                    done.append(desc)
                    show(f"Work request '{desc}' has failed:")
                    if work.errors:
                        for error in work.errors:
                            show(f" {error}")

        for d in done:
            pending.pop(d, None)

        if pending:
            time.sleep(sleep_for)


class WorkRequest:
    STATUS_ACCEPTED = oci.work_requests.models.WorkRequest.STATUS_ACCEPTED
    STATUS_IN_PROGRESS = oci.work_requests.models.WorkRequest.STATUS_IN_PROGRESS
    STATUS_FAILED = oci.work_requests.models.WorkRequest.STATUS_FAILED
    STATUS_SUCCEEDED = oci.work_requests.models.WorkRequest.STATUS_SUCCEEDED
    STATUS_CANCELING = oci.work_requests.models.WorkRequest.STATUS_CANCELING
    STATUS_CANCELED = oci.work_requests.models.WorkRequest.STATUS_CANCELED

    def __init__(self, config, ocid: str) -> None:
        self._config = configuration.get_current_config(config=config)
        self._client = core.get_oci_work_requests_client(self._config)
        self.id = ocid
        self.refresh()

    def refresh(self):
        self.obj: oci.work_requests.models.WorkRequest = self._client.get_work_request(
            self.id).data  # type: ignore

    @property
    def operation_type(self) -> str:
        return self.obj.operation_type  # type: ignore

    @property
    def resources(self) -> list[oci.work_requests.models.WorkRequestResource]:
        return self.obj.resources  # type: ignore

    @property
    def status(self) -> str:
        return self.obj.status  # type: ignore

    @property
    def percent_complete(self) -> float:
        return self.obj.percent_complete  # type: ignore

    @property
    def errors(self) -> list[oci.work_requests.models.WorkRequestError]:
        return oci.pagination.list_call_get_all_results(
            self._client.list_work_request_errors, work_request_id=self.id
        ).data


class IdentityWorkRequest:
    STATUS_ACCEPTED = oci.identity.models.WorkRequest.STATUS_ACCEPTED
    STATUS_IN_PROGRESS = oci.identity.models.WorkRequest.STATUS_IN_PROGRESS
    STATUS_FAILED = oci.identity.models.WorkRequest.STATUS_FAILED
    STATUS_SUCCEEDED = oci.identity.models.WorkRequest.STATUS_SUCCEEDED
    STATUS_CANCELING = oci.identity.models.WorkRequest.STATUS_CANCELING
    STATUS_CANCELED = oci.identity.models.WorkRequest.STATUS_CANCELED

    def __init__(self, config, ocid: str) -> None:
        self._config = configuration.get_current_config(config=config)
        self._client = core.get_oci_identity_client(self._config)
        self.id = ocid
        self.refresh()

    def refresh(self):
        self.obj: oci.identity.models.WorkRequest = self._client.get_work_request(
            self.id).data  # type: ignore

    @property
    def operation_type(self) -> str:
        return self.obj.operation_type  # type: ignore

    @property
    def resources(self) -> list[oci.identity.models.WorkRequestResource]:
        return self.obj.resources  # type: ignore

    @property
    def status(self) -> str:
        return self.obj.status  # type: ignore

    @property
    def percent_complete(self) -> float:
        return self.obj.percent_complete  # type: ignore

    @property
    def errors(self) -> Optional[list[oci.identity.models.WorkRequestError]]:
        return self.obj.errors


class MySQLWorkRequest:
    STATUS_ACCEPTED = oci.mysql.models.WorkRequest.STATUS_ACCEPTED
    STATUS_IN_PROGRESS = oci.mysql.models.WorkRequest.STATUS_IN_PROGRESS
    STATUS_FAILED = oci.mysql.models.WorkRequest.STATUS_FAILED
    STATUS_SUCCEEDED = oci.mysql.models.WorkRequest.STATUS_SUCCEEDED
    STATUS_CANCELING = oci.mysql.models.WorkRequest.STATUS_CANCELING
    STATUS_CANCELED = oci.mysql.models.WorkRequest.STATUS_CANCELED

    def __init__(self, config, ocid: str) -> None:
        self._config = configuration.get_current_config(config=config)
        self._client = core.get_oci_mysql_work_requests_client(self._config)
        self.id = ocid
        self.refresh()

    def refresh(self):
        self.obj: oci.mysql.models.WorkRequest = self._client.get_work_request(
            self.id).data  # type: ignore

    @property
    def operation_type(self) -> str:
        return self.obj.operation_type  # type: ignore

    @property
    def resources(self) -> list[oci.mysql.models.WorkRequestResource]:
        return self.obj.resources  # type: ignore

    @property
    def status(self) -> str:
        return self.obj.status  # type: ignore

    @property
    def percent_complete(self) -> float:
        return self.obj.percent_complete  # type: ignore

    @property
    def errors(self) -> list[oci.mysql.models.WorkRequestError]:
        return oci.pagination.list_call_get_all_results(
            self._client.list_work_request_errors, work_request_id=self.id
        ).data


class OCIUser:
    obj = None

    def __init__(self, config, use_home_region: bool) -> None:
        self._config = config
        self._iam_client = core.get_oci_identity_client(config=self._config)
        # certain ops (e.g. deleting API keys) need to be done from home region
        self.home_region = None
        if use_home_region:
            self.switch_to_home_region()

    def switch_to_home_region(self):
        # Get the tenancy OCID from config
        tenancy_id = self._config["tenancy"]

        # Get the list of region subscriptions for your tenancy
        region_subscriptions = self._iam_client.list_region_subscriptions(
            tenancy_id).data  # type: ignore

        # Find the region marked as home region
        self.home_region = next(
            (r.region_name for r in region_subscriptions if r.is_home_region), None)
        if self.home_region != self._config["region"]:
            self._config = self._config.copy()
            logging.info(f"Switching to home region {self.home_region}")
            self._config["region"] = self.home_region
            self._iam_client = core.get_oci_identity_client(
                config=self._config)

    @property
    def user_id(self) -> str:
        return self._config["user"]

    @property
    def email(self) -> str:
        if not self.obj:
            self.refresh()
        if not self.obj:
            return ""
        return self.obj.email

    def refresh(self):
        response = self._iam_client.get_user(user_id=self.user_id)
        assert response
        self.obj = response.data

    def list_api_keys(self) -> list[oci.identity.models.ApiKey]:
        return self._iam_client.list_api_keys(
            self.user_id).data  # type: ignore

    def delete_api_key(self, fingerprint: str):
        self._iam_client.delete_api_key(self.user_id, fingerprint=fingerprint)


class ComputeInstance:
    obj: oci_models.Instance
    id: str

    def __init__(
        self,
        config,
        ocid_or_instance: str | oci_models.Instance,
        client=None,
    ) -> None:
        assert ocid_or_instance

        self._config = configuration.get_current_config(config=config)
        self._client = client or core.get_oci_compute_client(
            config=self._config)

        if isinstance(ocid_or_instance, str):
            self.id = ocid_or_instance
            self.obj = self._client.get_instance(
                instance_id=self.id).data  # type: ignore
        else:
            self.obj = ocid_or_instance
            assert self.obj
            self.id = self.obj.id  # type: ignore

    def __repr__(self):
        return repr(oci.util.to_dict(self.obj))

    def connect_ssh(self, ip: str, private_key_file_path: str):
        return ssh_utils.connect_ssh(user="opc",
                                     host=ip,
                                     private_key_file_path=private_key_file_path)

    def freeform_tag(self, tag: str = k_my_id_tag_name):
        return freeform_tag(self.obj, tag)

    @property
    def display_name(self) -> str:
        assert self.obj
        return self.obj.display_name  # type: ignore

    @property
    def lifecycle_state(self):
        assert self.obj
        return self.obj.lifecycle_state

    @property
    def freeform_tags(self) -> dict:
        assert self.obj
        return self.obj.freeform_tags  # type: ignore

    @property
    def defined_tags(self) -> dict:
        assert self.obj
        return self.obj.defined_tags  # type: ignore

    def refresh(self):
        self.obj = self._client.get_instance(
            instance_id=self.id).data  # type: ignore

    def stop(self):
        self._client.instance_action(instance_id=self.id, action="STOP")

    def start(self):
        self._client.instance_action(instance_id=self.id, action="START")

    def get_public_ip(self) -> Optional[str]:
        return compute.get_instance_public_ip(
            config=self._config,
            instance_id=self.id,
            compartment_id=self.obj.compartment_id,
            interactive=False,
        )

    def get_ips(self) -> tuple[str | None, str | None]:
        return compute.get_instance_ips(
            config=self._config,
            instance_id=self.id,
            compartment_id=self.obj.compartment_id,
            interactive=False,
        )

    def get_all_boot_volume_attachments(self) -> list[oci_models.BootVolumeAttachment]:
        boot_volumes = [
            bv
            for bv in oci.pagination.list_call_get_all_results(
                self._client.list_boot_volume_attachments,
                availability_domain=self.obj.availability_domain,
                compartment_id=self.obj.compartment_id,
                instance_id=self.id,
            ).data
            if bv.lifecycle_state
            not in (
                oci.core.models.Instance.LIFECYCLE_STATE_TERMINATED,
                oci.core.models.Instance.LIFECYCLE_STATE_TERMINATING,
            )
        ]
        return boot_volumes

    def print_all_resources(self, show_fn=None):
        show = show_fn or logging.info
        bs_client = core.get_oci_block_storage_client(self._config)

        show(f"    - {format_description(self)}:")

        bvas = self.get_all_boot_volume_attachments()

        if bvas:
            show(f"      Boot Volumes:")
            for bva in bvas:
                show(f"        - attachment: {format_description(bva)}")
                bv = bs_client.get_boot_volume(
                    boot_volume_id=bva.boot_volume_id).data  # type: ignore
                show(f"        - volume: {format_description(bv)}")

    def delete_with_resources(self, show_fn=None):
        """Delete compute instance along with block and data volumes."""
        show = show_fn or logging.info

        show(f"Terminating instance {self.display_name}")
        self._client.terminate_instance(
            instance_id=self.id, preserve_boot_volume=False, preserve_data_volumes_created_at_launch=False)

        while True:
            self.refresh()
            show(
                f"Waiting termination of instance {self.display_name} ({self.lifecycle_state})")
            if (
                self.lifecycle_state
                == oci.core.models.Instance.LIFECYCLE_STATE_TERMINATED
            ):
                break
            time.sleep(5)


class VCN:
    id: str
    _vcn: Optional[oci_models.Vcn]

    def __init__(self, config, ocid_or_vcn: str | oci_models.Vcn, client=None,
                 lazy_refresh=False) -> None:
        self._config = configuration.get_current_config(config=config)
        self._client = client or core.get_oci_virtual_network_client(
            config=self._config
        )

        if isinstance(ocid_or_vcn, oci_models.Vcn):
            self._vcn = ocid_or_vcn
            self.id = ocid_or_vcn.id  # type: ignore
        else:
            self.id = ocid_or_vcn
            self._vcn = None
            if not lazy_refresh:
                self.refresh()

    def __repr__(self):
        return repr(oci.util.to_dict(self.vcn))

    @property
    def vcn(self) -> oci_models.Vcn:
        if not self._vcn:
            self.refresh()
            assert self._vcn
        return self._vcn

    @property
    def compartment_id(self) -> str:
        return self.vcn.compartment_id  # type: ignore

    @property
    def lifecycle_state(self):
        return self.vcn.lifecycle_state

    @property
    def display_name(self):
        return self.vcn.display_name

    @property
    def freeform_tags(self) -> dict:
        return self.vcn.freeform_tags  # type: ignore

    @property
    def defined_tags(self) -> dict:
        return self.vcn.defined_tags  # type: ignore

    @property
    def default_route_table_id(self) -> str:
        return self.vcn.default_route_table_id  # type: ignore

    def refresh(self):
        self._vcn = self._client.get_vcn(vcn_id=self.id).data  # type: ignore

    def freeform_tag(self, tag: str = k_my_id_tag_name):
        return freeform_tag(self.vcn, tag)

    def get_all_route_tables(self) -> list[oci_models.RouteTable]:
        """Get all route tables in a compartment."""
        route_tables = oci.pagination.list_call_get_all_results(
            self._client.list_route_tables,
            compartment_id=self.compartment_id,
            vcn_id=self.id,
        ).data
        return route_tables

    def get_all_internet_gateways(self) -> list[oci_models.InternetGateway]:
        """Get all internet gateways in a compartment."""
        igws = oci.pagination.list_call_get_all_results(
            self._client.list_internet_gateways,
            compartment_id=self.compartment_id,
            vcn_id=self.id,
        ).data
        return igws

    def get_all_service_gateways(self) -> list[oci_models.ServiceGateway]:
        """Get all service gateways in a compartment."""
        sgws = oci.pagination.list_call_get_all_results(
            self._client.list_service_gateways,
            compartment_id=self.compartment_id,
            vcn_id=self.id,
        ).data
        return sgws

    def get_all_subnets(self) -> list[oci_models.Subnet]:
        """Get all subnets in a compartment."""
        subnets = oci.pagination.list_call_get_all_results(
            self._client.list_subnets,
            compartment_id=self.compartment_id,
            vcn_id=self.id,
        ).data
        return subnets

    def get_all_security_lists(self) -> list[oci_models.SecurityList]:
        """Get all security lists in a compartment."""
        security_lists = oci.pagination.list_call_get_all_results(
            self._client.list_security_lists,
            compartment_id=self.compartment_id,
            vcn_id=self.id,
        ).data
        return security_lists

    def get_all_network_security_groups(self) -> list[oci_models.NetworkSecurityGroup]:
        """Get all network security groups in a compartment."""
        nsgs = oci.pagination.list_call_get_all_results(
            self._client.list_network_security_groups,
            compartment_id=self.compartment_id,
            vcn_id=self.id,
        ).data
        return nsgs

    def get_all_network_security_group_vnics(self, nsg_id: str) -> list[oci_models.NetworkSecurityGroupVnic]:
        """Get all VNICs in a network security group."""
        vnics = oci.pagination.list_call_get_all_results(
            self._client.list_network_security_group_vnics,
            network_security_group_id=nsg_id,
        ).data
        return vnics

    def detach_vnic_nsgs(self, vnic_id: str, nsg_ids: list[str]):
        """Detaches given network security groups from the VNIC."""
        # get the VNIC
        vnic: oci_models.Vnic = self._client.get_vnic(
            vnic_id=vnic_id
        ).data  # type: ignore

        # remove given NSGs from the list of VNIC's NSGs
        updated_nsg_ids = set(
            cast(list[str], vnic.nsg_ids)
        ).difference(nsg_ids)

        # update the VNIC
        details = oci_models.UpdateVnicDetails(
            nsg_ids=list(updated_nsg_ids)
        )
        self._client.update_vnic(vnic_id=vnic_id, update_vnic_details=details)

    def find_internet_gateway_by_name(
        self, name: str
    ) -> list[oci_models.InternetGateway]:
        return oci.pagination.list_call_get_all_results(
            self._client.list_internet_gateways,
            compartment_id=self.compartment_id,
            vcn_id=self.id,
            display_name=name,
        ).data

    def find_service_gateway_by_name(
        self, name: str
    ) -> list[oci_models.ServiceGateway]:
        return [svc for svc in oci.pagination.list_call_get_all_results(
            self._client.list_service_gateways,
            compartment_id=self.compartment_id,
            vcn_id=self.id,
        ).data if svc.display_name == name]

    def find_subnet_by_name(self, name: str) -> list[oci_models.Subnet]:
        return oci.pagination.list_call_get_all_results(
            self._client.list_subnets,
            compartment_id=self.compartment_id,
            vcn_id=self.id,
            display_name=name,
        ).data

    def try_get_security_list_by_name(self, name: str) -> Optional[oci_models.SecurityList]:
        matches = oci.pagination.list_call_get_all_results(
            self._client.list_security_lists,
            compartment_id=self.compartment_id,
            vcn_id=self.id,
            display_name=name,
        ).data
        # security list names are unique within a compartment
        assert len(matches) <= 1, matches
        if matches:
            return matches[0]
        return None

    def add_route_rules(self, route_table_id: str, rules: list[oci_models.RouteRule]):
        route_table = cast(oci_models.RouteTable,
                           self._client.get_route_table(
                               route_table_id).data)  # type: ignore
        existing_rules = cast(list, route_table.route_rules)

        logging.info(f"Adding rules {rules} to route table {route_table_id}")

        update_route_table_details = oci_models.UpdateRouteTableDetails(
            route_rules=existing_rules + rules
        )
        self._client.update_route_table(
            self.vcn.default_route_table_id, update_route_table_details
        )

    @log
    def create_internet_gateway(
        self,
        route_table_id: str,
        name: str,
        freeform_tags: dict
    ) -> oci_models.InternetGateway:
        create_igw_details = oci_models.CreateInternetGatewayDetails(
            compartment_id=self.compartment_id,
            is_enabled=True,
            vcn_id=self.id,
            display_name=name,
            freeform_tags=freeform_tags,
        )
        igw = self._client.create_internet_gateway(
            create_igw_details).data  # type: ignore

        # Update the default route table for the VCN to include a route to the IGW
        self.add_route_rules(route_table_id, [
            oci_models.RouteRule(destination="0.0.0.0/0",
                                 destination_type="CIDR_BLOCK",
                                 network_entity_id=igw.id)
        ])

        return igw

    @log
    def create_service_gateway(
        self,
        route_table_id: str,
        name: str,
        freeform_tags: dict,
    ) -> oci_models.InternetGateway:
        services = self._client.list_services().data  # type: ignore

        services = [
            svc for svc in services if svc.name.endswith("Object Storage")]

        logging.info(
            f"Creating service gateway {name} for services: {services}")

        create_sgw_details = oci_models.CreateServiceGatewayDetails(
            compartment_id=self.compartment_id,
            vcn_id=self.id,
            display_name=name,
            freeform_tags=freeform_tags,
            services=[
                oci_models.ServiceIdRequestDetails(
                    service_id=svc.id) for svc in services
            ]
        )
        sgw = self._client.create_service_gateway(
            create_sgw_details).data  # type: ignore

        # Update the default route table for the VCN to include a route to the SGW
        self.add_route_rules(route_table_id, [
            oci_models.RouteRule(destination=svc.cidr_block,
                                 destination_type="SERVICE_CIDR_BLOCK",
                                 network_entity_id=sgw.id) for svc in services
        ])

        return sgw

    def _filter_security_lists_for_subnet(
        self, security_lists: list[oci_models.SecurityList], subnet_id: str
    ) -> list[oci_models.SecurityList]:
        subnet = self._client.get_subnet(
            subnet_id=subnet_id).data  # type: ignore

        matches = []
        for sl in security_lists:
            if sl.id in subnet.security_list_ids:
                matches.append(sl)

        return matches

    def _match_ingress(self,
                       rule: oci_models.IngressSecurityRule,
                       port: int,
                       source: str):
        """
        Check if the given ingress rule matches (TCP) port and source
        """
        if (
            rule.tcp_options is not None
            and (
                rule.tcp_options.destination_port_range is not None
                and port >= rule.tcp_options.destination_port_range.min
                and port <= rule.tcp_options.destination_port_range.max
            )
            and rule.protocol == "6"
            and not rule.is_stateless
            and rule.source == source  # TODO do a cidr match
        ):
            return True
        return False

    def _match_egress(self,
                      rule: oci_models.EgressSecurityRule,
                      port: int,
                      dest: str):
        """
        Check if the given egress rule matches (TCP) port and dest
        """
        if (
            rule.tcp_options is not None
            and (
                rule.tcp_options.destination_port_range is not None
                and port >= rule.tcp_options.destination_port_range.min
                and port <= rule.tcp_options.destination_port_range.max
            )
            and rule.protocol == "6"
            and not rule.is_stateless
            and rule.destination == dest  # TODO do a cidr match
        ):
            return True
        return False

    def verify_security_list(self,
                             subnet_id: str,
                             ingress: list[tuple[str, int, str]] = [],
                             egress: list[tuple[str, int, str]] = []):
        security_lists = self.get_all_security_lists()

        # First check if there's an ingress rule for the subnet already
        subnet_security_lists = self._filter_security_lists_for_subnet(
            security_lists=security_lists, subnet_id=subnet_id
        )
        return
        matches = self._filter_security_lists_for_port_ingress(
            security_lists=subnet_security_lists,
            port=1,
            sources=["0.0.0.0/0"],
        )
        if matches:
            for sl in matches:
                logging.debug(
                    f"security_list={sl.display_name} id={sl.id} of subnet={subnet_id} already has ingress for port={destination_port} source={source}"
                )
            return None

    @log
    def add_security_list(
        self,
        subnet_id: str,
        security_list_name: str,
        freeform_tags: dict,
        ingress: list[tuple[str, int, str]],  # source_cidr, port, description
        egress: list[tuple[str, int, str]],  # dest_cidr, port, description
    ) -> Optional[str]:
        """
        Add a security list "owned" by us, to which we can add and remove rules.
        If a previously created one is found, we modify that instead.

        Note: This method is only intended for cases where we control the VCN.
        Cases where the user controls the VCN should never reach here.
        """

        def make_ingress_rule(source_cidr: str, port: int, description: str):
            return oci_models.IngressSecurityRule(
                protocol="6",  # TCP
                source=source_cidr,
                tcp_options=oci_models.TcpOptions(
                    destination_port_range=oci_models.PortRange(
                        min=port, max=port
                    )
                ),
                description=description,
            )

        def make_egress_rule(dest_cidr: str, port: int, description: str):
            return oci_models.EgressSecurityRule(
                protocol="6",  # TCP
                destination=dest_cidr,
                tcp_options=oci_models.TcpOptions(
                    destination_port_range=oci_models.PortRange(
                        min=port, max=port
                    )
                ),
                description=description,
            )

        # First find a security list owned by us with the given name
        security_list = self.try_get_security_list_by_name(security_list_name)
        if security_list:
            logging.info(
                f"VCN {self.display_name} already has security list {security_list_name}")

            # add missing rules
            new_ingress_rules = []
            for source, port, description in ingress:
                for rule in security_list.ingress_security_rules:  # type: ignore
                    if self._match_ingress(rule, source=source, port=port):
                        logging.info(
                            f"security list {security_list_name} already has ingress for source={source} port={port}")
                        break
                else:
                    logging.info(
                        f"adding ingress for source={source} port={port} to security list {security_list_name}")
                    new_ingress_rules.append(
                        make_ingress_rule(source, port, description))

            new_egress_rules = []
            for dest, port, description in egress:
                for rule in security_list.egress_security_rules:  # type: ignore
                    if self._match_egress(rule, dest=dest, port=port):
                        logging.info(
                            f"security list {security_list_name} already has egress for dest={dest} port={port}")
                        break
                else:
                    logging.info(
                        f"adding egress for dest={dest} port={port} to security list {security_list_name}")
                    new_egress_rules.append(
                        make_egress_rule(dest, port, description))

            if new_ingress_rules or new_egress_rules:
                update_security_list_details = oci.core.models.UpdateSecurityListDetails(
                    ingress_security_rules=security_list.ingress_security_rules +  # type: ignore
                    new_ingress_rules,
                    egress_security_rules=security_list.egress_security_rules +  # type: ignore
                    new_egress_rules
                )
                self._client.update_security_list(
                    security_list.id,
                    update_security_list_details
                )
        else:
            # Security list by the name does not exist, create one
            logging.info(
                f"VCN {self.display_name} does not have security list {security_list_name}, creating...")

            # create new Security list for the VCN
            create_security_list_details = oci_models.CreateSecurityListDetails(
                compartment_id=self.compartment_id,
                vcn_id=self.id,
                display_name=security_list_name,
                freeform_tags=freeform_tags,
                ingress_security_rules=[
                    make_ingress_rule(*r) for r in ingress
                ],
                egress_security_rules=[
                    make_egress_rule(*r) for r in egress
                ],
            )
            security_list = self._client.create_security_list(
                create_security_list_details
            ).data  # type: ignore

            logging.info(
                f"created new security_list={security_list_name} id={security_list.id}"
            )

        # Update the subnet to add the security list (if not there yet)
        subnet = self._client.get_subnet(
            subnet_id=subnet_id).data  # type: ignore

        if security_list.id not in subnet.security_list_ids:
            logging.info(
                f"adding security_list={security_list.display_name} to subnet={subnet_id}")

            update_subnet_details = oci_models.UpdateSubnetDetails(
                security_list_ids=subnet.security_list_ids + [security_list.id]
            )
            self._client.update_subnet(subnet_id, update_subnet_details)

        return security_list.id

    @log
    def create_subnet(
        self,
        name: str,
        cidr_block: str,
        freeform_tags: dict,
        private: bool,
        dns_label: Optional[str] = None,
    ):
        subnet_details = oci_models.CreateSubnetDetails(
            cidr_block=cidr_block,
            compartment_id=self.compartment_id,
            vcn_id=self.id,
            display_name=name,
            freeform_tags=freeform_tags,
            dns_label=dns_label,
            prohibit_internet_ingress=True if private else False,
            prohibit_public_ip_on_vnic=True if private else False,
        )
        return self._client.create_subnet(subnet_details).data  # type: ignore

    def get_subnet(self, subnet_id: str) -> oci_models.Subnet:
        return self._client.get_subnet(
            subnet_id=subnet_id).data        # type: ignore

    @log
    def delete_route_table(self, route_table_id: str):
        """Delete a route table."""
        logging.info(f"Deleting route table {route_table_id}")
        self._client.delete_route_table(rt_id=route_table_id)

    @log
    def delete_route_table_rules(self, route_table_id: str):
        """Delete rules in route table."""
        logging.info(f"Deleting rules from route table {route_table_id}")
        update_route_table_details = oci_models.UpdateRouteTableDetails(
            route_rules=[])
        self._client.update_route_table(
            rt_id=route_table_id,
            update_route_table_details=update_route_table_details,
        )

    @log
    def delete_security_list(self, security_list_id: str):
        """Delete security list."""
        logging.info(f"Deleting security list {security_list_id}")
        self._client.delete_security_list(security_list_id=security_list_id)

    @log
    def delete_network_security_group(self, nsg_id: str):
        """Delete network security group."""
        logging.info(f"Deleting network security group {nsg_id}")
        self._client.delete_network_security_group(
            network_security_group_id=nsg_id
        )

    @log
    def delete_internet_gateway(self, igw_id: str):
        """Delete an internet gateway."""
        logging.info(f"Deleting internet gateway {igw_id}")
        self._client.delete_internet_gateway(ig_id=igw_id)

    @log
    def delete_service_gateway(self, sgw_id: str):
        """Delete a service gateway."""
        logging.info(f"Deleting service gateway {sgw_id}")
        self._client.delete_service_gateway(service_gateway_id=sgw_id)

    @log
    def delete_subnet(self, subnet_id: str):
        """Delete a subnet."""
        logging.info(f"Deleting subnet {subnet_id}")
        self._client.delete_subnet(subnet_id=subnet_id)

    @log
    def detach_subnet_security_lists(self, subnet):
        logging.info(
            f"Detaching security lists from subnet {subnet.display_name}")

        # we keep just the default security list
        update_subnet_details = oci.core.models.UpdateSubnetDetails(
            security_list_ids=[self.vcn.default_security_list_id])
        self._client.update_subnet(
            subnet_id=subnet.id, update_subnet_details=update_subnet_details)

    def print_all_resources(self, show_fn=None) -> None:
        """Print the resources of a VCN."""
        show = show_fn or logging.info

        show(f"    - {format_description(self)}:")

        # Print subnets
        subnets = self.get_all_subnets()
        if subnets:
            show("      Subnets:")
            for subnet in subnets:
                show(f"        - {format_description(subnet)}")

        # Print internet gateways
        igws = self.get_all_internet_gateways()
        if igws:
            show("      Internet Gateways:")
            for igw in igws:
                show(f"        - {format_description(igw)}")

        # Print service gateways
        sgws = self.get_all_service_gateways()
        if sgws:
            show("      Service Gateways:")
            for sgw in sgws:
                show(f"        - {format_description(sgw)}")

        # Print route tables
        route_tables = self.get_all_route_tables()
        if route_tables:
            show("      Route Tables:")
            for rt in route_tables:
                rules = [(r.description, r.network_entity_id)
                         for r in rt.route_rules]  # type: ignore
                show(f"        - {format_description(rt)} rules={rules}")

        # Print security lists
        security_lists = self.get_all_security_lists()
        if security_lists:
            show("      Security Lists:")
            for sl in security_lists:
                show(f"        - {format_description(sl)}")

        # Print network security groups
        nsgs = self.get_all_network_security_groups()
        if nsgs:
            show("      Network Security Groups:")
            for nsg in nsgs:
                vnics = self.get_all_network_security_group_vnics(
                    cast(str, nsg.id)
                )
                vnics = [vnic.vnic_id for vnic in vnics]
                show(f"        - {format_description(nsg)} vnics={vnics}")

    def delete_recursive(self):
        """Delete all associated resources of a VCN."""

        # Delete route tables (except the default one)
        route_tables = self.get_all_route_tables()
        for rt in route_tables:
            self.delete_route_table_rules(rt.id)  # type: ignore
            if rt.id != self.vcn.default_route_table_id:
                self.delete_route_table(rt.id)  # type: ignore

        # Delete subnet references to security lists
        subnets = self.get_all_subnets()
        for subnet in subnets:
            self.detach_subnet_security_lists(subnet)

        # Delete security lists
        security_lists = self.get_all_security_lists()
        for security_list in security_lists:
            if security_list.id != self.vcn.default_security_list_id:
                self.delete_security_list(security_list.id)  # type: ignore

        # List network security groups (NSGs)
        nsgs = self.get_all_network_security_groups()
        nsg_ids = [cast(str, nsg.id) for nsg in nsgs]

        # List all VNICs in all NSGs
        vnic_ids: list[str] = []
        for nsg in nsg_ids:
            vnics = self.get_all_network_security_group_vnics(nsg)
            for vnic in vnics:
                vnic_ids.append(cast(str, vnic.vnic_id))

        # Detach all NSGs from VNICs
        for vnic in set(vnic_ids):
            self.detach_vnic_nsgs(vnic, nsg_ids)

        # Delete NSGs
        for nsg in nsg_ids:
            self.delete_network_security_group(nsg)

        # Delete internet gateways
        igws = self.get_all_internet_gateways()
        for igw in igws:
            self.delete_internet_gateway(igw.id)  # type: ignore

        # Delete service gateways
        sgws = self.get_all_service_gateways()
        for sgw in sgws:
            self.delete_service_gateway(cast(str, sgw.id))

        # Delete subnets
        for subnet in subnets:
            self.delete_subnet(subnet.id)  # type: ignore


class Channel:
    channel: oci.mysql.models.Channel

    def __init__(self, config, ocid_or_channel: str | oci.mysql.models.Channel, client=None
                 ) -> None:
        self._config = configuration.get_current_config(config=config)
        self._client = client or core.get_oci_mysql_channels_client(
            config=self._config)

        if isinstance(ocid_or_channel, str):
            self.id = ocid_or_channel
            self.channel = self._client.get_channel(
                ocid_or_channel).data  # type: ignore
        else:
            self.channel = ocid_or_channel
            self.id = cast(str, ocid_or_channel.id)

    def __repr__(self):
        return repr(oci.util.to_dict(self.channel))

    def refresh(self):
        self.channel = self._client.get_channel(self.id).data  # type: ignore

    def resume(self):
        response = self._client.resume_channel(self.id)
        self.channel = response.data  # type: ignore

    def update(self, is_enabled: Optional[bool] = None):
        pass

    @property
    def display_name(self) -> str:
        return cast(str, self.channel.display_name)

    @property
    def lifecycle_state(self) -> str:
        return cast(str, self.channel.lifecycle_state)

    @property
    def lifecycle_details(self) -> str:
        return cast(str, self.channel.lifecycle_details)


class MySQLConfiguration:
    id: str
    conf: oci.mysql.models.Configuration

    def __init__(
        self, config, ocid_or_config: str | oci.mysql.models.Configuration, client=None
    ) -> None:
        self._config = configuration.get_current_config(config=config)
        self._client = client or core.get_oci_mds_client(
            config=self._config)

        if isinstance(ocid_or_config, str):
            self.id = ocid_or_config
            self.conf = self._client.get_configuration(
                ocid_or_config).data  # type: ignore
        else:
            self.conf = ocid_or_config
            self.id = ocid_or_config.id  # type: ignore

    @property
    def lower_case_table_names(self):
        return self.conf.lower_case_table_names  # type: ignore

    @property
    def type(self):
        return self.conf.type

    @property
    def variables(self) -> oci.mysql.models.ConfigurationVariables:
        return self.conf.variables  # type: ignore

    @property
    def lifecycle_state(self) -> str:
        return self.conf.lifecycle_state  # type: ignore

    @property
    def display_name(self) -> str:
        return self.conf.display_name  # type: ignore

    def freeform_tag(self, tag: str = k_my_id_tag_name):
        return freeform_tag(self.conf, tag)

    def delete_configuration(self):
        """Deletes this configuration"""
        self._client.delete_configuration(configuration_id=self.id)


class DBSystem:
    id: str
    db_system: oci.mysql.models.DbSystem

    def __init__(
        self, config, ocid_or_db_system: str | oci.mysql.models.DbSystem, client=None
    ) -> None:
        self._config = configuration.get_current_config(config=config)
        self._client = client or core.get_oci_db_system_client(
            config=self._config)
        self._channel_client = core.get_oci_mysql_channels_client(
            config=self._config)
        self._backups_client = core.get_oci_db_backups_client(
            config=self._config)

        if isinstance(ocid_or_db_system, str):
            self.id = ocid_or_db_system
            self.db_system = self._client.get_db_system(
                ocid_or_db_system).data  # type: ignore
        else:
            self.db_system = ocid_or_db_system
            self.id = ocid_or_db_system.id  # type: ignore

    def __repr__(self):
        return repr(oci.util.to_dict(self.db_system))

    def refresh(self):
        self.db_system = self._client.get_db_system(
            self.id).data  # type: ignore

    @property
    def lifecycle_state(self):
        return self.db_system.lifecycle_state

    @property
    def lifecycle_details(self):
        return self.db_system.lifecycle_details

    @property
    def display_name(self) -> str:
        return self.db_system.display_name  # type: ignore

    @property
    def mysql_version(self):
        return self.db_system.mysql_version

    @property
    def is_heat_wave_cluster_attached(self) -> bool:
        return cast(bool, self.db_system.is_heat_wave_cluster_attached)

    @property
    def is_highly_available(self) -> bool:
        return cast(bool, self.db_system.is_highly_available)

    @property
    def crash_recovery(self) -> bool:
        return cast(bool, self.db_system.crash_recovery)

    @property
    def endpoint(self) -> Optional[oci.mysql.models.DbSystemEndpoint]:
        for ep in cast(
            list[oci.mysql.models.DbSystemEndpoint], self.db_system.endpoints
        ):
            if (
                ep.resource_type
                == oci.mysql.models.DbSystemEndpoint.RESOURCE_TYPE_DBSYSTEM
            ):
                return ep
        return None

    @property
    def configuration(self) -> MySQLConfiguration:
        return MySQLConfiguration(
            self._config, self.db_system.configuration_id)  # type: ignore

    def freeform_tag(self, tag: str = k_my_id_tag_name):
        return freeform_tag(self.db_system, tag)

    def _update_db_system(self, details: oci.mysql.models.UpdateDbSystemDetails) -> Optional[MySQLWorkRequest]:
        response: oci.response.Response = self._client.update_db_system(
            db_system_id=self.id, update_db_system_details=details
        )  # type: ignore

        try:
            return MySQLWorkRequest(self._config, response.headers[k_work_request_header])
        except Exception as e:
            # for some reason OCI returns 404 errors in case of some update requests
            return None

    def update_crash_recovery(self, enable: bool) -> Optional[MySQLWorkRequest]:
        if enable:
            crash_recovery = oci.mysql.models.UpdateDbSystemDetails.CRASH_RECOVERY_ENABLED
        else:
            crash_recovery = oci.mysql.models.UpdateDbSystemDetails.CRASH_RECOVERY_DISABLED
        details = oci.mysql.models.UpdateDbSystemDetails(
            crash_recovery=crash_recovery,
        )
        return self._update_db_system(details)

    def update_access_mode(self, restricted: bool) -> Optional[MySQLWorkRequest]:
        if restricted:
            access_mode = "RESTRICTED"
        else:
            access_mode = "UNRESTRICTED"
        details = oci.mysql.models.UpdateDbSystemDetails(
            access_mode=access_mode)
        return self._update_db_system(details)

    def update_high_availability(self, enabled: bool) -> Optional[MySQLWorkRequest]:
        details = oci.mysql.models.UpdateDbSystemDetails(
            is_highly_available=enabled
        )

        return self._update_db_system(details)

    def create_channel(self,
                       source_host: str,
                       source_port: int,
                       source_user: str,
                       source_password: str,
                       gtid_off_handling: Optional[dict] = None,
                       freeform_tags: dict = {},
                       replicate_ignore_db: list[str] = [],
                       replicate_ignore_table: list[str] = [],
                       replicate_wild_ignore_table: list[str] = [],
                       ) -> Channel:
        if gtid_off_handling:
            uuid_handling = oci.mysql.models.AssignManualUuidHandling(
                policy="ASSIGN_MANUAL_UUID",
                last_configured_log_filename=gtid_off_handling["binlog_file"],
                last_configured_log_offset=gtid_off_handling["binlog_pos"],
                uuid=gtid_off_handling["uuid"])
        else:
            uuid_handling = None

        source = oci.mysql.models.CreateChannelSourceFromMysqlDetails(
            source_type="MYSQL",
            hostname=source_host,
            port=source_port,
            username=source_user,
            password=source_password,
            ssl_mode="REQUIRED",
            anonymous_transactions_handling=uuid_handling
        )

        filters = []

        for db in replicate_ignore_db:
            filters.append(oci.mysql.models.ChannelFilter(
                type=oci.mysql.models.ChannelFilter.TYPE_REPLICATE_IGNORE_DB,
                value=db
            ))

        for table in replicate_ignore_table:
            filters.append(oci.mysql.models.ChannelFilter(
                type=oci.mysql.models.ChannelFilter.TYPE_REPLICATE_IGNORE_TABLE,
                value=table
            ))

        for table in replicate_wild_ignore_table:
            filters.append(oci.mysql.models.ChannelFilter(
                type=oci.mysql.models.ChannelFilter.TYPE_REPLICATE_WILD_IGNORE_TABLE,
                value=table
            ))

        target = oci.mysql.models.CreateChannelTargetFromDbSystemDetails(
            target_type="DBSYSTEM",
            db_system_id=self.id,
            tables_without_primary_key_handling="ALLOW",
            filters=filters or None,
        )

        # Create channel details
        channel_details = oci.mysql.models.CreateChannelDetails(
            compartment_id=self.db_system.compartment_id,
            display_name="migration-inbound-replication",
            source=source,
            target=target,
            freeform_tags=freeform_tags,
        )

        logging.info(
            f"CreateChannel: {util.sanitize_dict_any_pass(cast(dict, oci.util.to_dict(channel_details)))}")

        # Create the channel
        response = self._channel_client.create_channel(channel_details)
        channel = response.data  # type: ignore

        return Channel(config=self._config,
                       ocid_or_channel=channel,
                       client=self._channel_client)

    def delete_channel(self, channel_id: str):
        response: oci.response.Response = self._channel_client.delete_channel(
            channel_id=channel_id)  # type: ignore
        return MySQLWorkRequest(self._config, response.headers[k_work_request_header])

    def try_get_channel(self) -> Optional[Channel]:
        channels = self._channel_client.list_channels(
            compartment_id=self.db_system.compartment_id,
            db_system_id=self.id).data  # type: ignore

        channels = [ch for ch in channels if ch.lifecycle_state not in (
            "DELETING", "DELETED")]

        # supposedly only 1 channel per DBSystem
        assert len(channels) <= 1
        if not channels:
            return None
        return Channel(config=self._config,
                       ocid_or_channel=channels[0],
                       client=self._channel_client)

    def get_all_backups(self) -> list[oci.mysql.models.BackupSummary]:
        """Get all backups of this DB instance."""
        return oci.pagination.list_call_get_all_results(
            self._backups_client.list_backups, compartment_id=self.db_system.compartment_id, db_system_id=self.id
        ).data

    def delete_backup(self, ocid: str) -> MySQLWorkRequest:
        """Deletes backup with the given OCID"""
        response: oci.response.Response = self._backups_client.delete_backup(
            backup_id=ocid)  # type: ignore
        return MySQLWorkRequest(self._config, response.headers[k_work_request_header])

    def delete_db_system(self) -> MySQLWorkRequest:
        """Deletes this DB system"""
        response: oci.response.Response = self._client.delete_db_system(
            db_system_id=self.id)  # type: ignore
        return MySQLWorkRequest(self._config, response.headers[k_work_request_header])

    def add_heatwave_cluster(self, shape_name: str, cluster_size: int, is_lakehouse_enabled: bool = False):
        add_heatwave_cluster_details = oci.mysql.models.AddHeatWaveClusterDetails()
        add_heatwave_cluster_details.shape_name = shape_name
        add_heatwave_cluster_details.cluster_size = cluster_size
        add_heatwave_cluster_details.is_lakehouse_enabled = is_lakehouse_enabled

        response: oci.response.Response = self._client.add_heat_wave_cluster(
            db_system_id=self.id, add_heat_wave_cluster_details=add_heatwave_cluster_details)  # type: ignore

        return MySQLWorkRequest(self._config, response.headers[k_work_request_header])

    def print_all_resources(self, show_fn=None):
        show = show_fn or logging.info

        show(f"    - {format_description(self)}:")
        show(
            f"      Configuration: {format_description(self.configuration)}")

        channel = self.try_get_channel()
        if channel:
            show(f"      Channels:")
            show(f"        - {format_description(channel)}")

        backups = self.get_all_backups()
        if backups:
            show(f"      Backups:")
            for backup in backups:
                show(f"        - {format_description(backup)}")

    def delete_with_resources(self, show_fn=None):
        """Delete DB instance along with all its resources."""
        show = show_fn or logging.info
        work_requests: list[MySQLWorkRequest] = []

        show(f"Deleting DB instance {self.display_name}")
        work_requests.append(self.delete_db_system())

        backups = self.get_all_backups()
        if backups:
            show(f"Deleting backups of {self.display_name}")
            for backup in backups:
                work_requests.append(self.delete_backup(cast(str, backup.id)))

        wait_for_work_requests(
            work_requests, "deleting DB instance", show_fn=show)


class Compartment:
    id: str
    _obj: oci.identity.models.Compartment
    _namespace: str = ""
    _full_path: list[str] = []

    def __init__(
        self,
        config,
        ocid_or_compartment: None | str | oci.identity.models.Compartment = None,
        client: None | oci.identity.IdentityClient = None,
        retry_strategy=None,
        lazy_refresh: bool = False
    ) -> None:
        self._config = configuration.get_current_config(config=config)
        self._client = client or core.get_oci_identity_client(
            config=self._config)
        self._net_client = core.get_oci_virtual_network_client(
            config=self._config)
        self._compute_client = core.get_oci_compute_client(config=self._config)
        self._dbs_client = core.get_oci_db_system_client(config=self._config)
        self._mds_client = core.get_oci_mds_client(config=self._config)
        self._os_client = core.get_oci_object_storage_client(
            config=self._config)

        self._obj = None  # type: ignore

        # Note: get_compartment() doesn't always work on a tenancy_id (seems to depend on the tenancy)
        if ocid_or_compartment is None:
            self.id = self._config["tenancy"]
        elif isinstance(ocid_or_compartment, str):
            self.id = ocid_or_compartment
        else:
            self._obj = ocid_or_compartment  # type: ignore
            self.id = ocid_or_compartment.id  # type: ignore

        self._is_tenancy = self.id == self._config["tenancy"]

        if not self._obj and (retry_strategy or not lazy_refresh):
            self.refresh(retry_strategy)

    def __repr__(self) -> str:
        return repr(oci.util.to_dict(self.obj))

    def refresh(self, retry_strategy=None):
        if self._is_tenancy:
            self._obj = self._client.get_tenancy(
                self.id,
                retry_strategy=retry_strategy
            ).data  # type: ignore
        else:
            self._obj = self._client.get_compartment(
                self.id,
                retry_strategy=retry_strategy
            ).data  # type: ignore

    @property
    def obj(self) -> oci.identity.models.Compartment:
        if not self._obj:
            self.refresh()
        return self._obj

    @property
    def name(self) -> str:
        return cast(str, self.obj.name)

    @property
    def display_name(self) -> str:
        return self.name

    def freeform_tag(self, tag: str = k_my_id_tag_name):
        return freeform_tag(self.obj, tag)

    @property
    def full_path(self) -> list[str]:
        if not self._full_path:
            self._full_path = self.get_full_path()
        return self._full_path

    @property
    def namespace(self) -> str:
        if not self._namespace:
            self._namespace = self._os_client.get_namespace().data  # type: ignore
        return self._namespace

    @classmethod
    def find_by_name(
        cls, config, parent_compartment_id: str, name: str
    ) -> list["Compartment"]:
        config = configuration.get_current_config(config=config)
        client = core.get_oci_identity_client(config=config)

        return [
            Compartment(config, ocid_or_compartment=c, client=client)
            for c in oci.pagination.list_call_get_all_results(
                client.list_compartments,
                compartment_id=parent_compartment_id,
                name=name,
            ).data
            if c.lifecycle_state
            not in [
                oci.identity.models.Compartment.LIFECYCLE_STATE_DELETING,
                oci.identity.models.Compartment.LIFECYCLE_STATE_DELETED,
            ]
        ]

    @classmethod
    @log
    def create(
        cls,
        config,
        name: str,
        description: str,
        parent_compartment_id: str,
        freeform_tags: dict,
    ) -> "Compartment":
        config = configuration.get_current_config(config=config)
        client = core.get_oci_identity_client(config=config)

        compartment_details = oci.identity.models.CreateCompartmentDetails(
            compartment_id=parent_compartment_id,
            name=name,
            description=description,
            freeform_tags=freeform_tags,
        )

        # Create the compartment
        compartment = client.create_compartment(
            compartment_details).data  # type: ignore

        # the compartment has been created, retry on 404 errors, as it takes
        # some time for the OCI to propagate the new compartment
        MIGRATION_RETRY_STRATEGY.retry_on_not_found_errors()

        return Compartment(config, ocid_or_compartment=compartment, client=client)

    def get_full_path(self) -> list[str]:
        names = []
        tenancy_id = self._config["tenancy"]
        compartment_id = self.id
        while True:
            if compartment_id == self._config["tenancy"]:
                compartment = self._client.get_tenancy(
                    tenancy_id).data  # type: ignore
                names.append(compartment.name)
                break
            else:
                compartment = self._client.get_compartment(
                    compartment_id).data  # type: ignore
                names.append(compartment.name)
                compartment_id = compartment.compartment_id  # Move to parent
        return list(reversed(names))

    def get_all_compartments(self) -> list["Compartment"]:
        return [
            Compartment(
                config=self._config, ocid_or_compartment=i, client=self._client
            )
            for i in oci.pagination.list_call_get_all_results(
                self._client.list_compartments, compartment_id=self.id
            ).data if i.lifecycle_state not in (
                oci.identity.models.Compartment.LIFECYCLE_STATE_DELETED,
                oci.identity.models.Compartment.LIFECYCLE_STATE_DELETING,
            )
        ]

    def get_all_instances(self) -> list[ComputeInstance]:
        return [
            ComputeInstance(
                config=self._config, ocid_or_instance=i, client=self._compute_client
            )
            for i in oci.pagination.list_call_get_all_results(
                self._compute_client.list_instances, compartment_id=self.id
            ).data
            if i.lifecycle_state
            not in (
                oci_models.Instance.LIFECYCLE_STATE_TERMINATED,
                oci_models.Instance.LIFECYCLE_STATE_TERMINATING,
            )
        ]

    def get_vnic_attachments(self, instance_id) -> list[oci_models.VnicAttachment]:
        vnic_attachments = [
            va
            for va in oci.pagination.list_call_get_all_results(
                self._compute_client.list_vnic_attachments,
                compartment_id=self.id, instance_id=instance_id,
            ).data
            if va.lifecycle_state
            not in (
                oci_models.VnicAttachment.LIFECYCLE_STATE_DETACHING,
                oci_models.VnicAttachment.LIFECYCLE_STATE_DETACHED,
            )
        ]
        return vnic_attachments

    def get_subnet(self, subnet_id) -> oci_models.Subnet:
        subnet = self._net_client.get_subnet(subnet_id=subnet_id)
        return subnet.data  # type: ignore

    def get_all_db_systems(self) -> list[DBSystem]:
        return [
            DBSystem(
                config=self._config, ocid_or_db_system=dbs.id, client=self._dbs_client
            )
            for dbs in oci.pagination.list_call_get_all_results(
                self._dbs_client.list_db_systems, compartment_id=self.id
            ).data
            if dbs.lifecycle_state
            not in (
                oci.mysql.models.DbSystem.LIFECYCLE_STATE_DELETING,
                oci.mysql.models.DbSystem.LIFECYCLE_STATE_DELETED,
            )
        ]

    def get_all_vcns(self) -> list[VCN]:
        """Get all VCNs in a compartment."""
        vcns = oci.pagination.list_call_get_all_results(
            self._net_client.list_vcns, compartment_id=self.id
        ).data
        return [
            VCN(self._config, ocid_or_vcn=v, client=self._net_client)
            for v in vcns
            if v.lifecycle_state
            not in [
                oci.core.models.Vcn.LIFECYCLE_STATE_TERMINATING,
                oci.core.models.Vcn.LIFECYCLE_STATE_TERMINATED,
            ]
        ]

    def get_all_subnet_vnics(self, subnet_id: str) -> list[dict]:
        """
        Get all non-deleted VNICs in the subnet as a list of
        {"id", "private_ip", "public_ip", "hostname"}
        """
        private_ips = oci.pagination.list_call_get_all_results(
            self._net_client.list_private_ips,
            subnet_id=subnet_id,
        ).data

        Vnic = oci.core.models.Vnic

        result = []
        for private_ip in private_ips:
            vnic = self._net_client.get_vnic(
                vnic_id=private_ip.vnic_id).data  # type: ignore
            if vnic.lifecycle_state not in (
                Vnic.LIFECYCLE_STATE_AVAILABLE,
                Vnic.LIFECYCLE_STATE_PROVISIONING,
            ):
                continue

            result.append(
                {
                    "id": vnic.id,
                    "private_ip": vnic.private_ip,
                    "public_ip": vnic.public_ip,
                    "hostname": vnic.hostname_label,
                }
            )
        return result

    def get_all_pars(
        self, bucket_name: str
    ) -> list[oci.object_storage.models.PreauthenticatedRequestSummary]:
        """Get all PARs for a bucket in a compartment."""
        return oci.pagination.list_call_get_all_results(
            self._os_client.list_preauthenticated_requests,
            namespace_name=self.namespace,
            bucket_name=bucket_name,
        ).data

    def get_all_bucket_names(self) -> list[str]:
        """Get names of all objectstorage buckets in a compartment."""
        return [
            b.name
            for b in oci.pagination.list_call_get_all_results(
                self._os_client.list_buckets,
                compartment_id=self.id,
                namespace_name=self.namespace,
            ).data
        ]

    def get_all_buckets(self) -> list[oci.object_storage.models.Bucket]:
        """Get all objectstorage buckets in a compartment."""
        return oci.pagination.list_call_get_all_results(
            self._os_client.list_buckets,
            compartment_id=self.id,
            namespace_name=self.namespace,
        ).data

    def get_all_object_names(self, bucket_name: str) -> list[str]:
        """Get names of all objects for a bucket in a compartment."""
        return [
            o.name
            for o in oci.pagination.list_call_get_all_results(
                self._os_client.list_objects,
                namespace_name=self.namespace,
                bucket_name=bucket_name,
            ).data.objects
        ]

    def get_all_multipart_uploads(
        self, bucket_name: str
    ) -> list[oci.object_storage.models.MultipartUpload]:
        """Get all multipart uploads for a bucket in a compartment."""
        return oci.pagination.list_call_get_all_results(
            self._os_client.list_multipart_uploads,
            namespace_name=self.namespace,
            bucket_name=bucket_name,
        ).data

    def find_vcn_by_name(self, name: str) -> list[VCN]:
        return [
            VCN(self._config, ocid_or_vcn=v, client=self._net_client)
            for v in oci.pagination.list_call_get_all_results(
                self._net_client.list_vcns, compartment_id=self.id, display_name=name
            ).data
            if v.lifecycle_state
            not in [
                oci.core.models.Vcn.LIFECYCLE_STATE_TERMINATING,
                oci.core.models.Vcn.LIFECYCLE_STATE_TERMINATED,
            ]
        ]

    def find_instance_by_name(self, name: str) -> list["ComputeInstance"]:
        matches = []
        data = oci.pagination.list_call_get_all_results(
            self._compute_client.list_instances,
            compartment_id=self.id,
            display_name=name,
        ).data
        for i in data:
            if i.lifecycle_state in (
                oci_models.Instance.LIFECYCLE_STATE_TERMINATED,
                oci_models.Instance.LIFECYCLE_STATE_TERMINATING,
            ):
                continue

            matches.append(
                ComputeInstance(
                    self._config,
                    ocid_or_instance=i,
                    client=self._compute_client,
                )
            )
        return matches

    def find_db_system_by_name(self, name: str) -> list[DBSystem]:
        matches = []
        data = oci.pagination.list_call_get_all_results(
            self._dbs_client.list_db_systems,
            compartment_id=self.id,
            display_name=name,
        ).data
        for db in data:
            if db.lifecycle_state in (
                oci.mysql.models.DbSystem.LIFECYCLE_STATE_DELETING,
                oci.mysql.models.DbSystem.LIFECYCLE_STATE_DELETED,
            ):
                continue

            matches.append(
                DBSystem(
                    self._config,
                    ocid_or_db_system=db,
                    client=self._dbs_client,
                )
            )
        return matches

    def list_regions(self) -> list:
        iam_client = core.get_oci_identity_client(config=self._config)

        return oci.pagination.list_call_get_all_results(iam_client.list_regions).data

    def list_region_subscriptions(self) -> list:
        iam_client = core.get_oci_identity_client(config=self._config)

        return oci.pagination.list_call_get_all_results(
            iam_client.list_region_subscriptions
        ).data

    def list_availability_domains(self) -> list[oci.identity.models.AvailabilityDomain]:
        iam_client = core.get_oci_identity_client(config=self._config)

        return oci.pagination.list_call_get_all_results(
            iam_client.list_availability_domains, compartment_id=self.id
        ).data

    def pick_availability_domain(self) -> str:
        domains = [cast(str, d.name) for d in self.list_availability_domains()]
        return random.choice(domains)

    def list_db_shapes(self, availability_domain: Optional[str] = None) -> list[oci.mysql.models.ShapeSummary]:
        """List MySQL DB System shapes"""
        return oci.pagination.list_call_get_all_results(
            self._mds_client.list_shapes,
            compartment_id=self.id,
            availability_domain=availability_domain,
        ).data

    def list_db_configurations(self, default: bool = True, custom: bool = True, shape_name: Optional[str] = None) -> list[oci.mysql.models.ConfigurationSummary]:
        """List MySQL configurations"""
        types: list[str] = []

        if default:
            types.append(oci.mysql.models.Configuration.TYPE_DEFAULT)

        if custom:
            types.append(oci.mysql.models.Configuration.TYPE_CUSTOM)

        return oci.pagination.list_call_get_all_results(
            self._mds_client.list_configurations, compartment_id=self.id, type=types, shape_name=shape_name
        ).data

    def list_db_versions(self) -> list[oci.mysql.models.VersionSummary]:
        """List MySQL versions"""
        response = oci.pagination.list_call_get_all_results(
            self._mds_client.list_versions, compartment_id=self.id
        )
        result: list[oci.mysql.models.VersionSummary] = response.data
        # BUG#38884595 - do not list MySQL 8.0
        result = [
            summary for summary in result if not cast(str, summary.version_family).startswith("8.0")
        ]
        return result

    def list_images(
        self, operating_system: str, operating_system_version: str, shape: str
    ) -> list[oci.core.models.Image]:
        images = oci.pagination.list_call_get_all_results(
            self._compute_client.list_images,
            compartment_id=self.id,
            lifecycle_state="AVAILABLE",
            shape=shape,
            operating_system=operating_system,
            operating_system_version=operating_system_version,
            sort_by="DISPLAYNAME",
            sort_order="DESC",
        ).data
        return images

    def list_compute_shapes(self, availability_domain: Optional[str] = None) -> list[oci.core.models.Shape]:
        shapes = oci.pagination.list_call_get_all_results(
            self._compute_client.list_shapes,
            compartment_id=self.id,
            availability_domain=availability_domain,
        ).data
        return shapes

    def get_vcn(self, vcn_id: str) -> VCN:
        return VCN(self._config, ocid_or_vcn=vcn_id, client=self._net_client)

    @log
    def create_vcn(self, name: str, cidr_block: str, freeform_tags: dict) -> VCN:
        vcn_details = oci_models.CreateVcnDetails(
            cidr_block=cidr_block,
            compartment_id=self.id,
            display_name=name,
            freeform_tags=freeform_tags,
        )
        create_vcn_response = self._net_client.create_vcn(vcn_details)
        return VCN(
            self._config,
            ocid_or_vcn=create_vcn_response.data,  # type: ignore
            client=self._net_client
        )

    @log
    def delete_vcn(self, vcn_or_id: VCN | str):
        """Delete a VCN."""
        if not isinstance(vcn_or_id, str):
            vcn_or_id = vcn_or_id.id

        logging.info(f"Deleting VCN {vcn_or_id}")
        self._net_client.delete_vcn(vcn_id=vcn_or_id)

    def delete_vcn_recursive(self, vcn_or_id: VCN | str):
        """Delete all associated resources of a VCN and the VCN itself."""
        if isinstance(vcn_or_id, str):
            vcn = self.get_vcn(vcn_or_id)
        else:
            vcn = vcn_or_id

        vcn.delete_recursive()
        self.delete_vcn(vcn)

    def delete_all_vcns(self, show_fn=None, filter_fn=None):
        """Delete all VCNs in a compartment."""
        show = show_fn or logging.info
        vcns = self.get_all_vcns()

        if vcns:
            show(
                f"Deleting {'selected' if filter_fn else 'all'} VCNs in compartment {self.name}"
            )

            count = 0

            for vcn in vcns:
                if not filter_fn or filter_fn(vcn):
                    if filter_fn:
                        show(f"Deleting matching VCN {vcn.display_name}")
                    self.delete_vcn_recursive(vcn)
                    count += 1
                else:
                    show(f"Skipped deleting filtered VCN {vcn.display_name}")

            if count:
                show(
                    f"{'Selected' if filter_fn else 'All'} VCNs in compartment {self.name} have been deleted"
                )
            else:
                show(f"No matching VCNs found in compartment {self.name}")

    @log
    def create_configuration(
        self,
        description: str,
        name: str,
        freeform_tags: dict,
        shape_name: str,
        variables: dict,
        use_ha: bool = False,
    ) -> tuple[MySQLConfiguration, list[str]]:
        # find parent configurations for the given shape name
        configurations = self.list_db_configurations(
            custom=False, shape_name=shape_name)
        logging.debug(
            f"Candidate configurations for shape={shape_name}: {configurations}")

        # now filter by purpose
        suffix = ".HA" if use_ha else ".Standalone"
        configurations = [
            configuration for configuration in configurations if cast(str, configuration.display_name).endswith(suffix)
        ]
        logging.debug(
            f"Candidate configurations for suffix={suffix}: {configurations}")

        # select the parent configuration
        parent_configuration = None
        if configurations:
            parent_configuration = MySQLConfiguration(
                self._config, cast(str, configurations[0].id))
        logging.debug(
            f"Chosen parent configuration: {parent_configuration.display_name if parent_configuration else None}")

        if "lower_case_table_names" in variables:
            lower_case_table_names = str(variables["lower_case_table_names"])

            if lower_case_table_names == "0":
                lctn = \
                    oci.mysql.models.InitializationVariables.LOWER_CASE_TABLE_NAMES_CASE_SENSITIVE
            else:
                lctn = \
                    oci.mysql.models.InitializationVariables.LOWER_CASE_TABLE_NAMES_CASE_INSENSITIVE_LOWERCASE

            init_variables_obj = oci.mysql.models.InitializationVariables(
                lower_case_table_names=lctn
            )
        else:
            init_variables_obj = None

        issues: list[str] = []

        # filter out variables that we can't set here
        def filter_variables(vars) -> dict:
            filtered = {}

            for k, v in vars.items():
                if k == "lower_case_table_names":
                    continue

                message: str = ""

                if k in k_configuration_variables_metadata.keys():
                    if parent_configuration and getattr(parent_configuration.variables, k) is not None:
                        message = f"The MySQL system variable '{k}' was not migrated because it is already set in the parent DB Configuration."
                else:
                    message = f"The MySQL system variable '{k}' was not migrated because it cannot be set in the DB Configuration."

                if message:
                    issues.append(message)
                else:
                    filtered[k] = v

            return filtered

        variables_obj = oci.mysql.models.ConfigurationVariables(
            **filter_variables(variables)
        )

        details = oci.mysql.models.CreateConfigurationDetails(
            compartment_id=self.id,
            display_name=name,
            description=description,
            freeform_tags=freeform_tags,
            shape_name=shape_name,
            init_variables=init_variables_obj,
            variables=variables_obj,
            parent_configuration_id=parent_configuration.id if parent_configuration else None
        )

        logging.info(
            f"Creating configuration object for DBSystem: {oci.util.to_dict(details)}"
        )
        response: oci.response.Response = self._mds_client.create_configuration(
            details)  # type: ignore
        return (MySQLConfiguration(self._config, cast(oci.mysql.models.Configuration, response.data)), issues)

    def delete_configuration(self, configuration_id: str):
        """Delete MySQL configuration."""
        self._mds_client.delete_configuration(
            configuration_id=configuration_id)

    def get_db_system(self, db_system_id: str) -> DBSystem:
        return DBSystem(
            config=self._config, ocid_or_db_system=db_system_id, client=self._dbs_client
        )

# TODO fill contact email by default from user account
    @log
    def create_db_system(
        self,
        name: str,
        description: str,
        customer_contacts: list[str],
        hostname_label: Optional[str],
        admin_user: str,
        admin_pass: str,
        storage_size_gb: int,
        auto_expand_storage: bool,
        auto_expand_maximum_size_gb: int,
        version: str,
        shape_name: str,
        availability_domain: str,
        fault_domain: Optional[str],
        subnet_id: str,
        freeform_tags: dict,
        configuration_id: str,
        enable_ha: bool,
        enable_rest: bool,
        enable_backup: bool,
        crash_recovery: bool
    ) -> tuple[DBSystem, MySQLWorkRequest]:
        if enable_ha and enable_rest:
            logging.warning(
                f"DB system cannot have both HA and REST enabled, disabling REST")
            enable_rest = False

        if auto_expand_storage:
            data_storage_details = oci.mysql.models.DataStorageDetails()
            data_storage_details.is_auto_expand_storage_enabled = True
            # mandatory if auto_expand is enabled
            data_storage_details.max_storage_size_in_gbs = auto_expand_maximum_size_gb
        else:
            data_storage_details = None

        customer_contacts_obj = [
            oci.mysql.models.CustomerContact(email=e) for e in customer_contacts
        ]

        if enable_rest:
            create_rest_details = oci.mysql.models.CreateRestDetails()
            create_rest_details.configuration = oci.mysql.models.CreateRestDetails.CONFIGURATION_DBSYSTEM_ONLY
        else:
            create_rest_details = None

        if crash_recovery:
            crash_recovery_value = oci.mysql.models.CreateDbSystemDetails.CRASH_RECOVERY_ENABLED
        else:
            crash_recovery_value = oci.mysql.models.CreateDbSystemDetails.CRASH_RECOVERY_DISABLED

        if shape_name == "MySQL.Free":
            # MySQL.Free has some unexpected limitation:
            # - backup can't be disabled (or specified at all)
            # - crash recovery can't be disabled because backup can't be disabled
            backup_policy = None
            crash_recovery_value = None
            logging.info(
                f"DB System shape is {shape_name}, so backup policy and crash recovery will be forced to default")
        else:
            backup_policy = oci.mysql.models.CreateBackupPolicyDetails(
                is_enabled=enable_backup
            )

        db_system_details = oci.mysql.models.CreateDbSystemDetails(
            display_name=name,
            description=description,
            customer_contacts=customer_contacts_obj,
            hostname_label=hostname_label,
            admin_username=admin_user,
            admin_password=admin_pass,
            compartment_id=self.id,
            configuration_id=configuration_id,
            data_storage=data_storage_details,
            data_storage_size_in_gbs=storage_size_gb,
            mysql_version=version,
            shape_name=shape_name,
            availability_domain=availability_domain,  # required
            fault_domain=fault_domain or None,  # optional
            is_highly_available=enable_ha,
            subnet_id=subnet_id,
            # defined_tags=defined_tags,
            freeform_tags=freeform_tags,
            rest=create_rest_details,
            backup_policy=backup_policy,
            crash_recovery=crash_recovery_value
        )

        logging.info(
            f"CreateDbSystem: {util.sanitize_dict_any_pass(cast(dict, oci.util.to_dict(db_system_details)))}")

        response: oci.response.Response = self._dbs_client.create_db_system(
            db_system_details)  # type: ignore

        return (
            DBSystem(
                config=self._config,
                ocid_or_db_system=response.data,
                client=self._dbs_client),
            MySQLWorkRequest(
                self._config, response.headers[k_work_request_header])
        )

    def delete_all_db_systems(self, show_fn=None):
        """Delete all DB systems in a compartment."""
        show = show_fn or logging.info
        db_systems = self.get_all_db_systems()

        if db_systems:
            show(f"Deleting all DB systems in compartment {self.name}")

            for db in db_systems:
                db.delete_with_resources(show_fn=show)

            show(
                f"All DB systems in compartment {self.name} have been deleted")

        configurations = self.list_db_configurations(default=False)
        if configurations:
            show(
                f"Deleting all MySQL configurations in compartment {self.name}")

            for configuration in configurations:
                self.delete_configuration(cast(str, configuration.id))

            show(
                f"All MySQL configurations in compartment {self.name} have been deleted")

    @log
    def create_instance(
        self,
        instance_name: str,
        availability_domain: str,
        shape_name: str,
        ocpus: float,
        memory_in_gbs: float,
        subnet_id: str,
        image_id: str,
        ssh_public_key: str,
        defined_tags: dict = {},
        freeform_tags: dict = {},
        init_script_file_path: str = "",
    ) -> tuple[ComputeInstance, WorkRequest]:
        assert instance_name
        assert availability_domain
        assert shape_name

        instance_metadata = {
            "ssh_authorized_keys": ssh_public_key,
            "creator": "MySQL Migration Assistant",
        }

        if init_script_file_path:
            instance_metadata["user_data"] = (
                oci.util.file_content_as_launch_instance_user_data(
                    init_script_file_path
                )
            )

        launch_instance_details = oci.core.models.LaunchInstanceDetails(
            display_name=instance_name,
            compartment_id=self.id,
            availability_domain=availability_domain,
            shape=shape_name,
            shape_config=oci.core.models.LaunchInstanceShapeConfigDetails(
                ocpus=ocpus, memory_in_gbs=memory_in_gbs
            ),
            metadata=instance_metadata,
            source_details=oci.core.models.InstanceSourceViaImageDetails(
                image_id=image_id
            ),
            create_vnic_details=oci.core.models.CreateVnicDetails(
                subnet_id=subnet_id),
            defined_tags=defined_tags,
            freeform_tags=freeform_tags,
            agent_config=oci.core.models.LaunchInstanceAgentConfigDetails(
                plugins_config=[
                    oci.core.models.InstanceAgentPluginConfigDetails(
                        # TODO check whats this
                        desired_state="ENABLED",
                        name="Bastion",
                    )
                ]
            ),
        )

        response: oci.response.Response = self._compute_client.launch_instance(
            launch_instance_details)  # type: ignore

        return (
            ComputeInstance(
                config=self._config, ocid_or_instance=response.data, client=self._compute_client
            ),
            WorkRequest(
                self._config, response.headers[k_work_request_header]
            )
        )

    def delete_instance(self, instance_id: str):
        """Delete compute instance with the given OCID, block and data volumes are kept intact."""
        logging.info(f"Deleting Instance {instance_id}")
        self._compute_client.terminate_instance(
            instance_id, preserve_boot_volume=True, preserve_data_volumes_created_at_launch=True)

    def delete_all_instances(self, show_fn=None, filter_fn=None):
        """Delete all compute instances in a compartment."""
        show = show_fn or logging.info
        instances = self.get_all_instances()

        if instances:
            show(
                f"Deleting {'selected' if filter_fn else 'all'} compute instances in compartment {self.name}"
            )

            count = 0

            for instance in instances:
                if not filter_fn or filter_fn(instance):
                    if filter_fn:
                        show(
                            f"Deleting matching compute instance {instance.display_name}")
                    instance.delete_with_resources(show)
                    count += 1
                else:
                    show(
                        f"Skipped deleting filtered compute instance {instance.display_name}"
                    )

            if count:
                show(
                    f"{'Selected' if filter_fn else 'All'} compute instances in compartment {self.name} have been deleted"
                )
            else:
                show(
                    f"No matching compute instances found in compartment {self.name}"
                )

    def create_bucket(self, name: str, freeform_tags: dict):
        CreateBucketDetails = oci.object_storage.models.CreateBucketDetails
        create_bucket_details = CreateBucketDetails(
            compartment_id=self.id,
            name=name,
            freeform_tags=freeform_tags,
            storage_tier=CreateBucketDetails.STORAGE_TIER_STANDARD,
            public_access_type=CreateBucketDetails.PUBLIC_ACCESS_TYPE_NO_PUBLIC_ACCESS,
        )

        self._os_client.create_bucket(
            namespace_name=self.namespace, create_bucket_details=create_bucket_details
        )

    def get_bucket(self, name: str, approximate_count: bool = False) -> oci.object_storage.models.Bucket:
        """Get bucket with a given name."""
        fields: list[str] = []

        if approximate_count:
            fields.append("approximateCount")

        return self._os_client.get_bucket(
            namespace_name=self.namespace, bucket_name=name, fields=fields).data  # type: ignore

    def list_objects(self, bucket_name: str, prefix: str):
        """A generator which returns objects with the given prefix"""
        start = None

        while True:
            list_response: oci.response.Response = self._os_client.list_objects(
                namespace_name=self.namespace,
                bucket_name=bucket_name,
                prefix=prefix,
                start=start
            )  # type: ignore

            objects = list_response.data.objects
            if not objects:
                break  # No more objects with that prefix

            # Delete all listed objects
            for obj in objects:
                yield obj.name

            # Prepare for next batch if more objects are present
            start = list_response.data.next_start_with
            if not start:
                break

    def delete_from_bucket(self, bucket_name: str, prefix: str):
        for obj in self.list_objects(bucket_name, prefix):
            self.delete_object(bucket_name, obj)

    def delete_object(self, bucket_name: str, object_name: str):
        """Delete an object from the given bucket."""
        self._os_client.delete_object(
            namespace_name=self.namespace, bucket_name=bucket_name, object_name=object_name)

    def delete_bucket(self, name: str):
        """Delete a bucket."""
        self._os_client.delete_bucket(
            namespace_name=self.namespace, bucket_name=name)

    def wipe_bucket(self, bucket_name: str, threads: int = 4, show_fn=None):
        """Delete all associated resources of a bucket and the bucket itself."""
        show = show_fn or logging.info
        local_context = threading.local()

        bucket = self.get_bucket(bucket_name, approximate_count=True)
        pars = self.get_all_pars(bucket_name)
        uploads = self.get_all_multipart_uploads(bucket_name)

        show(
            f"Wiping out bucket {bucket_name}: approx. {bucket.approximate_count if bucket.approximate_count else '???'} objects, {len(pars)} PARs, {len(uploads)} uploads")

        def initializer(compartment: Compartment):
            local_context.compartment = Compartment(
                compartment._config, compartment.obj)

        def worker(task: Callable[[Compartment], None], descr: str):
            try:
                task(local_context.compartment)
            except Exception as e:
                show(f"Exception while {descr}: {e}")

        def delete_object(name):
            return lambda comp: comp.delete_object(bucket_name, name)

        def delete_par(id):
            return lambda comp: comp.delete_bucket_par(bucket_name, id)

        def abort_multipart(mp):
            return lambda comp: comp.abort_multipart_upload(bucket_name, mp.object, mp.upload_id)

        with ThreadPoolExecutor(
            max_workers=threads, initializer=initializer, initargs=(self,)
        ) as executor:
            for o in self.list_objects(bucket_name, ""):
                executor.submit(worker, delete_object(o),
                                f"deleting '{o}' object")

            for p in pars:
                executor.submit(worker, delete_par(p.id),
                                f"deleting '{p.id}' PAR")

            for u in uploads:
                executor.submit(worker, abort_multipart(u),
                                f"aborting multipart upload of '{u.object}', upload ID: {u.upload_id}")

            executor.shutdown()

        show(f"Deleting bucket {bucket_name}")

        self.delete_bucket(bucket_name)

        show(f"Bucket {bucket_name} has been deleted")

    def wipe_all_buckets(self, threads: int = 4, show_fn=None, filter_fn=None):
        """Wipe all buckets in a compartment."""
        show = show_fn or logging.info
        buckets = self.get_all_buckets()

        if buckets:
            show(
                f"Wiping {'selected' if filter_fn else 'all'} buckets in compartment {self.name}"
            )

            count = 0

            for bucket in buckets:
                name = cast(str, bucket.name)
                if not filter_fn or filter_fn(self.get_bucket(name)):
                    if filter_fn:
                        show(f"Deleting matching bucket {name}")
                    self.wipe_bucket(name, threads, show)
                    count += 1
                else:
                    show(f"Skipped deleting filtered bucket {name}")

            if count:
                show(
                    f"{'Selected' if filter_fn else 'All'} buckets in compartment {self.name} have been deleted"
                )
            else:
                show(f"No matching buckets found in compartment {self.name}")

    def create_bucket_par(
        self, name: str, bucket_name: str, time_expires: datetime
    ) -> oci.object_storage.models.PreauthenticatedRequest:
        """
        Create a full-access bucket PAR for the given bucket and expiration time.
        """
        CreatePreauthenticatedRequestDetails = (
            oci.object_storage.models.CreatePreauthenticatedRequestDetails
        )
        details = CreatePreauthenticatedRequestDetails(
            access_type=CreatePreauthenticatedRequestDetails.ACCESS_TYPE_ANY_OBJECT_READ_WRITE,
            bucket_listing_action="ListObjects",
            name=name,
            time_expires=time_expires,
        )
        return self._os_client.create_preauthenticated_request(
            namespace_name=self.namespace,
            bucket_name=bucket_name,
            create_preauthenticated_request_details=details,
        ).data  # type: ignore

    def delete_bucket_par(self, bucket_name: str, par_id: str):
        self._os_client.delete_preauthenticated_request(
            namespace_name=self.namespace, bucket_name=bucket_name, par_id=par_id
        )

    def abort_multipart_upload(self, bucket_name: str, object_name: str, upload_id: str):
        """Abort a multipart upload."""
        self._os_client.abort_multipart_upload(
            namespace_name=self.namespace, bucket_name=bucket_name, object_name=object_name, upload_id=upload_id
        )

    def delete_compartment(self) -> IdentityWorkRequest:
        response: oci.response.Response = self._client.delete_compartment(
            compartment_id=self.id)  # type: ignore
        return IdentityWorkRequest(self._config, response.headers[k_work_request_header])

    def print_all_resources(self, show_fn=None):
        show = show_fn or logging.info
        show(f"Resources of compartment {format_description(self)}")

        compartments = self.get_all_compartments()
        if compartments:
            show("  Sub-compartments:")
            for compartment in compartments:
                show(f"    - {format_description(compartment)}:")

        vcns = self.get_all_vcns()
        if vcns:
            show("  VCNs:")
            for vcn in vcns:
                vcn.print_all_resources(show_fn=show_fn)

        instances = self.get_all_instances()
        if instances:
            show("  Instances:")
            for i in instances:
                i.print_all_resources(show_fn=show_fn)

        db_systems = self.get_all_db_systems()
        if db_systems:
            show("  DBSystems:")
            for db in db_systems:
                db.print_all_resources(show_fn=show_fn)

            configurations = self.list_db_configurations(default=False)
            if configurations:
                show("  MySQL configurations:")
                for configuration in configurations:
                    show(f"    - {format_description(configuration)}:")

        buckets = self.get_all_bucket_names()
        if buckets:
            show("  Buckets:")
            for bucket in buckets:
                bucket_obj = self.get_bucket(bucket, approximate_count=True)
                objects = bucket_obj.approximate_count
                pars = len(self.get_all_pars(bucket))
                uploads = len(self.get_all_multipart_uploads(bucket))
                show(f"    - {bucket}"
                     f" CreatedBy={defined_tag(bucket_obj, tag="CreatedBy")}"
                     f"{f', approx. {objects} objects' if objects else ''}"
                     f"{f', {pars} PARs' if pars else ''}"
                     f"{f', {uploads} multipart uploads' if uploads else ''}")


class ProfilePropagationRetryStrategy(oci.retry.ExponentialBackOffWithDecorrelatedJitterRetryStrategy):
    def __init__(self) -> None:
        checkers = []
        checkers.append(
            oci.retry.retry_checkers.LimitBasedRetryChecker(max_attempts=30))
        checkers.append(
            oci.retry.retry_checkers.TotalTimeExceededRetryChecker())

        retryable_statuses = copy.deepcopy(
            oci.retry.retry_checkers.RETRYABLE_STATUSES_AND_CODES
        )
        retryable_statuses[401] = []

        checkers.append(
            oci.retry.retry_checkers.TimeoutConnectionAndServiceErrorRetryChecker(
                service_error_retry_config=retryable_statuses)
        )

        super().__init__(base_sleep_time_seconds=1, exponent_growth_factor=2, max_wait_between_calls_seconds=10,
                         checker_container=oci.retry.retry_checkers.RetryCheckerContainer(checkers=checkers))

    def do_sleep(self, attempt, exception):
        if isinstance(exception, oci.exceptions.ServiceError) and exception.status == 401:
            logging.debug(
                f"In profile propagation retry loop, attempt {attempt}...")
            time.sleep(10)
        else:
            super().do_sleep(attempt, exception)


class RetryStrategy:
    def __init__(self) -> None:
        # create a copy of retryable statuses, we're going to modify it, and
        # don't want to interfere with the global value
        self._retryable_statuses = copy.deepcopy(
            oci.retry.retry_checkers.RETRYABLE_STATUSES_AND_CODES
        )

        # this strategy is using the same configuration as the one used by Shell,
        # except for back-off time: instead of full jitter we're using a type
        # which ensures some waiting time
        builder = oci.retry.RetryStrategyBuilder(
            retry_base_sleep_time_seconds=1,
            retry_exponential_growth_factor=2,
            retry_max_wait_between_calls_seconds=60,
            backoff_type=oci.retry.BACKOFF_DECORRELATED_JITTER_VALUE,
        )

        builder.add_max_attempts(max_attempts=10)
        builder.add_total_elapsed_time(total_elapsed_time_seconds=600)
        builder.add_service_error_check(service_error_retry_config=self._retryable_statuses,
                                        service_error_retry_on_any_5xx=True)

        self._retry_strategy = builder.get_retry_strategy()
        self._retry_on_unauthorized_errors = False
        self._retry_on_not_found_errors = False

        # replace do_sleep() method with a version which logs retries
        retry_strategy = cast(
            oci.retry.ExponentialBackoffRetryStrategyBase, self._retry_strategy
        )
        _do_sleep_orig = retry_strategy.do_sleep

        def do_sleep(self, attempt, exception):
            target_service = getattr(exception, 'target_service', None)
            operation_name = getattr(exception, 'operation_name', None)
            status_code = getattr(exception, 'status', None)
            error_code = getattr(exception, 'code', None)

            logging.debug(
                f"Sleeping before retrying OCI request {target_service}.{operation_name} which has failed with: {exception}"
            )

            _do_sleep_orig(attempt, exception)

            logging.info(
                f"Retrying OCI request {target_service}.{operation_name}, retry attempt {attempt}, HTTP code: {status_code}, error code: {error_code}"
            )

        retry_strategy.do_sleep = MethodType(do_sleep, retry_strategy)

    def make_retrying_call(self, func_ref, *func_args, **func_kwargs):
        return self._retry_strategy.make_retrying_call(
            func_ref, *func_args, **func_kwargs
        )

    def add_circuit_breaker_callback(self, circuit_breaker_callback):
        self._retry_strategy.add_circuit_breaker_callback(  # type: ignore
            circuit_breaker_callback
        )

    def retry_on_unauthorized_errors(self) -> None:
        """Retry on 401 - NotAuthenticated errors."""
        if self._retry_on_unauthorized_errors:
            return

        # retry on any error code
        self._retryable_statuses[401] = []
        self._retry_on_unauthorized_errors = True

    def retry_on_not_found_errors(self) -> None:
        """Retry on:
         - 400 - RelatedResourceNotAuthorizedOrNotFound
         - 404 - BucketNotFound, NotAuthorizedOrNotFound
        errors."""
        if self._retry_on_not_found_errors:
            return

        self._retryable_statuses[400] = [
            "RelatedResourceNotAuthorizedOrNotFound",
        ]

        self._retryable_statuses[404] = [
            "BucketNotFound",
            "NotAuthorizedOrNotFound",
        ]

        self._retry_on_not_found_errors = True

    def should_retry(self, status_code: int, message: str) -> bool:
        if status_code not in self._retryable_statuses:
            return False

        error_codes = self._retryable_statuses[status_code]

        # empty array means that all error codes are retried
        if 0 == len(error_codes):
            return True

        for error in error_codes:
            if error in message:
                return True

        return False


MIGRATION_RETRY_STRATEGY = RetryStrategy()
