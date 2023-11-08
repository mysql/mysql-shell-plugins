# Copyright (c) 2021, 2023, Oracle and/or its affiliates.
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

"""Sub-Module to manage the MySQL DbSystems"""

from mds_plugin import core, configuration, util
from mysqlsh.plugin_manager import plugin_function

DB_SYSTEM_ACTION_START = 1
DB_SYSTEM_ACTION_STOP = 2
DB_SYSTEM_ACTION_RESTART = 3
HW_CLUSTER_ACTION_START = 4
HW_CLUSTER_ACTION_STOP = 5
HW_CLUSTER_ACTION_RESTART = 6


def format_db_systems(items, current=None) -> str:
    """Formats a given list of objects in a human readable form

    Args:
        items: Either a list of objects or a single object
        current (str): OCID of the current item

    Returns:
       The db_systems formatted as str
    """

    # If a single db_system was given, wrap it in a list
    if not type(items) is list:
        items = [items]

    # return objects in READABLE text output
    out = ""
    id = 1
    for i in items:
        index = f"*{id:>3} " if current == i.id else f"{id:>4} "
        kind = "  "
        if hasattr(i, "is_supported_for_hw_cluster") and i.is_supported_for_hw_cluster:
            kind = "HW"
        elif hasattr(i, "is_supported_for_analytics_cluster") and i.is_supported_for_analytics_cluster:
            kind = "AN"
        out += (index +
                core.fixed_len(i.display_name, 24, ' ', True) +
                core.fixed_len(i.description, 42, ' ', True) +
                core.fixed_len(i.mysql_version, 11, ' ') +
                core.fixed_len(i.lifecycle_state, 11, ' ' + kind + '\n'))
        id += 1

    return out


def format_db_system_config(items) -> str:
    """Formats a given list of objects in a human readable form

    Args:
        items: Either a list of objects or a single object

    Returns:
       The objects formatted as str
    """

    # If a single db_system was given, wrap it in a list
    if not type(items) is list:
        items = [items]

    # return objects in READABLE text output
    out = ""
    id = 1
    for i in items:
        out += (f"{id:>4} " +
                core.fixed_len(i.display_name, 32, ' ', True) +
                core.fixed_len(i.description, 35, ' ', True) +
                core.fixed_len(i.shape_name, 20, ' ') +
                core.fixed_len(i.lifecycle_state, 11, '\n'))
        id += 1

    return out


def format_mysql_shapes(items) -> str:
    """Formats a given list of objects in a human readable form

    Args:
        items: Either a list of objects or a single object

    Returns:
       The objects formatted as str
    """
    # If a single db_system was given, wrap it in a list
    if not type(items) is list:
        items = [items]

    # return objects in READABLE text output
    out = (core.fixed_len('Shape Name', 32, ' ') +
        core.fixed_len('CPU Count', 12, ' ', align_right=True) +
        core.fixed_len('Memory Size', 12, '\n', align_right=True))
    id = 1
    for i in items:
        out += (f"{id:>4} " +
                core.fixed_len(i.name, 32, ' ', True) +
                core.fixed_len(str(i.cpu_core_count), 12, ' ', align_right=True) +
                core.fixed_len(str(i.memory_size_in_gbs) + ' GB', 12, '\n',  align_right=True))
        id += 1

    return out


def get_db_system_by_id(db_system_id, config=None):
    """Gets a DbSystem with the given id

    Args:
        db_system_id (str): OCID of the DbSystem.
        config (object): An OCI config object or None.

    Returns:
       None
    """
    import oci.mysql

    # Initialize the DbSystem client
    db_sys = core.get_oci_db_system_client(config=config)

    # Get the DbSystems with the given db_system_id
    db_system = db_sys.get_db_system(db_system_id=db_system_id).data

    return db_system


@plugin_function('mds.get.dbSystemConfiguration', shell=True, cli=True, web=True)
def get_db_system_configuration(**kwargs):
    """Gets a DB System Config

    If no name is given, the user can select from a list.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        config_name (str): The name of the config.
        configuration_id (str): The OCID of the configuration.
        shape (str): The name of the compute shape.
        availability_domain (str): The name of the availability domain.
        compartment_id (str): OCID of the parent compartment
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls

    Returns:
       The MySQL configuration object
    """

    config_name = kwargs.get("config_name")
    configuration_id = kwargs.get("configuration_id")
    availability_domain = kwargs.get("availability_domain")
    shape = kwargs.get("shape")

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)
    return_python_object = kwargs.get("return_python_object", False)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.mysql
        from mds_plugin import compartment, compute

        try:
            # Get MDS Client
            mds_client = core.get_oci_mds_client(config=config)

            # If an configuration_id was given, look it up
            if configuration_id is not None:
                return core.return_oci_object(
                    oci_object=mds_client.get_configuration(
                        configuration_id=configuration_id),
                    return_python_object=return_python_object,
                    return_formatted=return_formatted,
                    format_function=format_db_system_config)

            if not availability_domain:
                # Get the availability_domain name
                availability_domain_obj = compartment.get_availability_domain(
                    random_selection=not interactive,
                    compartment_id=compartment_id,
                    availability_domain=availability_domain,
                    config=config,
                    interactive=interactive,
                    return_python_object=True)
                if availability_domain_obj is None:
                    raise ValueError("No availability domain specified.")
                availability_domain = availability_domain_obj.name

            # Get the shapes
            shape_id = compute.get_shape_name(
                shape_name=shape, compartment_id=compartment_id,
                availability_domain=availability_domain, config=config,
                interactive=interactive)
            if shape_id is None or shape_id == "":
                raise ValueError("No shape specified.")

            # Get list of configs
            configs = mds_client.list_configurations(compartment_id).data
            # Only consider configs that support the given shape
            configs = [c for c in configs if c.shape_name == shape_id]

            for config in configs:
                if config.display_name == config_name:
                    return core.return_oci_object(
                        oci_object=config,
                        return_python_object=return_python_object,
                        return_formatted=return_formatted,
                        format_function=format_db_system_config)

            # If there is only a single config, use it
            if len(configs) == 1 or not interactive:
                return core.return_oci_object(
                    oci_object=configs[0],
                    return_python_object=return_python_object,
                    return_formatted=return_formatted,
                    format_function=format_db_system_config)

            # Let the user choose from the list
            print(f"\nPlease choose a MySQL Configuration from this list.\n")
            config = core.prompt_for_list_item(
                item_list=configs,
                prompt_caption="Please enter the name or index of the MySQL config: ",
                item_name_property="display_name", given_value=config_name,
                print_list=True)

            return core.return_oci_object(
                oci_object=config,
                return_python_object=return_python_object,
                return_formatted=return_formatted,
                format_function=format_db_system_config)
        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


def get_mysql_version(mysql_version=None, compartment_id=None, config=None):
    """Gets a MySQL version

    If a mysql_version is given, it is checked if that mysql_version is
    available. Otherwise the user can select a different version

    Args:
        mysql_version (str): The mysql_version.
        compartment_id (str): The OCID of the compartment.
        config (object): An OCI config object or None.

    Returns:
       None
    """

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
    except ValueError as e:
        print(f"ERROR: {str(e)}")
        return

    import oci.mysql
    from mds_plugin import compartment, compute

    # Get MDS Client
    mds_client = core.get_oci_mds_client(config=config)

    # Get list of versions
    version_summaries = mds_client.list_versions(compartment_id).data
    versions = []
    for vs in version_summaries:
        versions += vs.versions

    if len(versions) == 1:
        return versions[0].version

    # Let the user choose from the list
    if mysql_version is None:
        print(f"\nPlease choose a MySQL Version from this list.\n")

    version = core.prompt_for_list_item(
        item_list=versions,
        prompt_caption="Please enter the MySQL version or index: ",
        item_name_property="version", given_value=mysql_version,
        print_list=True)

    return None if version is None else version.version


