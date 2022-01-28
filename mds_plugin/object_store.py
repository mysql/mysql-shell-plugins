# Copyright (c) 2021, Oracle and/or its affiliates.
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

"""Sub-Module to manage OCI Object Storage"""

from mysqlsh.plugin_manager import plugin_function
from mds_plugin import core, configuration

# Number of threads used in parallel for bucket file operations
NTHREAD = 50


def get_object_store_namespace(config=None):
    """Returns the object store namespace_name

    Args:
        config (object): An OCI config object or None.

    Returns:
        The namespace_name
    """
    import oci.object_storage

    # Check if object_store_namespace_name is already cached in config
    namespace_name = config.get("object_store_namespace_name")
    if not namespace_name:
        # Initialize the Object Store client
        os_client = core.get_oci_object_storage_client(config=config)

        # Get Object Store namespace
        namespace_name = os_client.get_namespace().data

        # Cache object_store_namespace_name in config
        config["object_store_namespace_name"] = namespace_name

    return namespace_name


def format_buckets_listing(buckets, current_bucket=None):
    """Returns a formated list of buckets.

    Args:
        buckets (list): A list of buckets objects.

    Returns:
        The formated list as string
    """
    import re

    out = ""
    i = 1
    for b in buckets:
        # Shorten to 24 chars max, remove linebreaks
        name = re.sub(r'[\n\r]', ' ',
                      b.name[:22] + '..'
                      if len(b.name) > 24
                      else b.name)

        index = f"*{i:>3}" if current_bucket == b.name else f"{i:>4}"
        out += (f"{index} {name:24} {b.time_created:%Y-%m-%d %H:%M}\n")
        i += 1

    return out


def sizeof_fmt(size):
    """Returns a formated file size

    Args:
        size (integer): Size in bytes

    Returns:
        The formated size as string
    """
    if size is None:
        return "0B"
    if size < 1024:
        return f"{size}B"

    for unit in ['', 'K', 'M', 'G', 'T', 'P', 'E', 'Z']:
        if abs(size) < 1024.0:
            return "%3.1f%s%s" % (size, unit, 'B')
        size /= 1024.0
    return "%.1f%s%s" % (size, 'Y', 'B')


def format_bucket_objects_listing(bucket_objects):
    """Returns a formated list of buckets.

    Args:
        buckets (list): A list of buckets objects.

    Returns:
        The formated list as string
    """
    import re
    import math

    out = ""
    i = 1
    for o in bucket_objects:
        # Shorten to 24 chars max, remove linebreaks
        name = re.sub(r'[\n\r]', ' ',
                      o.name[:63] + '..'
                      if len(o.name) > 65
                      else o.name)
        size = sizeof_fmt(o.size)
        time = f"{o.time_modified:%Y-%m-%d %H:%M}" \
            if o.time_modified is not None else ""

        out += (f"{i:>4} {name:65} {size:8} {time:16}\n")
        i += 1

    return out


@plugin_function('mds.list.buckets')
def list_buckets(compartment_id=None, config=None, raise_exceptions=False,
                 interactive=True, return_formatted=True):
    """Lists object store buckets

    This function will list all buckets of the compartment with the
    given compartment_id.

    Args:
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        raise_exceptions (bool): If set to True exceptions are raised
        interactive (bool): Whether output is more descriptive
        return_formatted (bool): If set to true, a list object is returned.

    Returns:
        A list of dicts representing the compartments
    """

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        bucket_name = configuration.get_current_bucket_name(
            config=config)

        import oci.object_storage
        import oci.util

        # Initialize the  Object Store client
        os_client = core.get_oci_object_storage_client(config=config)

        # Get Object Store namespace
        namespace_name = get_object_store_namespace(config)

        # List the buckets
        buckets = os_client.list_buckets(
            namespace_name=namespace_name,
            compartment_id=compartment_id).data

        if len(buckets) < 1 and interactive:
            print("This compartment contains no buckets.")

        if return_formatted:
            return format_buckets_listing(
                buckets=buckets, current_bucket=bucket_name)
        else:
            # return compartments in JSON text output
            return oci.util.to_dict(buckets)
    except oci.exceptions.ServiceError as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (ValueError, oci.exceptions.ClientError) as e:
        if raise_exceptions:
            raise
        print(f'ERROR: {e}')


@plugin_function('mds.get.bucket')
def get_bucket(bucket_name=None, compartment_id=None, config=None,
               ignore_current=False, interactive=True):
    """Get bucket

    Args:
        bucket_name (str): The name of the policy
        compartment_id (str): The OCID of the compartment.
        config (object): An OCI config object or None.
        ignore_current (bool): Ignores the current bucket
        interactive (bool): Whether exceptions should be raised

    Returns:
        The policy object or None
    """

    # Get the current config
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        if not ignore_current:
            bucket_name = configuration.get_current_bucket_name(
                bucket_name=bucket_name, config=config)

        import oci.object_storage
        import mysqlsh

        # Initialize the  Object Store client
        os_client = core.get_oci_object_storage_client(config=config)

        # Get Object Store namespace
        namespace_name = get_object_store_namespace(config)

        # if a bucket_name was provided, look up the bucket directly
        if bucket_name is not None:
            try:
                bucket = os_client.get_bucket(
                    namespace_name=namespace_name, bucket_name=bucket_name).data
                return bucket
            except oci.exceptions.ServiceError as e:
                if not interactive:
                    raise
                if e.status == 404:
                    print(f'The bucket with the name {bucket_name} was not '
                          f'found.')
                else:
                    print(f'ERROR: {e.message}. (Code: {e.code}; '
                          f'Status: {e.status})')
                return

        # Get item list
        buckets = os_client.list_buckets(
            namespace_name=namespace_name,
            compartment_id=compartment_id).data

        # Print the user list
        item_list = format_buckets_listing(buckets)
        print(f"Buckets:\n{item_list}")

        # Let the user choose from the list
        bucket = core.prompt_for_list_item(
            item_list=buckets, prompt_caption=("Please enter the name or index "
                                               "of the bucket: "),
            item_name_property="name")

        return bucket
    except oci.exceptions.ServiceError as e:
        if not interactive:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        if not interactive:
            raise
        print(f'ERROR: {e}')
        return


