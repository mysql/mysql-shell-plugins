#!/bin/bash
# Copyright (c) 2024, 2025, Oracle and/or its affiliates.

if [ ! -d "node_modules/regedit/vbs" ]; then
    echo "ERROR: The vbs in regedit is missing"
    exit 1
fi

# Ensure the vbs foldes does not exist, otherwise it will
# end up nesting it
if [ -d "out/vbs" ]; then
   rm -rf out/vbs;
fi

echo "Copy vbs files for regedit operations"
cp -R node_modules/regedit/vbs out/vbs
