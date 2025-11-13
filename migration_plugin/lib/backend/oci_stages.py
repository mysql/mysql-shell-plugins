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

import datetime
import time
from typing import cast, Optional, Callable

from ..util import sanitize_dict, k_san_dict_par, interruptible_sleep
import oci.exceptions
import oci.util
import os
from oci.mysql.models import DbSystem, UpdateDbSystemDetails
from oci.core.models import Instance
from . import model, stage
from .. import oci_utils, logging, errors, dbsession

k_par_ttl_hours = 7 * 24


"""
# Requirements relative to OCI resources created by us vs supplied by user

OCI Resources may be:
- new, created by us
- existing, created by us (same as above, but in case of a retry)
- existing, created by user

## DBSystem (created by user)
- If user provides an existing DBSystem, it must be empty. Contents may be deleted.
- All required resources must be pre-configured (compartments, VCN, security lists etc)

## Compute
- User provided compute is not supported, but reusing a compute created by us before is

## VCN (created by user)
- If user VCN is selected, then user must prepare and select all network configs
- If new VCN is selected, then we create everything
- If VCN pre-created by us is selected, then we update everything
"""


def wait_work_request(stage: stage.ThreadedStage, work: oci_utils.MySQLWorkRequest | oci_utils.WorkRequest, context: str,
                      refresh_delay: Optional[int] = 5):
    last_status = None
    last_percent = None
    done = False

    def get_refresh_delay(progress: Optional[float]) -> int:
        if refresh_delay is not None:
            return refresh_delay
        if not progress or progress < 50:
            return 60
        elif progress < 80:
            return 30
        else:
            return 5

    logging.debug(f"WorkRequest start, context={context}, id={work.id}")
    stage.push_progress(
        f"Monitoring WorkRequest {work.operation_type} ({work.status}) for {context}")

    while not done:
        work.refresh()

        match work.status:
            case work.STATUS_ACCEPTED:
                if last_status != work.STATUS_ACCEPTED:
                    stage.push_progress(f"Work request for {context} accepted")

            case work.STATUS_IN_PROGRESS:
                if last_percent != work.percent_complete:
                    stage.push_progress(f"{context} in progress", {
                        "stageCurrent": work.percent_complete, "stageTotal": 100.0})
                    last_percent = work.percent_complete

            case work.STATUS_CANCELING | work.STATUS_CANCELED:
                logging.error(
                    f"The work request for {context} has been cancelled: {work}")
                raise errors.OCIRuntimeError(
                    f"The work request for {context} was cancelled externally")

            case work.STATUS_SUCCEEDED:
                stage.push_progress(f"{context} has completed", {
                    "stageCurrent": 100.0, "stageTotal": 100.0})
                done = True

            case work.STATUS_FAILED:
                logging.error(
                    f"Work request for {context} has failed: {work}")
                work_errors = work.errors
                details = ""
                if work_errors:
                    for e in work_errors:
                        logging.error(
                            f"Work request for {context} error: {e.timestamp}: {e.message} ({e.code})")
                        details = f": {e.message} (code {e.code})"

                raise errors.OCIWorkRequestError(
                    f"{context} has failed with an OCI error{details}",
                    errors=[{"message": e.message, "code": e.code} for e in work_errors])

        stage.check_stop()

        last_status = work.status
        if not done:
            interruptible_sleep(get_refresh_delay(
                last_percent), lambda: stage._is_stopped)

    logging.debug(f"WorkRequest done, context={context}, id={work.id}")


def wait_db_system_state(stage: stage.ThreadedStage, is_ready: Callable[[oci_utils.DBSystem], bool],
                         context: str) -> oci_utils.DBSystem:
    done = False

    db_system = oci_utils.DBSystem(
        stage._owner.oci_config, stage._owner.cloud_resources.dbSystemId
    )

    logging.debug(
        f"Waiting for DB System, context={context}, id={db_system.id}")

    while not done:
        if is_ready(db_system):
            done = True

        if not done:
            stage.check_stop()
            time.sleep(30)
            db_system.refresh()

    logging.debug(
        f"Waiting for DB System done, context={context}, id={db_system.id}")

    return db_system


class OCIProvisioner(stage.ThreadedStage):
    def __init__(self, id, owner, work_fn) -> None:
        super().__init__(id, owner, work_fn=work_fn)

    def _freeform_tags(self):
        return oci_utils.make_freeform_tags(self._owner.migrator_instance_id)

    def _wait(self, fn):
        while not fn():
            self.check_stop()
            time.sleep(3)

    @property
    def options(self) -> model.OCIHostingOptions:
        return cast(model.OCIHostingOptions, self._owner.options.targetHostingOptions)

    @property
    def resources(self) -> model.CloudResources:
        return self._owner.cloud_resources

    def ensure_compartment(
        self, parent_id: str, id: str, name: str, description: str
    ) -> oci_utils.Compartment:
        if id:
            logging.info(f"Checking given existing compartment {id}...")
            return oci_utils.Compartment(
                config=self._owner.oci_config,
                ocid_or_compartment=id,
            )

        comps = oci_utils.Compartment.find_by_name(
            config=self._owner.oci_config, parent_compartment_id=parent_id, name=name
        )
        if comps:
            logging.info(
                f"compartment {name} already exists in {parent_id}, reusing {comps[0]}")
            return comps[0]

        logging.info(
            f"creating compartment name={name} in parent_id={parent_id} for {self._owner.migrator_instance_id}..."
        )
        self.push_progress(f"Creating compartment")
        comp = oci_utils.Compartment.create(
            config=self._owner.oci_config,
            name=name,
            description=description,
            parent_compartment_id=parent_id,
            freeform_tags=self._freeform_tags(),
        )

        self.push_progress(f"Compartment {name} created")

        return comp

    def get_vcn(self) -> oci_utils.VCN:
        assert self.resources.vcnId
        return oci_utils.VCN(self._owner.oci_config, ocid_or_vcn=self.resources.vcnId,
                             lazy_refresh=True)


