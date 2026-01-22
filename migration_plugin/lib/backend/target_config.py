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


import ipaddress
import string
import re
from typing import cast, Optional


from oci.identity.models import AvailabilityDomain
from oci.mysql.models import ShapeSummary, VersionSummary
from oci.exceptions import ServiceError

from .. import oci_utils, logging, dbsession, util
from . import model
from ..migration import Project
from ..errors import BadUserInput, SSHError
from ..dbsession import MigrationSession, version_to_nversion
from .model import (
    DBSystemOptions,
    OCIHostingOptions,
    ServerType,
)

k_min_storage_size_gb = 50
k_default_storage_size_multiplier = 2.0
k_base_jump_host_name = "mysql-jump-host"


# ref https://docs.oracle.com/en-us/iaas/mysql-database/doc/db-system-storage.html
k_storage_volume_limits = [
    {"minimum": 50, "volumes": 1, "maximum": 32 * 1024},
    {"minimum": 401, "volumes": 2, "maximum": 64 * 1024},
    {"minimum": 801, "volumes": 3, "maximum": 96 * 1024},
    {"minimum": 1201, "volumes": 4, "maximum": 128 * 1024},
    {"minimum": 1601, "volumes": 5, "maximum": 128 * 1024},
    {"minimum": 2001, "volumes": 6, "maximum": 128 * 1024},
    {"minimum": 2401, "volumes": 7, "maximum": 128 * 1024},
    {"minimum": 2801, "volumes": 8, "maximum": 128 * 1024},
    {"minimum": 3201, "volumes": 9, "maximum": 128 * 1024},
    {"minimum": 3601, "volumes": 10, "maximum": 128 * 1024},
    {"minimum": 4001, "volumes": 11, "maximum": 128 * 1024},
    {"minimum": 4401, "volumes": 12, "maximum": 128 * 1024},
    {"minimum": 4801, "volumes": 13, "maximum": 128 * 1024},
    {"minimum": 5201, "volumes": 14, "maximum": 128 * 1024},
    {"minimum": 5601, "volumes": 15, "maximum": 128 * 1024},
]

# sysvars that should not be copied from the source so that the shape-optimized
# DBSystem default is picked, even if there's a non-default value set
k_prefer_default_for_sysvars = {
    "default_authentication_plugin",
    "innodb_buffer_pool_instances",
    "innodb_buffer_pool_size",
    "innodb_log_writer_threads",
    "innodb_parallel_read_threads",
    # "max_connections",
    # "max_prepared_stmt_count",
    "replica_parallel_workers",
    "temptable_max_ram",
    "thread_pool_query_threads_per_group",
    "thread_pool_size",
}


k_reserved_user_names = [
    "mysql.infoschema",
    "mysql.session",
    "mysql.sys",
    "ociadmin",
    "ocidbm",
    "ocirpl",
]


def get_default_buffer_pool_size_gb(memory_size_gb, ha: bool) -> int:
    # Last Updated for: Jun 26, 2025
    standalone_gb = min(memory_size_gb * 75 / 100, memory_size_gb - 6)

    if not ha:
        return standalone_gb

    memory_size = memory_size_gb * 1024 * 1024 * 1024

    gr_message_cache_size = min(
        max(419430400, (5 / 100) * memory_size), 2147483648)
    gr_transaction_size_limit = min(
        max(83886080, 0.01 * memory_size), 1073741824)

    with_ha_gb = (
        standalone_gb
        - (gr_message_cache_size + 5 *
           gr_transaction_size_limit) / 1024 * 1024 * 1024
    )

    return with_ha_gb


def get_sysvars_old(session: MigrationSession) -> list[dict]:
    sysvars = [
        {
            "variable": k,
            "value": v,
            "useDefault": True if k in k_prefer_default_for_sysvars else False,
        }
        for k, v in iter(session.run_sql("show global variables").fetch_one, None)
    ]

    max_uint = 2**64 - 1
    # find whether this is a 32bit binary
    for var in sysvars:
        if var["variable"] == "version_compile_machine":
            if var["value"] == "i686":
                max_uint = 2**32 - 1
            break

    # detect default values by checking against the maximum
    # these are specially important for ints, because they usually have a
    # default of MAX_UINT64, which won't fit in a JSON int
    for var in sysvars:
        if type(var["value"]) is int and var["value"] == max_uint:
            logging.info(
                f"Assuming sysvar is set to default value: {var['variable']}={var['value']}"
            )
            var["useDefault"] = True

    return sysvars


def get_sysvars_new(session: MigrationSession) -> list[dict]:
    query = """SELECT i.variable_name, g.variable_value, i.variable_source='COMPILED'
    FROM performance_schema.variables_info i
    JOIN performance_schema.global_variables g
        ON i.VARIABLE_NAME=g.variable_name
"""
    return [
        {
            "variable": k,
            "value": v,
            "useDefault": True if k in k_prefer_default_for_sysvars else d,
        }
        for k, v, d in iter(session.run_sql(query).fetch_one, None)
    ]


