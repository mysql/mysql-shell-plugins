#!/bin/bash
# Copyright (c) 2022, 2025, Oracle and/or its affiliates.

if [ $# -eq 0 ]
then
    ROOTPATH="$( cd -- "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )/.."
else
    ROOTPATH=$1
fi

version="$(cat $ROOTPATH/docs/VERSION | grep -o "[^=]\+\$")"

cd $ROOTPATH/docs

# Generate the docs
echo "Generating HTML docs ..."
pandoc index.md -f markdown -t html -s -o $ROOTPATH/docs/index.html --template=$ROOTPATH/docs/templates/mysql_docs.html --toc --toc-depth=2 --metadata title="MySQL REST Service - Reference Manual" --variable=template_css:style/style.css --filter pandoc-include --number-sections -V version="$version"
pandoc quickstart.md -f markdown -t html -s -o $ROOTPATH/docs/quickstart.html --template=$ROOTPATH/docs/templates/mysql_docs.html --toc --toc-depth=2 --metadata title="MySQL REST Service - Quickstart Guide" --variable=template_css:style/style.css --filter pandoc-include --number-sections -V version="$version"
pandoc restApi.md -f markdown -t html -s -o $ROOTPATH/docs/restApi.html --template=$ROOTPATH/docs/templates/mysql_docs.html --toc --toc-depth=2 --metadata title="MySQL REST Service - Core REST APIs" --variable=template_css:style/style.css --filter pandoc-include --number-sections -V version="$version"
pandoc sdk.md -f markdown -t html -s -o $ROOTPATH/docs/sdk.html --template=$ROOTPATH/docs/templates/mysql_docs.html --toc --toc-depth=2 --metadata title="MySQL REST Service - SDK Reference" --variable=template_css:style/style.css --filter pandoc-include --number-sections -V version="$version"
pandoc sql.md -f markdown -t html -s -o $ROOTPATH/docs/sql.html --template=$ROOTPATH/docs/templates/mysql_docs.html --toc --toc-depth=2 --metadata title="MySQL REST Service - SQL Reference" --variable=template_css:style/style.css --filter pandoc-include --number-sections -V version="$version"

echo "Generating Accessibility docs ..."
pandoc index_one_page.md -f markdown -t html -s -o $ROOTPATH/docs/index_one_page.html --template=$ROOTPATH/docs/templates/mysql_docs_one_page.html --toc --toc-depth=2 --metadata title="MySQL REST Service - Reference Manual" --variable=template_css:style/style_one_page.css --filter pandoc-include --number-sections -V version="$version"

# Fix image links
sed -i '' 's#".*\.\.\/docs\/#".\/#g' $ROOTPATH/docs/index.html
sed -i '' 's#".*\.\.\/docs\/#".\/#g' $ROOTPATH/docs/quickstart.html

# Replace . in ids with -, e.g. id="service.authenticate-ts"
sed -i '' 's#id="\([^"]*\)\.\([^"]*\)"#id="\1-\2"#g' $ROOTPATH/docs/sdk.html
# Replace . in local href with -, e.g. href="#service.authenticate-ts"
sed -i '' 's#href="\#\([^"]*\)\.\([^"]*\)"#href="\#\1-\2"#g' $ROOTPATH/docs/sdk.html

# Remove (TS) from the TOC
sed -i '' 's#^\([^(]*\)([^)]*)</a></li>#\1</a></li>#g' $ROOTPATH/docs/sdk.html

# Remove (TS) from the H2 and H3 titles
sed -i '' 's# ([[:upper:]]*)</h2>#</h2>#g' $ROOTPATH/docs/sdk.html
sed -i '' 's# ([[:upper:]]*)</h3>#</h3>#g' $ROOTPATH/docs/sdk.html


# Fix one-page links

sed -i '' 's/sql\.html//g' $ROOTPATH/docs/index_one_page.html
sed -i '' 's/sdk\.html//g' $ROOTPATH/docs/index_one_page.html
sed -i '' 's/quickstart\.html//g' $ROOTPATH/docs/index_one_page.html
