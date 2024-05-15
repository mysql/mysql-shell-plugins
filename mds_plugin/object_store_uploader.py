# Copyright (c) 2024, Oracle and/or its affiliates.
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
import queue
from typing import List
import time
import os


class BucketUploader:
    def __init__(
        self,
        status_fn,
        os_client,
        namespace,
        bucket_name,
        processes_per_file=5,
        part_size=1024 * 1024,
    ) -> None:
        self.status_fn = status_fn
        self.processes_per_file = processes_per_file
        self.part_size = part_size
        self.os_client = os_client
        self.namespace = namespace
        self.bucket_name = bucket_name

        self.work_queue = queue.Queue()
        self.progress_queue = queue.Queue()
        self.workers = []

    def upload_files(self, files):
        self.files_done = 0
        self.done = False
        self.num_files = len(files)
        for f in files:
            t0 = time.time()
            try:
                self.work_queue.put_nowait(f)
            except queue.Full as e:
                self._process_status(False)
            # avoid busy loop when worker queue is full but there's no progress either
            t1 = time.time()
            if t1 - t0 < 1:
                time.sleep(1 - (t1 - t0))

        self._process_status(True)

    def _process_status(self, block):
        while self.files_done < self.num_files:
            try:
                progress = self.progress_queue.get(block=block)
                if progress["status"] == "END":
                    self.files_done += 1
                    self.status_fn(progress)
                elif progress["status"] == "ERROR":
                    self.files_done += 1
                    self.status_fn(progress)
                else:
                    self.status_fn(progress)
            except queue.Empty as e:
                break

    def _make_upload_manager(self):
        import oci.object_storage

        return oci.object_storage.UploadManager(
            object_storage_client=self.os_client,
            allow_parallel_uploads=True,
            parallel_process_count=self.processes_per_file,
        )

    def _worker(self):
        upload_manager = self._make_upload_manager()

        while not self.done:
            try:
                file_info = self.work_queue.get(block=True, timeout=1)
                if self.done:
                    break
            except queue.Empty:
                continue

            try:
                file_info["file_size"] = os.path.getsize(file_info["file_path"])
            except Exception as e:
                self.progress_queue.put({"status": "ERROR", "error": e} | file_info)
                continue

            self.progress_queue.put({"status": "BEGIN"} | file_info)

            def progress(bytes_uploaded):
                self.progress_queue.put(
                    {
                        "status": "PROGRESS",
                        "bytes_uploaded": bytes_uploaded
                    }
                    | file_info
                )

            try:
                upload_manager.upload_file(
                    namespace_name=self.namespace,
                    bucket_name=self.bucket_name,
                    object_name=file_info["object_name"],
                    file_path=file_info["file_path"],
                    part_size=self.part_size,
                    progress_callback=progress,
                )
                self.progress_queue.put({"status": "END"} | file_info)
            except Exception as e:
                self.progress_queue.put({"status": "ERROR", "error": e} | file_info)

    def start(self, num_workers):
        self.done = False
        for i in range(num_workers):
            p = threading.Thread(target=self._worker)
            self.workers.append(p)
            p.start()

    def stop(self):
        self.done = True
        for p in self.workers:
            p.join()
        self.workers = []


def parallel_bucket_upload(
    files: List[dict],
    status_fn,
    os_client,
    namespace,
    bucket_name,
    processes_per_file,
    part_size,
    num_workers,
):
    """
    files: list of file_info dicts, that must contain at least "file_path" and "object_name"
    status_fn: callback(status_data)

    status_data may be one of:
        {"status": "BEGIN"} | file_info
        {"status": "END"} | file_info
        {"status": "PROGRESS", "file_size": file_size, "bytes_uploaded": total_bytes_uploaded} | file_info
        {"status": "ERROR", "error": exception} | file_info
    """
    uploader = BucketUploader(
        status_fn, os_client, namespace, bucket_name, processes_per_file, part_size
    )
    uploader.start(num_workers)
    try:
        uploader.upload_files(files)
    finally:
        uploader.stop()