def get_sysvars_mariadb(session: MigrationSession) -> list[dict]:
    return get_sysvars_old(session)


def get_sysvars(session: MigrationSession) -> list[dict]:
    if session.server_type == ServerType.MariaDB:
        sysvars = get_sysvars_mariadb(session)
    elif session.nversion // 100 <= 507:
        # 5.7 has pfs.global_variables but not variables_info
        # 5.6 has neither
        sysvars = get_sysvars_old(session)
    else:
        try:
            sysvars = get_sysvars_new(session)
        except:
            # this could fail if pfs is disabled
            logging.exception(
                "Error querying global variables through performance_schema, falling back..."
            )
            sysvars = get_sysvars_old(session)

    return sysvars


def validate_password(pwd: str, username: str) -> str:
    """The password must be between 8 and 32 characters long,
    and must contain at least 1 numeric character,
    1 lowercase character,
    1 uppercase character,
    and 1 special (nonalphanumeric) character.
    Also, the username must not appear in it.
    """

    requirements = "Password must be between 8 and 32 chars and contain at least one each of lower case, upper case, digit and special characters"

    if len(pwd) < 8 or len(pwd) > 32:
        return f"{requirements}; but it is {len(pwd)} characters long."
    numeric = 0
    lower = 0
    upper = 0
    special = 0
    for c in pwd:
        if c in string.digits:
            numeric += 1
        elif c in string.ascii_lowercase:
            lower += 1
        elif c in string.ascii_uppercase:
            upper += 1
        else:
            special += 1
    missing = []
    if not numeric:
        missing.append("digits")
    if not lower:
        missing.append("lowercase")
    if not upper:
        missing.append("uppercase")
    if not special:
        missing.append("special")
    if not missing:
        if username in pwd:
            return "Username must not appear in the password."
        return ""
    elif len(missing) > 1:
        issue = ", ".join(missing[:-1]) + " and " + missing[-1]
    else:
        issue = missing[0]
    return f"{requirements}; but is has no {issue} characters."


def validate_email(s: str) -> bool:
    EMAIL_REGEX = r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    return re.match(EMAIL_REGEX, s) is not None


def adjust_mysql_configuration(configuration: list[dict]) -> tuple[list[dict], list[model.MigrationError]]:
    issues = []
    new_configuration: list[dict] = []

    def to_error(msg: str, var: dict):
        return model.MigrationError._from_exception(BadUserInput(msg, f"database.variables.{var['variable']}"))

    def add_error(msg: str, var: dict):
        issues.append(to_error(msg, var))

    def add_notice(msg: str, var: dict):
        err = to_error(msg, var)
        err.level = model.MessageLevel.NOTICE
        issues.append(err)

    for var in configuration:
        error_msg = ""

        if var["variable"] == "lower_case_table_names":
            var["value"] = int(var["value"])

            if var["value"] not in (0, 1, 2):
                error_msg = \
                    f"Invalid value for configuration variable {var['variable']}={var['value']}"
        else:
            try:
                fixed = oci_utils.fixup_sysvar_value(
                    var["variable"], var["value"]
                )

                if isinstance(fixed, bool):
                    fixed_str = "ON" if fixed else "OFF"
                else:
                    fixed_str = str(fixed)

                if fixed_str.upper() != var["value"].upper():
                    logging.info(
                        f"variable={var['variable']} original={var['value']} fixed={fixed_str}"
                    )
                    add_notice(
                        f"Configuration value changed for {var['variable']} from {var['value']} to {fixed_str} to fit in range allowed by the service.",
                        var,
                    )

                var["value"] = fixed
            except Exception as e:
                logging.debug(f"{var['variable']}={var['value']}: {e}")
                error_msg = \
                    f"Invalid/unsupported configuration variable {var['variable']}={var['value']}"

        if error_msg:
            add_error(error_msg, var)
        else:
            if var["variable"] == "time_zone" and var["value"] == "SYSTEM":
                # TODO: handle SYSTEM timezone
                pass
            elif "innodb_ft_server_stopword_table" == var["variable"]:
                # innodb_ft_server_stopword_table doesn't work because of a bug
                pass
            else:
                new_configuration.append(var)

    return (new_configuration, issues)


