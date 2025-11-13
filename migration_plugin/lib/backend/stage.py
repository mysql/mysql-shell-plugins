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

import mysqlsh
from threading import Thread
import time
from queue import Queue
from typing import List, Callable, Protocol, Optional

from ..oci_utils import Compartment
from . import model
from .model import WorkStatusEvent, SubStepId
from .. import project, logging, dbsession, errors
from .remote_helper import RemoteHelperClient


class OrchestratorInterface(Protocol):
    stopped: bool = False

    @property
    def options(self) -> model.MigrationOptions:
        raise NotImplementedError()

    @property
    def migrator_instance_id(self) -> str:
        raise NotImplementedError()

    @property
    def oci_config(self) -> dict:
        raise NotImplementedError()

    @property
    def bucket_par(self) -> dict:
        raise NotImplementedError()

    @property
    def full_storage_path(self) -> str:
        raise NotImplementedError()

    @property
    def source_connection_options(self) -> dict:
        raise NotImplementedError()

    @property
    def target_connection_options(self) -> dict:
        raise NotImplementedError()

    @target_connection_options.setter
    def target_connection_options(self, connection_options: dict) -> None:
        raise NotImplementedError()

    @property
    def target_version(self) -> str:
        raise NotImplementedError()

    @property
    def source_info(self) -> model.ServerInfo:
        raise NotImplementedError()

    @property
    def cloud_resources(self) -> model.CloudResources:
        raise NotImplementedError()

    @property
    def ssh_key_path(self) -> str:
        raise NotImplementedError()

    @property
    def project(self) -> project.Project:
        raise NotImplementedError()

    def push_progress(self, source: model.SubStepId, message: str, data: dict = {}):
        raise NotImplementedError()

    def push_status(self, source: model.SubStepId, status: WorkStatusEvent, data: dict = {}, message: str = ""):
        raise NotImplementedError()

    def push_message(self, source: model.SubStepId, data: dict):
        raise NotImplementedError()

    def connect_remote_helper(self, wait_ready: bool = False) -> RemoteHelperClient:
        raise NotImplementedError()

    def connect_source(self) -> dbsession.Session:
        raise NotImplementedError()

    def get_compartment(self) -> Compartment:
        raise NotImplementedError()

    def stop(self):
        raise NotImplementedError()


