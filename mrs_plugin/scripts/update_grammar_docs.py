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

# Looks *.md documentation files for grammar rules and checks if they're up-to-date compared to MRSParser.g4

import sys
import os
import re
import textwrap
import difflib

DOCS_PATH = "../docs"
PARSER_PATH = "../grammar/MRSParser.g4"


def remove_comments(code_str):
    """
    Removes C and C++ style comments from a given string.

    :param code_str: The input string containing code with comments.
    :return: The input string with C and C++ style comments removed.
    """
    # Pattern to match C style comments (/* */) and C++ style comments (//)
    pattern = r"//.*?$|/\*.*?\*/"
    # re.DOTALL makes '.' special character match any character at all, including the newline
    # re.MULTILINE makes '^' and '$' special characters match the beginning and end of each line
    return re.sub(pattern, "", code_str, flags=re.DOTALL | re.MULTILINE)


def extract_antlr_parser_rules(grammar_str):
    """
    Extracts ANTLR parser rules from a given string and normalizes whitespaces.

    :param grammar_str: The input string containing ANTLR grammar.
    :return: A list of ANTLR parser rules found in the input string.
    """
    # Pattern to match ANTLR parser rules
    pattern = r"\s*([a-z][a-zA-Z_0-9]*)\s*:(\s*.*?);"
    rules = re.findall(pattern, grammar_str, flags=re.DOTALL)

    # Extract rule name and definition, and normalize whitespaces
    antlr_parser_rules = [(rule[0], rule[1].strip("\n")) for rule in rules]

    return antlr_parser_rules


def extract_antlr_code_from_md(text):
    # Regular expression pattern to match text between ```antlr and ```
    pattern = r"```antlr(.*?)```"
    # re.DOTALL makes . special character match any character, including a newline
    matches = re.findall(pattern, text, re.DOTALL)
    return [re.sub(r"\s+", " ", rule).strip() for rule in matches]


def load_parser():
    with open(PARSER_PATH) as f:
        data = f.read()
    data = remove_comments(data)
    data = "\n".join([line for line in data.split("\n") if line.strip()])
    return dict(extract_antlr_parser_rules(data))


g_seen_rules = set()


def check(path, name, body):
    global g_seen_rules
    g_seen_rules.add(name)
    expected = g_all_rules.get(name)
    if not expected:
        print(f"{path}: {name} doesn't exist in MRSParser.g4")
        return None
    expected = expected.replace(
        "{this.isSqlModeActive(SqlMode.AnsiQuotes)}?", "{if AnsiQuotes}"
    )
    expected = expected.replace("DATABASE_SYMBOL", "SCHEMA")
    expected = expected.replace("DATABASES_SYMBOL", "SCHEMAS")
    expected = expected.replace("_SYMBOL", "")
    expected_norm = re.sub(r"\s+", " ", expected)
    if expected_norm != body:
        # print(f"{path}: {name}")
        # print("\tExpected:\n", textwrap.indent(expected, "\t\t"))
        # print("\tActual:\n", textwrap.indent(body, "\t\t"))
        return expected
    return None


def format_rule(name, body):
    if body.lstrip().startswith("( ") or body.lstrip().startswith("(\n"):
        return name + ":" + body + "\n;"
    else:
        return name + ":\n" + body + "\n;"


def check_file(path):
    with open(path) as f:
        orig_data = f.read()

    snippets = extract_antlr_code_from_md(orig_data)
    new_data = orig_data
    for s in snippets:
        rules = extract_antlr_parser_rules(s)
        for name, body in rules:
            expected = check(path, name, body)
            if expected:
                pattern = r"\s*(" + name + r"\s*:\s*.*?;)"
                rules = re.findall(pattern, new_data, flags=re.DOTALL)
                assert rules
                new_data = new_data.replace(rules[0], format_rule(name, expected))
    if orig_data != new_data:

        def print_diff(string1, string2):
            d = difflib.Differ()
            lines1 = string1.splitlines()
            lines2 = string2.splitlines()
            diff = d.compare(lines1, lines2)
            print("\n".join(diff))

        # print_diff(orig_data, new_data)

        with open(path, "w+") as f:
            f.write(new_data)
        print(path, "was updated")


def scan_files(path):
    for f in os.listdir(path):
        fpath = os.path.join(path, f)
        if os.path.isdir(fpath):
            scan_files(fpath)
        elif f.endswith(".md"):
            check_file(fpath)

# chdir to where the script is located
os.chdir(os.path.dirname(sys.argv[0]))

# check if the rrd generator is patched
for f in os.listdir("../docs/images/sql"):
    if not f.endswith(".svg"):
        continue
    with open(os.path.join("../docs/images/sql", f)) as f:
        if "DATABASE" in f.read():
            print("RRD image files have DATABASE instead of SCHEMA")
            print("You must patch the RRD generator first and regenerate them")
            sys.exit(1)

# start

g_all_rules = load_parser()
scan_files(DOCS_PATH)

ignore_undocumented = [
    "mrsScript",
    "mrsStatement",
    "graphQlAllowedKeyword",
    "identifier",
]

print_missing = "--print-missing" in sys.argv

undocumented_rules = set(g_all_rules.keys()) - g_seen_rules
if undocumented_rules:
    print("The following rules are not documented:")
    for r in sorted(undocumented_rules):
        if r in ignore_undocumented:
            continue

        if not print_missing:
            print("\t", r)
            continue
        print(format_rule(r, g_all_rules[r]))
        print()
        print(
            f"""{r} ::=
    ![{r}](../../images/sql/{r}.svg "{r}")
    """
        )
        assert os.path.exists(f"../docs/images/sql/{r}.svg"), r
        print()
        print("-" * 80)
        print()

    if not print_missing:
        print("Use --print-missing to print the missing rules")