class ConfigureTargetDBSystem:
    oci_config = {}
    availability_domains = None
    versions = None
    shapes: dict[str, list[ShapeSummary]] = {}
    _default_vcn = None
    _default_private_subnet = None
    _default_public_subnet = None

    def __init__(self, oci_config: dict, find_shared_ssh_key_cb, server_info: model.ServerInfo,
                 override_root_compartment_id: str = "",
                 default_compartment_name: str = "",
                 default_networks_compartment_name: str = "",
                 default_vcn_name: str = "") -> None:
        self.oci_config: dict = oci_config

        self._server_info = server_info

        self._override_root_compartment_id = override_root_compartment_id
        self._default_compartment_name = default_compartment_name or "MySQL"
        self._default_networks_compartment_name = default_networks_compartment_name or "Networks"
        self._default_vcn_name = default_vcn_name or "MySQLVCN"

        logging.info(f"Retrieving tenancy information...")
        self.compartment = None
        self.select_compartment(oci_utils.Compartment(
            self.oci_config, lazy_refresh=True))
        self.find_shared_ssh_key_cb = find_shared_ssh_key_cb

        self.network_compartment = None

        self.compute_resolution_notice: str = ""

    @property
    def default_vcn_exists(self) -> bool:
        if self._default_vcn and self._default_private_subnet and self._default_public_subnet:
            return True
        return False

    def select_compartment(self, id: str | oci_utils.Compartment):
        if self.compartment and self.compartment.id == (id if isinstance(id, str) else id.id):
            logging.debug(
                f"target_config: Compartment already set to {self.compartment.id}"
            )
            return
        logging.debug(f"target_config: Compartment changed to '{id}'")
        if not id:
            return
        self.compartment = oci_utils.Compartment(
            self.oci_config, id, lazy_refresh=True) if isinstance(id, str) else id

        # don't refetch things that are probably the same in all compartments
        if not self.availability_domains:
            self.availability_domains = self.compartment.list_availability_domains()
            assert self.availability_domains

        if not self.versions:
            self.versions = self.compartment.list_db_versions()
            assert self.versions

        if not self.shapes:
            for ad in self.availability_domains:
                self.shapes[cast(str, ad.name)] = self.compartment.list_db_shapes(
                    availability_domain=ad.name
                )
            assert self.shapes

    def select_network_compartment(self, id: str | oci_utils.Compartment):
        if self.network_compartment and self.network_compartment.id == (id if isinstance(id, str) else id.id):
            logging.debug(
                f"target_config: Network compartment already set to {self.network_compartment.id}"
            )
            return
        logging.debug(f"target_config: Network compartment changed to '{id}'")
        if not id:
            return
        self.network_compartment = oci_utils.Compartment(
            self.oci_config, id, lazy_refresh=True) if isinstance(id, str) else id
        # TODO - check this
        # self._default_vcn = None
        # self._default_private_subnet = None
        # self._default_public_subnet = None

    def get_full_compartment_path(self) -> str:
        if not self.compartment:
            return ""
        path = self.compartment.get_full_path()
        if path:
            path[0] = path[0] + " (root)"
        return "/".join(path)

    def get_full_network_compartment_path(self) -> str:
        if not self.network_compartment:
            return ""
        path = self.network_compartment.get_full_path()
        if path:
            path[0] = path[0] + " (root)"
        return "/".join(path)

    def validate_target_options(
        self, options: model.TargetHostingOptions, changed_options: list[str] | None
    ) -> list[model.MigrationError]:
        assert isinstance(options, model.OCIHostingOptions)

        issues = []

        def add_error(msg, option):
            issues.append(model.MigrationError._from_exception(
                BadUserInput(msg, option)))

        def get_field(field):
            if "." in field:
                on, _, fn = field.partition(".")
                obj = getattr(options, on)
                name = fn
            else:
                obj = options
                name = field

            return getattr(obj, name)

        def validate_cidr_block(cidr_block: str):
            try:
                network = ipaddress.ip_network(cidr_block, strict=False)
                if not isinstance(network, ipaddress.IPv4Network):
                    raise ValueError("Invalid IPv4 CIDR block.")
            except ValueError as e:
                raise ValueError(f"Invalid CIDR block: {e}")

        def validate_vcn_cidr_block(cidr_block: str):
            try:
                network = ipaddress.ip_network(cidr_block, strict=False)
                if not isinstance(network, ipaddress.IPv4Network):
                    raise ValueError("Invalid IPv4 CIDR block.")
                # Additional check to ensure it's not too large or too small for a VCN
                if network.prefixlen < 8 or network.prefixlen > 30:
                    raise ValueError(
                        "CIDR block prefix length for a VCN should be between /8 and /30."
                    )
            except ValueError as e:
                raise ValueError(f"Invalid CIDR block for a VCN: {e}")

        # If a resource name is given, it must NOT exist
        # If reusing an existing resource, then the id must be given and no name
        def validate_resource_reuse(prefix: str):
            if prefix[-1] == ".":
                id = "id"
                name = "name"
            else:
                id = "Id"
                name = "Name"
            if get_field(f"{prefix}{id}"):
                if get_field(f"{prefix}{name}"):
                    logging.info(
                        f"{prefix}{name} will be ignored because id was given")
            else:
                if not get_field(f"{prefix}{name}"):
                    add_error(
                        f"Either an existing {prefix.rstrip('.')} or a new {prefix.rstrip('.')} name must be given",
                        f"hosting.{prefix}{name}")

        def validate_vcn_selection():
            vcn = get_field("vcnId")
            compartment = get_field("networkCompartmentId")
            private = get_field("privateSubnet.id")
            public = get_field("publicSubnet.id")

            if not get_field("createVcn"):
                if vcn and private and public:
                    logging.info(
                        f"Pre-existing VCN selected: vcn={vcn} privateSubnet={private} publicSubnet={public}")
                else:
                    # if createVcn is selected, then all network options must be set
                    logging.info(
                        f"createVcn is selected, but some options are not set: networkCompartment={compartment} vcn={vcn} privateSubnet={private} publicSubnet={public}")
                    if not vcn:
                        add_error("Please select a VCN from the list or a pick different compartment",
                                  "hosting.vcnId")
                    else:
                        if not public:
                            add_error("Please select a public Subnet from the list",
                                      "hosting.publicSubnet.id")
                        if not private:
                            add_error("Please select a private Subnet from the list",
                                      "hosting.privateSubnet.id")

        validate_resource_reuse("compartment")

        if options.compartmentId:
            self.select_compartment(options.compartmentId)

        if options.networkCompartmentId:
            self.select_network_compartment(options.networkCompartmentId)

        # in v1, either a specific VCN is picked or create from scratch using pre-defined params
        validate_vcn_selection()
        # validate_resource_reuse("networkCompartment")
        # validate_resource_reuse("vcn")
        # validate_resource_reuse("privateSubnet.")
        # validate_resource_reuse("publicSubnet.")

        validate_resource_reuse("compute")

        for field in [
            "vcnName",
            "vcnCidrBlock",
            "internetGatewayName",
            "serviceGatewayName",
            "privateSubnet.cidrBlock",
            "publicSubnet.cidrBlock",
            "computeName",
            "shapeName",
            "bucketName",
            "onPremisePublicCidrBlock"
        ]:
            if options.vcnId:  # pre-existing VCN
                if field == "onPremisePublicCidrBlock":
                    continue

            value = get_field(field)
            if not value:
                if field in ["computeName", "shapeName"] and get_field("computeId"):
                    # computeName and shape are only mandatory if we're not reusing a compute
                    pass
                else:
                    add_error("Required value missing", f"hosting.{field}")

            if field in [
                "vcnCidrBlock",
                "privateSubnet.cidrBlock",
                "privateSubnet.cidrBlock",
                "onPremisePublicCidrBlock"
            ]:
                if field == "onPremisePublicCidrBlock":
                    is_vcn = False
                else:
                    is_vcn = True
                try:
                    if is_vcn:
                        validate_vcn_cidr_block(value)
                    else:
                        validate_cidr_block(value)
                except ValueError as e:
                    add_error(str(e), f"hosting.{field}")

            # TODO contained objects can't be specified when parents aren't

            # TODO check cpuCount and memory

        if not options.computeId:
            # TODO warn if compute with same name exists (but was not picked explicitly)
            if not options.shapeName:
                add_error("A shape must be selected for the jump host compute instance",
                          "hosting.shapeName")

        if options.privateSubnet.name and options.privateSubnet.name == options.publicSubnet.name:
            # If someone wants just a single subnet they can setup themselves
            # and pick ids
            add_error(
                "Private and Public subnet names must be different",
                f"hosting.publicSubnet.name",
            )

        return issues

    def validate_target_mysql_options(
        self, options: model.TargetMySQLOptions, changed_options: list[str] | None
    ) -> list[model.MigrationError]:
        assert isinstance(options, model.DBSystemOptions)
        issues = []

        def add_error(msg, option):
            issues.append(model.MigrationError._from_exception(
                BadUserInput(msg, option)))

        def add_warning(msg, option):
            err = model.MigrationError._from_exception(
                BadUserInput(msg, option))
            err.level = model.MessageLevel.WARNING
            issues.append(err)

        def add_notice(msg, option):
            err = model.MigrationError._from_exception(
                BadUserInput(msg, option))
            err.level = model.MessageLevel.NOTICE
            issues.append(err)

        if options.adminUsername in k_reserved_user_names:
            add_error(
                f"'{options.adminUsername}' is a reserved username.",
                "database.adminUsername",
            )
        elif not options.adminUsername:
            add_error(
                f"Please pick a username to be used for the administrator account of the new DBSystem.",
                "database.adminUsername",
            )

        if changed_options is None or "database.adminPassword" in changed_options or "database.adminPasswordConfirm" in changed_options:
            pwd_issues = validate_password(
                options.adminPassword, username=options.adminUsername)
            if not options.adminPassword:
                add_error(
                    f"Please provide a password to be set for the administrator account of the new DBSystem.",
                    "database.adminPassword",
                )
            elif pwd_issues:
                add_error(
                    f"Password does not comply with strength requirements: {pwd_issues}",
                    "database.adminPassword",
                )
            elif options.adminPassword != options.adminPasswordConfirm:
                add_error(f"Passwords must match.",
                          "database.adminPasswordConfirm")

        if changed_options is None or "database.name" in changed_options:
            if not options.name:
                add_error(
                    f"Display Name for the database must have a value", "database.name")
            else:
                if self.compartment and isinstance(self.compartment, oci_utils.Compartment):
                    matches = self.compartment.find_db_system_by_name(
                        options.name)
                    full_path = ' / '.join(self.compartment.full_path)
                    if len(matches) == 1:
                        add_notice(
                            f"A DB System named {options.name} already exists in compartment {full_path}. A new one will be created with the same name.",
                            "database.name")
                    elif len(matches) > 1:
                        add_notice(
                            f"{len(matches)} DB Systems named {options.name} already exist in compartment {full_path}. A new one will be created with the same name.",
                            "database.name")

            # TODO these checks should be put back once we move the OCI resource fetching from frontend to backend
        if False:
            availabilityDomain
            if not any(
                [
                    True
                    for ad in self.availability_domains
                    if ad.name == options.availabilityDomain
                ]
            ):
                add_error(
                    f"'{options.availabilityDomain}' is not a valid availability domain",
                    "database.availabilityDomain",
                )

            # shapeName
            for shape in self.shapes:
                if ShapeSummary.IS_SUPPORTED_FOR_DBSYSTEM not in cast(
                    list, shape.is_supported_for
                ):
                    continue
                if options.shapeName == shape.name:
                    break
            else:
                add_error(
                    f"'{options.shapeName}' is not a valid MySQL shape name",
                    "database.shapeName",
                )
        if not options.dbSystemId:
            if not options.shapeName:
                add_error("A shape must be selected for the DB System",
                          "database.shapeName")

        if self.availability_domains:
            ads = []

            for ad in self.availability_domains:
                assert ad.name in self.shapes
                if any(options.shapeName == s.name for s in self.shapes[ad.name]):
                    ads.append(ad)

            if ads:
                options.availabilityDomain = self.recommend_availability_domain(
                    ads
                )
            else:
                add_error(f"None of the availability domains provides '{options.shapeName}' MySQL shape",
                          "database.shapeName")

        if self.versions:
            if options.mysqlVersion:
                for vf in self.versions:
                    if options.mysqlVersion in [v.version for v in cast(list, vf.versions)]:
                        break
                else:
                    add_error(
                        f"'{options.mysqlVersion}' is not a supported MySQL version",
                        "database.mysqlVersion",
                    )
            else:
                if "MySQL.Free" == options.shapeName:
                    # Always Free Tier DB Systems must use the latest active available version
                    options.mysqlVersion = \
                        self.versions[-1].versions[-1].version  # type: ignore
                else:
                    options.mysqlVersion = self.recommend_version(
                        self._server_info, self.versions)
        else:
            if not options.mysqlVersion:
                add_error("Target database version not selected",
                          "database.mysqlVersion")

        # storageSizeGB
        try:
            options.storageSizeGB = int(options.storageSizeGB)
            storage_size_ok = True
        except:
            add_error(
                f"Invalid storage size value '{options.storageSizeGB}'",
                "database.storageSizeGB",
            )
            storage_size_ok = False
        if storage_size_ok:
            max_storage_size_gb = k_storage_volume_limits[-1]["maximum"]

            if options.storageSizeGB < k_min_storage_size_gb:
                options.storageSizeGB = k_min_storage_size_gb
                add_warning(
                    f"DBSystem storage size was set to {k_min_storage_size_gb}GB, which is the minimum.",
                    "database.storageSizeGB",
                )
            elif options.storageSizeGB > max_storage_size_gb:
                options.storageSizeGB = max_storage_size_gb
                add_warning(
                    f"DBSystem storage size was set to {max_storage_size_gb}GB, which is the maximum supported.",
                    "database.storageSizeGB",
                )

            if options.storageSizeGB <= self._estimated_db_size_gb * 1.1:
                add_error(
                    f"DBSystem storage size of {options.storageSizeGB}GB is probably too small to migrate source database of {self._estimated_db_size_gb}GB.",
                    "database.storageSizeGB",
                )
            elif options.storageSizeGB <= self._estimated_db_size_gb * 1.5:
                add_warning(
                    f"DBSystem storage size of {options.storageSizeGB}GB might not be sufficient to migrate source database of {self._estimated_db_size_gb}GB.",
                    "database.storageSizeGB",
                )

        # autoExpandMaximumSizeGB
        if options.autoExpandStorage:
            # find the storage size range
            storage_class = None
            for s in k_storage_volume_limits:
                if options.storageSizeGB >= s["minimum"]:
                    storage_class = s
                else:
                    break
            assert storage_class

            # TODO - validate minimum auto-expand size

            if options.autoExpandMaximumSizeGB == 0:
                options.autoExpandMaximumSizeGB = storage_class["maximum"]
                # TODO turn this into add_notice() when support for this field is added in ui
                logging.info(
                    f"Maximum auto-expanded volume size set to {storage_class['maximum']}."
                    # "database.autoExpandMaximumSizeGB",
                )
            elif options.autoExpandMaximumSizeGB > storage_class["maximum"]:
                add_error(
                    f"""Maximum auto-expanded volume size for the selected initial volume size is {storage_class["maximum"]}GB.
    You must either decrease it or increase the initial volume size to {storage_class["minimum"]}.""",
                    "database.autoExpandMaximumSizeGB",
                )

        contact_emails = options.contactEmails.strip()
        if contact_emails:
            if any([not validate_email(e.strip()) for e in contact_emails.split(",")]):
                add_error(
                    f"""Contact list contains invalid email addresses.""",
                    "database.contactEmails",
                )

        if self._server_info.hasMRS or version_to_nversion(options.mysqlVersion) < 90301 or options.enableHA:
            logging.info(
                f"Disabling REST service because hasMRS={self._server_info.hasMRS} and targetVersion={options.mysqlVersion} and enableHA={options.enableHA}")
            options.enableRestService = False

        # TODO disable backup for development templates (and Free shape)

        return issues

    def resolve_target_mysql_options(self, options: DBSystemOptions):
        "Apply remaining options that were not set from the ones that were"
        pass

    def resolve_existing_resources(self, options: OCIHostingOptions):
        # TODO see if the tenancy fetch in __init__ can be replaced with this
        matches = oci_utils.Compartment.find_by_name(
            self.oci_config, parent_compartment_id=options.parentCompartmentId,
            name=options.compartmentName)
        if matches:
            logging.info(
                f"Found compartment named {options.compartmentName}: {matches}")

            compartment = matches[0]
            self.select_compartment(compartment)

            options.compartmentId = compartment.id
            options.compartmentName = ""

    def resolve_existing_vcn(self, options: OCIHostingOptions):
        self._default_vcn = None
        self._default_public_subnet = None
        self._default_private_subnet = None

        matches = oci_utils.Compartment.find_by_name(
            config=self.oci_config,
            parent_compartment_id=options.networkParentCompartmentId,
            name=options.networkCompartmentName)
        if matches:
            logging.info(
                f"Found compartment named {options.networkCompartmentName}: {matches}")
            network_compartment = matches[0]

            self.select_network_compartment(network_compartment)
        else:
            return
        options.networkCompartmentId = network_compartment.id

        matches = network_compartment.find_vcn_by_name(name=options.vcnName)
        if matches:
            logging.info(f"Found VCNs named {options.vcnName}: {matches}")
            vcn = matches[0]
        else:
            return

        matches = vcn.find_subnet_by_name(options.publicSubnet.name)
        if matches:
            logging.info(
                f"Found public subnets named {options.publicSubnet.name}: {matches}")
            public_subnet = matches[0]
        else:
            return

        matches = vcn.find_subnet_by_name(options.privateSubnet.name)
        if matches:
            logging.info(
                f"Found private subnets named {options.privateSubnet.name}: {matches}")
            private_subnet = matches[0]
        else:
            return

        self._default_vcn = options.vcnId = vcn.id
        self._default_public_subnet = options.publicSubnet.id = public_subnet.id  # type: ignore
        self._default_private_subnet = options.privateSubnet.id = private_subnet.id  # type: ignore

        logging.info(f"Default VCN with subnets found")

    def set_jump_host_resolution_notice(self, notice: str):
        if self.compute_resolution_notice == "" or notice == "":
            self.compute_resolution_notice = notice

    def _create_jump_host_resolution_notice(self, instance_count, key_count, connection_error_count, different_subnet_count) -> str:
        msg = ""

        if instance_count == 1:
            base_message = "A new compute instance will be provisioned. An instance was found but"
            if key_count == 0:
                msg = f"{base_message} it's private SSH key is not available"
            elif connection_error_count:
                msg = f"{base_message} SSH connection failed"
            elif different_subnet_count == 1:
                msg = f"{base_message} it is on a different subnet"
        else:
            base_message = "A new compute instance will be provisioned. Some instances were found but"
            if key_count == 0:
                msg = f"{base_message} it's private SSH keys are not available"
            elif connection_error_count == instance_count:
                msg = f"{base_message} SSH connection failed to all of them"
            elif different_subnet_count == instance_count:
                msg = f"{base_message} they are on a different subnet"
            else:
                reasons = []
                if key_count > 0:
                    reasons.append(f"SSH Keys are not available")
                if connection_error_count > 0:
                    reasons.append(f"SSH connection failed")
                if different_subnet_count > 0:
                    reasons.append(f"they are on a different subnet")

                reason_list = ", ".join(reasons[:-1])
                final_reason = reasons[:-1]

                msg = f"A new compute instance will be provisioned. Some instances were found but either {reason_list} or {final_reason}"

        return msg

    def resolve_jump_host(self, options: OCIHostingOptions):
        self.set_jump_host_resolution_notice("")

        # Only if we have a valid compartment
        if not self.compartment:
            return

        options.computeId = ""
        options.computeName = ""

        matches = []
        try:
            matches = [i for i in self.compartment.get_all_instances()
                       if i.display_name.startswith(k_base_jump_host_name)]
        except ServiceError as e:
            options.computeName = k_base_jump_host_name
            logging.info(
                f"get_instances name={k_base_jump_host_name}%: {e}")
            self.set_jump_host_resolution_notice(
                f"Unable to verify existing instances named {k_base_jump_host_name}%")

        if not matches:
            options.computeName = k_base_jump_host_name
            return

        logging.info(
            f"Compute(s) with name={k_base_jump_host_name}% already exists: {matches}"
        )

        # If VCN is being created, there can't be existing reusable jump hosts
        if not options.createVcn:
            self._resolve_existing_jump_host(matches, options)

        # If not yet found, let's find the right name for the jump host
        if options.computeId == "" and options.computeName == "":
            index = 0
            while options.computeName == "":
                candidate_name = k_base_jump_host_name
                if index > 0:
                    candidate_name += f"-{index}"
                found = False
                for i in matches:
                    if i.display_name == candidate_name:
                        found = True
                        index += 1
                        break
                if not found:
                    options.computeName = candidate_name

    def _resolve_existing_jump_host(self, matches, options: OCIHostingOptions):
        instance_keys = 0
        is_different_subnet = 0
        ssh_connection_errors = 0

        instance_tags = {
            'user_id': self.oci_config.get('user'),
        }
        for i in matches:
            if not oci_utils.match_freeform_tags(instance_tags, i):
                continue

            ssh_key = self.find_shared_ssh_key_cb(i.id)
            if not ssh_key:
                continue

            instance_keys += 1

            ip = i.get_public_ip()
            if not ip:
                continue

            try:
                with i.connect_ssh(ip, ssh_key) as conn:
                    pass

                # If an existing vcn is being used, we must ensure the instance is on the subnet being used
                assert self.compartment
                if options.vcnId and options.publicSubnet:
                    for vnic in self.compartment.get_vnic_attachments(i.id):
                        subnet = self.compartment.get_subnet(
                            vnic.subnet_id)
                        if subnet.id == options.publicSubnet.id:
                            options.computeId = i.id
                            options.computeName = i.display_name
                            logging.info(
                                f"Reusing instance {i}")
                            break
                        else:
                            is_different_subnet += 1
            except SSHError:
                ssh_connection_errors += 1
                logging.info(
                    f"Unable to connect to the instance {i.display_name} with IP {ip} using SSH Key {ssh_key}")
            except Exception as e:
                logging.error(
                    f"Error verifying networking on instance {i.display_name}: {e}")

        if options.computeId == "" and options.computeName == "":
            msg = self._create_jump_host_resolution_notice(
                len(matches), instance_keys, ssh_connection_errors, is_different_subnet)
            self.set_jump_host_resolution_notice(msg)

    def get_recommended_oci_options(self) -> OCIHostingOptions:
        options = OCIHostingOptions()

        # TODO store VCN and compartment settings in projectdir/.. (per tenancy) and reuse it by default

        if self._override_root_compartment_id:
            options.parentCompartmentId = self._override_root_compartment_id
            options.networkParentCompartmentId = self._override_root_compartment_id
            logging.info(
                f"Root compartment overridden to {self._override_root_compartment_id}")
        else:
            tenancy = oci_utils.Compartment(
                config=self.oci_config, lazy_refresh=True)
            options.parentCompartmentId = tenancy.id
            options.networkParentCompartmentId = tenancy.id

        options.compartmentName = self._default_compartment_name
        options.availabilityDomain = ""  # randomly picked
        options.shapeName = "VM.Standard.E5.Flex"
        options.cpuCount = 2
        options.memorySizeGB = 24

        options.networkCompartmentName = self._default_networks_compartment_name
        options.vcnName = self._default_vcn_name
        options.vcnCidrBlock = "10.0.0.0/16"
        options.internetGatewayName = "MySQLVCN-IGW"
        options.serviceGatewayName = "MySQLVCN-SGW"
        options.privateSubnet.name = "MySQLSubnet"
        options.privateSubnet.cidrBlock = "10.0.2.0/24"
        options.publicSubnet.name = "MySQLPublicSubnet"
        options.publicSubnet.cidrBlock = "10.0.1.0/24"

        try:
            options.onPremisePublicCidrBlock = util.get_my_public_ip() + "/32"
        except:
            logging.exception("Could not determine public IP address")
            options.onPremisePublicCidrBlock = ""

        self.resolve_existing_resources(options)
        # check if our VCN already exists and if so, pick it by default
        self.resolve_existing_vcn(options)

        if not self.default_vcn_exists:
            options.createVcn = True

        # check if there's a jump host on the default compartment (tenancy)
        self.resolve_jump_host(options)

        options.bucketName = "mysql-migrated-data"

        return options

    def get_recommended_dbsystem_options(
        self, project: Project, source_connection_options: dict
    ) -> DBSystemOptions:
        options = DBSystemOptions()

        assert self.compartment

        logging.info("Generating recommended DBSystem options")

        # by default, use same user/pass as admin for source (assuming it's safe)
        options.adminUsername = source_connection_options["user"]
        logging.info(f"adminUsername={options.adminUsername}")
        if not validate_password(source_connection_options["password"], username=source_connection_options["user"]):
            options.adminPassword = source_connection_options["password"]
            options.adminPasswordConfirm = options.adminPassword

        options.name = project.name
        options.description = f"DBSystem migrated from MySQL {self._server_info.version} {self._server_info.versionComment} at {source_connection_options["host"]} using MySQL Migration Assistant."
        # TODO this is only allowed if dns is enabled
        # options.hostnameLabel = "dbsystem-1"

        options.storageSizeGB = (
            self.recommend_storage_size()
        )
        options.autoExpandStorage = False
        options.autoExpandMaximumSizeGB = 0
        options.enableRestService = False

        options.shapeName = "MySQL.2"

        options.contactEmails = project.user_email or ""

        logging.info(f"Recommended DBSystem={options}")

        return options

    def recommend_availability_domain(
        self, availability_domains: list[AvailabilityDomain]
    ) -> str:
        import random
        ad = cast(str, random.choice(availability_domains).name)
        logging.info(f"Recommended availability domain={ad}")
        return ad

    def recommend_version(
        self,
        server_info: model.ServerInfo,
        versions: list[VersionSummary],
    ) -> str:

        def get_version_summary(version_prefix: str) -> Optional[VersionSummary]:
            for family in versions:
                if cast(str, family.version_family).startswith(version_prefix):
                    return family
            return None

        if server_info.serverType == ServerType.MariaDB:
            version_prefix = "8.4"
        else:
            nversion = dbsession.version_to_nversion(server_info.version)

            # for now, recommend the newest supported version of the same series
            if nversion // 100 <= 804:
                version_prefix = "8.4"
            else:
                version_prefix = server_info.version[
                    :server_info.version.find(".")
                ]

        vf = get_version_summary(version_prefix)
        assert vf and vf.versions, server_info.version

        version = vf.versions[-1].version
        logging.info(
            f"Recommended target version={version} for source={server_info.version} source_type={server_info.serverType.name}"
        )
        return version

    def recommend_shape(
        self, session, shapes: list[ShapeSummary]
    ) -> str:
        assert shapes

        (source_buffer_pool_size,) = session.run_sql(
            "select @@innodb_buffer_pool_size"
        ).fetch_one()

        logging.info(
            f"Searching shapes large enough for innodb_buffer_pool_size={source_buffer_pool_size}"
        )
        for shape in sorted(shapes, key=lambda s: s.memory_size_in_gbs):  # type: ignore
            if not shape.name.startswith("MySQL.") or shape.name.startswith("MySQL.VM."):
                continue
            if shape.is_supported_for and (
                ShapeSummary.IS_SUPPORTED_FOR_DBSYSTEM
                not in shape.is_supported_for
            ):
                continue

            default_bp = (
                get_default_buffer_pool_size_gb(
                    shape.memory_size_in_gbs, ha=False)
                * 1024
                * 1024
                * 1024
            )
            if default_bp < source_buffer_pool_size:
                continue

            logging.info(
                f"Shape {shape.name} mem={shape.memory_size_in_gbs} cpus={shape.cpu_core_count} looks ok"
            )

            return cast(str, shape.name)

        logging.warning(
            f"Could not find a suitable shape large enough for innodb_buffer_pool_size={source_buffer_pool_size}"
        )
        return ""

    @property
    def _estimated_db_size_gb(self) -> float:
        return self._server_info.dataSize / (1024 * 1024 * 1024.0)

    def recommend_storage_size(self) -> int:
        return max(
            k_min_storage_size_gb,
            int(self._estimated_db_size_gb * k_default_storage_size_multiplier),
        )