def validate_mysql_password(password):
    """Validates the given password using the default MDS MySQL password rules

    - Should have at least one number.
    - Should have at least one uppercase and one lowercase character.
    - Should have at least one special symbol.
    - Should be between 8 to 20 characters long.

    Args:
        password (str): The password to validate

    Returns:
        True if the given password is valid, False otherwise
    """
    import re

    reg = (r"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*#?&])"
           r"[A-Za-z\d@$!#%*?&]{6,20}$")

    # compiling regex
    pattern = re.compile(reg)

    # searching regex
    return re.search(pattern, password)


def get_validated_mysql_password(password_caption, print_password_rules=True):
    """Gets a validated password using the default MDS MySQL password rules

    - Should have at least one number.
    - Should have at least one uppercase and one lowercase character.
    - Should have at least one special symbol.
    - Should be between 8 to 20 characters long.

    Args:
        prompt (str): The password prompt that should be printed

    Returns:
        The password as string
    """
    import mysqlsh

    if print_password_rules:
        print(
            f"When specifying the {password_caption} password, please use:\n"
            "  - a minimum of 8 characters\n  - one uppercase letter\n"
            "  - one lowercase letter\n  - one number\n  - one special char")

    # Loop until a valid password is given
    while True:
        password = mysqlsh.globals.shell.prompt(
            f"Please enter the {password_caption} password: ",
            {'defaultValue': '', 'type': 'password'}).strip()
        if password == "":
            return ""

        if validate_mysql_password(password):
            break
        else:
            print(
                "The given password does not comply to the password rules. "
                "Please try again.\n")

    i = 0
    while i < 2:
        password_2 = mysqlsh.globals.shell.prompt(
            f"Please confirm the {password_caption} password: ",
            {'defaultValue': '', 'type': 'password'})
        if password_2 == "":
            return ""

        if password == password_2:
            break
        else:
            print(
                "The given passwords do not match. Please try again.\n")
            i += 1

    if i >= 2:
        return ""
    else:
        return password


@plugin_function('mds.list.dbSystemShapes', shell=True, cli=True, web=True)
def list_db_system_shapes(**kwargs):
    """Lists Shapes available for MySQL DB Systems

    Lists all shapes of a given compartment.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        is_supported_for (str): Either DBSYSTEM (default), HEATWAVECLUSTER or "DBSYSTEM, HEATWAVECLUSTER"
        availability_domain (str): The name of the availability_domain to use
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_formatted (bool): If set to true, a list object is returned.
        return_python_object (bool): Used for internal plugin calls

    Returns:
        A list of DB Systems Shapes
    """

    is_supported_for = kwargs.get("is_supported_for", "DBSYSTEM")
    availability_domain = kwargs.get("availability_domain")

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)
    return_python_object = kwargs.get("return_python_object", False)

    import oci.mysql

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        support_list = []
        if 'DBSYSTEM' in is_supported_for:
            support_list.append('DBSYSTEM')
        if 'HEATWAVECLUSTER' in is_supported_for:
            support_list.append('HEATWAVECLUSTER')

        # Initialize the DbSystem client
        mds_client = core.get_oci_mds_client(config=config)

        # List the DbSystems of the current compartment
        data = mds_client.list_shapes(compartment_id=compartment_id,
            is_supported_for=support_list,
            availability_domain=availability_domain).data

        return core.return_oci_object(
            oci_object=data,
            return_python_object=return_python_object,
            return_formatted=return_formatted,
            format_function=format_mysql_shapes)

    except oci.exceptions.ServiceError as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except (ValueError, oci.exceptions.ClientError) as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.get.dbSystemShape')
def get_db_system_shape(**kwargs):
    """Gets a certain shape specified by name

    The shape is specific for the given compartment and availability_domain

    Args:
        **kwargs: Additional options

    Keyword Args:
        is_supported_for (str): Either DBSYSTEM (default), HEATWAVECLUSTER or "DBSYSTEM, HEATWAVECLUSTER"
        availability_domain (str): The name of the availability_domain to use
        compartment_id (str): OCID of the parent compartment.
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls

    Returns:
        An shape object or None
    """

    is_supported_for = kwargs.get("is_supported_for", "DBSYSTEM")
    availability_domain = kwargs.get("availability_domain")

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)
    return_python_object = kwargs.get("return_python_object", False)

    try:
        # Get the active config and compartment
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        # Get the list of available shapes
        shapes = list_db_system_shapes(
            is_supported_for=is_supported_for,
            availability_domain=availability_domain,
            compartment_id=compartment_id,
            config=config, interactive=interactive,
            raise_exceptions=True,
            return_python_object=True)

        if not shapes:
            raise Exception("No shapes found.")

        # Let the user choose from the list
        shape = core.prompt_for_list_item(
            item_list=shapes,
            prompt_caption="Please enter the name or index of the shape: ",
            item_name_property="name",
            print_list=True)

        return core.return_oci_object(
            oci_object=shape,
            return_formatted=return_formatted,
            return_python_object=return_python_object,
            format_function=format_mysql_shapes)
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {str(e)}')


@plugin_function('mds.list.dbSystems', shell=True, cli=True, web=True)
def list_db_systems(**kwargs):
    """Lists MySQL DB Systems

    Lists all DB Systems of a given compartment.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If set to true exceptions are raised
        return_formatted (bool): If set to true, a list object is returned.
        return_python_object (bool): Used for internal plugin calls

    Returns:
        A list of DB Systems
    """

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)
    return_python_object = kwargs.get("return_python_object", False)

    import oci.mysql

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        current_db_system_id = configuration.get_current_db_system_id(
            config=config)

        mds_client = core.get_oci_mds_client(config=config)

        # Get the list of shapes, cSpell:ignore ANALYTICSCLUSTER
        all_shapes = mds_client.list_shapes(compartment_id=compartment_id,
            is_supported_for=['DBSYSTEM','HEATWAVECLUSTER']).data
        hw_shapes = [s.name for s in all_shapes if "HEATWAVECLUSTER" in s.is_supported_for]
        # Support for "ANALYTICSCLUSTER" has been removed from the SDK
        analytics_shapes = [] #[s.name for s in all_shapes if "ANALYTICSCLUSTER" in s.is_supported_for]

        # Initialize the DbSystem client
        db_sys = core.get_oci_db_system_client(config=config)

        # List the DbSystems of the current compartment
        data = db_sys.list_db_systems(compartment_id=compartment_id).data

        # Filter out all deleted db_systems
        data = [d for d in data if d.lifecycle_state != "DELETED"]

        # Add supported HW flags
        for d in data:
            setattr(d, "is_supported_for_hw_cluster",  d.shape_name in hw_shapes)
            d.swagger_types["is_supported_for_hw_cluster"] = "bool"
            setattr(d, "is_supported_for_analytics_cluster",  d.shape_name in analytics_shapes)
            d.swagger_types["is_supported_for_analytics_cluster"] = "bool"

        return core.return_oci_object(
            oci_object=data,
            return_python_object=return_python_object,
            return_formatted=return_formatted,
            format_function=format_db_systems,
            current=current_db_system_id)

    except oci.exceptions.ServiceError as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except (ValueError, oci.exceptions.ClientError) as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.get.dbSystem', shell=True, cli=True, web=True)
