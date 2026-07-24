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

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from gui_plugin.migration.lib import errors
from gui_plugin.migration.lib.backend import model, oci_stages


def _provision_vcn_stage(on_premise_public_cidr_block: str):
    options = model.OCIHostingOptions()
    options.vcnName = "MySQLVCN"
    options.publicSubnet.id = "ocid1.subnet.oc1..public"
    options.onPremisePublicCidrBlock = on_premise_public_cidr_block

    stage = oci_stages.ProvisionVCN.__new__(oci_stages.ProvisionVCN)
    stage._owner = SimpleNamespace(
        migrator_instance_id="test-migration",
        options=SimpleNamespace(targetHostingOptions=options),
    )
    stage.push_progress = MagicMock()
    return stage


class TestSecurityListPublicCidr:

    def test_public_security_list_uses_valid_ipv4_cidr_for_ssh_ingress(self):
        stage = _provision_vcn_stage("192.0.2.44/32")
        comp = SimpleNamespace(display_name="MySQL")
        vcn = MagicMock()
        vcn.add_security_list.return_value = "ocid1.securitylist.oc1..ssh"

        stage.ensure_public_security_list(comp, vcn)

        vcn.add_security_list.assert_called_once()
        assert vcn.add_security_list.call_args.kwargs["ingress"][0] == (
            "192.0.2.44/32",
            22,
            "SSH",
        )

    def test_public_security_list_canonicalizes_bare_ipv4_for_ssh_ingress(self):
        stage = _provision_vcn_stage("192.0.2.44")
        comp = SimpleNamespace(display_name="MySQL")
        vcn = MagicMock()
        vcn.add_security_list.return_value = "ocid1.securitylist.oc1..ssh"

        stage.ensure_public_security_list(comp, vcn)

        assert vcn.add_security_list.call_args.kwargs["ingress"][0] == (
            "192.0.2.44/32",
            22,
            "SSH",
        )

    def test_public_security_list_rejects_empty_ssh_ingress_cidr(self):
        stage = _provision_vcn_stage("")
        vcn = MagicMock()

        with pytest.raises(errors.BadUserInput):
            stage.ensure_public_security_list(SimpleNamespace(display_name="MySQL"), vcn)

        vcn.add_security_list.assert_not_called()

    def test_public_security_list_rejects_host_bits_in_ssh_ingress_cidr(self):
        stage = _provision_vcn_stage("192.0.2.44/24")
        vcn = MagicMock()

        with pytest.raises(errors.BadUserInput):
            stage.ensure_public_security_list(SimpleNamespace(display_name="MySQL"), vcn)

        vcn.add_security_list.assert_not_called()

    def test_public_security_list_rejects_ipv6_ssh_ingress_cidr(self):
        stage = _provision_vcn_stage("2001:db8::1/128")
        vcn = MagicMock()

        with pytest.raises(errors.BadUserInput):
            stage.ensure_public_security_list(SimpleNamespace(display_name="MySQL"), vcn)

        vcn.add_security_list.assert_not_called()
