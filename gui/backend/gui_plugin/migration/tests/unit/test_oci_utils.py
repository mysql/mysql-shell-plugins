# Copyright (c) 2026, Oracle and/or its affiliates.
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License, version 2.0,
# as published by the Free Software Foundation.
#
# This program is designed to work with certain software that is licensed
# under separate terms, as designated in a particular file or component
# or in included license documentation. The authors of MySQL hereby grant
# you an additional permission to link the program and your derivative
# works with the separately licensed software that they have either
# included with the program or referenced in the documentation.
#
# This program is distributed in the hope that it will be useful, but
# WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See
# the GNU General Public License, version 2.0, for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA

import importlib
import sys
from unittest.mock import MagicMock, patch

from gui_plugin.migration.lib import oci_utils


class TestCompartment:

    def test_oci_utils_imports_required_oci_submodules(self, tmp_path, monkeypatch):
        def write_module(path, content=""):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content)

        write_module(tmp_path / "mds_plugin" / "__init__.py")
        write_module(tmp_path / "mds_plugin" / "compute.py")
        write_module(tmp_path / "mds_plugin" / "configuration.py")
        write_module(
            tmp_path / "mds_plugin" / "core.py",
            "def __getattr__(name):\n"
            "    def stub(*args, **kwargs):\n"
            "        return None\n"
            "    return stub\n",
        )

        model_module = (
            "class _Dummy:\n"
            "    STATUS_ACCEPTED = 'ACCEPTED'\n"
            "    STATUS_IN_PROGRESS = 'IN_PROGRESS'\n"
            "    STATUS_FAILED = 'FAILED'\n"
            "    STATUS_SUCCEEDED = 'SUCCEEDED'\n"
            "    STATUS_CANCELING = 'CANCELING'\n"
            "    STATUS_CANCELED = 'CANCELED'\n"
            "    LIFECYCLE_STATE_DELETING = 'DELETING'\n"
            "    LIFECYCLE_STATE_DELETED = 'DELETED'\n"
            "    LIFECYCLE_STATE_TERMINATING = 'TERMINATING'\n"
            "    LIFECYCLE_STATE_TERMINATED = 'TERMINATED'\n"
            "\n"
            "def __getattr__(name):\n"
            "    value = type(name, (_Dummy,), {})\n"
            "    globals()[name] = value\n"
            "    return value\n"
            "\n"
            "WorkRequest = type('WorkRequest', (_Dummy,), {})\n"
        )
        for package in [
            "core",
            "identity",
            "mysql",
            "object_storage",
            "work_requests",
        ]:
            write_module(
                tmp_path / "oci" / package / "__init__.py",
                "from . import models\n",
            )
            write_module(tmp_path / "oci" / package / "models.py", model_module)
        write_module(
            tmp_path / "oci" / "identity" / "__init__.py",
            "from . import models\n"
            "\n"
            "class IdentityClient:\n"
            "    pass\n",
        )

        write_module(tmp_path / "oci" / "__init__.py")
        write_module(tmp_path / "oci" / "util.py")
        write_module(tmp_path / "oci" / "pagination.py")
        write_module(tmp_path / "oci" / "regions.py", "REGIONS = []\n")
        write_module(tmp_path / "oci" / "response.py", "class Response:\n    pass\n")
        write_module(
            tmp_path / "oci" / "exceptions.py",
            "class ServiceError(Exception):\n"
            "    status = None\n",
        )
        write_module(
            tmp_path / "oci" / "retry" / "__init__.py",
            "from . import retry_checkers\n"
            "BACKOFF_DECORRELATED_JITTER_VALUE = 'jitter'\n"
            "GLOBAL_RETRY_STRATEGY = None\n"
            "\n"
            "class ExponentialBackoffRetryStrategyBase:\n"
            "    def do_sleep(self, *args, **kwargs):\n"
            "        pass\n"
            "    def make_retrying_call(self, func_ref, *args, **kwargs):\n"
            "        return func_ref(*args, **kwargs)\n"
            "    def add_circuit_breaker_callback(self, callback):\n"
            "        pass\n"
            "\n"
            "class ExponentialBackOffWithDecorrelatedJitterRetryStrategy"
            "(ExponentialBackoffRetryStrategyBase):\n"
            "    def __init__(self, *args, **kwargs):\n"
            "        pass\n"
            "\n"
            "class RetryStrategyBuilder:\n"
            "    def __init__(self, *args, **kwargs):\n"
            "        pass\n"
            "    def add_max_attempts(self, *args, **kwargs):\n"
            "        pass\n"
            "    def add_total_elapsed_time(self, *args, **kwargs):\n"
            "        pass\n"
            "    def add_service_error_check(self, *args, **kwargs):\n"
            "        pass\n"
            "    def get_retry_strategy(self):\n"
            "        return ExponentialbackoffRetryStrategyBase()\n"
            "\n"
            "ExponentialbackoffRetryStrategyBase = ExponentialBackoffRetryStrategyBase\n",
        )
        write_module(
            tmp_path / "oci" / "retry" / "retry_checkers.py",
            "RETRYABLE_STATUSES_AND_CODES = {}\n"
            "\n"
            "class LimitBasedRetryChecker:\n"
            "    def __init__(self, *args, **kwargs):\n"
            "        pass\n"
            "\n"
            "class TotalTimeExceededRetryChecker:\n"
            "    def __init__(self, *args, **kwargs):\n"
            "        pass\n"
            "\n"
            "class TimeoutConnectionAndServiceErrorRetryChecker:\n"
            "    def __init__(self, *args, **kwargs):\n"
            "        pass\n"
            "\n"
            "class RetryCheckerContainer:\n"
            "    def __init__(self, *args, **kwargs):\n"
            "        pass\n",
        )

        original_oci_utils = sys.modules.get("gui_plugin.migration.lib.oci_utils")
        import gui_plugin.migration.lib as migration_lib

        monkeypatch.syspath_prepend(str(tmp_path))
        for name in list(sys.modules):
            if (
                name == "gui_plugin.migration.lib.oci_utils"
                or name == "oci"
                or name.startswith("oci.")
                or name == "mds_plugin"
                or name.startswith("mds_plugin.")
            ):
                monkeypatch.delitem(sys.modules, name, raising=False)

        try:
            imported = importlib.import_module("gui_plugin.migration.lib.oci_utils")

            assert hasattr(imported.oci, "identity")
            assert hasattr(imported.oci, "work_requests")
        finally:
            sys.modules.pop("gui_plugin.migration.lib.oci_utils", None)
            if original_oci_utils is not None:
                sys.modules["gui_plugin.migration.lib.oci_utils"] = original_oci_utils
                migration_lib.oci_utils = original_oci_utils

    def test_list_region_subscriptions_uses_tenancy_id(self):
        config = {
            "tenancy": "ocid1.tenancy.oc1..exampleuniqueID",
            "region": "us-ashburn-1",
        }
        identity_client = MagicMock()
        pagination_result = MagicMock(data=["subscription"])

        with patch(
            "gui_plugin.migration.lib.oci_utils.configuration.get_current_config",
            return_value=config,
        ), patch(
            "gui_plugin.migration.lib.oci_utils.core.get_oci_identity_client",
            return_value=identity_client,
        ), patch(
            "gui_plugin.migration.lib.oci_utils.core.get_oci_virtual_network_client"
        ), patch(
            "gui_plugin.migration.lib.oci_utils.core.get_oci_compute_client"
        ), patch(
            "gui_plugin.migration.lib.oci_utils.core.get_oci_db_system_client"
        ), patch(
            "gui_plugin.migration.lib.oci_utils.core.get_oci_mds_client"
        ), patch(
            "gui_plugin.migration.lib.oci_utils.core.get_oci_object_storage_client"
        ), patch(
            "gui_plugin.migration.lib.oci_utils.oci.pagination.list_call_get_all_results",
            return_value=pagination_result,
        ) as list_all:
            compartment = oci_utils.Compartment(config, lazy_refresh=True)

            result = compartment.list_region_subscriptions()

        list_all.assert_called_once_with(
            identity_client.list_region_subscriptions,
            config["tenancy"],
        )
        assert result == pagination_result.data
