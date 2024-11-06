/*
 * Copyright (c) 2024, Oracle and/or its affiliates.
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
 * separately licensed software that they have included with
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

import { spawnSync } from "child_process";
import { platform } from "os";
import { join } from "path";
import {
    readdirSync, existsSync, mkdirSync, writeFileSync, symlinkSync, readFileSync,
    truncateSync, rmSync, createWriteStream,
    cpSync,
} from "fs";
import { get } from "https";
import { ExTester } from "vscode-extension-tester";
import { IE2ECli, IE2ETestSuite } from "./interfaces";

/**
 * This class aggregates the functions that are used on the tests setup script
 */
export class E2ETests {

    /** The Test suites identified under the tests folder */
    public static testSuites: IE2ETestSuite[] = [];

    /** The MySQL port used by the deployed sandbox. Defaults to 3308 */
    public static mysqlPort = "3308";

    /** The MySQL deployed sandbox directory */
    public static mysqlSandboxDir = process.cwd();

    /** Location of the shell binary */
    public static shellBinary: string;

    /**
     * Gets the cli arguments (--extension-path, --mysql-port and --test-suite)
     * @returns The object @IE2ECli with the cli values
     */
    public static getCliArguments = (): IE2ECli => {

        const cliArguments: IE2ECli = {};
        const argv = process.argv.toString();

        if (argv.includes("/install_extension.ts")) {
            if (!argv.toString().includes("--extension-path")) {
                throw new Error("Please define the cli argument --extension-path");
            }
        }

        const cliArgs = process.argv.slice(2);

        if (cliArgs.length > 0) {
            for (const cli of cliArgs) {
                if (cli.includes("--test-suite")) {
                    cliArguments.testSuite = cli.split("=")[1];
                }
                if (cli.includes("--extension-path")) {
                    cliArguments.extensionPath = cli.split("=")[1];
                }
                if (cli.includes("--mysql-port")) {
                    cliArguments.mysqlPort = cli.split("=")[1];
                }
                if (cli.includes("--generate-web-certificate")) {
                    cliArguments.generateWebCertificate = cli.split("=")[1] === "true";
                }
                if (cli.includes("--log")) {
                    cliArguments.log = cli.split("=")[1] === "true";
                }
                if (cli.includes("--source-test-suite")) {
                    cliArguments.sourceTestSuite = cli.split("=")[1];
                }
            }
        }

        return cliArguments;
    };

    /**
     * Reads the test suite files from tests/*.ts and sets the testSuites attribute
     */
    public static readTestSuites = (): void => {

        const testFiles = readdirSync(join(process.cwd(), "tests"));

        if (testFiles.length > 0) {
            this.testSuites = [];
        }

        for (const testFile of testFiles) {
            const file = testFile.toString();
            const testSuiteName = file.match(/ui-(.*).ts/)[1].toUpperCase();
            this.setTestSuite(testSuiteName);
        }

        console.log(`[OK] Read test suites: ${this.testSuites.map((item) => {
            return item.name;
        }).toString()}`);
    };

    /**
     * Sets the Shell binary location on the shellBinary attribute
     */
    public static setShellBinary = (): void => {
        const mysqlsh = platform() !== "win32" ? "mysqlsh" : "mysqlsh.exe";

        this.shellBinary = join(this.testSuites[0].extensionDir, readdirSync(this.testSuites[0].extensionDir)
            .filter((item) => {
                return item.includes("oracle");
            })[0], "shell", "bin", mysqlsh);

        if (!existsSync(this.shellBinary)) {
            throw new Error(`[ERR] Could not find the shell binary. Please install the extension`);
        }
    };

    /**
     * Sets the testSuites attribute
     * @param testSuiteName The test suite name
     */
    public static setTestSuite = (testSuiteName: string): void => {

        if (!process.env.TEST_RESOURCES_PATH) {
            // eslint-disable-next-line max-len
            throw new Error("[ERR] No value found for env:TEST_RESOURCES_PATH (Path for VSCode instances and Chromedriver)");
        }

        const testResources = join(process.env.TEST_RESOURCES_PATH, `test-resources-${testSuiteName.toUpperCase()}`);
        process.env.EXTENSIONS_DIR = process.env.EXTENSIONS_DIR ?? process.cwd();
        const extensionDir = join(process.env.EXTENSIONS_DIR, `ext-${testSuiteName.toUpperCase()}`);

        this.testSuites.push({
            name: testSuiteName.toUpperCase(),
            testResources,
            extensionDir,
            exTester: new ExTester(testResources, undefined, extensionDir),
        });
    };