@plugin_function('mds.create.bucket')
def create_bucket(bucket_name=None, compartment_id=None, config=None,
                  interactive=True, return_object=False):
    """Creates a new object store buckets

    Args:
        bucket_name (str): The name of the new bucket.
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        interactive (bool): Whether exceptions should be raised
        return_object (bool): Whether the bucket object should be returned 

    Returns:
        None or the created bucket object
    """

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.object_storage
        import mysqlsh

        if not interactive and bucket_name is None:
            raise ValueError("A bucket_name needs to be provided")
        elif bucket_name is None:
            print("Creating a new object store bucket ...\n")

            # Get a name
            bucket_name = mysqlsh.globals.shell.prompt(
                "Please enter the name for the new bucket: ",
                {'defaultValue': ''}).strip()
            if bucket_name == "":
                print("Operation cancelled.")
                return

        # Initialize the  Object Store client
        os_client = core.get_oci_object_storage_client(config=config)

        # Get Object Store namespace
        namespace_name = get_object_store_namespace(config)

        create_bucket_details = oci.object_storage.models.CreateBucketDetails(
            name=bucket_name,
            compartment_id=compartment_id
        )

        bucket = os_client.create_bucket(
            namespace_name=namespace_name,
            create_bucket_details=create_bucket_details).data

        if return_object:
            return bucket
        else:
            print(f"Object Store Bucket {bucket_name} has being created.\n")
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


@plugin_function('mds.delete.bucket')
def delete_bucket(bucket_name=None, compartment_id=None, config=None,
                  interactive=True):
    """Deletes an object store bucket

    Args:
        bucket_name (str): The name of the bucket.
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        interactive (bool): If set to false, function returns true on success
    Returns:
        None or True
    """

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)

        import oci.object_storage
        import mysqlsh

        bucket = get_bucket(
            bucket_name=bucket_name, compartment_id=compartment_id,
            config=config, ignore_current=True)
        if bucket is None:
            print("Operation Cancelled.\n")
            return

        # Initialize the  Object Store client
        os_client = core.get_oci_object_storage_client(config=config)

        # Get Object Store namespace
        namespace_name = get_object_store_namespace(config)

        # Check if the bucket still has objects
        object_list = os_client.list_objects(
            namespace_name=namespace_name, bucket_name=bucket.name).data.objects
        obj_count = len(object_list)
        if obj_count > 0:
            print(f"The bucket {bucket.name} contains {obj_count} "
                  f"object{'s' if obj_count > 1 else ''}.")

        if interactive:
            # Prompt the user for confirmation
            prompt = mysqlsh.globals.shell.prompt(
                f"Are you sure you want to delete the bucket {bucket.name} "
                f"[yes/NO]: ",
                {'defaultValue': 'no'}).strip().lower()
            if prompt != "yes":
                print("Deletion aborted.\n")
                return

        if obj_count > 0:
            delete_bucket_object(
                name="*", bucket_name=bucket.name,
                compartment_id=compartment_id, config=config, interactive=False)

        # Check if the bucket still has PARs
        pars = os_client.list_preauthenticated_requests(
            namespace_name=namespace_name, bucket_name=bucket.name).data
        for p in pars:
            os_client.delete_preauthenticated_request(
                namespace_name=namespace_name, bucket_name=bucket.name,
                par_id=p.id)

        os_client.delete_bucket(
            namespace_name=namespace_name, bucket_name=bucket.name)

        if interactive:
            print(f"Bucket {bucket.name} deleted successfully.")
        else:
            return True
    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        print(f'ERROR: {e}')
        return


def delete_file_from_list_from_bucket(index, os_client, objects,
                                      namespace_name, bucket_name,
                                      thread_count):
    """Deletes a file from a given file list

    Args:
        index (int): The thread index, specifying which files from the list to 
            upload
        os_client (object): An oci object store client instance
        files (list): The list of filenames as strings
        namespace_name (str): The OCI object store namespace of the tenancy
        bucket_name (str): The name of the bucket to upload to

    Returns:
       None
    """
    import os.path

    for o in objects:
        if hash(o.name) % thread_count == index:
            os_client.delete_object(
                namespace_name=namespace_name, bucket_name=bucket_name,
                object_name=o.name)