class ProvisionVCN(OCIProvisioner):
    def __init__(self, owner) -> None:
        super().__init__(model.SubStepId.PROVISION_VCN, owner, self._do_work)

    def _do_work(self):
        logging.debug(f"{self._name}: start VCN provisioner work thread")
        self.provision_vcn()

    def ensure_network(self, comp: oci_utils.Compartment) -> oci_utils.VCN:
        assert self.resources.networkCompartmentId
        assert self.options.createVcn
        self.push_progress(f"Setting up VCN in compartment {comp.name}")
        vcn = self.ensure_vcn(comp)

        self.ensure_public_subnet(comp, vcn)
        self.ensure_private_subnet(comp, vcn)
        self.ensure_internet_gateway(comp, vcn)
        self.ensure_service_gateway(comp, vcn)
        # TODO handle old vcn
        self.ensure_public_security_list(comp, vcn)
        self.ensure_private_security_list(comp, vcn)

        return vcn

    def ensure_vcn(self, comp: oci_utils.Compartment) -> oci_utils.VCN:
        assert not self.options.vcnId
        assert self.options.vcnCidrBlock
        assert self.options.vcnName

        if self.options.vcnName:
            vcn_list = comp.find_vcn_by_name(self.options.vcnName)
            if vcn_list:
                logging.warning(
                    f"VCN with name {self.options.vcnName} already exist in {comp.name}, reusing {vcn_list[0]}"
                )
                self.options.vcnId = vcn_list[0].id
                self.resources.vcnId = vcn_list[0].id
                return vcn_list[0]
            else:
                logging.info(
                    f"VCN with name {self.options.vcnName} not found in {comp.name}")

        self.push_progress(f"Creating VCN {self.options.vcnName}")
        vcn = comp.create_vcn(
            self.options.vcnName,
            cidr_block=self.options.vcnCidrBlock,
            freeform_tags=self._freeform_tags(),
        )
        self.options.vcnId = vcn.id
        self.resources.vcnId = vcn.id
        self.push_progress(f"VCN {self.options.vcnName} created")
        logging.info(
            f"created vcn name={self.options.vcnName} id={self.options.vcnId} in compartment {comp.name}: {vcn}"
        )
        return vcn

    def ensure_public_subnet(self, comp: oci_utils.Compartment, vcn: oci_utils.VCN):
        # Create subnet
        assert self.options.publicSubnet.cidrBlock
        assert self.options.publicSubnet.name

        input_name = self.options.publicSubnet.name
        if self.options.publicSubnet.name:
            subnet_list = vcn.find_subnet_by_name(
                self.options.publicSubnet.name)
            if subnet_list:
                self.options.publicSubnet.id = cast(str, subnet_list[0].id)
                logging.info(
                    f"Subnet with name {self.options.publicSubnet.name} already exists, reusing {oci.util.to_dict(subnet_list[0])}"
                )
                return
            elif input_name:
                logging.info(
                    f"Subnet with name {self.options.publicSubnet.name} not found in {comp.name}"
                )

        self.push_progress(f"Creating subnet {self.options.publicSubnet.name}")
        subnet = vcn.create_subnet(
            name=self.options.publicSubnet.name,
            cidr_block=self.options.publicSubnet.cidrBlock,
            freeform_tags=self._freeform_tags(),
            private=False,
            # dns_label=self.options.publicSubnet.dnsLabel,
        )
        self.options.publicSubnet.id = subnet.id
        self.push_progress(f"Subnet {self.options.publicSubnet.name} created")

    def ensure_private_subnet(self, comp: oci_utils.Compartment, vcn: oci_utils.VCN):
        # Create subnet
        assert self.options.privateSubnet.cidrBlock
        assert self.options.privateSubnet.name

        input_name = self.options.privateSubnet.name

        if self.options.privateSubnet.name:
            subnet_list = vcn.find_subnet_by_name(
                self.options.privateSubnet.name)
            if subnet_list:
                self.options.privateSubnet.id = cast(str, subnet_list[0].id)
                logging.info(
                    f"Subnet with name {self.options.privateSubnet.name} already exists, reusing {oci.util.to_dict(subnet_list[0])}"
                )
                return
            elif input_name:
                logging.info(
                    f"Subnet with name {self.options.privateSubnet.name} not found in {comp.name}"
                )

        self.push_progress(
            f"Creating subnet {self.options.privateSubnet.name}")
        subnet = vcn.create_subnet(
            name=self.options.privateSubnet.name,
            cidr_block=self.options.privateSubnet.cidrBlock,
            freeform_tags=self._freeform_tags(),
            private=True,
            # dns_label=self.options.privateSubnet.dnsLabel,
        )
        self.options.privateSubnet.id = subnet.id
        self.push_progress(f"Subnet {self.options.publicSubnet.name} created")

    def ensure_internet_gateway(self, comp: oci_utils.Compartment, vcn: oci_utils.VCN):
        input_name = self.options.internetGatewayName
        if not self.options.internetGatewayName:
            self.options.internetGatewayName = f"{self.options.vcnName}-IGW"

        # check if there's one already
        igw_list = vcn.find_internet_gateway_by_name(
            name=self.options.internetGatewayName,
        )
        if igw_list:
            logging.info(
                f"Internet gateway with name {self.options.internetGatewayName} already exists, reusing {oci.util.to_dict(igw_list[0])}"
            )
            return
        elif input_name:
            logging.info(
                f"Internet gateway with name {self.options.internetGatewayName} not found in {comp.name}"
            )

        self.push_progress(
            f"Creating internet gateway {self.options.internetGatewayName}"
        )
        igw = vcn.create_internet_gateway(
            route_table_id=vcn.default_route_table_id,
            name=self.options.internetGatewayName,
            freeform_tags=self._freeform_tags(),
        )
        self.push_progress(
            f"Internet gateway {self.options.internetGatewayName} created"
        )
        logging.info(
            f"Created internet gateway (and added public routes) name={self.options.internetGatewayName} id={igw.id}"
        )

    def ensure_service_gateway(self, comp: oci_utils.Compartment, vcn: oci_utils.VCN):
        input_name = self.options.serviceGatewayName
        if not self.options.serviceGatewayName:
            self.options.serviceGatewayName = f"{self.options.vcnName}-SGW"

        # check if there's one already
        sgw_list = vcn.find_service_gateway_by_name(
            name=self.options.serviceGatewayName,
        )
        if sgw_list:
            logging.info(
                f"Service gateway with name {self.options.serviceGatewayName} already exists, reusing {oci.util.to_dict(sgw_list[0])}"
            )
            return
        elif input_name:
            logging.info(
                f"Service gateway with name {self.options.serviceGatewayName} not found in {comp.name}"
            )

        self.push_progress(
            f"Creating service gateway {self.options.serviceGatewayName}"
        )
        sgw = vcn.create_service_gateway(
            route_table_id=vcn.default_route_table_id,
            name=self.options.serviceGatewayName,
            freeform_tags=self._freeform_tags(),
        )
        self.push_progress(
            f"service gateway {self.options.serviceGatewayName} created for public subnet"
        )
        logging.info(
            f"Created service gateway (and added public routes) name={self.options.serviceGatewayName} id={sgw.id}"
        )

    def ensure_public_security_list(self, comp: oci_utils.Compartment, vcn: oci_utils.VCN):
        """
        Minimal goals:
        - allow ingress from on-premises to jump-host:22 (ssh)
        - allow ingress from DBSystem to jump-host:3306 (for inbound repl)
        """
        # Create a security list for the VCN
        security_list_name = f"{self.options.vcnName}-MigrationSecList-Public"
        self.push_progress(
            f"Setting up security lists for SSH access through public subnet")

        slid = vcn.add_security_list(
            subnet_id=self.options.publicSubnet.id,
            security_list_name=security_list_name,
            freeform_tags=self._freeform_tags(),
            ingress=[(self.options.onPremisePublicCidrBlock, 22, "SSH"),
                     ("10.0.0.0/16", 3306, "For replication channel connections from DBSystem to Jump Host running SSH tunnel to source MySQL")
                     ],
            egress=[],
        )
        self.push_progress(f"Security list updated for public subnet")
        if slid:
            logging.info(
                f"Updated security lists for SSH access through public subnet name={security_list_name} id={slid} in compartment={comp.name}"
            )
        else:
            logging.info(
                f"Found security list for SSH access through public subnet in compartment={comp.name}"
            )

    def ensure_private_security_list(self, comp: oci_utils.Compartment, vcn: oci_utils.VCN):
        """
        Minimal goals:
        - allow ingress from jump-host to DBSystem:3306
        - allow egress from DBSystem to jump-host:3306 (for inbound repl)
        """

        # Create a security list for the VCN
        security_list_name = f"{self.options.vcnName}-MigrationSecList-Private"
        self.push_progress(
            f"Setting up security lists for MySQL access through private subnet"
        )
        # TODO tighten source/destination for in/egress

        # TODO add egress from DBSystem to internet (or source DB) for repl channel
        slid = vcn.add_security_list(
            subnet_id=self.options.privateSubnet.id,
            security_list_name=security_list_name,
            freeform_tags=self._freeform_tags(),
            ingress=[
                ("10.0.0.0/16", 3306, "MySQL from jump host to DBSystem")],
            egress=[
                ("10.0.0.0/16", 3306, "MySQL Channels from DBSystem to jump host")]
        )
        self.push_progress(f"Security list updated")
        if slid:
            logging.info(
                f"Updated security lists for MySQL access through private subnet name={security_list_name} id={slid} in compartment={comp.name}"
            )
        else:
            logging.info(
                f"Found security list for MySQL access through private subnet in compartment={comp.name}"
            )

    def validate_vcn(self):
        logging.info(
            f"Verifying pre-existing VCN {self.options.vcnId}...")
        try:
            vcn = oci_utils.VCN(self._owner.oci_config,
                                ocid_or_vcn=self.options.vcnId)
            logging.info(
                f"VCN {vcn.display_name} exists: {oci.util.to_dict(vcn)}")
        except Exception as e:
            logging.error(f"Error checking VCN {self.options.vcnId}: {e}")
            raise
        try:
            subnet = vcn.get_subnet(self.options.publicSubnet.id)
            logging.info(
                f"Public subnet {subnet.display_name} exists: {oci.util.to_dict(subnet)}")
        except Exception as e:
            logging.error(
                f"Error checking public subnet {self.options.publicSubnet.id} in VCN {self.options.vcnId}: {e}")
            raise
        try:
            subnet = vcn.get_subnet(self.options.privateSubnet.id)
            logging.info(
                f"Private subnet {subnet.display_name} exists: {oci.util.to_dict(subnet)}")
        except Exception as e:
            logging.error(
                f"Error checking private subnet {self.options.privateSubnet.id} in VCN {self.options.vcnId}: {e}")
            raise

        return vcn

    def provision_vcn(self):
        logging.info(
            f"Provision VCN: createVcn={self.options.createVcn} vcnId={self.options.vcnId}")

        if self.options.createVcn:
            self.push_status(stage.WorkStatusEvent.BEGIN,
                             message="Provisioning a new VCN")
            if (
                self.options.networkCompartmentId
                and self.options.networkCompartmentId != self.options.compartmentId
            ) or (
                self.options.networkCompartmentName
                and self.options.networkCompartmentName != self.options.compartmentName
            ):
                parent_compartment_id = self.options.networkParentCompartmentId
                if not parent_compartment_id:
                    parent_compartment_id = self.options.parentCompartmentId
                net_comp = self.ensure_compartment(
                    parent_id=parent_compartment_id,
                    id=self.options.networkCompartmentId,
                    name=self.options.networkCompartmentName,
                    description="Shared Compartment for Networks"
                )
            else:
                net_comp = self._owner.get_compartment()
            self.resources.networkCompartmentId = net_comp.id
            self.resources.networkCompartmentName = net_comp.name

            self.ensure_network(net_comp)
        else:
            self.push_status(stage.WorkStatusEvent.BEGIN,
                             message=f"Verifying selected VCN")
            self.validate_vcn()

        # TODO specify whether the network was created or just found/verified
        self.push_status(stage.WorkStatusEvent.END,
                         message=f"Network {self.options.vcnName} provisioned")


