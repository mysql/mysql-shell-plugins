#!/bin/bash
# Copyright (c) 2024, Oracle and/or its affiliates.

if [ ! -d "node_modules/regedit/vbs" ]; then
    echo "ERROR: The vbs in regedit is missing"
    exit 1
fi

echo "Copy vbs files for regedit operations"
cp -R node_modules/regedit/vbs out/vbs
