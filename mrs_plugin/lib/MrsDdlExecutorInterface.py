# Copyright (c) 2023, Oracle and/or its affiliates.
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

class MrsDdlExecutorInterface():

    def __init__(self, session):
        raise NotImplementedError()

    @property
    def current_service_id(self):
        raise NotImplementedError()

    @property
    def current_schema_id(self):
        raise NotImplementedError()

    def createRestMetadata(self, mrs_object: dict):
        raise NotImplementedError()

    def createRestService(self, mrs_object: dict):
        raise NotImplementedError()

    def createRestSchema(self, mrs_object: dict):
        raise NotImplementedError()

    def createRestDbObject(self, mrs_object: dict):
        raise NotImplementedError()

    def createRestContentSet(self, mrs_object: dict):
        raise NotImplementedError()

    def createRestAuthApp(self, mrs_object: dict):
        raise NotImplementedError()

    def createRestUser(self, mrs_object: dict):
        raise NotImplementedError()

    def alterRestService(self, mrs_object: dict):
        raise NotImplementedError()

    def alterRestSchema(self, mrs_object: dict):
        raise NotImplementedError()

    def alterRestDbObject(self, mrs_object: dict):
        raise NotImplementedError()

    def dropRestService(self, mrs_object: dict):
        raise NotImplementedError()

    def dropRestSchema(self, mrs_object: dict):
        raise NotImplementedError()

    def dropRestDbObject(self, mrs_object: dict):
        raise NotImplementedError()

    def dropRestContentSet(self, mrs_object: dict):
        raise NotImplementedError()

    def dropRestAuthApp(self, mrs_object: dict):
        raise NotImplementedError()

    def dropRestUser(self, mrs_object: dict):
        raise NotImplementedError()

    def use(self, mrs_object):
        raise NotImplementedError()

    def showRestMetadataStatus(self, mrs_object: dict):
        raise NotImplementedError()

    def showRestServices(self, mrs_object: dict):
        raise NotImplementedError()

    def showRestSchemas(self, mrs_object: dict):
        raise NotImplementedError()

    def showRestDbObjects(self, mrs_object: dict):
        raise NotImplementedError()

    def showRestContentSets(self, mrs_object: dict):
        raise NotImplementedError()

    def showRestAuthApps(self, mrs_object: dict):
        raise NotImplementedError()

    def showCreateRestService(self, mrs_object: dict):
        raise NotImplementedError()

    def showCreateRestSchema(self, mrs_object: dict):
        raise NotImplementedError()

    def showCreateRestDbObject(self, mrs_object: dict):
        raise NotImplementedError()

    def showCreateRestAuthApp(self, mrs_object: dict):
        raise NotImplementedError()