@plugin_function('mds.delete.bucketObject')
def delete_bucket_object(name=None, **kwargs):
    """Deletes an object store bucket objects

    Args:
        name (str): The name of the object, can include * to match multiple 
            objects
        **kwargs: Additional options

    Keyword Args:
        bucket_name (str): The name of the bucket.
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        interactive (bool): If set to false, function returns true on success
    Returns:
         None or True
    """

    bucket_name = kwargs.get('bucket_name')
    compartment_id = kwargs.get('compartment_id')
    config = kwargs.get('config')
    interactive = kwargs.get('interactive', True)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        bucket_name = configuration.get_current_bucket_name(
            bucket_name=bucket_name, config=config)

        import oci.object_storage
        import mysqlsh
        import re

        bucket = get_bucket(
            bucket_name=bucket_name, compartment_id=compartment_id,
            config=config)
        if bucket is None:
            if interactive:
                print("Operation Cancelled.\n")
            return

        # Initialize the  Object Store client
        os_client = core.get_oci_object_storage_client(config=config)

        # Get Object Store namespace
        namespace_name = get_object_store_namespace(config)

        # If the user specified * as name, delete all
        if name and (name == '*' or '*' in name):
            # Get object list
            objects = oci.pagination.list_call_get_all_results(
                os_client.list_objects,
                namespace_name=namespace_name,
                bucket_name=bucket.name,
                limit=1000).data.objects
            # Filter list
            if name != '*':
                name = name.lower()
                # Filter list if PARs
                if '*' in name:
                    name_pattern = '^' + name.replace('*', '.+')
                    objects = [obj for obj in objects
                               if re.search(name_pattern, obj.name.lower())]
                else:
                    objects = [obj for obj in objects
                               if name == obj.name.lower()]

            # Get object count
            obj_count = len(objects)
            if obj_count == 0:
                print("No objects to delete in this bucket.")
                return

            # Prompt the user for confirmation
            if interactive:
                prompt = mysqlsh.globals.shell.prompt(
                    f"Are you sure you want to delete {obj_count} object"
                    f"{'s' if obj_count > 1 else ''} from {bucket.name} "
                    f"[yes/NO]: ",
                    {'defaultValue': 'no'}).strip().lower()
                if prompt != "yes":
                    print("Deletion aborted.\n")
                    return

            # Delete all objects
            print(f"Deleting {obj_count} "
                  f"object{'s' if obj_count > 1 else ''}.")

            import threading

            thread_count = NTHREAD if obj_count > NTHREAD else obj_count

            ths = [threading.Thread(
                target=delete_file_from_list_from_bucket,
                args=(i, os_client, objects, namespace_name, bucket.name,
                      thread_count))
                   for i in range(thread_count)]
            for th in ths:
                th.daemon = True
                th.start()
            for th in ths:
                th.join()

            if interactive:
                print(f"Bucket object{'s' if '*' in name else ''} "
                      f"deleted successfully.")
        elif name:
            os_client.delete_object(
                namespace_name=namespace_name, bucket_name=bucket.name,
                object_name=name)

            print(f"Bucket object '{name}' deleted successfully.")
        elif interactive:
            # Get object list
            bucket_objects = oci.pagination.list_call_get_all_results(
                os_client.list_objects,
                namespace_name=namespace_name,
                bucket_name=bucket.name,
                limit=1000).data.objects

            print(format_bucket_objects_listing(bucket_objects=bucket_objects))

            obj_summary = core.prompt_for_list_item(
                item_list=bucket_objects,
                prompt_caption="Please enter the index or name of an object: ",
                item_name_property="name")
            if obj_summary is None:
                print("Operation cancelled.")
                return
            name = obj_summary.name

            os_client.delete_object(
                namespace_name=namespace_name, bucket_name=bucket.name,
                object_name=name)

            print(f"Bucket object '{name}' deleted successfully.")
        else:
            print('No Object name given.')

        if not interactive:
            return True

    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        print(f'ERROR: {e}')
        return


def bucket_object_upload_progress_callback(bytes_uploaded):
    print(f"Additional {sizeof_fmt(bytes_uploaded)} uploaded.")


@plugin_function('mds.create.bucketObject')
def create_bucket_object(file_name=None, name=None,
                         bucket_name=None, file_content=None,
                         compartment_id=None, config=None,
                         interactive=True):
    """Creates a new object store bucket object

    Args:
        file_name (str): The name of the file to upload
        name (str): The name of the object bucket to create
        bucket_name (str): The name of the new bucket.
        file_content (str): The contents of the file
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        interactive (bool): Whether exceptions should be raised

    Returns:
        None
    """

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        bucket_name = configuration.get_current_bucket_name(
            bucket_name=bucket_name, config=config)
    except ValueError as e:
        print(f"ERROR: {str(e)}")
        return

    import oci.object_storage
    import mysqlsh
    import os.path
    import io

    if interactive and file_name is None and file_content is None:
        print("Creating a new bucket object ...\n")

    # Get a name (if no file_content was given)
    if file_name is None and file_content is None:
        file_name = mysqlsh.globals.shell.prompt(
            "Please enter the path to a local file to upload: ",
            {'defaultValue': ''}).strip()
        if file_name == "":
            print("Operation cancelled.")
            return
    if file_content is None:
        file_name = os.path.abspath(
            os.path.expanduser(file_name))
        if not os.path.exists(file_name):
            print(f"Cannot find the file {file_name}.")
            return

    if name is None and file_name:
        name = os.path.basename(file_name)

    if name is None:
        print(f"No name for the bucked file specified.")
        return

    # Initialize the  Object Store client
    os_client = core.get_oci_object_storage_client(config=config)

    # Get Object Store namespace
    namespace_name = get_object_store_namespace(config)

    try:
        # If the file content was given as string
        if file_content is not None:
            with io.StringIO() as f:
                f.write(file_content)
                f.seek(0)
                # put_object returns a response object with data None
                os_client.put_object(
                    namespace_name=namespace_name, bucket_name=bucket_name,
                    object_name=name, put_object_body=f)
        else:
            # upload manager will automatically use singlepart uploads if the
            # part size (in bytes) is less than the file size
            part_size = oci.object_storage.transfer.constants.DEFAULT_PART_SIZE

            upload_manager = oci.object_storage.UploadManager(
                object_storage_client=os_client,
                allow_parallel_uploads=True, parallel_process_count=5)

            upload_manager.upload_file(
                namespace_name=namespace_name, bucket_name=bucket_name,
                object_name=name,
                file_path=file_name,
                part_size=part_size,
                progress_callback=bucket_object_upload_progress_callback)
    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        print(f'ERROR: {e}')
        return

    if interactive:
        print("Bucket object created successfully.")
    else:
        return True