def get_db_system(**kwargs):
    """Gets a DbSystem with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        db_system_name (str): The new name of the compartment.
        db_system_id (str): OCID of the DbSystem.
        ignore_current (bool): Whether to not default to the current bastion.
        compartment_id (str): OCID of the parent compartment
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        return_formatted (bool): If true a human readable string is returned
        return_python_object (bool): Used for internal plugin calls

    Returns:
       None
    """

    db_system_name = kwargs.get("db_system_name")
    db_system_id = kwargs.get("db_system_id")
    ignore_current = kwargs.get("ignore_current", False)

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)
    return_formatted = kwargs.get("return_formatted", interactive)
    return_python_object = kwargs.get("return_python_object", False)

    try:
        # Get the active config and compartment
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        current_db_system_id = configuration.get_current_db_system_id(
            config=config)
        if (not ignore_current and db_system_name is None
                and db_system_id is None and current_db_system_id):
            db_system_id = current_db_system_id

        import oci.identity
        import oci.util

        try:
            if db_system_id:
                return core.return_oci_object(
                    oci_object=get_db_system_by_id(
                        db_system_id=db_system_id, config=config),
                    return_formatted=return_formatted,
                    return_python_object=return_python_object,
                    format_function=format_db_systems,
                    current=current_db_system_id)

            # Initialize the DbSystem client
            db_sys = core.get_oci_db_system_client(config=config)

            # List the DbSystems of the current compartment
            db_systems = db_sys.list_db_systems(
                compartment_id=compartment_id).data

            # Filter out all deleted compartments
            db_systems = [u for u in db_systems
                          if u.lifecycle_state != "DELETED"]

            if len(db_systems) == 0:
                if interactive:
                    print("No MySQL DB Systems available in this compartment.")
                    return
                return None

            # If a name was given, look it up in the list and return it
            if db_system_name is not None:
                for d in db_systems:
                    if d.display_name.lower() == db_system_name.lower():
                        return core.return_oci_object(
                            oci_object=get_db_system_by_id(
                                db_system_id=d.id, config=config),
                            return_formatted=return_formatted,
                            return_python_object=return_python_object,
                            format_function=format_db_systems,
                            current=current_db_system_id)

            # If the db_systems was not found by id or name, return None if
            # not in interactive mode
            if not interactive:
                return None

            # Let the user choose from the list
            db_system = core.prompt_for_list_item(
                item_list=db_systems,
                prompt_caption=("Please enter the name or index "
                                "of the MySQL DB System: "),
                item_name_property="display_name",
                given_value=db_system_name,
                print_list=True)

            if db_system:
                return core.return_oci_object(
                    oci_object=get_db_system_by_id(
                        db_system_id=db_system.id, config=config),
                    return_formatted=return_formatted,
                    return_python_object=return_python_object,
                    format_function=format_db_systems,
                    current=current_db_system_id)
        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.get.dbSystemId', shell=True, cli=True, web=True)
def get_db_system_id(**kwargs):
    """Gets information about the DbSystem with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        db_system_name (str): The new name of the compartment.
        ignore_current (bool): Whether to not default to the current bastion.
        compartment_id (str): OCID of the compartment.
        config (object): An OCI config object or None.
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised

    Returns:
       None
    """

    db_system_name = kwargs.get("db_system_name")
    ignore_current = kwargs.get("ignore_current", False)

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    db_system = get_db_system(
        db_system_name=db_system_name,
        ignore_current=ignore_current,
        compartment_id=compartment_id,
        config=config,
        config_profile=config_profile,
        interactive=interactive,
        raise_exceptions=raise_exceptions,
        return_formatted=False,
        return_python_object=True)

    return None if db_system is None else db_system.id


@plugin_function('mds.update.dbSystem', shell=True, cli=True, web=True)
def update_db_system(**kwargs):
    """Updates the DbSystem with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        db_system_name (str): The name of the DB System.
        db_system_id (str): OCID of the DbSystem.
        ignore_current (bool): Whether to not default to the current bastion.
        new_name (str): The new name
        new_description (str): The new description
        new_freeform_tags (str): The new freeform_tags formatted as string
        compartment_id (str): OCID of the parent compartment
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised


    Returns:
       None
    """

    db_system_name = kwargs.get("db_system_name")
    db_system_id = kwargs.get("db_system_id")
    ignore_current = kwargs.get("ignore_current", False)

    new_name = kwargs.get("new_name")
    new_description = kwargs.get("new_description")
    new_freeform_tags = kwargs.get("new_freeform_tags")

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        current_db_system_id = configuration.get_current_db_system_id(
            config=config)
        if (not ignore_current and db_system_name is None
                and db_system_id is None and current_db_system_id):
            db_system_id = current_db_system_id

        import oci.identity
        import oci.mysql
        import mysqlsh
        import json

        try:
            # Get the db_system based on input params
            db_system = get_db_system(
                db_system_name=db_system_name, db_system_id=db_system_id,
                compartment_id=compartment_id, config=config,
                interactive=interactive, raise_exceptions=True,
                return_python_object=True)
            if db_system is None:
                if db_system_name or db_system_id:
                    raise ValueError("DB System not found.")
                else:
                    raise Exception("Cancelling operation.")

            if not new_name and interactive:
                # Prompt the user for the new values
                new_name = mysqlsh.globals.shell.prompt(
                    f"Please enter a new name for the DbSystem "
                    f"[{db_system.display_name}]: ",
                    {'defaultValue': db_system.display_name}).strip()

            if not new_description and interactive:
                new_description = mysqlsh.globals.shell.prompt(
                    "Please enter a new description for the DbSystem "
                    "[current description]: ",
                    {'defaultValue': db_system.description
                        if db_system.description is not None else ''}).strip()
            if not new_freeform_tags and interactive:
                new_freeform_tags = mysqlsh.globals.shell.prompt(
                    f"Please enter new freeform_tags for the DbSystem "
                    f"[{str(db_system.freeform_tags)}]: ",
                    {'defaultValue': json.dumps(db_system.freeform_tags)
                        if db_system.freeform_tags is not None else ''}).strip()
            if new_freeform_tags and isinstance(new_freeform_tags, str):
                new_freeform_tags = json.loads(new_freeform_tags)

            if not new_name and not new_freeform_tags and not new_freeform_tags:
                raise ValueError("Nothing to update.")

            # Initialize the DbSystem client
            db_sys = core.get_oci_db_system_client(config=config)

            update_details = oci.mysql.models.UpdateDbSystemDetails(
                display_name=new_name,
                description=new_description,
                freeform_tags=new_freeform_tags
            )
            db_sys.update_db_system(db_system.id, update_details)

            if interactive:
                print(f"DbSystem {db_system.display_name} is being updated.")

        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except (ValueError, oci.exceptions.ClientError) as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.create.dbSystem', shell=True, cli=True, web=True)
