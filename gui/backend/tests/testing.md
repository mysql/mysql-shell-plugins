### Copyright (c) 2020, Oracle and/or its affiliates.

# Testing

This document describes 4 diffrent testing python frameworks and how to use it. 

## Install dependencies

First we need install all required dependencies. All dependencies are listed in `requirements.txt` file and you can install executing command:

`pip3 install -r requirements.txt`

## Executing tests

All test sholud be executed from `plugins/gui/backend` directory. Before run any of those tests you must start WebSocket server. You can do it by executing `F5` in VSCode or manully execute `main.py` file.

1. Doctest

The [doctest](https://docs.python.org/3/library/doctest.html) is builtin python module. The module searches for pieces of text that look like interactive Python sessions, and then executes those sessions to verify that they work exactly as shown. Example is in `Protocols.py` file. To execute it, run:

`python3 -m doctest -v ./gui/core/Protocols.py`

2. Unittest

The [unittest](https://docs.python.org/3/library/unittest.html) unit testing framework was originally inspired by JUnit and has a similar flavor as major unit testing frameworks in other languages. It supports test automation, sharing of setup and shutdown code for tests, aggregation of tests into collections, and independence of the tests from the reporting framework. To execute it, run:

`python3 -m unittest -v tests.py`

3. Twisted tests

[Trial](https://twistedmatrix.com/trac/wiki/TwistedTrial) is Twisted's unit testing system, an extension of ​Python's `unittest` module. To execute it, run:

`python3 -m twisted.trial ./twisted_tests.py`

4. Pytest

The [pytest](https://docs.pytest.org/en/latest/) framework makes it easy to write small tests, yet scales to support complex functional testing for applications and libraries. To execute it, run:

`pytest` or `pytest -v`

## VSCode integration

Python unittest and pytest can be executed from VSCode, here is detailed instruction how to do it: https://code.visualstudio.com/docs/python/testing