class ProvisionCompartment(OCIProvisioner):
    def __init__(self, owner) -> None:
        super().__init__(model.SubStepId.PROVISION_COMPARTMENT, owner, self._do_work)

    def _do_work(self):
        assert self.options.compartmentName or self.options.compartmentId

        if self.options.compartmentId:
            self.push_status(stage.WorkStatusEvent.BEGIN,
                             message=f"Verifying compartment {self.options.compartmentName}")
            check_only = True
        else:
            self.push_status(stage.WorkStatusEvent.BEGIN,
                             message=f"Provisioning compartment {self.options.compartmentName}")
            check_only = False

        comp = self.ensure_compartment(
            parent_id=self.options.parentCompartmentId,
            id=self.options.compartmentId,
            name=self.options.compartmentName,
            description="Compartment for MySQL HeatWave"
        )
        self.resources.compartmentId = comp.id
        self.resources.compartmentName = comp.name

        self.push_status(stage.WorkStatusEvent.END,
                         message=f"Compartment {comp.name} {'verified' if check_only else 'provisioned'}")


class ProvisionBucket(OCIProvisioner):
    def __init__(self, owner) -> None:
        super().__init__(model.SubStepId.PROVISION_BUCKET, owner, work_fn=self._do_work)

    def _do_work(self):
        logging.debug(f"{self._name}: start Bucket provisioner thread")

        comp = self._owner.get_compartment()

        self.push_status(stage.WorkStatusEvent.BEGIN,
                         message="Provisioning bucket in Object Storage")

        self.ensure_bucket(comp)

        self.push_status(stage.WorkStatusEvent.END,
                         message=f"Bucket {self.resources.bucketName} provisioned")

    def ensure_bucket(self, comp: oci_utils.Compartment):
        def create_par():
            par_name = (
                f"par-{self._owner.source_info.serverUuid}-{datetime.datetime.now().isoformat()}"
            )
            expiration = datetime.datetime.now() + datetime.timedelta(
                hours=k_par_ttl_hours
            )
            # TODO make this a prefix par
            logging.debug(
                f"Creating PAR name={par_name} for bucket {self.options.bucketName}, expiration={expiration}"
            )
            par = comp.create_bucket_par(
                name=par_name,
                bucket_name=self.options.bucketName,
                time_expires=expiration,
            )
            self.resources.bucketPar = {"id": par.id, "par": par.full_path}
            logging.info(
                f"PAR {par_name} created: {sanitize_dict(cast(dict, oci.util.to_dict(par)), k_san_dict_par)}"
            )

        if self.resources.bucketCreated:
            logging.info(
                f"bucket {self.resources.bucketName} was previously created")
            try:
                comp.get_bucket(self.resources.bucketName)
                return
            except oci.exceptions.ServiceError as e:
                logging.error(
                    f"{self._name}: could not get previously created bucket {self.resources.bucketName}: {e}")
                if e.status == 404 and e.code == "BucketNotFound":
                    logging.info(
                        f"Bucket will be created anew")
                else:
                    raise

        logging.info(
            f"Creating bucket {self.options.bucketName} in compartment={comp.name} namespace={comp.namespace}"
        )
        try:
            comp.create_bucket(
                self.options.bucketName, freeform_tags=self._freeform_tags()
            )
            self.resources.bucketName = self.options.bucketName
            self.resources.bucketNamespace = comp.namespace
            self.resources.bucketCreated = True
        except oci.exceptions.ServiceError as e:
            if e.code == "BucketAlreadyExists":
                logging.info(
                    f"Bucket {self.options.bucketName} already exists")
            else:
                raise
        create_par()