@plugin_function('mds.list.bucketObjects')
def list_bucket_objects(**kwargs):
    """Lists bucket object

    This function will list all bucket objects of the bucket with the
    given bucket_name.

    Args:
        **kwargs: Additional options

    Keyword Args:
        bucket_name (str): The name of the bucket
        name (str): Then name of the bucket object, can include * 
            to match multiple objects
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        interactive (bool): If set to false exceptions are raised
        return_formatted (bool): If set to true, a list object is returned.

    Returns:
        A list of dicts representing the bucket objects or a string or none
    """

    bucket_name = kwargs.get('bucket_name')
    name = kwargs.get('name')
    compartment_id = kwargs.get('compartment_id')
    config = kwargs.get('config')
    interactive = kwargs.get('interactive', True)
    return_formatted = kwargs.get('return_formatted', True)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        bucket_name = configuration.get_current_bucket_name(
            bucket_name=bucket_name, config=config)

        import oci.object_storage
        import oci.util
        import re

        bucket = get_bucket(
            bucket_name=bucket_name, compartment_id=compartment_id, config=config,
            interactive=interactive)
        if bucket is None:
            print("Operation cancelled.")
            return

        # Initialize the  Object Store client
        os_client = core.get_oci_object_storage_client(config=config)

        # Get Object Store namespace
        namespace_name = get_object_store_namespace(config)

        # List the bucket objects
        # bucket_objects = os_client.list_objects(
        #     namespace_name=namespace_name,
        #     bucket_name=bucket.name,
        #     fields="name,size,timeModified").data.objects

        bucket_objects = oci.pagination.list_call_get_all_results(
            os_client.list_objects,
            namespace_name=namespace_name,
            bucket_name=bucket.name,
            fields="name,size,timeModified",
            limit=1000).data.objects
        # Filter list if PARs
        if name and name != '*':
            name = name.lower()
            # Filter list if PARs
            if '*' in name:
                name_pattern = '^' + name.replace('*', '.+')
                bucket_objects = [obj for obj in bucket_objects
                                  if re.search(name_pattern, obj.name.lower())]
            else:
                bucket_objects = [obj for obj in bucket_objects
                                  if name == obj.name.lower()]

        if len(bucket_objects) < 1:
            if name:
                print(f"The bucket {bucket.name} contains no objects matching "
                      f"the object name {name}.")
            else:
                print(f"The bucket {bucket.name} contains no objects.")
            return

        if return_formatted:
            return format_bucket_objects_listing(bucket_objects=bucket_objects)
        else:
            # return compartments in JSON text output
            return oci.util.to_dict(bucket_objects)
    except oci.exceptions.ServiceError as e:
        if not interactive:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        if not interactive:
            raise
        print(f'ERROR: {e}')
        return


