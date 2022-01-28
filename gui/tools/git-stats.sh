#!/bin/bash

# Copyright (c) 2020, Oracle and/or its affiliates.

# Line stats per developer:
git log --format='%aN' --since "Mar 01 2020" | sort -u | while read name; do echo -en "$name\t"; git log --author="$name" --pretty=tformat: --numstat | awk '{ add += $1; subs += $2; loc += $1 - $2 } END { printf "added lines: %s, removed lines: %s, total lines: %s\n", add, subs, loc }' -; done
 
# Commits per developer:
git shortlog -s -n --since "Mar 01 2020"