class ProvisionCompute(OCIProvisioner):
    def __init__(self, owner) -> None:
        super().__init__(model.SubStepId.PROVISION_COMPUTE, owner, work_fn=self._do_work)
        self._work_request: Optional[oci_utils.WorkRequest] = None

    def _do_work(self):
        if self.resources.computeId:
            self.push_status(stage.WorkStatusEvent.BEGIN,
                             message="Verifying compute instance for jump host")
        else:
            self.push_status(stage.WorkStatusEvent.BEGIN,
                             message="Launching compute instance for jump host")
        comp = self._owner.get_compartment()

        self.instance = self.ensure_compute(comp)

        self.ensure_compute_running(self.instance)

        self.push_status(stage.WorkStatusEvent.END,
                         message=f"Jump host instance {self.instance.display_name} was launched")

    def ensure_compute(
        self, compartment: oci_utils.Compartment
    ) -> oci_utils.ComputeInstance:

        instance = None
        # Check if compute was already created previously
        if self.resources.computeId:
            logging.info(
                f"Getting previously created compute {self.resources.computeId}...")
            instance = oci_utils.ComputeInstance(
                config=self._owner.oci_config,
                ocid_or_instance=self.resources.computeId
            )

        # if compute ocid was given, check if it exists and is running
        if not instance and self.options.computeId:
            logging.info(
                f"Getting given compute {self.options.computeId}...")
            instance = oci_utils.ComputeInstance(
                config=self._owner.oci_config,
                ocid_or_instance=self.options.computeId
            )

        self.check_stop()

        # check if a compute with the same name already exists
        # TODO duplicate name should throw an error, if picking an existing compute
        # (by id), then we need the path to the ssh key

        if not instance:
            # TODO fallback to other similar shapes if OCI runs out of the one we want
            images = compartment.list_images(
                operating_system="Oracle Linux",
                operating_system_version="8",
                shape=self.options.shapeName,
            )
            if not images:
                logging.error(
                    f"could not find any images for operating_system=Oracle Linux, operating_system_version=8, shape={self.options.shapeName}"
                )
                raise Exception(
                    f"Could not find any suitable compute images for shape {self.options.shapeName}"
                )
            logging.debug(
                f"images for shape={self.options.shapeName} are: {[s.display_name for s in images]}, picking first"
            )

            logging.info(
                f"Creating compute instance {self.options.computeName} {self.options}"
            )

            instance_tags = {
                'user_id': self._owner.oci_config.get('user'),
            } | self._freeform_tags()

            self.check_stop()

            self._owner.project.create_ssh_key_pair()
            with open(self._owner.project.ssh_key_public) as f:
                ssh_public_key = f.read()

            # Note: we don't use an init_script because it seems compute can become
            # ONLINE before it finishes executing, which results in a race
            instance, self._work_request = compartment.create_instance(
                instance_name=self.options.computeName,
                availability_domain=self.options.availabilityDomain
                or compartment.pick_availability_domain(),
                shape_name=self.options.shapeName,
                ocpus=float(self.options.cpuCount),
                memory_in_gbs=float(self.options.memorySizeGB),
                subnet_id=self.options.publicSubnet.id,
                image_id=cast(str, images[0].id),
                ssh_public_key=ssh_public_key,
                freeform_tags=instance_tags,
            )

            self.resources.computeId = instance.id
            self.resources.computeName = instance.display_name
            self.resources.computeCreated = True

            self._owner.project.save_shared_ssh_key_pair(instance.id)

            logging.info(f"Compute instance created {instance}")
        else:
            self.resources.computeId = instance.id

        return instance

    def ensure_compute_running(self, instance: oci_utils.ComputeInstance):
        if self._work_request:
            wait_work_request(self, self._work_request,
                              "Launch compute instance")
            instance.refresh()

        if instance.lifecycle_state == Instance.LIFECYCLE_STATE_STOPPED:
            logging.info(
                f"Instance {instance.id} is STOPPED and will be started")
            instance.start()
        # TODO handle other states
        if instance.lifecycle_state != Instance.LIFECYCLE_STATE_RUNNING:
            logging.info(
                f"Waiting for instance {instance.id} to become RUNNING")

            def check():
                instance.refresh()
                logging.debug(f"instance state={instance.lifecycle_state}")
                if instance.lifecycle_state in (Instance.LIFECYCLE_STATE_STOPPED,
                                                Instance.LIFECYCLE_STATE_STOPPING,
                                                Instance.LIFECYCLE_STATE_TERMINATED,
                                                Instance.LIFECYCLE_STATE_TERMINATING):
                    logging.error(
                        f"Instance {instance.id} has unexpected state {instance.lifecycle_state}"
                    )
                    raise Exception(
                        f"Instance {instance.display_name} in unexpected state {instance.lifecycle_state}"
                    )
                return (
                    instance.lifecycle_state == Instance.LIFECYCLE_STATE_RUNNING
                )

            self._wait(check)

            logging.info(f"Instance is now {instance.lifecycle_state}")


