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

import threading
import time

import gui_plugin as gui


class AutoTTLConnectionCache:
    def __init__(self, ttl_seconds=3600, max_size=1000, cleanup_interval=1):
        self.clean_func = None
        self.ttl = ttl_seconds
        self.max_size = max_size
        self.cleanup_interval = cleanup_interval
        self._cache = {}  # key: (value, timestamp)
        self._lock = threading.Lock()
        self._stop_event = threading.Event()

        self._cleaner_thread = threading.Thread(
            target=self._cleaner, daemon=True)
        self._cleaner_thread.start()

    def _cleaner(self):
        while not self._stop_event.is_set():
            self._evict_expired()
            time.sleep(self.cleanup_interval)

    def _evict_expired(self):
        now = time.time()
        with self._lock:
            keys_to_delete = [
                key for key, (_, ts) in self._cache.items() if now - ts > self.ttl]
            for key in keys_to_delete:
                profile_id, connection_id = self._cache[key]
                gui.db_connections.remove_db_connection(  # type: ignore
                    profile_id, connection_id)
                del self._cache[key]

    def __setitem__(self, key, value):
        with self._lock:
            if len(self._cache) >= self.max_size:
                oldest_key = min(self._cache.items(),
                                 key=lambda item: item[1][1])[0]
                del self._cache[oldest_key]
            self._cache[key] = (value, time.time())

    def __getitem__(self, key):
        with self._lock:
            item = self._cache.get(key)
            if not item:
                raise KeyError(key)
            value, ts = item
            if time.time() - ts > self.ttl:
                del self._cache[key]
                raise KeyError(key)
            return value

    def __delitem__(self, key):
        with self._lock:
            if key in self._cache:
                del self._cache[key]
            else:
                raise KeyError(key)

    def __contains__(self, key):
        with self._lock:
            item = self._cache.get(key)
            if not item:
                return False
            _, ts = item
            if time.time() - ts > self.ttl:
                del self._cache[key]
                return False
            return True

    def __len__(self):
        with self._lock:
            now = time.time()
            return sum(1 for _, ts in self._cache.values() if now - ts <= self.ttl)

    def set_clean_func(self, func):
        """
        Set a function to be called when the cache is cleared.
        The function should take no arguments and return nothing.
        """
        self.clean_func = func

    def clear(self):
        """
        Clear the cache and call the clean function if set.
        """
        with self._lock:
            self._cache.clear()

    def stop(self):
        """
        Stop the cleaner thread and call the clean function if set.
        """
        self._stop_event.set()
        self._cleaner_thread.join()

    def clean(self):
        if self.clean_func is not None:
            self.clean_func()