@plugin_function('mds.get.bucketObject')
def get_bucket_object(name=None, file_name=None, bucket_name=None,
                      compartment_id=None, config=None,
                      no_error_on_not_found=False):
    """Get a bucket object by name

    This function will either save the file to disk, if file_name is given
    or return the contents as a string

    Args:
        name (str): If set to JSON, output is formated that way.
        file_name (str): The name of the file that should be created.
        bucket_name (str): The name of the bucket.
        compartment_id (str): The OCID of the compartment
        config (object): An OCI config object or None.
        no_error_on_not_found (bool): Whether to print out an error on 404

    Returns:
        A list of dicts representing the bucket objects or a string
    """

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        bucket_name = configuration.get_current_bucket_name(
            bucket_name=bucket_name, config=config)
    except ValueError as e:
        print(f"ERROR: {str(e)}")
        return

    import oci.object_storage
    import oci.util
    import os.path
    import io

    # Get bucket
    bucket = get_bucket(
        bucket_name=bucket_name, compartment_id=compartment_id, config=config)
    if bucket is None:
        print("Operation cancelled.")
        return

    # Initialize the  Object Store client
    os_client = core.get_oci_object_storage_client(config=config)

    # Get Object Store namespace
    namespace_name = get_object_store_namespace(config)

    try:
        # If the user did not specify an name
        if name is None:
            # Let the user select an object
            bucket_objects = os_client.list_objects(
                namespace_name=namespace_name,
                bucket_name=bucket.name,
                fields="name,size,timeModified").data.objects

            print(format_bucket_objects_listing(bucket_objects=bucket_objects))

            obj_summary = core.prompt_for_list_item(
                item_list=bucket_objects,
                prompt_caption="Please enter the index or name of an object: ",
                item_name_property="name")
            if obj_summary is None:
                print("Operation cancelled.")
                return
            name = obj_summary.name

        # Look up the object by name
        obj = os_client.get_object(
            namespace_name=namespace_name, bucket_name=bucket.name,
            object_name=name)

        if file_name is not None:
            file_name = os.path.abspath(
                os.path.expanduser(file_name))
            with open(file_name, 'wb') as f:
                for chunk in obj.data.raw.stream(1024 * 1024,
                                                 decode_content=False):
                    f.write(chunk)

            print(f"File {file_name} was written to disk.")
        else:
            with io.BytesIO() as f:
                for chunk in obj.data.raw.stream(
                        1024 * 1024, decode_content=False):
                    f.write(chunk)

                contents = f.getvalue().decode("utf-8")

            return contents

    except oci.exceptions.ServiceError as e:
        if not (no_error_on_not_found and e.status == 404):
            print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        print(f'ERROR: {e}')
        return


def download_text_file(url):
    """Downloads a file from a given URL

    Args:
        url (str): The URL to the text file to download

    Returns:
        The contents of the file decoded to utf-8 or None
    """
    import urllib.request

    try:
        response = urllib.request.urlopen(url)
        data = response.read()
        return data.decode('utf-8')
    except urllib.error.URLError as e:
        if e.reason == 'CERTIFICATE_VERIFY_FAILED':
            try:
                install_ssl_certificates()
                response = urllib.request.urlopen(url)
                data = response.read()
                return data.decode('utf-8')
            except urllib.error.URLError as e:
                print(f"Could not download file from {url}\nERROR: {str(e)}")
        else:
            print(f"Could not download file from {url}\nERROR: {str(e)}")


def install_ssl_certificates():
    import os
    import os.path
    import ssl
    import stat
    import subprocess
    import sys

    # cSpell:ignore cafile certifi chdir IRGRP IROTH IRUSR IWGRP IWUSR IXGRP
    # cSpell:ignore IXOTH IXUSR
    STAT_0o775 = (stat.S_IRUSR | stat.S_IWUSR | stat.S_IXUSR
                  | stat.S_IRGRP | stat.S_IWGRP | stat.S_IXGRP
                  | stat.S_IROTH | stat.S_IXOTH)

    openssl_dir, openssl_cafile = os.path.split(
        ssl.get_default_verify_paths().openssl_cafile)

    # print(" -- pip install --upgrade certifi")
    # subprocess.check_call([sys.executable,
    #     "-E", "-s", "-m", "pip", "install", "--upgrade", "certifi"])

    import certifi

    print("Installing SSL certificate...")
    # change working directory to the default SSL directory
    os.chdir(openssl_dir)
    relpath_to_certifi_cafile = os.path.relpath(certifi.where())
    print(" -- removing any existing file or link")
    try:
        os.remove(openssl_cafile)
    except FileNotFoundError:
        pass
    print(" -- creating symlink to certifi certificate bundle")
    os.symlink(relpath_to_certifi_cafile, openssl_cafile)
    print(" -- setting permissions")
    os.chmod(openssl_cafile, STAT_0o775)
    print(" -- update complete")


def bucket_dir_object_upload_progress_callback(bytes_uploaded):
    # Only print . if bytes_uploaded is > 1MB
    if bytes_uploaded >= 1024*1024*1024:
        print(".")


def upload_file_from_list_to_bucket(index, upload_manager, files,
                                    namespace_name, bucket_name,
                                    object_name_prefix):
    """Uploads a file from a file list

    Args:
        index (int): The thread index, specifying which files from the list to 
            upload
        upload_manager (object): An oci upload_manager instance
        files (list): The list of filenames as strings
        namespace_name (str): The OCI object store namespace of the tenancy
        bucket_name (str): The name of the bucket to upload to

    Returns:
       None
    """
    import os.path

    if object_name_prefix is None:
        object_name_prefix = ""

    for file_name in files:
        if hash(file_name) % NTHREAD == index:
            file_size = sizeof_fmt(os.path.getsize(file_name))
            object_name = object_name_prefix + os.path.basename(file_name)
            print(f"{object_name} ({file_size}) ...")

            upload_manager.upload_file(
                namespace_name=namespace_name, bucket_name=bucket_name,
                object_name=object_name,
                file_path=file_name)


