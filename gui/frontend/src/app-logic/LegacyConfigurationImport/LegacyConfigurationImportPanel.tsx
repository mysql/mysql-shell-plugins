/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is designed to work with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms,
 * as designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have either included with
 * the program or referenced in the documentation.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import "./LegacyConfigurationImportPanel.css";

import { Component, type ComponentChild } from "preact";

import { Button } from "../../components/ui/Button/Button.js";
import { Icon } from "../../components/ui/Icon/Icon.js";
import { Assets } from "../../supplement/Assets.js";
import { ProfileState } from "../../supplement/ProfileState.js";
import { convertErrorToString } from "../../utilities/helpers.js";
import { ShellInterface } from "../../supplement/ShellInterface/ShellInterface.js";
import { webSession } from "../../supplement/WebSession.js";
import type {
    ILegacyConfigurationImportDiscovery,
    ILegacyConfigurationImportReport,
    ILegacyConfigurationImportSelections,
} from "./LegacyConfigurationImportTypes.js";
import { LegacyConfigurationImportWizard } from "./LegacyConfigurationImportWizard.js";

interface ILegacyConfigurationImportPanelProperties {
    onConnectionsImported: () => void | Promise<void>;
}

interface ILegacyConfigurationImportPanelState {
    discovery?: ILegacyConfigurationImportDiscovery;
    dismissed: boolean;
    error?: string;
    showWizard: boolean;
}

const formatCount = (count: number, singular: string): string => {
    return `${count} ${singular}${count === 1 ? "" : "s"}`;
};

const panelDismissedStateKey = "dbEditor.connectionBrowser.configurationImport.dismissed";

export const hasActionableLegacyData = (discovery: ILegacyConfigurationImportDiscovery): boolean => {
    const workbenchActionable = discovery.workbench !== undefined && (
        discovery.workbench.connectionsPending
        || discovery.workbench.issues.length > 0
    );
    const vscodeActionable = discovery.vscode !== undefined && (
        discovery.vscode.connectionsPending
        || discovery.vscode.issues.length > 0
    );
    const projectsActionable = discovery.projects !== undefined && (
        discovery.projects.sources.some((source) => {
            return source.copyPending || source.issueCount > 0;
        })
        || discovery.projects.issues.length > 0
    );

    return workbenchActionable || vscodeActionable || projectsActionable;
};

export class LegacyConfigurationImportPanel extends Component<
    ILegacyConfigurationImportPanelProperties,
    ILegacyConfigurationImportPanelState