class ProvisionJumpHost(OCIProvisioner):
    def __init__(self, owner, compute) -> None:
        super().__init__(model.SubStepId.PROVISION_HELPER, owner, work_fn=self._do_work)
        self._compute = compute

    def _do_work(self):
        self.push_status(stage.WorkStatusEvent.BEGIN,
                         message="Provisioning jump host agent")

        self.ensure_provisioned(self._compute.instance)

        self.push_status(stage.WorkStatusEvent.END,
                         message="Jump host provisioned")

    def ensure_provisioned(self, instance: oci_utils.ComputeInstance):
        retry_count = 0
        while retry_count < 5:
            try:
                self.do_ensure_provisioned(instance=instance)
                return
            except (EOFError, OSError) as e:
                retry_count += 1
                logging.exception(
                    f"Failed provisioning jump host, attempt {retry_count}...")

        raise errors.OCIError(
            f"Failed provisioning the jump host")

    def do_ensure_provisioned(self, instance: oci_utils.ComputeInstance):
        assert self._owner.options.targetHostingOptions

        public_ip, private_ip = instance.get_ips()
        logging.info(
            f"📡 Helper instance public_ip={public_ip} private_ip={private_ip}")

        if not public_ip or not private_ip:
            raise errors.OCIError(
                f"Could not determine public and private IP addresses of compute instance {instance.id}")

        self.resources.computePublicIP = public_ip
        self.resources.computePrivateIP = private_ip

        self._owner.push_progress(model.SubStepId.PROVISION_HELPER,
                                  f"Connecting ssh to jump host instance")

        with self._owner.connect_remote_helper(wait_ready=True) as helper:
            if helper.exists():
                status = helper.check_helper()
                logging.info(
                    f"remote helper self-status: up-to-date={status}")
                if status:
                    logging.info(
                        f"remote helper already running and has suitable version"
                    )
                    return
            else:
                logging.info("remote helper not setup")

            def progress(msg: str):
                self.check_stop()
                if msg:
                    self._owner.push_progress(
                        model.SubStepId.PROVISION_HELPER, msg)

            self._owner.push_progress(model.SubStepId.PROVISION_HELPER,
                                      f"Setting up jump host")
            helper.setup(
                basedir=os.path.abspath(
                    os.path.join(os.path.dirname(__file__), "../..")
                ),
                progress_fn=progress
            )

            if self._owner.options.migrationType == model.MigrationType.HOT and self._owner.options.cloudConnectivity in (
                    model.CloudConnectivity.SSH_TUNNEL,
                    model.CloudConnectivity.LOCAL_SSH_TUNNEL):
                self._owner.push_progress(model.SubStepId.PROVISION_HELPER,
                                          f"Configuring host to enable SSH tunneling")
                helper.enable_tunneling()

            status = helper.helper_status()
            logging.info(f"remote helper status={status}")