def create_bucket_objects_from_local_dir(local_dir_path=None, bucket_name=None,
                                         object_name_prefix=None,
                                         compartment_id=None, config=None,
                                         interactive=True):
    """Imports a local dump on a DB System

    Args:
        local_dir_path (str): The directory to upload
        bucket_name (str): The name of the bucket
        compartment_id (str): The OCID of the compartment
        config (object): An OCI config object or None.

    Returns:
       None
    """

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        bucket_name = configuration.get_current_bucket_name(
            bucket_name=bucket_name, config=config)
    except ValueError as e:
        print(f"ERROR: {str(e)}")
        return

    import oci.mysql
    from pathlib import Path
    from os import listdir
    import os.path
    import datetime
    import mysqlsh

    # Get a local_dir_path
    if local_dir_path is None and interactive:
        local_dir_path = mysqlsh.globals.shell.prompt(
            "Please enter the file path of the directory to upload: ",
            {'defaultValue': ''}).strip()
        if local_dir_path == "":
            print("Operation cancelled.\n")
            return
    elif local_dir_path is None and not interactive:
        print("No directory path specified.")
        return

    if object_name_prefix is None and interactive:
        object_name_prefix = mysqlsh.globals.shell.prompt(
            "Please enter the prefix to use for the object names, e.g. /, "
            "or leave empty []: ",
            {'defaultValue': ''}).strip()

    local_dir_path = os.path.abspath(
        os.path.expanduser(local_dir_path))
    if not os.path.exists(local_dir_path):
        print(f"Cannot find the file directory {local_dir_path}.")
        return

    file_list = [os.path.join(local_dir_path, name) for name
                 in os.listdir(local_dir_path)
                 if os.path.isfile(os.path.join(local_dir_path, name))]
    if len(file_list) < 1:
        print(f"File directory {local_dir_path} contains no files.")
        return

    # Prompt the user for confirmation
    if interactive:
        prompt = mysqlsh.globals.shell.prompt(
            f"{len(file_list)} file{'s' if len(file_list)>1 else ''} will be "
            f"uploaded from {local_dir_path}.\nDo you want to continue? "
            f"[YES/no]: ",
            {'defaultValue': 'yes'}).strip().lower()
        if prompt != "yes":
            print("Operation cancelled.\n")
            return

    # Get the bucket
    bucket = get_bucket(
        bucket_name=bucket_name, compartment_id=compartment_id, config=config)
    if bucket is None:
        print("Operation cancelled.\n")
        return

    # Initialize the  Object Store client
    os_client = core.get_oci_object_storage_client(config=config)

    # Get Object Store namespace
    namespace_name = get_object_store_namespace(config)

    try:
        upload_manager = oci.object_storage.UploadManager(
            object_storage_client=os_client,
            allow_parallel_uploads=True, parallel_process_count=3)

        print(f"\nUploading files to bucket {bucket.name}...")

        import threading

        ths = [threading.Thread(
            target=upload_file_from_list_to_bucket, args=(
                i, upload_manager, file_list, namespace_name, bucket_name,
                object_name_prefix))
               for i in range(NTHREAD)]
        for th in ths:
            th.daemon = True
            th.start()
        for th in ths:
            th.join()

        # for file_name in file_list:
        #     file_size = sizeof_fmt(os.path.getsize(file_name))
        #     print(f"{os.path.basename(file_name)} ({file_size}) ...", end='')

        #     upload_manager.upload_file(
        #         namespace_name=namespace_name, bucket_name=bucket.name,
        #         object_name=os.path.basename(file_name),
        #         file_path=file_name,
        #         progress_callback=bucket_dir_object_upload_progress_callback,
        #         part_size=1024*1024*1024*128)

        #     print("")
    except Exception as e:
        print(f"Could not upload all files successfully.\n"
              f"ERROR: {str(e)}")
        return
    if len(file_list) > 1:
        print(f"\nAll {len(file_list)} files uploaded successfully.\n")
    else:
        print(f"\nThe file was uploaded successfully.\n")

    if not interactive:
        return len(file_list)


@plugin_function('mds.create.bucketObjectPreauthenticatedRequest')
def create_bucket_object_par(**kwargs):
    """Get a preauthenticated request for the given bucket object

    Args:
        **kwargs: Additional options

    Keyword Args:
        bucket_object_name (str): If set to JSON, output is formated that way.
        bucket_name (str): The name of the bucket
        access_type (str): The type of access to grant ('r', 'w', 'rw')
        valid_till (str): The point in time until the PAR is valid using the 
            format YYYY-MM-DD HH:MM:SS. If not specified it is now + 7 days.
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        return_object (bool): If the object should be returned

    Returns:
        The link or the object
    """

    bucket_object_name = kwargs.get('bucket_object_name')
    bucket_name = kwargs.get('bucket_name')
    access_type = kwargs.get('access_type')
    valid_till = kwargs.get('valid_till')
    compartment_id = kwargs.get('compartment_id')
    config = kwargs.get('config')
    return_object = kwargs.get('return_object', False)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        bucket_name = configuration.get_current_bucket_name(
            bucket_name=bucket_name, config=config)

        import oci.object_storage
        import oci.util
        import os.path
        import io
        import mysqlsh
        import datetime
        import time

        # Get bucket
        bucket = get_bucket(
            bucket_name=bucket_name, compartment_id=compartment_id, config=config)
        if bucket is None:
            print("Operation cancelled.")
            return

        # Get bucket object name
        if bucket_object_name is None:
            bucket_object_name = mysqlsh.globals.shell.prompt(
                "Please enter the name of the bucket object: ",
                {'defaultValue': ''}).strip()
            if bucket_object_name == "":
                print("Operation cancelled.")
                return

        # Initialize the  Object Store client
        os_client = core.get_oci_object_storage_client(config=config)

        # Get Object Store namespace
        namespace_name = get_object_store_namespace(config)

        # PAR valid till now + 7 day
        if valid_till is None:
            valid_till = datetime.datetime.now() + datetime.timedelta(days=7)
        elif type(valid_till) is str:
            try:
                valid_till = datetime.datetime(*(time.strptime(
                    valid_till, f"%Y-%m-%d %H:%M:%S")[0:6]))
            except ValueError as e:
                print("Invalid datetime format. Use YYYY-MM-DD HH:MM:SS")
                return

        # Get access type
        access_type = access_type.lower() if access_type is not None else "r"
        if access_type == "w":
            access = oci.object_storage.models.\
                CreatePreauthenticatedRequestDetails.ACCESS_TYPE_OBJECT_WRITE
        elif access_type == "rw":
            access = oci.object_storage.models.\
                CreatePreauthenticatedRequestDetails.\
                ACCESS_TYPE_OBJECT_READ_WRITE
        else:
            access = oci.object_storage.models.\
                CreatePreauthenticatedRequestDetails.ACCESS_TYPE_OBJECT_READ

        details = oci.object_storage.models.\
            CreatePreauthenticatedRequestDetails(
                name=f"PAR-{bucket.name}-{bucket_object_name}-R",
                object_name=bucket_object_name,
                access_type=access,
                time_expires=f"{valid_till:%Y-%m-%dT%H:%M:%SZ}")

        par = os_client.create_preauthenticated_request(
            namespace_name=namespace_name, bucket_name=bucket_name,
            create_preauthenticated_request_details=details).data

        if return_object:
            return par
        else:
            return get_par_url_prefix(config) + par.access_uri
    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        print(f'ERROR: {e}')
        return