class Stage:
    _update_interval = 5
    _enabled = True
    __started = False
    __finished = False
    _fatal_error: Optional[Exception] = None
    # TODO add timeouts (with per stage customization)

    def __init__(self, id: SubStepId,  owner: OrchestratorInterface, ) -> None:
        self._id = id
        self._owner = owner
        self._dependencies: List[Stage] = []

    def __str__(self) -> str:
        return f"<{self._name}:{self._is_started}:{self._is_finished}>"

    def __repr__(self) -> str:
        return f"<{self._name}:{self._is_started}:{self._is_finished}>"

    @property
    def _name(self) -> str:
        return self.__class__.__name__

    @property
    def _is_started(self) -> bool:
        return self.__started

    @property
    def _is_finished(self) -> bool:
        return self.__finished

    @property
    def _is_stopped(self) -> bool:
        return self._owner.stopped

    def _dump(self, indent=0, seen=None):
        if seen is None:
            seen = set()
        flags = []
        flags.append("enabled" if self._enabled else "disabled")
        if self.__started:
            flags.append("started")
        if self.__finished:
            flags.append("finished")
        if self._fatal_error:
            flags.append(f"{type(self._fatal_error)}")
        logging.debug("  " * indent + "-" + self._name +
                      f" ({','.join(flags)})")
        for dep in self._dependencies:
            dep._dump(indent + 1, seen)
        seen.add(self)

    def push_progress(self, message: str = "", data: dict = {}):
        if message:
            logging.info(f"{self._name}: {message}")

        if message or data:
            self._owner.push_progress(self._id, message, data)

    def push_status(self, event: WorkStatusEvent, data: dict = {}, message=""):
        if message:
            logging.info(f"{self._name}: {message}")

        self._owner.push_status(self._id, event, data, message)

    def push_message(self, data: dict):
        self._owner.push_message(self._id, data)

    def add_dependency(self, dep: "Stage"):
        assert dep not in self._dependencies, self._name

        logging.debug(f"{self._name} adding {dep._name} as a dependency")
        self._dependencies.append(dep)

    def wait_dependencies(self, deps: list):
        logging.debug(f"{self._name} waiting dependencies")
        try:
            while deps:
                logging.info(
                    f"{self._name} waiting deps: {[f'{d._name} started={1 if d._is_started else 0}' for d in deps]}")
                delay = 1
                for d in deps[:]:
                    if d._is_started:
                        try:
                            if d.update():
                                d.finish()
                                deps.remove(d)
                        except errors.Aborted:
                            deps.remove(d)
                    delay = max(delay, d._update_interval)

                if deps:
                    time.sleep(delay)

            if self._owner.stopped:
                raise errors.Aborted()
        except errors.Aborted:
            logging.info(f"{self._name}: aborting...")
            self.push_status(WorkStatusEvent.ABORTED)
            raise
        except Exception as e:
            logging.error(f"{self._name}: error encountered ({e})")
            self._owner.stop()
            raise
        logging.debug(f"{self._name} dependencies done")

    #

    def start(self, parents) -> bool:
        """Return True if done, False is work is in progress"""
        if self._is_started:
            logging.debug(
                f"Short-circuiting start of already started {self._name}: {'/'.join(parents)}"
            )
            if self._is_finished:
                return False
            deps = [
                dep for dep in self._dependencies if not dep._is_finished and dep._enabled]
            self.wait_dependencies(deps)
            return False
        self.__started = (
            True  # TODO make this thread safe (atomic set and get at the top)
        )
        logging.debug(
            f"{len(parents)*"  "}{self._name} start: {'/'.join(parents)}")

        deps = []
        for dep in self._dependencies:
            if self._owner.stopped:
                logging.info(f"{self._name}: canceling stage execution")
                return False

            if dep.start([self._name] + parents):
                logging.debug(f"{dep._name} started by {self._name}")
            else:
                logging.debug(
                    f"{dep._name} started by {self._name} (finished={dep._is_finished}, enabled={dep._enabled})"
                )
            if not dep._is_finished and self._enabled:
                deps.append(dep)

        if deps and not self._owner.stopped:
            self.wait_dependencies(deps)

        return True

    def update(self) -> bool:
        """Return True if work is done, False to keep waiting"""
        return True

    def finish(self):
        logging.debug(f"{self._name} finished")
        self.__finished = True

    def stop(self):
        for dep in self._dependencies:
            if not dep._is_finished and dep._is_started:
                dep.stop()

    def check_stop(self):
        if self._owner.stopped:
            logging.info(f"{self._name} - aborting")
            raise errors.Aborted()

    def reset(self):
        self._fatal_error = None
        if not self.__finished:
            self.__started = False

    def cleanup(self):
        pass

    def run(self):
        if self.start([]):
            self.wait_dependencies(self._dependencies[:])
            self.finish()


class ThreadedStage(Stage):
    __done = False

    def __init__(self, id, owner, work_fn: Callable) -> None:
        super().__init__(id, owner)
        self._work_fn = work_fn

        self._queue = Queue()
        self._thread = None
        self.reset()

    def start(self, parents) -> bool:
        super().start(parents)

        assert self._thread, self._name

        if not self._enabled or self.__done:
            logging.info(
                f"Skipping {'done' if self.__done else 'disabled'} stage {self._name}")
            self.__done = True
            return True

        logging.debug(f"🧵 {self._name} starting thread")
        self._thread.start()

        return True

    def finish(self):
        if not self._thread or not self._thread.is_alive():
            return

        logging.debug(f"🧵 {self._name} joining thread")
        self._thread.join()
        self._thread = None
        super().finish()

    def _wait_one(self):
        return self._queue.get()

    def _notify_one(self, value):
        self._queue.put(value)

    def update(self) -> bool:
        if self._fatal_error:
            logging.info(
                f"{self._name} thread failed with an error: {self._fatal_error}")
            raise self._fatal_error
        logging.devdebug(f"{self._name}.update={self.__done}")
        return self.__done

    def reset(self):
        super().reset()

        self.__done = False
        self._fatal_error = None

        if self._thread and self._thread.is_alive():
            logging.debug(f"{self._name}: joining thread")
            self._thread.join()
            logging.debug(f"{self._name}: joined")

        def safe_work():
            mysqlsh.thread_init()
            try:
                self._work_fn()
                logging.debug(f"{self._name}: worker done")
                self.__done = True
            except errors.Aborted as e:
                logging.info(f"{self._name} aborted")
                self.push_status(WorkStatusEvent.ABORTED)
                self._fatal_error = e
            except Exception as e:
                logging.exception(
                    f"{self._name} threw an exception in thread")
                self.push_status(WorkStatusEvent.ERROR,
                                 {"error": model.MigrationError._from_exception(e)._json(noclass=False)})
                self._fatal_error = e
            finally:
                mysqlsh.thread_end()

        self._thread = Thread(target=safe_work)