class DBSystemUpdateStage(OCIProvisioner):
    def ensure_state_active(self, db_system: oci_utils.DBSystem) -> oci_utils.DBSystem:
        if db_system.lifecycle_state != DbSystem.LIFECYCLE_STATE_ACTIVE:
            self.push_progress("Waiting for the DB System to become active")

            def is_active(db_system: oci_utils.DBSystem):
                logging.info(
                    f"waiting for DBSystem ocid={db_system.id} lifecycle_state={db_system.lifecycle_state}"
                )

                if db_system.lifecycle_state == DbSystem.LIFECYCLE_STATE_ACTIVE:
                    logging.info(f"DBSystem is active {db_system}")
                    self.push_progress("The DB System is now active")
                    return True

                if db_system.lifecycle_state not in [
                    DbSystem.LIFECYCLE_STATE_CREATING,
                    DbSystem.LIFECYCLE_STATE_UPDATING,
                ]:
                    logging.error(
                        f"DBSystem {db_system.id} has unexpected state {db_system.lifecycle_state}"
                    )
                    raise Exception(
                        f"DBSystem {db_system.display_name} is in unexpected state {db_system.lifecycle_state}"
                    )

                return False

            return wait_db_system_state(self, is_active, "waiting for DB System")

        return db_system


class LaunchDBSystem(DBSystemUpdateStage):
    _db_system = None
    _work_request = None

    def __init__(self, owner) -> None:
        super().__init__(model.SubStepId.PROVISION_DBSYSTEM, owner, work_fn=self._do_work)

    def _rollback(self, compartment: oci_utils.Compartment):
        status_message = ""
        if self._db_system and self.resources.dbSystemCreated:
            configuration_deleted = False
            db_system_deleted = False
            try:
                logging.info(
                    f"Deleting DB System with id={self._db_system.id}")
                self._db_system.delete_db_system()
                db_system_deleted = True
            except Exception as e:
                logging.exception("delete db system")

            try:
                logging.info(
                    f"Deleting DB System Configuration with id={self._db_system.configuration.id}")
                compartment.delete_configuration(
                    self._db_system.configuration.id)
                configuration_deleted = True
            except:
                logging.exception("delete db system configuration")

            if configuration_deleted and db_system_deleted:
                status_message = "DB System and configuration were deleted"
            elif db_system_deleted:
                status_message = "DB System was deleted but not the configuration"
            else:
                status_message = "failed deleting the DB System"

        return status_message

    def _do_work(self):
        compartment = oci_utils.Compartment(
            self._owner.oci_config,
            ocid_or_compartment=self._owner.cloud_resources.compartmentId
        )

        if self.resources.dbSystemId:
            self.push_status(stage.WorkStatusEvent.BEGIN,
                             message="Verifying MySQL DB System")
        else:
            self.push_status(stage.WorkStatusEvent.BEGIN,
                             message="Launching MySQL DB System")
        try:
            db, work_request = self.ensure_db_system(compartment=compartment)

            if work_request:
                wait_work_request(self, work_request, "DB System provisioning",
                                  refresh_delay=None)

            # TODO make frontend not show a progressbar for the case where we dont have a work request
            self.ensure_active()
        except errors.Aborted:
            status = self._rollback(compartment=compartment)
            raise
        except errors.OCIWorkRequestError as e:
            details = f" (ocid={self._db_system.id})" if self._db_system else ""
            self.push_status(stage.WorkStatusEvent.ERROR,
                             message=str(e)+details, data={"errors": e.errors})
            raise

        self.push_status(stage.WorkStatusEvent.END,
                         message=f"MySQL DB System {db.display_name} was launched")

    @property
    def resources(self) -> model.CloudResources:
        return self._owner.cloud_resources

    def delete_if_ours(self, db_system: oci_utils.DBSystem) -> bool:
        # Delete the DBSystem if it was provisioned by us for this project
        if db_system.freeform_tag() != self._owner.migrator_instance_id:
            return False
        self.push_progress(
            f"Deleting DB System {db_system.display_name} ({db_system.id}) which is in state {db_system.lifecycle_state}")
        db_system.delete_db_system()
        return True

    def ensure_db_system(self, compartment: oci_utils.Compartment) -> tuple[oci_utils.DBSystem, Optional[oci_utils.MySQLWorkRequest]]:
        options = cast(model.OCIHostingOptions,
                       self._owner.options.targetHostingOptions)
        db_options = cast(model.DBSystemOptions,
                          self._owner.options.targetMySQLOptions)

        self._work_request = None
        if self.resources.dbSystemId:
            logging.info(
                f"Getting previously created DB System with id {self.resources.dbSystemId}...")
            self._db_system = compartment.get_db_system(
                self.resources.dbSystemId)
            logging.info(
                f"DBSystem ocid={self._db_system.id} lifecycle_state={self._db_system.lifecycle_state}"
            )
            if self._db_system.lifecycle_details == DbSystem.LIFECYCLE_STATE_FAILED:
                logging.error(
                    f"Previously created DBSystem {self._db_system.id} is in state FAILED: details={self._db_system.lifecycle_details}")
                if not self.delete_if_ours(self._db_system):
                    raise Exception(
                        f"The DB System with id {self._db_system.id} is in state FAILED")
                self.resources.dbSystemId = ""
                self._db_system = None
            else:
                return self._db_system, self._work_request

        freeform_tags = oci_utils.make_freeform_tags(
            self._owner.migrator_instance_id)

        if db_options.dbSystemId:
            logging.info(
                f"Getting given DBSystem with id {db_options.dbSystemId}...")
            self._db_system = compartment.get_db_system(db_options.dbSystemId)
            logging.info(
                f"DBSystem ocid={self._db_system.id} lifecycle_state={self._db_system.lifecycle_state}"
            )
            self.resources.dbSystemId = self._db_system.id
            return self._db_system, self._work_request

        # TODO this check shouldn't be here, if duplicate name is given then it should create a new db with same name
        # (but it's good for testing)
        if os.getenv("DEBUG_MIGRATION_REUSE_DB"):
            db_systems = compartment.find_db_system_by_name(db_options.name)
            if db_systems:
                logging.info(
                    f"DBSystem(s) with name {db_options.name} already exist, reusing {db_systems[0]}"
                )
                self._db_system = db_systems[0]
                self.resources.dbSystemId = self._db_system.id
                return self._db_system, self._work_request

        # create configuration
        variables = dict(
            [
                (var["variable"], var["value"])
                for var in self._owner.options.mysqlConfiguration
                if not var.get("useDefault", False)
            ]
        )

        configuration, issues = compartment.create_configuration(
            name=db_options.name,
            description=f"Configuration for {db_options.name}",
            freeform_tags=freeform_tags,
            shape_name=db_options.shapeName,
            variables=variables,
            use_ha=db_options.enableHA,
        )

        if issues:
            # TODO: push these issues to the frontend
            logging.warning(
                f"The following DB configuration issues have been reported: {issues}"
            )

        logging.info(
            f"Created DBSystem configuration name={db_options.name} ocid={configuration.id}"
        )

        logging.info(
            f"Launching new DBSystem name={db_options.name} compartment={options.compartmentId} shape={db_options.shapeName} storage_size={db_options.storageSizeGB} avail_domain={db_options.availabilityDomain} fault_domain={db_options.faultDomain} ha={db_options.enableHA}"
        )

        # TODO enableRestService unless the MRS metadata schema exists in source

        self._db_system, self._work_request = compartment.create_db_system(
            name=db_options.name,
            description=db_options.description,
            customer_contacts=[e.strip()
                               for e in db_options.contactEmails.split(",") if e.strip()],
            hostname_label=db_options.hostnameLabel or None,
            admin_user=db_options.adminUsername,
            admin_pass=db_options.adminPassword,
            storage_size_gb=db_options.storageSizeGB,
            auto_expand_storage=db_options.autoExpandStorage,
            auto_expand_maximum_size_gb=db_options.autoExpandMaximumSizeGB,
            version=db_options.mysqlVersion,
            shape_name=db_options.shapeName,
            availability_domain=db_options.availabilityDomain,
            fault_domain=db_options.faultDomain or None,
            subnet_id=options.privateSubnet.id,
            freeform_tags=freeform_tags,
            configuration_id=configuration.id,
            enable_ha=False,  # this will be enabled in a separate step
            # cannot enable REST when HA is requested
            enable_rest=db_options.enableRestService and not db_options.enableHA,
            # backup policy needs to be disabled for crash recovery to be disabled
            enable_backup=False,
            # we enable crash recovery later, after loading dump
            crash_recovery=False
        )
        # TODO enable backup for production template after crash recovery
        self.resources.dbSystemId = self._db_system.id
        self.resources.dbSystemCreated = True
        self.push_progress("The new DBSystem was launched")
        logging.info(
            f"Launched DBSystem ocid={self._db_system.id} lifecycle_state={self._db_system.lifecycle_state}"
        )

        return self._db_system, self._work_request

    def ensure_active(self):
        assert self._db_system

        self._db_system.refresh()

        self._db_system = self.ensure_state_active(self._db_system)

        endpoint = self._db_system.endpoint
        assert endpoint
        assert endpoint.ip_address
        assert self._owner.options.targetMySQLOptions

        self._owner.target_connection_options = {
            "user": self._owner.options.targetMySQLOptions.adminUsername,
            "password": self._owner.options.targetMySQLOptions.adminPassword,
            "host": endpoint.ip_address,
            "port": endpoint.port,
        }

        self.resources.dbSystemIP = endpoint.ip_address
        self.resources.dbSystemVersion = cast(
            str, self._db_system.mysql_version)
        logging.info(f"📡 DBSystem ip={self.resources.dbSystemIP}")
        self.push_progress("The new DB System is ready")