def get_par_url_prefix(config=None):
    """Get a preauthenticated request for the given bucket object

    Args:
        config (object): An OCI config object or None.

    Returns:
        The PAR URL prefix
    """

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
    except ValueError as e:
        print(f"ERROR: {str(e)}")
        return

    prefix = f"https://objectstorage.{config.get('region')}.oraclecloud.com"

    return prefix


def format_pars_listing(pars):
    """Returns a formated list of pars.

    Args:
        pars (list): A list of PAR objects.

    Returns:
        The formated list as string
    """
    import re
    import math

    out = ""
    i = 1
    for p in pars:
        # Shorten to 30 chars max, remove linebreaks
        name = re.sub(r'[\n\r]', ' ',
                      p.name[:28] + '..'
                      if len(p.name) > 30
                      else p.name)
        obj_name = re.sub(r'[\n\r]', ' ',
                          p.object_name[:28] + '..'
                          if len(p.object_name) > 30
                          else p.object_name)
        time_cr = f"{p.time_created:%Y-%m-%d %H:%M}" \
            if p.time_created is not None else ""
        time_ex = f"{p.time_expires:%Y-%m-%d %H:%M}" \
            if p.time_expires is not None else ""

        out += (f"{i:>4} {name:30} {obj_name:30} {time_cr:16} {time_ex:16}\n")
        i += 1

    return out


@plugin_function('mds.list.bucketObjectPreauthenticatedRequests')
def list_pars(**kwargs):
    """Lists PAR objects

    Args:
        **kwargs: Additional options

    Keyword Args:
        bucket_name (str): The name of the bucket.
        name (str): Name of the PAR, can include * to match multiple PARs
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        interactive (bool): If set to false exceptions are raised
        return_formatted (bool): If set to true, a list object is returned.

    Returns:
        None
    """

    bucket_name = kwargs.get('bucket_name')
    name = kwargs.get('name')
    compartment_id = kwargs.get('compartment_id')
    config = kwargs.get('config')
    interactive = kwargs.get('interactive', True)
    return_formatted = kwargs.get('return_formatted', True)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        bucket_name = configuration.get_current_bucket_name(
            bucket_name=bucket_name, config=config)

        import oci.object_storage
        import oci.util
        import oci.pagination
        import mysqlsh
        import re

        bucket = get_bucket(
            bucket_name=bucket_name, compartment_id=compartment_id, config=config)
        if bucket is None:
            print("Operation Cancelled.\n")
            return

        # Initialize the  Object Store client
        os_client = core.get_oci_object_storage_client(config=config)

        # Get Object Store namespace
        namespace_name = get_object_store_namespace(config)

        # List all PARs
        pars = oci.pagination.list_call_get_all_results(
            os_client.list_preauthenticated_requests,
            namespace_name=namespace_name,
            bucket_name=bucket.name,
            limit=1000).data

        if name:
            name = name.lower()
            # Filter list if PARs
            if '*' in name:
                name_pattern = '^' + name.replace('*', '.+')
                pars = [par for par in pars
                        if re.search(name_pattern, par.name.lower())]
            else:
                pars = [par for par in pars if name == par.name.lower()]

        if return_formatted:
            return format_pars_listing(pars)
        else:
            return oci.util.to_dict(pars)
    except oci.exceptions.ServiceError as e:
        if not interactive:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (Exception, ValueError) as e:
        if not interactive:
            raise
        print(f'ERROR: {e}')
        return