def create_db_system(**kwargs):
    """Creates a DbSystem with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        db_system_name (str): The new name of the DB System.
        description (str): The new description of the DB System.
        availability_domain (str): The name of the availability_domain
        shape (str): The compute shape name to use for the instance
        subnet_id (str): The OCID of the subnet to use
        configuration_id (str): The OCID of the MySQL configuration
        data_storage_size_in_gbs (int): The data storage size in gigabytes
        mysql_version (str): The MySQL version
        admin_username (str): The name of the administrator user account
        admin_password (str): The password of the administrator account
        private_key_file_path (str): The file path to an SSH private key
        par_url (str): The PAR url used for initial data import
        perform_cleanup_after_import (bool): Whether the bucket and PARs should
            be kept or deleted if an import took place
        source_mysql_uri (str): The MySQL Connection URI if data should
            be imported from an existing MySQL Server instance
        source_mysql_password (str): The password to use when data
            should be imported from an existing MySQL Server instance
        source_local_dump_dir (str): The path to a local directory that
            contains a dump
        source_bucket (str): The name of the source bucket that contains
            a dump
        host_image_id (str): OCID of the host image to use for this Instance.
            Private API only.
        defined_tags (dict): The defined_tags of the dynamic group.
        freeform_tags (dict): The freeform_tags of the dynamic group
        compartment_id (str): The OCID of the compartment
        config (object): An OCI config object or None.
        interactive (bool): Ask the user for input if needed
        return_object (bool): Whether to return the object when created

    Returns:
       None or the new DB System object if return_object is set to true
    """
    db_system_name = kwargs.get("db_system_name")
    description = kwargs.get("description")
    availability_domain = kwargs.get("availability_domain")
    shape = kwargs.get("shape")
    subnet_id = kwargs.get("subnet_id")
    configuration_id = kwargs.get("configuration_id")
    data_storage_size_in_gbs = kwargs.get("data_storage_size_in_gbs")
    mysql_version = kwargs.get("mysql_version")
    admin_username = kwargs.get("admin_username")
    admin_password = kwargs.get("admin_password")
    private_key_file_path = kwargs.get(
        "private_key_file_path", "~/.ssh/id_rsa")
    par_url = kwargs.get("par_url")
    perform_cleanup_after_import = kwargs.get(
        "perform_cleanup_after_import")
    source_mysql_uri = kwargs.get("source_mysql_uri")
    source_mysql_password = kwargs.get("source_mysql_password")
    source_local_dump_dir = kwargs.get("source_local_dump_dir")
    source_bucket = kwargs.get("source_bucket")
    #host_image_id = kwargs.get("host_image_id")
    defined_tags = kwargs.get("defined_tags")
    # Conversion from Shell Dict type
    if defined_tags:
        defined_tags = dict(defined_tags)
    freeform_tags = kwargs.get("freeform_tags")
    # Conversion from Shell Dict type
    if freeform_tags:
        freeform_tags = dict(freeform_tags)
    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    interactive = kwargs.get("interactive", True)
    return_object = kwargs.get("return_object", False)

    try:
        # Get the active config and compartment
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.mysql
        from pathlib import Path
        import mysqlsh
        from mds_plugin import compartment, compute, network, object_store
        import datetime
        import time

        # Set the import_source_type to 0 to default to a clean new DB System
        import_source_type = 0

        # Check if source_* parameters are given and if so, set the correct
        # import_source_type
        if source_mysql_uri is not None:
            # Import from an existing MySQL Server instance
            import_source_type = 1
        elif source_local_dump_dir is not None:
            # Import from a local data dir
            import_source_type = 2
        elif source_bucket is not None:
            # Import from an existing bucket
            import_source_type = 3

        # If the user did not specify a par_url, or other source paremeter,
        # let him choose if he wants to import data from a given source

        if interactive and import_source_type == 0 and par_url is None:
            print("Choose one of the following options of how to create the "
                  "MySQL DB System:\n")

            import_sources = [
                "Create a clean MySQL DB System",
                ("Create a MySQL DB System from an existing MySQL Server "
                 "instance"),
                "Create a MySQL DB System from a local dump",
                ("Create a MySQL DB System from a dump stored on OCI "
                 "Object Storage")
            ]
            import_source = core.prompt_for_list_item(
                item_list=import_sources,
                prompt_caption=("Please enter the index of an option listed "
                                "above: "),
                prompt_default_value='', print_list=True)
            if import_source == "":
                print("Operation cancelled.")
                return
            import_source_type = import_sources.index(import_source)

        # Get a name
        if not db_system_name and interactive:
            db_system_name = core.prompt(
                "Please enter the name for the new DB System: ").strip()
        if not db_system_name:
            raise Exception("No name given. "
                            "Operation cancelled.")

        # Get a description
        if not description and interactive:
            description = core.prompt(
                "Please enter a description for the new DB System: ").strip()

        # Get an admin_username
        if not admin_username and interactive:
            admin_username = core.prompt(
                "MySQL Administrator account name [admin]: ",
                {'defaultValue': 'admin'}).strip()
        if not admin_username:
            raise Exception("No admin username given. "
                            "Operation cancelled.")

        # Get an admin_password
        if not admin_password and interactive:
            admin_password = get_validated_mysql_password(
                password_caption="MySQL Administrator account")
        if not admin_password:
            raise Exception("No admin password given. "
                            "Operation cancelled.")

        # Get data_storage_size_in_gbs
        if not data_storage_size_in_gbs and interactive:
            data_storage_size_in_gbs = core.prompt(
                "Please enter the amount of data storage size in gigabytes "
                "with a minimum of 50 GB [50]: ",
                {'defaultValue': '50'}).strip()
            try:
                data_storage_size_in_gbs = int(data_storage_size_in_gbs)
            except ValueError:
                ValueError("Please enter a number for data storage size.\n")

        if not data_storage_size_in_gbs:
            raise Exception("No data storage size given. "
                            "Operation cancelled.")

        # Get the availability_domain name
        availability_domain_obj = compartment.get_availability_domain(
            random_selection=not interactive,
            compartment_id=compartment_id,
            availability_domain=availability_domain,
            config=config, interactive=interactive,
            return_python_object=True)
        if not availability_domain_obj:
            raise Exception("No availability domain selected. "
                            "Operation cancelled.")
        availability_domain = availability_domain_obj.name
        if interactive:
            print(f"Using availability domain {availability_domain}.")

        # Get the shapes
        shape_id = compute.get_shape_name(
            shape_name=shape, limit_shapes_to=[
                "VM.Standard.E2.1", "VM.Standard.E2.2",
                "VM.Standard.E2.4", "VM.Standard.E2.8"],
            compartment_id=compartment_id,
            availability_domain=availability_domain, config=config,
            interactive=interactive)
        if shape_id is None or shape_id == "":
            print("Compute Shape not set or found. Operation cancelled.")
            return
        if interactive:
            print(f"Using shape {shape_id}.")

        # Get private subnet
        subnet = network.get_subnet(
            subnet_id=subnet_id, public_subnet=False,
            compartment_id=compartment_id, config=config,
            interactive=interactive, availability_domain=availability_domain)
        if subnet is None:
            print("Operation cancelled.")
            return
        if interactive:
            print(f"Using subnet {subnet.display_name}.")

        # Get mysql_version
        mysql_version = get_mysql_version(compartment_id=compartment_id,
                                          config=config)
        if mysql_version is None:
            print("Operation cancelled.")
            return
        print(f"Using MySQL version {mysql_version}.")

        # Get mysql_configuration
        mysql_configuration = get_db_system_configuration(
            configuration_id=configuration_id, shape=shape_id,
            availability_domain=availability_domain,
            compartment_id=compartment_id, config=config, return_python_object=True)
        if mysql_configuration is None:
            print("Operation cancelled.")
            return
        print(f"Using MySQL configuration {mysql_configuration.display_name}.")

        # TODO Check Limits
        # limits.list_limit_values(config["tenancy"], "mysql").data
        # limits.get_resource_availability(
        #     service_name="mysql", limit_name="vm-standard-e2-4-count",
        #     compartment_id=config["tenancy"],
        #     availability_domain="fblN:US-ASHBURN-AD-1").data
        # limits.get_resource_availability(
        #     service_name="compute", limit_name="standard-e2-core-ad-count",
        #     compartment_id=config["tenancy"],
        #     availability_domain="fblN:US-ASHBURN-AD-1").data

        # If requested, prepare import
        if import_source_type > 0:
            # If a bucket needs to be created, define a name for it
            if import_source_type == 1 or import_source_type == 2:
                # Take all alphanumeric chars from the DB System name
                # to create the bucket_name
                bucket_name = (
                    f"{''.join(e for e in db_system_name if e.isalnum())}_import_"
                    f"{datetime.datetime.now():%Y%m%d%H%M%S}")

                print(f"\nCreating bucket {bucket_name}...")

                bucket = object_store.create_bucket(
                    bucket_name=bucket_name, compartment_id=compartment_id,
                    config=config, return_object=True)
                if bucket is None:
                    print("Cancelling operation")
                    return

                if perform_cleanup_after_import is None:
                    perform_cleanup_after_import = True

            # Create a MySQL DB System from an existing MySQL Server instance
            if import_source_type == 1:
                # Start the dump process
                if not util.dump_to_bucket(bucket_name=bucket.name,
                                           connection_uri=source_mysql_uri,
                                           connection_password=source_mysql_password,
                                           create_bucket_if_not_exists=True,
                                           object_name_prefix="",
                                           interactive=interactive,
                                           return_true_on_success=True):
                    print(f"Could not dump the given instance to the object "
                          f"store bucket {bucket.name}")
                    return
            # Create a MySQL DB System from local dir
            elif import_source_type == 2:
                if interactive and source_local_dump_dir is None:
                    source_local_dump_dir = mysqlsh.globals.shell.prompt(
                        "Please specify the directory path that contains the "
                        "dump: ",
                        {'defaultValue': ''}).strip()
                    if source_local_dump_dir == "":
                        print("Operation cancelled.")
                        return
                elif source_local_dump_dir is None:
                    print("No directory path given. Operation cancelled.")
                    return

                # Upload the files from the given directory to the bucket
                file_count = object_store.create_bucket_objects_from_local_dir(
                    local_dir_path=source_local_dump_dir,
                    bucket_name=bucket.name,
                    object_name_prefix="",
                    compartment_id=compartment_id, config=config,
                    interactive=False)
                if file_count is None:
                    print("Cancelling operation")
                    return
            elif import_source_type == 3:
                # Create a MySQL DB System from a bucket
                bucket = object_store.get_bucket(
                    bucket_name=source_bucket,
                    compartment_id=compartment_id,
                    config=config)
                if bucket is None:
                    print("Cancelling operation")
                    return
                bucket_name = bucket.name

                if perform_cleanup_after_import is None:
                    perform_cleanup_after_import = False

            # Create PAR for import manifest and progress files
            par, progress_par = util.create_bucket_import_pars(
                object_name_prefix="",
                bucket_name=bucket.name,
                db_system_name=db_system_name,
                compartment_id=compartment_id,
                config=config)
            if par is None or progress_par is None:
                return

            # Build URLs
            par_url_prefix = object_store.get_par_url_prefix(config=config)
            par_url = par_url_prefix + par.access_uri
            # progress_par_url = par_url_prefix + progress_par.access_uri

        # Once the API supports the new PAR based import, build the
        # import_details using the given par_url
        # if par_url:
        #     import urllib.parse
        #     import_details = oci.mysql.models.\
        #         CreateDbSystemSourceImportFromUrlDetails(
        #             source_type=oci.mysql.models.
        #             CreateDbSystemSourceImportFromUrlDetails.
        #             SOURCE_TYPE_IMPORTURL,
        #             source_url=(f'{par_url}?progressPar='
        #                         f'{urllib.parse.quote(progress_par_url)}'))

        db_system_details = oci.mysql.models.CreateDbSystemDetails(
            description=description,
            admin_username=admin_username,
            admin_password=admin_password,
            compartment_id=compartment_id,
            configuration_id=mysql_configuration.id,
            data_storage_size_in_gbs=data_storage_size_in_gbs,
            display_name=db_system_name,
            mysql_version=mysql_version,
            shape_name=shape_id,
            availability_domain=availability_domain,
            subnet_id=subnet.id,
            defined_tags=defined_tags,
            freeform_tags=freeform_tags
            # host_image_id=host_image_id
            # source=import_details
        )

        # Get DbSystem Client
        db_sys = core.get_oci_db_system_client(config=config)

        # Create DB System
        new_db_system = db_sys.create_db_system(db_system_details).data

        # If there was a PAR URL given, wait till the system becomes
        # ACTIVE and then perform the clean up work
        if par_url is not None:
            print("Waiting for MySQL DB System to become active.\n"
                  "This can take up to 20 minutes or more...", end="")
            # Wait until the lifecycle_state == ACTIVE, 20 minutes max
            cycles = 0
            while cycles < 240:
                db_system = db_sys.get_db_system(new_db_system.id).data
                if db_system.lifecycle_state == "ACTIVE" or \
                        db_system.lifecycle_state == "FAILED":
                    break
                else:
                    time.sleep(10)
                    print(".", end="")
                cycles += 1
            print("")

            # Until the API is ready to directly import at deployment time,
            # also start the import from here

            if db_system.lifecycle_state == "ACTIVE":
                util.import_from_bucket(
                    bucket_name=bucket_name,
                    db_system_id=new_db_system.id,
                    db_system_name=db_system_name,
                    object_name_prefix="",
                    admin_username=admin_username,
                    admin_password=admin_password,
                    private_key_file_path=private_key_file_path,
                    perform_cleanup=perform_cleanup_after_import,
                    compartment_id=compartment_id,
                    config=config,
                    interactive=False
                )
        else:
            if return_object:
                return new_db_system
            else:
                if new_db_system.lifecycle_state == "CREATING":
                    print(f"\nMySQL DB System {db_system_name} is being created.\n"
                          f"Use mds.ls() to check it's provisioning state.\n")
                else:
                    print(f"\nThe creation of the MySQL DB System {db_system_name} "
                          "failed.\n")

    except oci.exceptions.ServiceError as e:
        if not interactive:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (ValueError, oci.exceptions.ClientError) as e:
        if not interactive:
            raise
        print(f'ERROR: {e}')
        return


