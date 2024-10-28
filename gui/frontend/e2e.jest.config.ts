/*
 * Copyright (c) 2023, 2024, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import type { Config } from 'jest';

const config: Config = {
    // All imported modules in your tests should be mocked automatically
    // automock: false,

    // Stop running tests after `n` failures
    //bail: 1,

    // The directory where Jest should store its cached dependency information
    // cacheDirectory: "/private/var/folders/03/gj5f1gl92w11zc3l2c526dnm0000gn/T/jest_dx",

    // Automatically clear mock calls, instances, contexts and results before every test
    // clearMocks: true,

    ci: true,

    // Indicates whether the coverage information should be collected while executing the test
    //collectCoverage: true,

    // An array of glob patterns indicating a set of files for which coverage information should be collected
    //collectCoverageFrom: [
    //    "src/**/*.{ts,tsx}",
    //    "!src/tests/**",
    //    "!**/node_modules/**",
    //    "!src/app-wrapper/**",
    //    "!src/assets/**",
    //    "!src/parsing/mysql/generated/**",
    //    "!src/parsing/SQLite/generated/**",
    //    "!src/parsing/python/generated/**",
    //    "!src/**/*.d.ts"
    //],

    // The directory where Jest should output its coverage files
    //coverageDirectory: "coverage",

    // An array of regexp pattern strings used to skip coverage collection
    // coveragePathIgnorePatterns: [
    //   "/node_modules/"
    // ],

    // Indicates which provider should be used to instrument code for coverage
    //coverageProvider: "v8",

    // A list of reporter names that Jest uses when writing coverage reports
    //coverageReporters: [
    //    "json",
    //    "text",
    //    "clover",
    //    "html"
    //],

    // An object that configures minimum threshold enforcement for coverage results
    //coverageThreshold: {
    //    "global": {
    //        "statements": 65,
    //        "branches": 70,
    //        "functions": 50,
    //        "lines": 65
    //    }
    //},

    // A path to a custom dependency extractor
    // dependencyExtractor: undefined,

    // displayName: "FE unit tests",

    // Make calling deprecated APIs throw helpful error messages
    // errorOnDeprecated: false,

    // The default configuration for fake timers
    // fakeTimers: {
    //   "enableGlobally": false
    // },

    // Force coverage collection from ignored files using an array of glob patterns
    // forceCoverageMatch: [],

    // A path to a module which exports an async function that is triggered once before all test suites
    //globalSetup: "./src/tests/globalSetup.ts",

    // A path to a module which exports an async function that is triggered once after all test suites
    //globalTeardown: "./src/tests/globalTearDown.ts",

    // A set of global variables that need to be available in all test environments
    // globals: {},

    // The maximum amount of workers used to run your tests. Can be specified as % or a number. E.g. maxWorkers: 10% will use 10% of your CPU amount + 1 as the maximum worker number. maxWorkers: 2 will use a maximum of 2 workers.
    maxWorkers: 3,

    // An array of directory names to be searched recursively up from the requiring module's location
    // moduleDirectories: [
    //   "node_modules"
    // ],

    workerIdleMemoryLimit: "500MB",

    // An array of file extensions your modules use
    moduleFileExtensions: [
        "tsx",
        "ts",
        "js",
        "mjs",
        "cjs",
        "jsx",
        "json",
        "node"
    ],

    // A map from regular expressions to module names or to arrays of module names that allow to stub out resources with a single module
    moduleNameMapper: {
        "monaco-editor$": "monaco-editor/esm/vs/editor/editor.api",
        "tabulator-tables$": "tabulator-tables/dist/js/tabulator_esm.js",
        ".+\\.worker\\?worker$": "<rootDir>/src/tests/unit-tests/__mocks__/workerMock.ts",
        ".+runtime\\.d\\.ts$": "<rootDir>/src/tests/unit-tests/__mocks__/typingsMock.ts",
        "^react$": "preact/compat",
        '^react/jsx-runtime$': 'preact/jsx-runtime',
        ".*\\?raw": "jest-raw-loader",
        "^(\\.\\.?\\/.+)\\.js$": "$1", // For imports with the .js extension.
    },

    // An array of regexp pattern strings, matched against all module paths before considered 'visible' to the module loader
    // modulePathIgnorePatterns: [],

    // Activates notifications for test results
    // notify: false,

    // An enum that specifies notification mode. Requires { notify: true }
    // notifyMode: "failure-change",

    // A preset that is used as a base for Jest's configuration
    //"preset": "",

    // Run tests from one or more projects
    // projects: undefined,

    // Use this configuration option to add custom reporters to Jest
    // reporters: undefined,

    // Automatically reset mock state before every test
    resetMocks: false,

    // Reset the module registry before running each individual test
    // resetModules: false,

    // A path to a custom resolver
    // resolver: undefined,

    // Automatically restore mock state and implementation before every test
    // restoreMocks: false,

    // The root directory that Jest should scan for tests and modules within
    // rootDir: undefined,

    // A list of paths to directories that Jest should use to search for files in
    //roots: [
    //    "src/tests/unit-tests"
    //],

    // Allows you to use a custom runner instead of Jest's default test runner
    // runner: "jest-runner",

    // The paths to modules that run some code to configure or set up the testing environment before each test
    // setupFiles: [],

    // A list of paths to modules that run some code to configure or set up the testing framework before each test
    setupFilesAfterEnv: [
        // Note: this is not optimal. This setup is run again for every test file, while we actually want to
        // run it only once.
        "./src/tests/e2e/setupTests.ts",
    ],

    // The number of seconds after which a test is considered as slow and reported as such in the results.
    // slowTestThreshold: 5,

    // A list of paths to snapshot serializer modules Jest should use for snapshot testing
    snapshotSerializers: [
        "enzyme-to-json/serializer"
    ],

    // The test environment that will be used for testing
    testEnvironment: "jsdom",

    // Options that will be passed to the testEnvironment
    testEnvironmentOptions: {},

    // Adds a location field to test results
    // testLocationInResults: false,

    // The glob patterns Jest uses to detect test files
    testMatch: [
        "**/tests/e2e/**/ui-*.[jt]s?(x)"
    ],

    // An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
    testPathIgnorePatterns: [
        //"[/\\\\]node_modules[/\\\\].+\\.(js|jsx|mjs|cjs|ts|tsx)$",
        //"^.+\\.module\\.(css|sass|scss)$",
    ],

    // The regexp pattern or array of patterns that Jest uses to detect test files
    // testRegex: [],

    // This option allows the use of a custom results processor
    //testResultsProcessor: "./node_modules/jest-html-reporters",

    // This option allows use of a custom test runner
    testRunner: "jest-circus/runner",

    // CI machines can be slow.
    testTimeout: 1200000,

    // A map from regular expressions to paths to transformers
    transform: {
        "^.+\\.(ts|js|mjs|tsx|jsx)$": [
            '@swc/jest',
            {
                jsc: {
                    transform: {
                        react: {
                            runtime: 'automatic',
                        },
                    },
                },
            },
        ],
        "^.+\\.css$": "<rootDir>/src/tests/cssTransform.cjs",
        "^(?!.*\\.(js|jsx|mjs|cjs|ts|tsx|css|json)$)": "<rootDir>/src/tests/fileTransform.cjs",
    },

    // An array of regexp pattern strings that are matched against all source file paths, matched files will skip transformation
    transformIgnorePatterns: [
        "<rootDir>/../node_modules/"
    ],

    // An array of regexp pattern strings that are matched against all modules before the module loader will automatically return a mock for them
    // unmockedModulePathPatterns: undefined,

    // Indicates whether each individual test should be reported during the run
    // verbose: undefined,

    // An array of regexp patterns that are matched against all source file paths before re-running tests in watch mode
    // watchPathIgnorePatterns: [],

    // Whether to use watchman for file crawling
    // watchman: true,
    reporters: [
        "default",
        [
            "jest-html-reporter",
            {
                "pageTitle": "MySQL Shell FE GUI Tests Report",
                "includeFailureMsg": true,
                "styleOverridePath": "style.css",
                "outputPath": "src/tests/e2e/test-report.html",
                "append": false,
                "useCssFile": true,
            }
        ]
    ]
};

export default config;
