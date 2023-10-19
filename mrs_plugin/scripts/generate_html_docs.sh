#!/bin/bash
# Copyright (c) 2022, 2023, Oracle and/or its affiliates.

if [ $# -eq 0 ]
then
    ROOTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )/.."
else
    ROOTPATH=$1
fi

cd $ROOTPATH/docs

# Generate the docs
echo "Generating HTML docs ..."
pandoc index.md -f markdown -t html -s -o $ROOTPATH/docs/index.html --template=$ROOTPATH/docs/templates/mysql_docs.html --toc --toc-depth=2 --metadata title="MRS Developer's Guide" --variable=template_css:style/style.css --filter pandoc-include --number-sections
pandoc restApi.md -f markdown -t html -s -o $ROOTPATH/docs/restApi.html --template=$ROOTPATH/docs/templates/mysql_docs.html --toc --toc-depth=2 --metadata title="MRS Core REST APIs" --variable=template_css:style/style.css --filter pandoc-include --number-sections
pandoc sdk.md -f markdown -t html -s -o $ROOTPATH/docs/sdk.html --template=$ROOTPATH/docs/templates/mysql_docs.html --toc --toc-depth=2 --metadata title="MRS SDK Reference" --variable=template_css:style/style.css --filter pandoc-include --number-sections
pandoc sql.md -f markdown -t html -s -o $ROOTPATH/docs/sql.html --template=$ROOTPATH/docs/templates/mysql_docs.html --toc --toc-depth=2 --metadata title="MRS SQL Reference" --variable=template_css:style/style.css --filter pandoc-include --number-sections