@plugin_function('mds.delete.dbSystem', shell=True, cli=True, web=True)
def delete_db_system(**kwargs):
    """Updates the DbSystem with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        db_system_name (str): The name of the DB System.
        db_system_id (str): OCID of the DbSystem.
        await_completion (bool): Whether to wait till the DbSystem reaches
            the desired lifecycle state
        ignore_current (bool): Whether to not default to the current bastion.
        compartment_id (str): OCID of the parent compartment
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised


    Returns:
       None
    """

    db_system_name = kwargs.get("db_system_name")
    db_system_id = kwargs.get("db_system_id")
    await_completion = kwargs.get("await_completion")
    ignore_current = kwargs.get("ignore_current", False)

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        # Get the active config and compartment
        try:
            import oci.mysql
            import mysqlsh

            db_system = get_db_system(
                db_system_name=db_system_name, db_system_id=db_system_id,
                compartment_id=compartment_id, config=config,
                interactive=interactive, raise_exceptions=raise_exceptions,
                ignore_current=ignore_current,
                return_python_object=True)
            if db_system is None:
                if db_system_name or db_system_id:
                    raise ValueError("DB System not found.")
                else:
                    raise Exception("Cancelling operation.")

            if interactive:
                # Prompt the user for specifying a compartment
                prompt = mysqlsh.globals.shell.prompt(
                    f"Are you sure you want to delete the MySQL DB System "
                    f"{db_system.display_name} [yes/NO]: ",
                    {'defaultValue': 'no'}).strip().lower()

                if prompt != "yes":
                    print("Deletion aborted.\n")
                    return

            # Get DbSystem Client
            db_sys = core.get_oci_db_system_client(config=config)

            # Delete the DB System
            work_request_id = db_sys.delete_db_system(db_system.id).headers["opc-work-request-id"]

            # If the function should wait till the bastion reaches the correct
            # lifecycle state
            if await_completion:
                await_lifecycle_state(
                    db_system.id, "DELETED", "complete the deletion process",
                    config, interactive, work_request_id)
            elif interactive:
                print(f"MySQL DB System '{db_system.display_name}' is being "
                      "deleted.")
        except oci.exceptions.ServiceError as e:
            if interactive:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
            return
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.stop.dbSystem', shell=True, cli=True, web=True)
def stop_db_system(**kwargs):
    """Stops the DbSystem with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        db_system_name (str): The name of the DB System.
        db_system_id (str): OCID of the DbSystem.
        await_completion (bool): Whether to wait till the DbSystem reaches
            the desired lifecycle state
        ignore_current (bool): Whether to not default to the current bastion.
        compartment_id (str): OCID of the parent compartment
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised


    Returns:
       None
    """

    change_lifecycle_state(**kwargs, action=DB_SYSTEM_ACTION_STOP)