    /**
     * Runs a shell command
     * @param params The parameters to use on the command
     */
    public static runShellCommand = (params: string[]): void => {
        const response = spawnSync(this.shellBinary, params);

        if (response.status !== 0) {
            throw response.stderr.toString();
        }
    };

    /**
     * Runs a generic command
     * @param cmd The command name
     * @param params The parameters to use on the command
     * @returns The output of the command
     */
    public static runCommand = (cmd: string, params: string[]): string => {
        const response = spawnSync(cmd, params);

        if (response.status !== 0) {

            if (response.stderr.toString().trim() === "") {
                throw response.stdout.toString();
            } else {
                throw response.stderr.toString();
            }

        } else {
            return response.stdout.toString();
        }
    };

    /**
     * Installs VSCode and Chromedriver for a test suite
     * @param testSuite The test suite
     */
    public static installTestResources = async (testSuite: IE2ETestSuite): Promise<void> => {

        if (!process.env.TEST_RESOURCES_PATH) {
            throw new Error(`[ERR] No value found for env:TEST_RESOURCES_PATH`);
        }

        if (!process.env.CODE_VERSION) {
            throw new Error("[ERR] No value found for env:CODE_VERSION (VSCode version to download)");
        }

        if (!this.existsVSCode(testSuite)) {

            if (platform() === "darwin") {
                const cpuArch = this.runCommand("uname", ["-p"]);

                if (cpuArch === "arm") {
                    const destination = join(testSuite.testResources, `stable_${process.env.CODE_VERSION}.zip`);
                    const file = createWriteStream(destination);
                    get(`https://update.code.visualstudio.com/${process.env.CODE_VERSION}/darwin-arm64/stable`,
                        (response) => {
                            response.pipe(file);

                            file.on("finish", () => {
                                file.close();
                            });
                        });
                    console.log(`[OK] Downloaded VSCode (ARM64) for ${testSuite.name} test suite`);
                } else {
                    await testSuite.exTester.downloadCode(process.env.CODE_VERSION);
                    console.log(`[OK] Downloaded VSCode for ${testSuite.name} test suite`);
                }
            } else {
                await testSuite.exTester.downloadCode(process.env.CODE_VERSION);
                console.log(`[OK] Downloaded VSCode for ${testSuite.name} test suite`);
            }

        } else {
            console.log(`[OK] Found VSCode for ${testSuite.name} test suite`);
        }

        if (!this.existsChromedriver(testSuite)) {
            await testSuite.exTester.downloadChromeDriver(process.env.CODE_VERSION);
            console.log(`[OK] Downloaded Chromedriver for ${testSuite.name} test suite`);
        } else {
            console.log(`[OK] Found Chromedriver for ${testSuite.name} test suite`);
        }

    };