class AddHeatWaveCluster(stage.ThreadedStage):
    def __init__(self, owner) -> None:
        super().__init__(model.SubStepId.PROVISION_HEATWAVE_CLUSTER, owner, work_fn=self._do_work)

    @property
    def _enabled(self) -> bool:
        assert self._owner.project.options.targetMySQLOptions
        return self._owner.project.options.targetMySQLOptions.enableHeatWave

    def _do_work(self):
        self.push_status(stage.WorkStatusEvent.BEGIN,
                         message="Launching HeatWave cluster")

        self.ensure_active()

        self.push_status(stage.WorkStatusEvent.END,
                         message="HeatWave cluster launched")

    @property
    def resources(self) -> model.CloudResources:
        return self._owner.cloud_resources

    def ensure_active(self) -> None:
        db_options = cast(model.DBSystemOptions,
                          self._owner.options.targetMySQLOptions)

        logging.info(
            f"Adding HeatWave cluster to DBSystem ocid={self.resources.dbSystemId}, shape={db_options.heatWaveShapeName}, size={db_options.heatWaveClusterSize}"
        )

        db_system = oci_utils.DBSystem(
            self._owner.oci_config, self.resources.dbSystemId
        )

        if self.resources.heatWaveClusterCreated:
            logging.info(
                f"HeatWave cluster has already been added to DBSystem ocid={self.resources.dbSystemId}"
            )

            if db_system.is_heat_wave_cluster_attached:
                return

            logging.warning(
                f"DBSystem reports that it has no HeatWave cluster, re-adding... ocid={self.resources.dbSystemId}"
            )

        if dbsession.version_to_nversion(db_options.mysqlVersion) >= 80400:
            # always enable LH since there's no extra cost
            enable_lakehouse = True
            logging.info(f"LakeHouse enabled")
        else:
            # unless, server is < 8.4 since there are several restrictions with shapes and other features in that case
            logging.info(
                f"Not enabling LakeHouse because target MySQL version is {db_options.mysqlVersion}")
            enable_lakehouse = False

        work_request = db_system.add_heatwave_cluster(
            db_options.heatWaveShapeName, db_options.heatWaveClusterSize,
            is_lakehouse_enabled=enable_lakehouse
        )

        wait_work_request(self, work_request, "HeatWave cluster provisioning",
                          refresh_delay=None)

        self.resources.heatWaveClusterCreated = True