@plugin_function('mds.start.dbSystem', shell=True, cli=True, web=True)
def start_db_system(**kwargs):
    """Starts the DbSystem with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        db_system_name (str): The name of the DB System.
        db_system_id (str): OCID of the DbSystem.
        await_completion (bool): Whether to wait till the DbSystem reaches
            the desired lifecycle state
        ignore_current (bool): Whether to not default to the current bastion.
        compartment_id (str): OCID of the parent compartment
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised


    Returns:
       None
    """

    change_lifecycle_state(**kwargs, action=DB_SYSTEM_ACTION_START)


@plugin_function('mds.restart.dbSystem', shell=True, cli=True, web=True)
def restart_db_system(**kwargs):
    """Restarts the DbSystem with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        db_system_name (str): The name of the DB System.
        db_system_id (str): OCID of the DbSystem.
        await_completion (bool): Whether to wait till the DbSystem reaches
            the desired lifecycle state
        ignore_current (bool): Whether to not default to the current bastion.
        compartment_id (str): OCID of the parent compartment
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised


    Returns:
       None
    """

    change_lifecycle_state(**kwargs, action=DB_SYSTEM_ACTION_RESTART)


@plugin_function('mds.stop.heatWaveCluster', shell=True, cli=True, web=True)
def stop_hw_cluster(**kwargs):
    """Stops the HeatWave cluster with the given DBSystem id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        db_system_name (str): The name of the DB System.
        db_system_id (str): OCID of the DbSystem.
        await_completion (bool): Whether to wait till the DbSystem reaches
            the desired lifecycle state
        ignore_current (bool): Whether to not default to the current bastion.
        compartment_id (str): OCID of the parent compartment
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised


    Returns:
       None
    """

    change_lifecycle_state(**kwargs, action=HW_CLUSTER_ACTION_STOP)


@plugin_function('mds.start.heatWaveCluster', shell=True, cli=True, web=True)
def start_hw_cluster(**kwargs):
    """Starts the HeatWave cluster with the given DBSystem id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        db_system_name (str): The name of the DB System.
        db_system_id (str): OCID of the DbSystem.
        await_completion (bool): Whether to wait till the DbSystem reaches
            the desired lifecycle state
        ignore_current (bool): Whether to not default to the current bastion.
        compartment_id (str): OCID of the parent compartment
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised


    Returns:
       None
    """

    change_lifecycle_state(**kwargs, action=HW_CLUSTER_ACTION_START)


@plugin_function('mds.restart.heatWaveCluster', shell=True, cli=True, web=True)
def restart_hw_cluster(**kwargs):
    """Restarts the HeatWave cluster with the given DBSystem id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        db_system_name (str): The name of the DB System.
        db_system_id (str): OCID of the DbSystem.
        await_completion (bool): Whether to wait till the DbSystem reaches
            the desired lifecycle state
        ignore_current (bool): Whether to not default to the current bastion.
        compartment_id (str): OCID of the parent compartment
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised


    Returns:
       None
    """

    change_lifecycle_state(**kwargs, action=HW_CLUSTER_ACTION_RESTART)


def change_lifecycle_state(**kwargs):
    """Starts or stops the DbSystem with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        db_system_name (str): The name of the DB System.
        db_system_id (str): OCID of the DbSystem.
        await_completion (bool): Whether to wait till the DbSystem reaches
            the desired lifecycle state
        ignore_current (bool): Whether to not default to the current bastion.
        compartment_id (str): OCID of the parent compartment
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised
        action (int): The action to execute


    Returns:
       None
    """
    db_system_name = kwargs.get("db_system_name")
    db_system_id = kwargs.get("db_system_id")
    await_completion = kwargs.get("await_completion")
    ignore_current = kwargs.get("ignore_current", False)

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    action = kwargs.get("action")

    if action == DB_SYSTEM_ACTION_START or action == HW_CLUSTER_ACTION_START:
        action_name = "start"
        action_state = "ACTIVE"
    elif action == DB_SYSTEM_ACTION_STOP or action == HW_CLUSTER_ACTION_STOP:
        action_name = "stop"
        action_state = "INACTIVE"
    elif action == DB_SYSTEM_ACTION_RESTART or action == HW_CLUSTER_ACTION_RESTART:
        action_name = "restart"
        action_state = "ACTIVE"
    else:
        raise ValueError("Unknown action given.")

    db_system_action = (
        action == DB_SYSTEM_ACTION_START or action == DB_SYSTEM_ACTION_STOP or action == DB_SYSTEM_ACTION_RESTART
    )

    action_obj = "DB System" if db_system_action else "HeatWave Cluster"

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        # Get the active config and compartment
        try:
            import oci.mysql
            import mysqlsh

            db_system = get_db_system(
                db_system_name=db_system_name, db_system_id=db_system_id,
                compartment_id=compartment_id, config=config,
                interactive=interactive, raise_exceptions=raise_exceptions,
                ignore_current=ignore_current,
                return_python_object=True)
            if db_system is None:
                if db_system_name or db_system_id:
                    raise ValueError("DB System not found.")
                else:
                    raise Exception("Cancelling operation.")
            else:
                db_system_id = db_system.id

            if interactive:
                # Prompt the user for specifying a compartment
                prompt = mysqlsh.globals.shell.prompt(
                    f"Are you sure you want to {action_name} the {action_obj} "
                    f"{db_system.display_name} [yes/NO]: ",
                    {'defaultValue': 'no'}).strip().lower()

                if prompt != "yes":
                    print("Operation cancelled.\n")
                    return

            # Get DbSystem Client
            db_sys = core.get_oci_db_system_client(config=config)
            work_request_id = None

            if action == DB_SYSTEM_ACTION_STOP:
                # Stop the DB System
                work_request_id = db_sys.stop_db_system(
                    db_system_id,
                    oci.mysql.models.StopDbSystemDetails(
                        shutdown_type="IMMEDIATE"
                    )).headers["opc-work-request-id"]
            elif action == DB_SYSTEM_ACTION_START:
                # Start the DB System
                work_request_id = db_sys.start_db_system(db_system_id).headers["opc-work-request-id"]
            elif action == DB_SYSTEM_ACTION_RESTART:
                # Restart the DB System
                work_request_id = db_sys.restart_db_system(
                    db_system_id,
                    oci.mysql.models.RestartDbSystemDetails(
                        shutdown_type="IMMEDIATE"
                    ))
            elif action == HW_CLUSTER_ACTION_STOP:
                # Stop the HW Cluster
                work_request_id = db_sys.stop_heat_wave_cluster(db_system_id).headers["opc-work-request-id"]
            elif action == HW_CLUSTER_ACTION_START:
                # Start the HW Cluster
                work_request_id = db_sys.start_heat_wave_cluster(db_system_id).headers["opc-work-request-id"]
            elif action == HW_CLUSTER_ACTION_RESTART:
                # Restart the HW Cluster
                work_request_id = db_sys.restart_heat_wave_cluster(db_system_id).headers["opc-work-request-id"]

            # If the function should wait till the bastion reaches the correct
            # lifecycle state

            if await_completion:
                if db_system_action:
                    await_lifecycle_state(
                        db_system_id, action_state, action_name,
                        config, interactive, work_request_id)
                else:
                    await_hw_cluster_lifecycle_state(
                        db_system_id, action_state, action_name,
                        config, interactive, work_request_id)
            elif interactive:
                print(f"MySQL {action_obj} '{db_system.display_name}' is being "
                    f"{action_name}{'p' if action_name == 'stop' else ''}ed.")

        except oci.exceptions.ServiceError as e:
            if interactive:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
            return
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