    /**
     * Executes the setup to run the e2e tests
     * @param cliArguments The CLI arguments.
     * - --mysql-port = The port of a running mysql. If omitted, a new sandbox will be deployed on port 3308
     * - --test-suite = The test suite name to run the setup for. If omitted, the setup will run for all test suites
     * found under tests/*.ts
     * If extension-path is true,
     */
    public static setup = (cliArguments: IE2ECli): void => {

        this.checkSetupEnvVars();
        this.checkMySql();
        this.setShellBinary();

        // DEPLOY A MYSQL SANDBOX INSTANCE
        if (cliArguments && !cliArguments.mysqlPort) {
            this.runShellCommand([
                "--",
                "dba",
                "deploy-sandbox-instance",
                this.mysqlPort,
                `--password=${process.env.DBROOTPASSWORD}`,
                `--sandbox-dir=${this.mysqlSandboxDir}`,
            ]);
            console.log(`[OK] MySQL Sandbox instance deployed successfully on port ${this.mysqlPort}`);
        } else {
            console.log(`[OK] Using existing MySQL Server running on port ${cliArguments.mysqlPort}`);
        }

        // RUN SQL CONFIGURATIONS
        const feSqlFiles = join("..", "..", "..", "..", "gui", "frontend", "src", "tests", "e2e", "sql");
        const extSqlFiles = join(process.cwd(), "sql");

        const sqlFiles = readdirSync(feSqlFiles).map((item) => {
            return join(feSqlFiles, item);
        }).concat(readdirSync(extSqlFiles).map((item) => {
            return join(extSqlFiles, item);
        }));

        // eslint-disable-next-line max-len
        const connUri = `root:${process.env.DBROOTPASSWORD}@localhost:${(cliArguments && cliArguments.mysqlPort) ?? this.mysqlPort}`;

        const sakilaSchema = sqlFiles.filter((item) => {
            return item.includes("sakila");
        });

        this.runShellCommand([connUri, "--file", sakilaSchema[0]]);
        console.log(`[OK] Installed sakila schema successfully`);

        for (const file of sqlFiles) {
            if (!file.includes("sakila")) {
                this.runShellCommand([connUri, "--file", file]);
                console.log(`[OK] Executed SQL file ${file} successfully`);
            }
        }

        // CREATE THE OCI CONFIG FILE
        const ociConfigFile = `
[E2ETESTS]
user=${process.env.OCI_E2E_USER}
fingerprint=${process.env.OCI_E2E_FINGERPRINT}
tenancy=${process.env.OCI_E2E_TENANCY}
region=${process.env.OCI_E2E_REGION}
key_file=${process.env.OCI_E2E_KEY_FILE_PATH}

[HEATWAVE]
user=${process.env.OCI_HW_USER}
fingerprint=${process.env.OCI_HW_FINGERPRINT}
tenancy=${process.env.OCI_HW_TENANCY}
region=${process.env.OCI_HW_REGION}
key_file=${process.env.OCI_HW_KEY_FILE_PATH}
        `;

        writeFileSync(join(process.cwd(), "config"), ociConfigFile);
        console.log("[OK] OCI Configuration file created successfully");

        // CONVERT LIB TS FILES TO JS
        const npm = platform() !== "win32" ? "npm" : "npm.cmd";
        this.runCommand(npm, ["run", "e2e-tests-tsc"]);
        console.log("[OK] TS files converted to JS successfully");
        console.log("[OK] Setup finished !");
    };

    /**
     * Runs some setup configurations and the e2e tests
     * @param testSuite The test suite name. If omitted, it will run all tests
     * @param log True to send the test results to a log file
     * @returns A promise resolving with the result code of the tests execution (0 = success)
     */
    public static run = async (testSuite: IE2ETestSuite, log = false): Promise<number> => {

        this.setWebCertificate(testSuite);
        this.checkTestsEnvVars();

        process.env.MOCHAWESOME_REPORTDIR = process.cwd();
        process.env.MOCHAWESOME_REPORTFILENAME = `test-report-${testSuite.name}.json`;
        process.env.TEST_SUITE = testSuite.name;
        process.env.MYSQLSH_GUI_CUSTOM_CONFIG_DIR = join(process.env.TEST_RESOURCES_PATH, `mysqlsh-${testSuite.name}`);
        this.setMySqlPort();

        if (this.mysqlPort === "3308") {
            process.env.SSL_CERTIFICATES_PATH = join(process.cwd(), this.mysqlPort, "sandboxdata");
        } else {
            if (!process.env.SSL_CERTIFICATES_PATH) {
                throw new Error(`Please define the env:SSL_CERTIFICATES_PATH`);
            }
        }

        process.env.MYSQL_PORT = this.mysqlPort;
        process.env.DBUSERNAME1 = "clientqa";
        process.env.DBPASSWORD1 = "dummy";
        process.env.DBUSERNAME2 = "shell";
        process.env.DBPASSWORD2 = "dummy";
        process.env.OCI_QA_COMPARTMENT_PATH = "QA/MySQLShellTesting";
        process.env.MYSQLSH_OCI_CONFIG_FILE = join(process.cwd(), "config");

        // ASSIGN MYSQL SHELL PORTS
        const minPort = 4000;
        const maxPort = 6000;

        process.env.MYSQLSH_GUI_CUSTOM_PORT = `${Math.floor(Math.random() * (maxPort - minPort + 1) + minPort)}`;
        console.log(`[OK] MYSQLSH_GUI_CUSTOM_PORT is ${process.env.MYSQLSH_GUI_CUSTOM_PORT}`);

        // TRUNCATE THE MYSQL SHELL LOG FILE
        const mysqlshLog = join(process.env.TEST_RESOURCES_PATH, `mysqlsh-${testSuite.name}`, "mysqlsh.log");
        truncateSync(mysqlshLog);

        // REMOVE SHELL INSTANCE HOME (for safety)
        const shellInstanceHome = join(process.env.TEST_RESOURCES_PATH, `mysqlsh-${testSuite.name}`, "plugin_data",
            "gui_plugin", "shell_instance_home");
        rmSync(shellInstanceHome, { force: true, recursive: true });

        // REMOVE ROUTER CONFIGURATIONS
        const routerConfigsFolder = join(process.env.TEST_RESOURCES_PATH, `mysqlsh-${testSuite.name}`, "plugin_data",
            "mrs_plugin", "router_configs");
        rmSync(routerConfigsFolder, { force: true, recursive: true });

        // RUN THE TESTS
        let result = await this.executeTests(testSuite, log);

        if (log) {
            if (result !== 0) {
                if (this.extensionNotLoaded(testSuite.name)) {
                    result = await this.executeTests(testSuite, log);
                }
            }
        }

        return result;
    };