@plugin_function('mds.get.bucketObjectPreauthenticatedRequest')
def get_par(**kwargs):
    """Gets a PAR object

    Args:
        **kwargs: Additional options

    Keyword Args:
        bucket_name (str): The name of the bucket.
        name (str): The name of the PAR.
        par_id (str): The OCID of the PAR.
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.

    Returns:
        None
    """

    bucket_name = kwargs.get('bucket_name')
    name = kwargs.get('name')
    par_id = kwargs.get('par_id')
    compartment_id = kwargs.get('compartment_id')
    config = kwargs.get('config')

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        bucket_name = configuration.get_current_bucket_name(
            bucket_name=bucket_name, config=config)

        import oci.object_storage
        import mysqlsh

        # Initialize the  Object Store client
        os_client = core.get_oci_object_storage_client(config=config)

        # Get Object Store namespace
        namespace_name = get_object_store_namespace(config)

        # If a par_id is given, look it up directly
        if par_id is not None:
            par = os_client.get_preauthenticated_request(
                namespace_name=namespace_name, bucket_name=bucket_name,
                par_id=par_id).data
            return par

        # If a name was given, look it up
        if name:
            pars = oci.pagination.list_call_get_all_results(
                os_client.list_preauthenticated_requests,
                namespace_name=namespace_name,
                bucket_name=bucket_name,
                limit=1000).data
            for par in pars:
                if par.name.lower() == name:
                    return par

        bucket = get_bucket(
            bucket_name=bucket_name, compartment_id=compartment_id, config=config)
        if bucket is None:
            print("Operation Cancelled.\n")
            return

        # List the bucket objects
        pars = os_client.list_preauthenticated_requests(
            namespace_name=namespace_name, bucket_name=bucket.name).data

        # If an user_name was given not given, print the user list
        print(f"Preauthenticated Requests:\n")
        print(format_pars_listing(pars))

        # Let the user choose from the list
        par = core.prompt_for_list_item(
            item_list=pars,
            prompt_caption=("Please enter the index "
                            "of the preauthenticated request: "))

        return par
    except oci.exceptions.ServiceError as e:
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except Exception as e:
        print(f'ERROR: {e}')
        return


@plugin_function('mds.delete.bucketObjectPreauthenticatedRequest')
def delete_par(**kwargs):
    """Deletes an object store PAR

    Args:
        **kwargs: Additional options

    Keyword Args:
        bucket_name (str): The name of the bucket.
        name (str): Name of the PAR, can include * to match multiple PARs
        par_id (str): The OCID of the PAR.
        compartment_id (str): OCID of the parent compartment.
        config (object): An OCI config object or None.
        interactive (bool): Makes the func return true on success

    Returns:
        None or True
    """

    bucket_name = kwargs.get('bucket_name')
    name = kwargs.get('name')
    par_id = kwargs.get('par_id')
    compartment_id = kwargs.get('compartment_id')
    config = kwargs.get('config')
    interactive = kwargs.get('interactive', True)

    # Get the active config and compartment
    try:
        config = configuration.get_current_config(config=config)
        compartment_id = configuration.get_current_compartment_id(
            compartment_id=compartment_id, config=config)
        bucket_name = configuration.get_current_bucket_name(
            bucket_name=bucket_name, config=config)

        import oci.object_storage
        import mysqlsh
        import re

        bucket = get_bucket(
            bucket_name=bucket_name, compartment_id=compartment_id,
            config=config)
        if bucket is None:
            print("Operation Cancelled.\n")
            return

        # Initialize the Object Store client
        os_client = core.get_oci_object_storage_client(config=config)

        # Get Object Store namespace
        namespace_name = get_object_store_namespace(config)

        if not name:
            # Get the PAR
            par = get_par(
                bucket_name=bucket.name, name=name, par_id=par_id,
                compartment_id=compartment_id, config=config)
            if par is None:
                print("Operation cancelled.")
                return
            os_client.delete_preauthenticated_request(
                namespace_name=namespace_name, bucket_name=bucket.name,
                par_id=par.id).data
        else:
            pars = oci.pagination.list_call_get_all_results(
                os_client.list_preauthenticated_requests,
                namespace_name=namespace_name,
                bucket_name=bucket.name,
                limit=1000).data
            # Filter list if PARs
            if name != '*':
                name = name.lower()
                # Filter list if PARs
                if '*' in name:
                    name_pattern = '^' + name.replace('*', '.+')
                    pars = [par for par in pars
                            if re.search(name_pattern, par.name.lower())]
                else:
                    pars = [par for par in pars if name == par.name.lower()]

            # Prompt the user for confirmation
            if interactive:
                prompt = mysqlsh.globals.shell.prompt(
                    f"Are you sure you want to delete {len(pars)} "
                    f"preauthenticated request{'s' if len(pars) > 1 else ''} "
                    f"from {bucket.name} "
                    f"[yes/NO]: ",
                    {'defaultValue': 'no'}).strip().lower()
                if prompt != "yes":
                    print("Deletion aborted.\n")
                    return

            for par in pars:
                os_client.delete_preauthenticated_request(
                    namespace_name=namespace_name, bucket_name=bucket_name,
                    par_id=par.id).data

        if interactive:
            print("Preauthenticated request deleted successfully.")
        else:
            return True

    except oci.exceptions.ServiceError as e:
        if not interactive:
            raise
        print(f'ERROR: {e.message}. (Code: {e.code}; Status: {e.status})')
        return
    except (Exception, ValueError) as e:
        if not interactive:
            raise
        print(f'ERROR: {e}')
        return
