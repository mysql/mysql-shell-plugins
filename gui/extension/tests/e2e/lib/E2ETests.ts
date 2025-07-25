/*
 * Copyright (c) 2024, 2025 Oracle and/or its affiliates.
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
import fs from "fs/promises";
import {
    readdirSync, existsSync, mkdirSync, writeFileSync, symlinkSync, readFileSync,
    truncateSync, rmSync, createWriteStream, cpSync, appendFileSync,
} from "fs";
import { get } from "https";
import { ExTester } from "vscode-extension-tester";
import { IE2ECli, IE2ETestSuite } from "./interfaces";
import { E2ELogger } from "./E2ELogger";
import { Os } from "./Os";

/**
 * This class aggregates the functions that are used on the tests setup script
 */
export class E2ETests {

    /** The Test suites identified under the tests folder */
    public static testSuites: IE2ETestSuite[] = [];

    /** MySQL Servers to deploy */
    public static mysqlPorts = [
        "1107", // DEFAULT
        "1108", // REST
        "1109", // ROUTER
        "1110", // REST CONFIG
    ];

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

        E2ELogger.success(`Read test suites: ${this.testSuites.map((item) => {
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
        const response = spawnSync(cmd, params, { shell: true });

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

                    E2ELogger.success(`Downloaded VSCode (ARM64) for ${testSuite.name} test suite`);
                } else {
                    await testSuite.exTester.downloadCode(process.env.CODE_VERSION);
                    E2ELogger.success(`Downloaded VSCode for ${testSuite.name} test suite`);
                }
            } else {
                await testSuite.exTester.downloadCode(process.env.CODE_VERSION);
                E2ELogger.success(`Downloaded VSCode for ${testSuite.name} test suite`);
            }

        } else {
            E2ELogger.success(`Found VSCode for ${testSuite.name} test suite`);
        }

        if (!this.existsChromedriver(testSuite)) {
            await testSuite.exTester.downloadChromeDriver(process.env.CODE_VERSION);
            E2ELogger.success(`Downloaded Chromedriver for ${testSuite.name} test suite`);
        } else {
            E2ELogger.success(`Found Chromedriver for ${testSuite.name} test suite`);
        }

    };

    /**
     * Removes the logs folder for a test suite
     * @param testSuite The test suite
     */
    public static removeLogs = async (testSuite: IE2ETestSuite): Promise<void> => {
        const logsFolderPath = join(testSuite.testResources, "settings", "logs");

        if (existsSync(logsFolderPath)) {
            const folderItems = await fs.readdir(logsFolderPath);

            for (const item of folderItems) {
                await fs.rm(join(logsFolderPath, item), { recursive: true });
            }
        }
    };

    /**
     * Executes the setup to run the e2e tests
     */
    public static setup = (): void => {

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

        this.checkSetupEnvVars();
        this.checkMySql();
        this.setShellBinary();

        const installMLE = (port: string): void => {
            const connUri = `root:${process.env.DBROOTPASSWORD}@localhost:${port}`;
            this.runShellCommand([
                connUri,
                "--sql",
                "-e",
                `INSTALL COMPONENT "file://component_mle";`,
            ]);
            E2ELogger.success(`Installed MLE component on port ${this.mysqlPorts[0]}`);
        };

        const installSqlData = (port: string): void => {
            this.runShellCommand([
                "--",
                "dba",
                "deploy-sandbox-instance",
                port,
                `--password=${process.env.DBROOTPASSWORD}`,
                `--sandbox-dir=${this.mysqlSandboxDir}`,
            ]);
            E2ELogger.success(`MySQL Sandbox instance deployed successfully on port ${port}`);

            const feSqlFiles = join("..", "..", "..", "..", "gui", "frontend", "src", "tests", "e2e", "sql");
            const extSqlFiles = join(process.cwd(), "sql");

            const sqlFiles = readdirSync(feSqlFiles).map((item) => {
                return join(feSqlFiles, item);
            }).concat(readdirSync(extSqlFiles).map((item) => {
                return join(extSqlFiles, item);
            }));

            for (const file of sqlFiles) {
                this.runShellCommand([
                    `root:${process.env.DBROOTPASSWORD}@localhost:${port}`, "--file",
                    file,
                ]);
            }
            E2ELogger.success(`Executed SQL files successfully on port ${port}`);
        };

        const installMRS = (port: string): void => {
            this.runShellCommand([
                `root:${process.env.DBROOTPASSWORD}@localhost:${port}`,
                "--py", "-e", "mrs.configure()",
            ]);
            E2ELogger.success(`MRS was configured successfully on port ${port}`);

        };

        if (this.testSuites.length > 1) {
            for (const port of this.mysqlPorts) {
                installSqlData(port);
            }

            installMLE(this.mysqlPorts[0]);
            installMRS(this.mysqlPorts[1]);
            installMRS(this.mysqlPorts[2]);
            writeFileSync(join(process.cwd(), "config"), ociConfigFile);
            E2ELogger.success("OCI Configuration file created successfully");
        } else if (this.testSuites[0].name === "DB" ||
            this.testSuites[0].name === "NOTEBOOK" ||
            this.testSuites[0].name === "OPEN-EDITORS" ||
            this.testSuites[0].name === "SHELL"
        ) {
            installSqlData(this.mysqlPorts[0]);
            installMLE(this.mysqlPorts[0]);
            installSqlData(this.mysqlPorts[2]);
        } else if (this.testSuites[0].name === "CONNECTION-OVERVIEW") {
            installSqlData(this.mysqlPorts[0]);
            writeFileSync(join(process.cwd(), "config"), ociConfigFile);
            E2ELogger.success("OCI Configuration file created successfully");
        }
        else if (this.testSuites[0].name === "REST-CONFIG") {
            installSqlData(this.mysqlPorts[3]);
        } else if (this.testSuites[0].name === "REST") {
            installSqlData(this.mysqlPorts[1]);
            installMRS(this.mysqlPorts[1]);
        } else if (this.testSuites[0].name === "ROUTER") {
            installSqlData(this.mysqlPorts[2]);
            installMRS(this.mysqlPorts[2]);
        } else if (this.testSuites[0].name === "OCI") {
            writeFileSync(join(process.cwd(), "config"), ociConfigFile);
            E2ELogger.success("OCI Configuration file created successfully");
        } else {
            throw new Error(`Unknown test suite ${this.testSuites[0].name}`);
        }

        E2ELogger.success("Setup finished successfully");
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
        process.env.SSL_CERTIFICATES_PATH = join(process.cwd(), this.mysqlPorts[0], "sandboxdata");
        process.env.MYSQL_1107 = this.mysqlPorts[0];
        process.env.MYSQL_1108 = this.mysqlPorts[1]; // HAS MRS
        process.env.MYSQL_1109 = this.mysqlPorts[2]; // HAS MRS
        process.env.MYSQL_1110 = this.mysqlPorts[3];
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
        E2ELogger.success(`MYSQLSH_GUI_CUSTOM_PORT is ${process.env.MYSQLSH_GUI_CUSTOM_PORT}`);

        // TRUNCATE THE MYSQL SHELL LOG FILE
        const mysqlshLog = join(process.env.TEST_RESOURCES_PATH, `mysqlsh-${testSuite.name}`, "mysqlsh.log");

        if (existsSync(mysqlshLog)) {
            truncateSync(mysqlshLog);
        } else {
            appendFileSync(mysqlshLog, "");
        }

        // REMOVE SHELL INSTANCE HOME (for safety)
        const shellInstanceHome = join(process.env.TEST_RESOURCES_PATH, `mysqlsh-${testSuite.name}`, "plugin_data",
            "gui_plugin", "shell_instance_home");
        rmSync(shellInstanceHome, { force: true, recursive: true });

        // REMOVE ROUTER CONFIGURATIONS
        const routerConfigsFolder = join(process.env.TEST_RESOURCES_PATH, `mysqlsh-${testSuite.name}`, "plugin_data",
            "mrs_plugin", "router_configs");
        rmSync(routerConfigsFolder, { force: true, recursive: true });

        // REMOVE LOGS
        await this.removeLogs(testSuite);

        // RUN THE TESTS
        const result = await this.executeTests(testSuite, log);
        await this.exportExtensionLogsToWorkspace(testSuite);

        return result;
    };

    /**
     * Removes and installs the Shell Web Certificate, using Shell
     */
    public static generateWebCertificate = (): void => {

        // (ON WINDOWS/MACOS, THERE IS A NATIVE DIALOG THAT THIS SCRIPT CAN'T INTERACT WITH)
        if (platform() === "linux") {
            this.runShellCommand(["--js", "-e", "gui.core.removeShellWebCertificate()"]);
            E2ELogger.success("Web Certificates removed");
            this.runShellCommand(["--js", "-e", "gui.core.installShellWebCertificate()"]);
            E2ELogger.success("Web Certificate installed successfully");
        } else {
            E2ELogger.info(`It is only possible to generate the Web Certificates automatically for linux`);
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
                    E2ELogger.success(`Web certificates found at ${webCertificatesPath}`);
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
                    E2ELogger.success(`[OK] Web certificates found at ${webCertificatesPath}`);
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
            E2ELogger.success(`Created config folder for ${testSuite.name} test suite`);
        }

        const webCerts = join(configFolder, "plugin_data", "gui_plugin", "web_certs");

        if (platform() !== "win32") {
            for (const item of readdirSync(join(configFolder, "plugin_data", "gui_plugin"))) {
                if (item === "web_certs") {
                    rmSync(webCerts, { recursive: true });
                }
            }

            symlinkSync(webCertificatesPath, webCerts);
            E2ELogger.success(`Web Certificates symlink created for ${testSuite.name} test suite`);
        } else {
            if (!existsSync(webCerts)) {
                cpSync(webCertificatesPath, webCerts, { recursive: true });
                E2ELogger.success(`[OK] Copied web_certs folder for ${testSuite.name} test suite`);
            } else {
                E2ELogger.success(`Found web_certs folder for ${testSuite.name} test suite`);
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
                E2ELogger.warning(`Extension NOT loaded: ${error.toString()}`);
                E2ELogger.debug(result.toString());
                console.debug("-----");

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
        E2ELogger.success("Test reports merged successfully");

        this.runCommand(npm, [
            "run",
            "e2e-tests-report",
            "--",
            "-o",
            "finalReport",
            "mergeReport.json",
        ]);
        E2ELogger.success("Test report generated successfully");
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
            E2ELogger.success(`Copied the extension from ${testSuiteSource.name} suite to ${testSuite.name} suite`);
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
            E2ELogger.info(`Skipping extension installation for ${testSuite.name} test suite`);
        }
    };

    /**
     * Disables the tests or test suites that are defined in the DISABLE_TESTS env variable.
     * Multiple tests/test suites to disable should be separated by the "," character
     */
    public static disableTests = async (): Promise<void> => {
        const testsDir = join(process.cwd(), "tests");

        let testsToDisable: string[];

        if (process.env.DISABLE_TESTS.includes(",")) {
            testsToDisable = process.env.DISABLE_TESTS.split(",").map((item) => {
                return item.trim();
            });
        } else {
            testsToDisable = [process.env.DISABLE_TESTS];
        }

        const files = await fs.readdir(testsDir);

        for (const test of testsToDisable) {

            for (const file of files) {
                const testFile = (await fs.readFile(join(testsDir, file))).toString();
                let toReplace = "";

                if (testFile.match(new RegExp(test)) !== null) {

                    let log = "";

                    if (testFile.match(new RegExp(`describe\\("${test}"`)) !== null) {
                        log += `Test Suite`;
                        toReplace = testFile.replace(`describe("${test}"`, `describe.skip("${test}"`);
                    } else if (testFile.match(new RegExp(`it\\("${test}"`)) !== null) {
                        log += `Test`;
                        toReplace = testFile.replace(`it("${test}"`, `it.skip("${test}"`);
                    } else {
                        continue;
                    }

                    await fs.writeFile(join(testsDir, file), toReplace);
                    E2ELogger.info(`${log} "${test}" on file "${file}" was DISABLED`);
                    break;
                }
            }
        }
    };

    /**
     * Kills and removes the sandbox directories of running MySQL Server instances running on ports 3307, 3308 and 3309
     */
    public static killAndDeleteMySQLInstances = (): void => {
        if (this.testSuites.length === 0) {
            E2ETests.setTestSuite("DB");
        }

        E2ETests.setShellBinary();

        for (const mysqlPort of this.mysqlPorts) {

            try {
                E2ETests.runShellCommand([
                    "--",
                    "dba",
                    "kill-sandbox-instance",
                    mysqlPort,
                    `--sandbox-dir=${E2ETests.mysqlSandboxDir}`,
                ]);

                E2ELogger.success(`Killed MySQL instance successfully for port ${mysqlPort}`);
            } catch (e) {
                if (!String(e).includes("Unable to find pid file")) {
                    throw e;
                }
                E2ELogger.success(`MySQL instance on port ${mysqlPort} not found. Continuing...`);
            }

            try {
                E2ETests.runShellCommand([
                    "--",
                    "dba",
                    "delete-sandbox-instance",
                    mysqlPort,
                    `--sandbox-dir=${E2ETests.mysqlSandboxDir}`,
                ]);
                E2ELogger.success(`Deleted MySQL instance successfully for port ${mysqlPort}`);
            }
            catch (e) {
                if (!String(e).includes("does not exist")) {
                    throw e;
                }
                E2ELogger.success(`Sandbox instance on port ${mysqlPort} not found. Continuing...`);
            }
        }
    };

    /**
     * Executes the tests
     * @param testSuite The test suite name
     * @param log True to log the test results to a file, false otherwise
     * @returns A promise resolving with the result code of the tests execution (0 = success)
     */
    private static executeTests = async (testSuite: IE2ETestSuite, log: boolean): Promise<number> => {

        E2ELogger.info(`Running tests for ${testSuite.name.toUpperCase()} suite...`);
        process.env.NODE_ENV = "test";
        const defaultStdoutWrite = process.stdout.write.bind(process.stdout);
        const filename = `test_results_${testSuite.name}.log`;

        if (log) {
            if (existsSync(filename)) {
                rmSync(filename);
            }

            const logStream = createWriteStream(filename, { flags: "a" });

            process.stdout.write = process.stderr.write = logStream.write.bind(logStream);
        }

        let extensionFileName: string;
        const extensionDir = await fs.readdir(testSuite.extensionDir);
        for (const file of extensionDir) {
            if (file.includes("oracle")) {
                extensionFileName = file;
                break;
            }
        }

        if (!extensionFileName) {
            throw new Error(`Could not find the extension file name at ${testSuite.extensionDir}`);
        }

        process.env.VSCODE_ARGS = `--disable-extensions --extensionDevelopmentPath=${join(testSuite.extensionDir,
            extensionFileName)} --user-data-dir=./vscode-test-user-data --disable-gpu`;

        const result = await testSuite.exTester.runTests(`./tests/ui-${testSuite.name.toLowerCase()}.ts`, {
            settings: join(process.cwd(), "setup", "settings.json"),
            offline: true,
            config: join(process.cwd(), "setup", ".mocharc.json"),
            cleanup: process.env.UNINSTALL_EXTENSION ? true : false,
            resources: [],
        });

        if (log) {
            process.stdout.write = defaultStdoutWrite;
        }

        result === 0 ? E2ELogger.info(`Tests PASSED for ${testSuite.name.toUpperCase()} suite.`) :
            E2ELogger.error(`Tests FAILED for ${testSuite.name.toUpperCase()} suite`);

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
            E2ELogger.success(`Found MySQL Server - ${output}`);
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
        if (existsSync(testSuite.testResources)) {
            const files = readdirSync(testSuite.testResources);

            for (const file of files) {
                if (file.toLowerCase().includes("code")) {
                    return true;
                }
            }
        } else {
            return false;
        }
    };

    /**
     * Verifies if Chromedriver exists for a test suite. It searches under the test-resources-<test_suite> folder
     * @param testSuite The Test suite
     * @returns True if Chromedriver exists for the test suite, false otherwise
     */
    private static existsChromedriver = (testSuite: IE2ETestSuite): boolean => {
        if (existsSync(testSuite.testResources)) {
            const files = readdirSync(testSuite.testResources);

            for (const file of files) {
                if (file.toLowerCase().includes("chromedriver")) {
                    return true;
                }
            }
        } else {
            return false;
        }
    };

    /**
     * Prepares the extension logs to be exported on jenkins, by renaming the log files according with the test suite
     * @param testSuite The test suite
     * @returns A promise resolving when the logs are prepared
     */
    private static exportExtensionLogsToWorkspace = async (testSuite: IE2ETestSuite): Promise<void> => {
        const logFile = await Os.getExtensionLogFile();

        // rename the file
        await fs.rename(logFile, join(process.cwd(), `${testSuite.name}_output_tab.log`));
    };
}