    /**
     * Removes and installs the Shell Web Certificate, using Shell
     */
    public static generateWebCertificate = (): void => {

        // (ON WINDOWS/MACOS, THERE IS A NATIVE DIALOG THAT THIS SCRIPT CAN'T INTERACT WITH)
        if (platform() === "linux") {
            this.runShellCommand(["--js", "-e", "gui.core.removeShellWebCertificate()"]);
            console.log("[OK] Web Certificates removed");
            this.runShellCommand(["--js", "-e", "gui.core.installShellWebCertificate()"]);
            console.log("[OK] Web Certificate installed successfully");
        } else {
            console.log(`[INF] It is only possible to generate the Web Certificates automatically for linux`);
        }
    };

    /**
     * Copies the Web Certificates from the shell config folder to the custom config folder of the test suite
     * @param testSuite The test suite
     */
    public static setWebCertificate = (testSuite: IE2ETestSuite): void => {

        // WEB CERTIFICATES VERIFICATION (USER DATA FOLDER)
        let webCertificatesPath: string;

        switch (platform()) {

            case "win32": {
                webCertificatesPath = join(String(process.env.APPDATA), "MySQL", "mysqlsh", "plugin_data",
                    "gui_plugin", "web_certs");
                const webCertificatesGuiPath = join(String(process.env.APPDATA), "MySQL", "mysqlsh-gui", "plugin_data",
                    "gui_plugin", "web_certs");

                let error = `[ERR] web_certs were not found at `;
                error += `'${webCertificatesPath}' nor '${webCertificatesGuiPath}'`;

                if (!existsSync(webCertificatesPath) && !(existsSync(webCertificatesGuiPath))) {
                    throw new Error(error);
                } else {
                    webCertificatesPath = webCertificatesPath || webCertificatesGuiPath;
                    console.log(`[OK] Web certificates found at ${webCertificatesPath}`);
                }
                break;
            }

            case "darwin":
            case "linux": {
                webCertificatesPath = join(String(process.env.HOME),
                    ".mysqlsh", "plugin_data", "gui_plugin", "web_certs");
                const webCertificatesGuiPath = join(String(process.env.HOME),
                    ".mysqlsh-gui", "plugin_data", "gui_plugin", "web_certs");

                if (!existsSync(webCertificatesPath) && !existsSync(webCertificatesGuiPath)) {
                    let error = `[ERR] web_certs were not found at '${webCertificatesPath}' nor`;
                    error += ` '${webCertificatesGuiPath}'`;
                    throw new Error(error);
                } else {
                    webCertificatesPath = webCertificatesPath || webCertificatesGuiPath;
                    console.log(`[OK] Web certificates found at ${webCertificatesPath}`);
                }
                break;
            }

            default: {
                break;
            }
        }

        const configFolder = join(process.env.TEST_RESOURCES_PATH, `mysqlsh-${testSuite.name}`);

        if (!existsSync(configFolder)) {
            mkdirSync(configFolder);
            writeFileSync(join(configFolder, "mysqlsh.log"), "");
            mkdirSync(join(configFolder, "plugin_data", "gui_plugin"), { recursive: true });
            console.log(`[OK] Created config folder for ${testSuite.name} test suite`);
        }

        const webCerts = join(configFolder, "plugin_data", "gui_plugin", "web_certs");

        if (platform() !== "win32") {
            for (const item of readdirSync(join(configFolder, "plugin_data", "gui_plugin"))) {
                if (item === "web_certs") {
                    rmSync(webCerts, { recursive: true });
                }
            }

            symlinkSync(webCertificatesPath, webCerts);
            console.log(`[OK] Web Certificates symlink created for ${testSuite.name} test suite`);
        } else {
            if (!existsSync(webCerts)) {
                cpSync(webCertificatesPath, webCerts, { recursive: true });
                console.log(`[OK] Copied web_certs folder for ${testSuite.name} test suite`);
            } else {
                console.log(`[OK] Found web_certs folder for ${testSuite.name} test suite`);
            }
        }
    };

