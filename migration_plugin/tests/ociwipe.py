#!/usr/bin/env mysqlsh --py -f
# Copyright (c) 2025 Oracle and/or its affiliates.
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

import argparse
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from migration_plugin.lib import oci_utils
import threading
import re
import time


k_nowipe_tag = "nowipe"
k_oracle_tags = "Oracle-Tags"


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OCI Resource Deleter")

    parser.add_argument(
        "--compartment-id",
        type=str,
        help="ID of the compartment.",
        required=True,
    )

    parser.add_argument(
        "-l",
        "--show-compartment",
        action="store_true",
        help="Show resources in the compartment with the given id and its direct sub-compartments.",
    )

    parser.add_argument(
        "--wipe-compartment",
        action="store_true",
        help="Same as --wipe-db-systems --wipe-computes --wipe-vcns --wipe-buckets.",
    )

    parser.add_argument(
        "--wipe-db-systems",
        action="store_true",
        help="Delete DB systems in compartment and its sub-compartments.",
    )

    parser.add_argument(
        "--wipe-computes",
        action="store_true",
        help="Delete computes in compartment and its sub-compartments.",
    )

    parser.add_argument(
        "--wipe-vcns",
        action="store_true",
        help="Delete VCNs in compartment and its sub-compartments.",
    )

    parser.add_argument(
        "--delete-vcn",
        type=str,
        help="Delete VCN with the given name in compartment and its sub-compartments.",
    )

    parser.add_argument(
        "--wipe-buckets",
        action="store_true",
        help="Delete buckets in compartment and its sub-compartments.",
    )

    parser.add_argument(
        "--force-wipe",
        action="store_true",
        help=f"Wipe resources even in compartments marked with '{k_nowipe_tag}' tag.",
    )

    parser.add_argument(
        "--delete-subcompartments",
        action="store_true",
        help="Delete sub-compartments (need to be empty).",
    )

    parser.add_argument(
        "--created-by",
        type=str,
        help="Only delete resources with a matching CreatedBy tag (regex)."
    )

    parser.add_argument(
        "--config-file",
        type=str,
        help="The path to the OCI's config file.",
    )

    parser.add_argument(
        "--profile",
        type=str,
        help="The profile in the config file to load.",
    )

    args = parser.parse_args()

    if args.wipe_vcns and args.delete_vcn:
        parser.error(
            "The --wipe-vcns and --delete-vcn options cannot be used at the same time."
        )

    return args


def wipe_db_systems(compartments: list[oci_utils.Compartment], filter_fn):
    if filter_fn:
        print("Filtering not supported for DB Systems yet!")

    for comp in compartments:
        comp.delete_all_db_systems(show_fn=print)


def wipe_computes(compartments: list[oci_utils.Compartment], filter_fn):
    for comp in compartments:
        comp.delete_all_instances(show_fn=print, filter_fn=filter_fn)


def wipe_vcns(compartments: list[oci_utils.Compartment], filter_fn):
    for comp in compartments:
        comp.delete_all_vcns(show_fn=print, filter_fn=filter_fn)


def wipe_buckets(compartments: list[oci_utils.Compartment], filter_fn):
    for comp in compartments:
        comp.wipe_all_buckets(show_fn=print, filter_fn=filter_fn)


def delete_compartments(compartments: list[oci_utils.Compartment], filter_fn):
    if filter_fn:
        print("Filtering not supported for compartments yet!")
        return
    work_requests: list[oci_utils.IdentityWorkRequest] = []

    for comp in compartments:
        print(f"Deleting compartment {comp.name}")
        work_requests.append(comp.delete_compartment())

    oci_utils.wait_for_work_requests(
        work_requests, "deleting compartments", show_fn=print)