class EnableCrashRecovery(DBSystemUpdateStage):
    def __init__(self, owner) -> None:
        super().__init__(model.SubStepId.ENABLE_CRASH_RECOVERY, owner, work_fn=self._do_work)

    def _do_work(self):
        self.push_status(stage.WorkStatusEvent.BEGIN,
                         message="Re-enabling database crash recovery")

        self.ensure_enabled()

        self.push_status(stage.WorkStatusEvent.END,
                         message="Database crash recovery enabled")

    def ensure_enabled(self):
        db = oci_utils.DBSystem(self._owner.oci_config,
                                ocid_or_db_system=self.resources.dbSystemId)

        self.ensure_state_active(db)

        work_request = db.update_crash_recovery(enable=True)

        if work_request:
            wait_work_request(self, work_request, "Re-enable crash recovery")
        else:
            is_ready: Callable[[oci_utils.DBSystem], bool] = \
                lambda db: db.crash_recovery != UpdateDbSystemDetails.CRASH_RECOVERY_DISABLED
            wait_db_system_state(
                self, is_ready, "Re-enable crash recovery"
            )


class EnableHA(stage.ThreadedStage):
    def __init__(self, owner) -> None:
        super().__init__(model.SubStepId.ENABLE_HA, owner, work_fn=self._do_work)

    @property
    def _enabled(self) -> bool:
        assert self._owner.project.options.targetMySQLOptions
        return self._owner.project.options.targetMySQLOptions.enableHA

    def _do_work(self):
        self.push_status(stage.WorkStatusEvent.BEGIN,
                         message="Enabling High Availability")

        self.ensure_enabled()

        self.push_status(stage.WorkStatusEvent.END,
                         message="High Availability enabled")

    @property
    def resources(self) -> model.CloudResources:
        return self._owner.cloud_resources

    def ensure_enabled(self) -> None:
        logging.info(
            f"Enabling High Availability of DBSystem ocid={self.resources.dbSystemId}"
        )

        db_system = oci_utils.DBSystem(
            self._owner.oci_config, self.resources.dbSystemId
        )

        if self.resources.haEnabled:
            logging.info(
                f"High Availability has already been enabled in DBSystem ocid={self.resources.dbSystemId}"
            )

            if db_system.is_highly_available:
                return

            logging.warning(
                f"DBSystem reports that it's not highly available, re-enabling... ocid={self.resources.dbSystemId}"
            )

        work_request = db_system.update_high_availability(True)

        if work_request:
            wait_work_request(self, work_request, "Enable High Availability",
                              refresh_delay=None)

        self.resources.haEnabled = True