> {
    public constructor(props: ILegacyConfigurationImportPanelProperties) {
        super(props);

        this.state = {
            dismissed: ProfileState.get(panelDismissedStateKey, false),
            showWizard: false,
        };
    }

    public override componentDidMount(): void {
        void this.discover();
    }

    public render(): ComponentChild {
        const { discovery, dismissed, error, showWizard } = this.state;

        if (!showWizard && (
            dismissed
            || (!error && (!discovery || !hasActionableLegacyData(discovery)))
        )) {
            return null;
        }

        return (
            <>
                {!dismissed && <section
                    className="legacyConfigurationImportPanel"
                    aria-labelledby="legacyConfigurationImportPanelTitle"
                >
                    <Button
                        id="dismissLegacyConfigurationImportPanel"
                        className="legacyConfigurationImportDismissButton"
                        round
                        data-tooltip="Dismiss configuration import panel"
                        onClick={this.dismiss}
                    >
                        <Icon src={Assets.misc.close2Icon} data-tooltip="inherit" />
                    </Button>
                    <div className="legacyConfigurationImportPanelContent">
                        <h2 id="legacyConfigurationImportPanelTitle">
                            Configuration Import
                        </h2>
                        <div>
                            Configuration data from previous MySQL applications is ready to be imported.
                        </div>
                        {error
                            ? <div className="legacyConfigurationImportPanelError">
                                Could not check for data from previous applications: {error}
                            </div>
                            : <>
                                <div>The New MySQL Workbench obsoletes MySQL Workbench 8 and the
                                    MySQL Shell for Visual Studio Code extension. You may import MySQL connections and
                                    some other configuration data from these applications.</div>
                                {discovery && <dl className="legacyConfigurationImportSummary">
                                    {this.renderWorkbenchSummary(discovery)}
                                    {this.renderVsCodeSummary(discovery)}
                                    {this.renderProjectSummary(discovery)}
                                </dl>}
                            </>}
                    </div>
                    <div className="legacyConfigurationImportPanelActions">
                        {error
                            ? <Button
                                id="retryLegacyConfigurationImportDiscovery"
                                caption="Retry"
                                onClick={this.retryDiscovery}
                            />
                            : <Button
                                id="openLegacyConfigurationImportWizard"
                                caption="Review and Import…"
                                isDefault
                                onClick={this.openWizard}
                            />}
                    </div>
                </section>}
                {showWizard && discovery &&
                    <LegacyConfigurationImportWizard
                        discovery={discovery}
                        onRunPage={this.runImportPage}
                        onClose={this.closeWizard}
                    />}
            </>
        );
    }

    private renderWorkbenchSummary(discovery: ILegacyConfigurationImportDiscovery): ComponentChild {
        const workbench = discovery.workbench;
        if (!workbench || (
            !workbench.connectionsPending
            && workbench.issues.length === 0
        )) {
            return null;
        }

        const details: string[] = [];
        if (workbench.connectionsPending) {
            details.push(formatCount(workbench.connectionCount, "connection"));
        }
        if (workbench.issues.length > 0) {
            details.push(`${formatCount(workbench.issues.length, "item")} needs attention`);
        }

        return <>
            <dt>MySQL Workbench 8</dt>
            <dd>{details.join(" · ")}</dd>
        </>;
    }

    private renderVsCodeSummary(discovery: ILegacyConfigurationImportDiscovery): ComponentChild {
        const vscode = discovery.vscode;
        if (!vscode || (
            !vscode.connectionsPending
            && vscode.issues.length === 0
        )) {
            return null;
        }

        const details: string[] = [];
        if (vscode.connectionsPending) {
            details.push(`${formatCount(vscode.connectionCount, "connection")} in `
                + formatCount(vscode.profileCount, "profile"));
        }
        if (vscode.issues.length > 0) {
            details.push(`${formatCount(vscode.issues.length, "item")} needs attention`);
        }

        return <>
            <dt>MySQL Shell for VS Code</dt>
            <dd>{details.join(" · ")}</dd>
        </>;
    }

    private renderProjectSummary(discovery: ILegacyConfigurationImportDiscovery): ComponentChild {
        const projects = discovery.projects;
        if (!projects) {
            return null;
        }

        const projectCount = projects.sources.reduce((count, source) => {
            return count + source.projectCount;
        }, 0);
        const issueCount = projects.sources.reduce((count, source) => {
            return count + source.issueCount;
        }, 0);
        if (projectCount === 0 && issueCount === 0) {
            return null;
        }

        const details: string[] = [];
        if (projectCount > 0) {
            details.push(formatCount(projectCount, "project"));
        }
        if (issueCount > 0) {
            details.push(`${formatCount(issueCount, "item")} needs attention`);
        }

        return <>
            <dt>Migration Assistant</dt>
            <dd>{details.join(" · ")}</dd>
        </>;
    }

    private discover = async (preserveDiscovery = false): Promise<void> => {
        try {
            const discovery = await ShellInterface.legacy.discover();
            this.setState({
                discovery,
                error: undefined,
            });
        } catch (reason) {
            this.setState({
                discovery: preserveDiscovery ? this.state.discovery : undefined,
                error: convertErrorToString(reason),
            });
        }
    };

    private retryDiscovery = (): void => {
        this.setState({
            error: undefined,
        });
        void this.discover();
    };

    private openWizard = (): void => {
        this.setState({
            showWizard: true,
        });
    };

    private dismiss = (): void => {
        ProfileState.set(panelDismissedStateKey, true);
        ProfileState.saveState(true);
        this.setState({
            dismissed: true,
            showWizard: false,
        });
    };

    private closeWizard = (completed: boolean): void => {
        this.setState({
            showWizard: false,
        });
        if (completed) {
            void this.discover();
        }
    };

    private runImportPage = async (
        page: "workbench" | "vscode" | "projects",
        selections: ILegacyConfigurationImportSelections,
    ): Promise<ILegacyConfigurationImportReport[]> => {
        const { discovery } = this.state;
        if (!discovery) {
            return [];
        }

        let reports: ILegacyConfigurationImportReport[] = [];
        switch (page) {
            case "workbench": {
                if (discovery.workbench?.connectionsPending) {
                    reports = [
                        await ShellInterface.legacy.importDiscoveredWorkbenchConnections(
                            webSession.currentProfileId,
                        ),
                    ];
                }
                break;
            }

            case "vscode": {
                reports = await ShellInterface.legacy.importVsCode(
                    webSession.currentProfileId,
                );
                break;
            }

            case "projects": {
                const sourceIds = discovery.projects?.sources.filter((source) => {
                    return source.copyPending || source.issueCount > 0;
                }).map((source) => {
                    return source.id;
                }) ?? [];
                if (sourceIds.length > 0) {
                    reports = await ShellInterface.legacy.importMigrationAssistantProjects({
                        sourceIds,
                        deleteSources: selections.deleteProjectSources,
                        copySshKeys: selections.copyProjectSshKeys,
                        deleteSshKeys: selections.copyProjectSshKeys
                            && selections.deleteProjectSshKeys,
                    });
                }
                break;
            }
        }

        const connectionsImported = reports.some((report) => {
            return (
                report.phase === "workbenchConnections"
                || report.phase === "vscodeConnections"
            ) && report.failed.length === 0;
        });
        if (connectionsImported) {
            await this.props.onConnectionsImported();
        }
        const failed = reports.some((report) => {
            return report.failed.length > 0 || (report.cleanup?.failed.length ?? 0) > 0;
        });
        if (!failed) {
            await this.discover(true);
        }

        return reports;
    };
}