if __name__ == "__main__":
    args = arguments()

    if args.created_by:
        def filter_resource_(resource) -> bool:
            if not args.force_wipe and resource.freeform_tags and k_nowipe_tag in resource.freeform_tags:
                return False

            created_by = None
            if resource.defined_tags and k_oracle_tags in resource.defined_tags:
                created_by = resource.defined_tags[k_oracle_tags].get(
                    "CreatedBy")
            if created_by and not re.match(args.created_by, created_by):
                return False

            return True
        filter_resource = filter_resource_
    else:
        filter_resource = None

    config = oci_utils.get_config(args.config_file, args.profile)
    main_compartment = oci_utils.Compartment(
        config,
        ocid_or_compartment=args.compartment_id,
    )
    compartments: list[oci_utils.Compartment] = []

    if args.force_wipe:
        compartments.append(main_compartment)
        compartments.extend(main_compartment.get_all_compartments())
    else:
        if main_compartment.freeform_tag(k_nowipe_tag) is None:
            compartments.append(main_compartment)

            for comp in main_compartment.get_all_compartments():
                if comp.freeform_tag(k_nowipe_tag) is None:
                    compartments.append(comp)
                else:
                    print(
                        f"Compartment {comp.name} ({comp.id}) is marked with '{k_nowipe_tag}' tag, skipping.")
        else:
            print(
                f"Main compartment {main_compartment.name} ({main_compartment.id}) is marked with '{k_nowipe_tag}' tag, nothing to do!")

    if args.show_compartment:
        for comp in compartments:
            print()
            comp.print_all_resources(show_fn=print)

    if args.wipe_compartment:
        args.wipe_db_systems = True
        args.wipe_computes = True
        args.wipe_vcns = True
        args.wipe_buckets = True

    what_to_wipe: list[str] = []

    if args.wipe_db_systems:
        what_to_wipe.append("DB SYSTEMS")

    if args.wipe_computes:
        what_to_wipe.append("COMPUTES")

    if args.wipe_vcns or args.delete_vcn:
        what_to_wipe.append("VCNS")

    if args.wipe_buckets:
        what_to_wipe.append("BUCKETS")

    if what_to_wipe:
        print(
            f"\033[91mWIPING {', '.join(what_to_wipe)} in compartment {main_compartment.name}!\033[0m")
        time.sleep(3)

        threads: int = 0

        # we use a separate thread for each of the tasks, VCNs do not get a thread,
        # because both DB systems and computes need to be deleted first
        for todo in [args.wipe_db_systems, args.wipe_computes, args.wipe_buckets]:
            if todo:
                threads += 1

        local_context = threading.local()

        def initializer(compartments: list[oci_utils.Compartment]):
            local_context.compartments = [oci_utils.Compartment(
                comp._config, comp.obj) for comp in compartments]

        def worker(task: Callable[[list[oci_utils.Compartment], Callable], None], descr: str, filter_fn):
            try:
                task(local_context.compartments, filter_fn)
            except Exception as e:
                import traceback
                traceback.print_exc()
                print(f"Exception while {descr}: {e}")

        with ThreadPoolExecutor(
            max_workers=max(threads, 1), initializer=initializer, initargs=(compartments,)
        ) as executor:
            if args.wipe_buckets:
                executor.submit(worker, wipe_buckets,
                                "wiping buckets", filter_resource)

            db_systems_task = None
            computes_task = None

            if args.wipe_db_systems:
                db_systems_task = executor.submit(
                    worker, wipe_db_systems, "wiping DB systems", filter_resource)

            if args.wipe_computes:
                computes_task = executor.submit(
                    worker, wipe_computes, "wiping computes", filter_resource)

            if args.wipe_vcns or args.delete_vcn:
                # before wiping the VCNs we need to wait until computes and DB systems are deleted
                if db_systems_task:
                    db_systems_task.result()

                if computes_task:
                    computes_task.result()

                if args.wipe_vcns:
                    executor.submit(worker, wipe_vcns,
                                    "wiping VCNs", filter_resource)
                elif args.delete_vcn:
                    def match_vcn(vcn):
                        return vcn.display_name == args.delete_vcn
                    executor.submit(worker, wipe_vcns,
                                    f"deleting {args.delete_vcn} VCN", match_vcn)

            executor.shutdown()

    if args.delete_subcompartments:
        # don't delete the main compartment
        delete_compartments(
            [comp for comp in compartments if main_compartment != comp], filter_resource)