def await_lifecycle_state(db_system_id, action_state, action_name, config, interactive, work_request_id):
    """Waits of the db_system to reach the desired lifecycle state

    Args:
        db_system_id (str): OCID of the DbSystem.
        action_state (str): The lifecycle state to reach
        action_name (str): The name of the action to be performed
        config (dict): An OCI config object or None
        interactive (bool): Indicates whether to execute in interactive mode
        request_id (bool): The request_id of the action

    Returns:
       None
    """
    import time

    # Get DbSystem Client
    db_sys = core.get_oci_db_system_client(config=config)

    # Get WorkRequest Client
    req_client = core.get_oci_work_requests_client(config=config)

    # Wait for the lifecycle to reach desired state
    cycles = 0
    while cycles < 120:
        db_system = db_sys.get_db_system(
            db_system_id=db_system_id).data

        if db_system.lifecycle_state == action_state:
            break
        else:
            if interactive:
                s = "." * (cycles + 1)
                try:
                    if work_request_id:
                        req = req_client.get_work_request(work_request_id=work_request_id).data
                        s = f" {req.percent_complete:.0f}% completed."
                except:
                    pass

                print(f'Waiting for DB System to {action_name}...{s}', end='\r')
            time.sleep(5)
        cycles += 1

    if interactive:
        print("")

    if db_system.lifecycle_state != action_state:
        raise Exception("The DB System did not reach the correct "
                        "state within 10 minutes.")
    if interactive:
        print(f"DB System '{db_system.display_name}' did "
              f"{action_name} successfully.")


def await_hw_cluster_lifecycle_state(db_system_id, action_state, action_name, config, interactive, work_request_id):
    """Waits of the db_system to reach the desired lifecycle state

    Args:
        db_system_id (str): OCID of the DbSystem.
        action_state (str): The lifecycle state to reach
        action_name (str): The name of the action to be performed
        config (dict): An OCI config object or None
        interactive (bool): Indicates whether to execute in interactive mode

    Returns:
       None
    """
    import time

    # Get DbSystem Client
    db_sys = core.get_oci_db_system_client(config=config)

    # Get WorkRequest Client
    req_client = core.get_oci_work_requests_client(config=config)

    # Wait for the lifecycle to reach desired state
    cycles = 0
    while cycles < 240:
        db_system = db_sys.get_db_system(
            db_system_id=db_system_id).data
        if db_system.heat_wave_cluster and db_system.heat_wave_cluster.lifecycle_state == action_state:
            break
        else:
            if interactive:
                s = "." * (cycles + 1)
                try:
                    if work_request_id:
                        req = req_client.get_work_request(work_request_id=work_request_id).data
                        s = f" {req.percent_complete:.0f}% completed."
                except:
                    pass

                print(f'Waiting for HeatWave Cluster to {action_name}...{s}')
            time.sleep(5)
        cycles += 1

    if interactive:
        print("")

    if (not db_system.heat_wave_cluster) or db_system.heat_wave_cluster.lifecycle_state != action_state:
        raise Exception("The HeatWave Cluster did not reach the correct "
                        "state within 20 minutes.")
    if interactive:
        print(f"The HeatWave Cluster of DB System '{db_system.display_name}' did "
              f"{action_name} successfully.")


@plugin_function('mds.create.heatWaveCluster', shell=True, cli=True, web=True)
def create_hw_cluster(**kwargs):
    """Adds a HeatWave cluster to the DbSystem with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        db_system_name (str): The name of the DB System.
        db_system_id (str): OCID of the DbSystem.
        ignore_current (bool): Whether to not default to the current DB System.
        cluster_size (int): The size of the cluster
        shape_name (str): The name of the shape to use
        await_completion (bool): Whether to wait till the DbSystem reaches
            the desired lifecycle state
        compartment_id (str): OCID of the parent compartment.
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised


    Returns:
       None
    """

    db_system_name = kwargs.get("db_system_name")
    db_system_id = kwargs.get("db_system_id")
    ignore_current = kwargs.get("ignore_current", False)

    cluster_size = kwargs.get("cluster_size")
    shape_name = kwargs.get("shape_name")

    await_completion = kwargs.get("await_completion", False)

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        current_db_system_id = configuration.get_current_db_system_id(
            config=config)
        if (not ignore_current and db_system_name is None
                and db_system_id is None and current_db_system_id):
            db_system_id = current_db_system_id

        import oci.identity
        import oci.mysql
        import mysqlsh
        import json

        try:
            # Get the db_system based on input params
            db_system = get_db_system(
                db_system_name=db_system_name, db_system_id=db_system_id,
                compartment_id=compartment_id, config=config,
                interactive=interactive, raise_exceptions=True,
                return_python_object=True)
            if db_system is None:
                if db_system_name or db_system_id:
                    raise ValueError("DB System not found.")
                else:
                    raise Exception("Cancelling operation.")

            if not cluster_size and interactive:
                # Prompt the user for the new values
                cluster_size = mysqlsh.globals.shell.prompt(
                    f"Please enter the number of nodes for the HeatWave cluster "
                    f"(1 - 64): ",
                    {'defaultValue': '1'}).strip()
            if cluster_size is None:
                raise ValueError("The cluster_size was not specified.")
            if cluster_size == "":
                cluster_size = '1'

            try:
                cluster_size = int(cluster_size)
            except:
                raise ValueError(f"'{cluster_size}' is not a valid number.")

            if cluster_size < 1 or cluster_size > 64:
                raise ValueError(f"The cluster size must be between 1 and 64. A size of {cluster_size} was given.")

            if not shape_name and interactive:
                shape = get_db_system_shape(
                    is_supported_for="HEATWAVECLUSTER",
                    compartment_id=db_system.compartment_id,
                    config=config, config_profile=config_profile,
                    interactive=True,
                    raise_exceptions=True,
                    return_python_object=True)

                if shape:
                    shape_name = shape.name
            if not shape_name:
                raise ValueError("No shape name given.")

            # Initialize the DbSystem client
            db_sys = core.get_oci_db_system_client(config=config)

            details = oci.mysql.models.AddHeatWaveClusterDetails(
                cluster_size=cluster_size,
                shape_name=shape_name,
            )
            work_request_id = db_sys.add_heat_wave_cluster(
                db_system.id, add_heat_wave_cluster_details=details).headers["opc-work-request-id"]

            if await_completion:
                await_hw_cluster_lifecycle_state(db_system_id=db_system.id, action_state='ACTIVE',
                    action_name="start", config=config, interactive=interactive,
                    work_request_id=work_request_id)
            elif interactive:
                print(f"The HeatWave Cluster of the MySQL DB System '{db_system.display_name}' is being "
                      "created.")

        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except (ValueError, oci.exceptions.ClientError) as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.update.heatWaveCluster', shell=True, cli=True, web=True)