    /**
     * Verifies if the extension was not loaded
     * @param testSuite The test suite name
     * @returns A promise resolving with true if the extension was not loaded, false otherwise
     */
    public static extensionNotLoaded = (testSuite: string): boolean => {

        const result = readFileSync(join(process.cwd(), `test_results_${testSuite}.log`));

        const errorMatches = [
            /Extension was not loaded successfully/,
            /WebDriverError/,
        ];

        for (const error of errorMatches) {
            if (result.toString().match(error) !== null) {
                console.log(`[WRN] Extension NOT loaded: ${error.toString()}`);

                return true;
            }
        }

        return false;
    };

    /**
     * Merges and generates the final test report
     */
    public static generateReport = (): void => {

        const currentDir = readdirSync(process.cwd());

        const reportFiles = [];
        for (const file of currentDir) {
            if (file.includes("test-report")) {
                reportFiles.push(file);
            }
        }

        const npm = platform() !== "win32" ? "npm" : "npm.cmd";

        this.runCommand(npm, [
            "run",
            "e2e-tests-merge",
            "--",
            "-o",
            "mergeReport.json",
        ].concat(reportFiles));
        console.log("[OK] Test reports merged successfully");

        this.runCommand(npm, [
            "run",
            "e2e-tests-report",
            "--",
            "-o",
            "finalReport",
            "mergeReport.json",
        ]);
        console.log("[OK] Test report generated successfully");
    };

    /**
     * Copies the extension for a test suite
     * @param testSuiteSource The test suite source that already has the extension installed
     * @param testSuite The test suite to copy the extension for
     */
    public static copyExtension = (testSuiteSource: IE2ETestSuite, testSuite: IE2ETestSuite): void => {
        if (!existsSync(testSuite.testResources)) {
            throw new Error(`${testSuite.testResources} does not exist`);
        }

        if (existsSync(testSuiteSource.extensionDir)) {
            cpSync(testSuiteSource.extensionDir, testSuite.extensionDir, { recursive: true });
            console.log(`[OK] Copied the extension from ${testSuiteSource.name} suite to ${testSuite.name} suite`);
        } else {
            throw new Error(`Please install the extension for ${testSuite.name} test suite`);
        }
    };

    /**
     * Installs the extension on a test suite
     * @param testSuite The test suite
     */
    public static installExtension = async (testSuite: IE2ETestSuite): Promise<void> => {
        if (!existsSync(testSuite.testResources)) {
            throw new Error(`${testSuite.testResources} does not exist`);
        }
        const cliArguments = this.getCliArguments();

        if (cliArguments.extensionPath) {
            await testSuite.exTester.installVsix({ vsixFile: cliArguments.extensionPath });
        } else {
            console.log(`[INF] Skipping extension installation for ${testSuite.name} test suite`);
        }
    };

    /**
     * Executes the tests
     * @param testSuite The test suite name
     * @param log True to log the test results to a file, false otherwise
     * @returns A promise resolving with the result code of the tests execution (0 = success)
     */
    private static executeTests = async (testSuite: IE2ETestSuite, log: boolean): Promise<number> => {

        console.log(`[INF] Running tests for ${testSuite.name.toUpperCase()} suite...`);
        process.env.NODE_ENV = "test";
        const defaultStdoutWrite = process.stdout.write.bind(process.stdout);

        if (log) {
            const logStream = createWriteStream(`test_results_${testSuite.name}.log`, { flags: "a" });

            process.stdout.write = process.stderr.write = logStream.write.bind(logStream);
        }

        const result = await testSuite.exTester.runTests(`./output/tests/ui-${testSuite.name.toLowerCase()}.js`, {
            settings: join(process.cwd(), "setup", "settings.json"),
            offline: true,
            config: join(process.cwd(), "setup", ".mocharc.json"),
            resources: [],
        });

        if (log) {
            process.stdout.write = defaultStdoutWrite;
        }

        result === 0 ? console.log(`[INF] Tests PASSED for ${testSuite.name.toUpperCase()} suite.`) :
            console.log(`[INF] Tests FAILED for ${testSuite.name.toUpperCase()} suite`);

        return result;
    };

    /**
     * Verifies if all the required environment variables for the setup are defined
     */
    private static checkSetupEnvVars = (): void => {

        const requiredEnvVars = [
            {
                value: process.env.DBROOTPASSWORD,
                description: "MySQL Server Root password",
            },
            {
                value: process.env.OCI_E2E_KEY_FILE_PATH,
                description: "OCI Key file path for 'E2ETESTS' profile",
            },
            {
                value: process.env.OCI_HW_KEY_FILE_PATH,
                description: "OCI Key file path for 'HEATWAVE' profile",
            },
            {
                value: process.env.OCI_E2E_USER,
                description: "OCI user for 'E2ETESTS' profile",
            },
            {
                value: process.env.OCI_E2E_FINGERPRINT,
                description: "OCI fingerprint for 'E2ETESTS' profile",
            },
            {
                value: process.env.OCI_E2E_TENANCY,
                description: "OCI tenancy for 'E2ETESTS' profile",
            },
            {
                value: process.env.OCI_E2E_REGION,
                description: "OCI region for 'E2ETESTS' profile",
            },
            {
                value: process.env.OCI_HW_USER,
                description: "OCI user for 'HEATWAVE' profile",
            },
            {
                value: process.env.OCI_HW_FINGERPRINT,
                description: "OCI fingerprint for 'HEATWAVE' profile",
            },
            {
                value: process.env.OCI_HW_TENANCY,
                description: "OCI tenancy for 'HEATWAVE' profile",
            },
            {
                value: process.env.OCI_HW_REGION,
                description: "OCI region for 'HEATWAVE' profile",
            },
        ];

        for (const envVar of requiredEnvVars) {
            if (!envVar) {
                throw new Error(`Please define env:${envVar.value} (${envVar.description})`);
            }
        }
    };

    /**
     * Verifies if all the required environment variables for the tests are defined
     */
    private static checkTestsEnvVars = (): void => {

        const requiredEnvVars = [
            {
                value: process.env.TEST_RESOURCES_PATH,
                description: "Path for VSCode instances and Chromedriver)",
            },
            {
                value: process.env.HWHOSTNAME,
                description: "HeatWave agent hostname",
            },
            {
                value: process.env.HWUSERNAME,
                description: "HeatWave agent username",
            },
            {
                value: process.env.HWPASSWORD,
                description: "HeatWave agent password",
            },
            {
                value: process.env.OCI_BASTION_USERNAME,
                description: "OCI Bastion username",
            },
            {
                value: process.env.OCI_BASTION_PASSWORD,
                description: "OCI Bastion password",
            },
        ];

        for (const envVar of requiredEnvVars) {
            if (!envVar) {
                throw new Error(`Please define env:${envVar.value} (${envVar.description})`);
            }
        }
    };

    /**
     * Verifies if MySQL Server is installed
     */
    private static checkMySql = (): void => {

        let output: string;
        try {
            output = this.runCommand("mysql", ["--version"]);
            console.log(`[OK] Found MySQL Server - ${output}`);
        } catch (e) {
            throw new Error(`[ERR] MySQL Server was not found.`);
        }

    };

    /**
     * Verifies if VSCode exists for a test suite. It searches under the test-resources-<test_suite> folder
     * @param testSuite The Test suite
     * @returns True if VSCode exists for the test suite, false otherwise
     */
    private static existsVSCode = (testSuite: IE2ETestSuite): boolean => {
        const files = readdirSync(testSuite.testResources);

        for (const file of files) {
            if (file.toLowerCase().includes("code")) {
                return true;
            }
        }
    };

    /**
     * Verifies if Chromedriver exists for a test suite. It searches under the test-resources-<test_suite> folder
     * @param testSuite The Test suite
     * @returns True if Chromedriver exists for the test suite, false otherwise
     */
    private static existsChromedriver = (testSuite: IE2ETestSuite): boolean => {
        const files = readdirSync(testSuite.testResources);

        for (const file of files) {
            if (file.toLowerCase().includes("chromedriver")) {
                return true;
            }
        }
    };

    /**
     * Sets the mysql port attribute
     */
    private static setMySqlPort = (): void => {
        const cliArguments = this.getCliArguments();

        if (cliArguments.mysqlPort) {
            this.mysqlPort = cliArguments.mysqlPort;
        }
    };
}