def update_hw_cluster(**kwargs):
    """Update the HeatWave cluster for a DbSystem with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        db_system_name (str): The name of the DB System.
        db_system_id (str): OCID of the DbSystem.
        ignore_current (bool): Whether to not default to the current DB System.
        cluster_size (int): The size of the cluster
        shape_name (str): The name of the shape to use
        await_completion (bool): Whether to wait till the DbSystem reaches
            the desired lifecycle state
        compartment_id (str): OCID of the parent compartment.
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised


    Returns:
       None
    """

    db_system_name = kwargs.get("db_system_name")
    db_system_id = kwargs.get("db_system_id")
    ignore_current = kwargs.get("ignore_current", False)

    cluster_size = kwargs.get("cluster_size")
    shape_name = kwargs.get("shape_name")

    await_completion = kwargs.get("await_completion", False)

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        current_db_system_id = configuration.get_current_db_system_id(
            config=config)
        if (not ignore_current and db_system_name is None
                and db_system_id is None and current_db_system_id):
            db_system_id = current_db_system_id

        import oci.identity
        import oci.mysql
        import mysqlsh
        import json

        try:
            # Get the db_system based on input params
            db_system = get_db_system(
                db_system_name=db_system_name, db_system_id=db_system_id,
                compartment_id=compartment_id, config=config,
                interactive=interactive, raise_exceptions=True,
                return_python_object=True)
            if db_system is None:
                if db_system_name or db_system_id:
                    raise ValueError("DB System not found.")
                else:
                    raise Exception("Cancelling operation.")

            if not cluster_size and interactive:
                # Prompt the user for the new values
                cluster_size = mysqlsh.globals.shell.prompt(
                    f"Please enter the number of nodes for the HeatWave cluster "
                    f"(1 - 64): ",
                    {'defaultValue': '1'}).strip()
            if cluster_size is None:
                raise ValueError("The cluster_size was not specified.")
            if cluster_size == "":
                cluster_size = '1'

            try:
                cluster_size = int(cluster_size)
            except:
                raise ValueError(f"'{cluster_size}' is not a valid number.")

            if cluster_size < 1 or cluster_size > 64:
                raise ValueError(f"The cluster size must be between 1 and 64. A size of {cluster_size} was given.")

            if not shape_name and interactive:
                shape = get_db_system_shape(
                    is_supported_for="HEATWAVECLUSTER",
                    compartment_id=db_system.compartment_id,
                    config=config, config_profile=config_profile,
                    interactive=True,
                    raise_exceptions=True,
                    return_python_object=True)

                if shape:
                    shape_name = shape.name
            if not shape_name:
                raise ValueError("No shape name given.")

            # Initialize the DbSystem client
            db_sys = core.get_oci_db_system_client(config=config)

            details = oci.mysql.models.UpdateHeatWaveClusterDetails(
                cluster_size=cluster_size,
                shape_name=shape_name,
            )
            work_request_id = db_sys.update_heat_wave_cluster(
                db_system.id, update_heat_wave_cluster_details=details).headers["opc-work-request-id"]

            if await_completion:
                await_hw_cluster_lifecycle_state(db_system_id=db_system.id, action_state='ACTIVE',
                    action_name="rescale", config=config, interactive=interactive,
                    work_request_id=work_request_id)
            elif interactive:
                print(f"The HeatWave Cluster of the MySQL DB System '{db_system.display_name}' is being "
                      "rescaled.")

        except oci.exceptions.ServiceError as e:
            if raise_exceptions:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
    except (ValueError, oci.exceptions.ClientError) as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.delete.heatWaveCluster', shell=True, cli=True, web=True)
def delete_hw_cluster(**kwargs):
    """Deletes the DbSystem with the given id

    If no id is given, it will prompt the user for the id.

    Args:
        **kwargs: Optional parameters

    Keyword Args:
        db_system_name (str): The name of the DB System.
        db_system_id (str): OCID of the DbSystem.
        await_completion (bool): Whether to wait till the DbSystem reaches
            the desired lifecycle state
        ignore_current (bool): Whether to not default to the current bastion.
        compartment_id (str): OCID of the parent compartment
        config (dict): An OCI config object or None
        config_profile (str): The name of an OCI config profile
        interactive (bool): Indicates whether to execute in interactive mode
        raise_exceptions (bool): If true exceptions are raised


    Returns:
       None
    """

    db_system_name = kwargs.get("db_system_name")
    db_system_id = kwargs.get("db_system_id")
    await_completion = kwargs.get("await_completion")
    ignore_current = kwargs.get("ignore_current", False)

    compartment_id = kwargs.get("compartment_id")
    config = kwargs.get("config")
    config_profile = kwargs.get("config_profile")

    interactive = kwargs.get("interactive", core.get_interactive_default())
    raise_exceptions = kwargs.get("raise_exceptions", not interactive)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(
            config=config, config_profile=config_profile,
            interactive=interactive)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        # Get the active config and compartment
        try:
            import oci.mysql
            import mysqlsh

            db_system = get_db_system(
                db_system_name=db_system_name, db_system_id=db_system_id,
                compartment_id=compartment_id, config=config,
                interactive=interactive, raise_exceptions=raise_exceptions,
                ignore_current=ignore_current,
                return_python_object=True)
            if db_system is None:
                if db_system_name or db_system_id:
                    raise ValueError("DB System not found.")
                else:
                    raise Exception("Cancelling operation.")

            if interactive:
                # Prompt the user for specifying a compartment
                prompt = mysqlsh.globals.shell.prompt(
                    f"Are you sure you want to delete the HeatWave Cluster of the MySQL DB System "
                    f"{db_system.display_name} [yes/NO]: ",
                    {'defaultValue': 'no'}).strip().lower()

                if prompt != "yes":
                    print("Deletion aborted.\n")
                    return

            # Get DbSystem Client
            db_sys = core.get_oci_db_system_client(config=config)

            # Delete the HW Cluster
            work_request_id = db_sys.delete_heat_wave_cluster(db_system.id).headers["opc-work-request-id"]

            # If the function should wait till the bastion reaches the correct
            # lifecycle state
            if await_completion:
                await_hw_cluster_lifecycle_state(
                    db_system.id, "DELETED", "complete the deletion process",
                    config, interactive, work_request_id=work_request_id)
            elif interactive:
                print(f"The HeatWave Cluster of the MySQL DB System '{db_system.display_name}' is being "
                      "deleted.")
        except oci.exceptions.ServiceError as e:
            if interactive:
                raise
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
            return
    except Exception as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')
