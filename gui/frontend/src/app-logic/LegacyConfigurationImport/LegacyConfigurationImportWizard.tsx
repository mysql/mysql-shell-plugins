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

import "./LegacyConfigurationImportWizard.css";

import { Component, type ComponentChild, createRef } from "preact";

import mysqlShellExtensionIcon from "../../assets/images/legacy/MySQLShellExtension.png";
import mysqlWorkbenchIcon from "../../assets/images/legacy/MySQLWorkbench-8.0.png";
import { Button } from "../../components/ui/Button/Button.js";
import { CheckState, Checkbox } from "../../components/ui/Checkbox/Checkbox.js";
import { Container, Orientation } from "../../components/ui/Container/Container.js";
import { Dialog } from "../../components/ui/Dialog/Dialog.js";
import { Label } from "../../components/ui/Label/Label.js";
import { Message } from "../../components/ui/Message/Message.js";
import { ProgressIndicator } from "../../components/ui/ProgressIndicator/ProgressIndicator.js";
import { convertErrorToString } from "../../utilities/helpers.js";
import { MessageType } from "../general-types.js";
import type {
    ILegacyConfigurationImportIssue,
    ILegacyConfigurationImportReport,
    ILegacyConfigurationImportSelections,
    ILegacyConfigurationImportWizardProperties,
} from "./LegacyConfigurationImportTypes.js";

type ActionPage = "workbench" | "vscode" | "projects";
type WizardPage = ActionPage | "summary" | "nothing" | "results";

const formatCount = (count: number, singular: string): string => {
    return `${count} ${singular}${count === 1 ? "" : "s"}`;
};

const formatWasWere = (count: number): string => {
    return count === 1 ? "was" : "were";
};

interface ILegacyConfigurationImportWizardState {
    page: WizardPage;
    actionPages: ActionPage[];
    selectedPages: ActionPage[];
    busy: boolean;
    reports: ILegacyConfigurationImportReport[];
    selections: ILegacyConfigurationImportSelections;
    errors: string[];
}

export class LegacyConfigurationImportWizard extends Component<
    ILegacyConfigurationImportWizardProperties,
    ILegacyConfigurationImportWizardState
> {
    private readonly dialogRef = createRef<Dialog>();

    public constructor(props: ILegacyConfigurationImportWizardProperties) {
        super(props);

        const actionPages = this.actionPagesFor(props);
        this.state = {
            page: actionPages[0] ?? "nothing",
            actionPages,
            selectedPages: [...actionPages],
            busy: false,
            reports: [],
            errors: [],
            selections: {
                deleteProjectSources: true,
                copyProjectSshKeys: true,
                deleteProjectSshKeys: true,
            },
        };
    }

    public override componentDidMount(): void {
        this.dialogRef.current?.open({
            closeOnEscape: false,
            closeOnPortalClick: false,
        });
    }

    public render(): ComponentChild {
        const { page } = this.state;

        return (
            <Dialog
                ref={this.dialogRef}
                id="legacyConfigurationImportWizard"
                className="legacyConfigurationImportWizard"
                content={this.renderPage(page)}
                actions={this.renderActions(page)}
                onClose={this.handleDialogClose}
            />
        );
    }

    private actionPagesFor(props: ILegacyConfigurationImportWizardProperties): ActionPage[] {
        const { discovery } = props;
        const pages: ActionPage[] = [];

        if (discovery.workbench && (
            discovery.workbench.connectionsPending
            || discovery.workbench.issues.length > 0
        )) {
            pages.push("workbench");
        }

        if (discovery.vscode && (
            discovery.vscode.connectionsPending
            || discovery.vscode.issues.length > 0
        )) {
            pages.push("vscode");
        }

        if (discovery.projects && (
            discovery.projects.sources.some((source) => {
                return source.copyPending || source.issueCount > 0;
            })
            || discovery.projects.issues.length > 0
        )) {
            pages.push("projects");
        }

        return pages;
    }

    private renderActions(page: WizardPage): {
        end: ComponentChild[];
    } {
        const { busy } = this.state;
        if (page === "results") {
            return {
                end: [<Button
                    id="legacyConfigurationImportClose"
                    key="close"
                    caption="Close"
                    isDefault
                    onClick={this.closeResults}
                />],
            };
        }

        if (page === "nothing") {
            return {
                end: [<Button
                    id="legacyConfigurationImportClose"
                    key="close"
                    caption="Close"
                    isDefault
                    onClick={this.closeWithoutImport}
                />],
            };
        }

        if (page === "summary") {
            return {
                end: [
                    <Button
                        id="legacyConfigurationImportStart"
                        key="import"
                        caption="Import"
                        isDefault
                        disabled={busy}
                        onClick={this.startImport}
                    />,
                    <Button
                        id="legacyConfigurationImportBack"
                        key="back"
                        caption="< Back"
                        disabled={busy}
                        onClick={this.goBackFromSummary}
                    />,
                    <Button
                        id="legacyConfigurationImportCancel"
                        key="cancel"
                        caption="Cancel"
                        disabled={busy}
                        onClick={this.cancel}
                    />,
                ],
            };
        }

        return {
            end: [
                <Button
                    id="legacyConfigurationImportNext"
                    key="next"
                    caption="Next >"
                    isDefault
                    disabled={busy}
                    onClick={this.includePage}
                />,
                <Button
                    id="legacyConfigurationImportBack"
                    key="back"
                    caption="< Back"
                    disabled={busy || this.state.actionPages.indexOf(page) === 0}
                    onClick={this.goBack}
                />,
                <Button
                    id="legacyConfigurationImportCancel"
                    key="cancel"
                    caption="Cancel"
                    onClick={this.cancel}
                />,
            ],
        };
    }

    private renderPage(page: WizardPage): ComponentChild {
        const { busy, errors } = this.state;

        return (
            <Container className="legacyConfigurationImportPage" orientation={Orientation.TopDown}>
                {this.renderPageContent(page)}
                {errors.length > 0 &&
                    <Message id="legacyConfigurationImportError" type={MessageType.Error}>
                        {errors.length === 1
                            ? errors[0]
                            : <ul className="legacyConfigurationImportIssues">
                                {errors.map((error, index) => {
                                    return <li key={`${index}-${error}`}>{error}</li>;
                                })}
                            </ul>}
                    </Message>}
                {busy && <ProgressIndicator
                    id="legacyConfigurationImportProgress"
                    className="legacyConfigurationImportProgress"
                    indicatorWidth={36}
                    indicatorHeight={36}
                    stroke={3}
                />}
            </Container>
        );
    }

    private renderPageContent(page: WizardPage): ComponentChild {
        switch (page) {
            case "workbench": {
                return this.renderWorkbench();
            }

            case "vscode": {
                return this.renderVsCode();
            }

            case "projects": {
                return this.renderProjects();
            }

            case "summary": {
                return this.renderSummary();
            }

            case "nothing": {
                return <>
                    <h2>Nothing to import</h2>
                    <Label caption="No configuration import actions were selected." />
                </>;
            }

            case "results": {
                return this.renderResults();
            }
        }
    }

    private renderWorkbench(): ComponentChild {
        const { discovery } = this.props;
        const workbench = discovery.workbench;

        if (!workbench) {
            return null;
        }

        return (
            <>
                <img
                    className="legacyConfigurationImportPageIcon"
                    src={mysqlWorkbenchIcon}
                    alt="MySQL Workbench 8"
                />
                <h2>Import MySQL Workbench 8 Connections</h2>
                <div className="legacyConfigurationImportInventory">
                    <Label
                        caption={`${formatCount(workbench.connectionCount, "connection definition")} `
                            + `${formatWasWere(workbench.connectionCount)} found.`}
                    />
                    {this.renderIssues(workbench.issues)}
                </div>
                <div className="legacyConfigurationImportPageBottom">
                    {this.renderPageSelection("workbench", "Import MySQL Workbench 8 connections")}
                    <div className="legacyConfigurationImportPageBottomDetails">
                        <Label caption="Note: passwords will not be imported." />
                    </div>
                </div>
            </>
        );
    }

    private renderVsCode(): ComponentChild {
        const { vscode } = this.props.discovery;
        if (!vscode) {
            return null;
        }

        return (
            <>
                <img
                    className="legacyConfigurationImportPageIcon"
                    src={mysqlShellExtensionIcon}
                    alt="MySQL Shell for VS Code"
                />
                <h2>Import MySQL Shell for VS Code Connections</h2>
                <div className="legacyConfigurationImportInventory">
                    {vscode.connectionsPending
                        ? <Label
                            caption={`${formatCount(vscode.connectionCount, "connection definition")} `
                                + `${formatWasWere(vscode.connectionCount)} found.`}
                        />
                        : null}
                    {this.renderIssues(vscode.issues)}
                </div>
                <div className="legacyConfigurationImportPageBottom">
                    {this.renderPageSelection("vscode", "Import MySQL Shell for VS Code data")}
                    <div className="legacyConfigurationImportPageBottomDetails">
                        <Label caption="Old VS Code extension logs will be deleted after import." />
                        <Label caption="Saved passwords remain available to both applications." />
                    </div>
                </div>
            </>
        );
    }

    private renderProjects(): ComponentChild {
        const { projects } = this.props.discovery;
        const { selections } = this.state;

        if (!projects) {
            return null;
        }

        const projectCount = projects.sources.reduce((count, source) => {
            return count + source.projectCount;
        }, 0);
        const invalidCount = projects.sources.reduce((count, source) => {
            return count + source.issueCount;
        }, 0);

        return (
            <>
                <h2>Import Migration Assistant Projects</h2>
                <div className="legacyConfigurationImportInventory">
                    <Label
                        caption={`${formatCount(projectCount, "migration assistant project")} `
                            + `${formatWasWere(projectCount)} found.`}
                    />
                    <Label
                        caption={`${formatCount(projects.sshKeyCount, "SSH key")} for OCI jump host `
                            + `${projects.sshKeyCount === 1 ? "instance was" : "instances were"} found.`}
                    />
                    {invalidCount > 0 &&
                        <Label
                            caption={`${formatCount(invalidCount, "project")} could not be validated`}
                        />}
                    {this.renderIssues(projects.issues)}
                </div>
                <div className="legacyConfigurationImportPageBottom">
                    {this.renderPageSelection(
                        "projects",
                        "Import Migration Assistant projects and SSH keys",
                    )}
                    <div className="legacyConfigurationImportPageBottomDetails">
                        <Checkbox
                            id="deleteProjectSources"
                            caption="Delete original Migration Assistant project files"
                            checkState={selections.deleteProjectSources
                                ? CheckState.Checked
                                : CheckState.Unchecked}
                            onChange={this.toggleProjectSourceDeletion}
                        />
                        <Checkbox
                            id="copyProjectSshKeys"
                            caption="Copy SSH keys for jump host instances"
                            checkState={selections.copyProjectSshKeys
                                ? CheckState.Checked
                                : CheckState.Unchecked}
                            onChange={this.toggleProjectSshKeyCopy}
                        />
                        <Checkbox
                            id="deleteProjectSshKeys"
                            caption="Delete original SSH keys after copying"
                            checkState={selections.deleteProjectSshKeys
                                ? CheckState.Checked
                                : CheckState.Unchecked}
                            disabled={!selections.copyProjectSshKeys}
                            onChange={this.toggleProjectSshKeyDeletion}
                        />
                    </div>
                </div>
            </>
        );
    }

    private renderSummary(): ComponentChild {
        const items = this.selectedSummaryItems();

        return (
            <>
                <h2>Import Summary</h2>
                <Label caption="The following actions will be performed when Import is clicked:" />
                <ul className="legacyConfigurationImportSummaryActions">
                    {items.map((item) => {
                        return <li key={item}>{item}</li>;
                    })}
                </ul>
            </>
        );
    }

    private renderResults(): ComponentChild {
        const { reports } = this.state;

        return (
            <>
                <h2>Import results</h2>
                {reports.length === 0
                    ? <Label caption="No import actions were completed." />
                    : reports.map((report, index) => {
                        const source = report.sourceId
                            ? ` (${this.sourceLabel(report.sourceId)})`
                            : "";
                        const cleanupOnly = report.phase === "vscodeLogCleanup";
                        const cleanupItem = report.phase === "vscodeLogCleanup"
                            ? "log file"
                            : "source item";

                        return (
                            <section
                                className="legacyConfigurationImportReport"
                                key={`${report.phase}-${report.sourceId ?? index}`}
                            >
                                <h3>{this.phaseCaption(report.phase)}{source}</h3>
                                {!cleanupOnly &&
                                    <Label caption={[
                                        `${report.imported} imported`,
                                        `${report.merged} merged`,
                                        `${report.skipped} skipped`,
                                    ].join(", ")} />}
                                {report.cleanup &&
                                    <Label caption={`${formatCount(report.cleanup.deleted, cleanupItem)} deleted; `
                                        + `${report.cleanup.retained} retained.`} />}
                                {this.renderIssues(report.warnings)}
                                {this.renderIssues(report.failed)}
                                {report.cleanup && this.renderIssues(report.cleanup.failed)}
                            </section>
                        );
                    })}
            </>
        );
    }

    private selectedSummaryItems(): string[] {
        return this.state.selectedPages.flatMap((page) => {
            return this.summaryItems(page);
        });
    }

    private summaryItems(page: ActionPage): string[] {
        const { discovery } = this.props;
        const { selections } = this.state;
        const items: string[] = [];

        switch (page) {
            case "workbench": {
                const workbench = discovery.workbench;
                if (!workbench) {
                    break;
                }
                if (workbench.connectionsPending) {
                    items.push(`Import ${formatCount(
                        workbench.connectionCount,
                        "MySQL Workbench 8 connection definition",
                    )}`);
                }
                if (items.length === 0 && workbench.issues.length > 0) {
                    items.push("Retry the MySQL Workbench 8 configuration import");
                }
                break;
            }

            case "vscode": {
                const vscode = discovery.vscode;
                if (!vscode) {
                    break;
                }
                if (vscode.connectionsPending) {
                    items.push(`Import ${formatCount(
                        vscode.connectionCount,
                        "MySQL Shell for VS Code connection definition",
                    )}`);
                }
                if (vscode.connectionsPending && vscode.logFileCount > 0) {
                    items.push(`Delete ${formatCount(
                        vscode.logFileCount,
                        "old VS Code extension log file",
                    )}`);
                }
                if (items.length === 0 && vscode.issues.length > 0) {
                    items.push("Retry the MySQL Shell for VS Code configuration import");
                }
                break;
            }

            case "projects": {
                const projects = discovery.projects;
                if (!projects) {
                    break;
                }
                const projectCount = projects.sources.reduce((count, source) => {
                    return count + source.projectCount;
                }, 0);
                const copyPending = projects.sources.some((source) => {
                    return source.copyPending;
                });
                if (copyPending && projectCount > 0) {
                    items.push(`Import ${formatCount(projectCount, "Migration Assistant project")}`);
                }
                if (selections.deleteProjectSources && projectCount > 0) {
                    items.push("Delete original Migration Assistant project files");
                }
                if (
                    copyPending
                    && selections.copyProjectSshKeys
                    && projects.sshKeyCount > 0
                ) {
                    items.push(`Copy ${formatCount(
                        projects.sshKeyCount,
                        "SSH key",
                    )} for jump host instances`);
                }
                if (
                    selections.copyProjectSshKeys
                    && selections.deleteProjectSshKeys
                    && projects.sshKeyCount > 0
                ) {
                    items.push("Delete original SSH keys after copying");
                }
                if (items.length === 0 && projects.issues.length > 0) {
                    items.push("Retry the Migration Assistant project import");
                }
                break;
            }
        }

        return items;
    }

    private phaseCaption(phase: ILegacyConfigurationImportReport["phase"]): string {
        switch (phase) {
            case "workbenchConnections": {
                return "MySQL Workbench";
            }

            case "vscodeConnections": {
                return "MySQL Shell for VS Code";
            }

            case "vscodeLogCleanup": {
                return "MySQL Shell for VS Code logs";
            }

            case "migrationAssistantProjects": {
                return "Migration Assistant";
            }
        }
    }

    private sourceLabel(sourceId: string): string {
        return this.props.discovery.projects?.sources.find((source) => {
            return source.id === sourceId;
        })?.label ?? sourceId;
    }

    private renderIssues(issues: ILegacyConfigurationImportIssue[]): ComponentChild {
        if (issues.length === 0) {
            return null;
        }

        return (
            <ul className="legacyConfigurationImportIssues">
                {issues.map((issue) => {
                    return <li key={`${issue.item}-${issue.message}`}>{issue.item}: {issue.message}</li>;
                })}
            </ul>
        );
    }

    private renderPageSelection(page: ActionPage, caption: string): ComponentChild {
        return <Checkbox
            id={`includeLegacyConfigurationImport${page[0].toUpperCase()}${page.slice(1)}`}
            caption={caption}
            checkState={this.state.selectedPages.includes(page)
                ? CheckState.Checked
                : CheckState.Unchecked}
            onChange={(checkState) => {
                this.togglePageSelection(page, checkState);
            }}
        />;
    }

    private togglePageSelection = (page: ActionPage, checkState: CheckState): void => {
        const selected = checkState === CheckState.Checked;
        this.setState((state) => {
            return {
                selectedPages: state.actionPages.filter((actionPage) => {
                    return actionPage === page
                        ? selected
                        : state.selectedPages.includes(actionPage);
                }),
            };
        });
    };

    private includePage = (): void => {
        const { actionPages, page, selectedPages } = this.state;
        if (page !== "workbench" && page !== "vscode" && page !== "projects") {
            return;
        }

        const pageIndex = actionPages.indexOf(page);
        const nextPage = pageIndex < actionPages.length - 1
            ? actionPages[pageIndex + 1]
            : selectedPages.flatMap((selectedPage) => {
                return this.summaryItemsForSelections(
                    selectedPage,
                    selectedPages,
                );
            }).length > 0
                ? "summary"
                : "nothing";
        this.setState({
            page: nextPage,
            errors: [],
        });
    };

    private goBack = (): void => {
        const { actionPages, page } = this.state;
        if (page !== "workbench" && page !== "vscode" && page !== "projects") {
            return;
        }

        const pageIndex = actionPages.indexOf(page);
        if (pageIndex > 0) {
            this.setState({
                page: actionPages[pageIndex - 1],
                errors: [],
            });
        }
    };

    private goBackFromSummary = (): void => {
        const { actionPages } = this.state;
        const previousPage = actionPages[actionPages.length - 1];
        this.setState({
            page: previousPage,
            errors: [],
        });
    };

    private summaryItemsForSelections(
        page: ActionPage,
        selectedPages: ActionPage[],
    ): string[] {
        if (!selectedPages.includes(page)) {
            return [];
        }

        return this.summaryItems(page);
    }

    private startImport = (): void => {
        const executablePages = this.state.selectedPages.filter((page) => {
            return this.summaryItems(page).length > 0;
        });
        this.setState({
            busy: true,
            reports: [],
            errors: [],
        });
        void this.runPages(executablePages);
    };

    private async runPages(pages: ActionPage[]): Promise<void> {
        const reports: ILegacyConfigurationImportReport[] = [];
        const errors: string[] = [];

        for (const page of pages) {
            try {
                const pageReports = await this.props.onRunPage(
                    page,
                    this.state.selections,
                );
                reports.push(...pageReports);
                const failed = pageReports.some((report) => {
                    return report.failed.length > 0
                        || (report.cleanup?.failed.length ?? 0) > 0;
                });
                if (failed) {
                    break;
                }
            } catch (reason) {
                errors.push(convertErrorToString(reason));
                break;
            }
        }

        this.setState({
            page: "results",
            busy: false,
            reports,
            errors,
        });
    }

    private closeResults = (): void => {
        this.props.onClose(true);
        this.dialogRef.current?.close(false);
    };

    private closeWithoutImport = (): void => {
        this.props.onClose(false);
        this.dialogRef.current?.close(false);
    };

    private cancel = (): void => {
        this.dialogRef.current?.close(true);
    };

    private handleDialogClose = (cancelled: boolean): void => {
        if (cancelled) {
            this.props.onClose(false);
        }
    };

    private toggleProjectSourceDeletion = (checkState: CheckState): void => {
        this.updateSelection("deleteProjectSources", checkState);
    };

    private toggleProjectSshKeyCopy = (checkState: CheckState): void => {
        const enabled = checkState === CheckState.Checked;
        this.setState((state) => {
            return {
                selections: {
                    ...state.selections,
                    copyProjectSshKeys: enabled,
                    deleteProjectSshKeys: enabled && state.selections.deleteProjectSshKeys,
                },
            };
        });
    };

    private toggleProjectSshKeyDeletion = (checkState: CheckState): void => {
        this.updateSelection("deleteProjectSshKeys", checkState);
    };

    private updateSelection(
        key: "deleteProjectSources"
            | "deleteProjectSshKeys",
        checkState: CheckState,
    ): void {
        this.setState((state) => {
            return {
                selections: {
                    ...state.selections,
                    [key]: checkState === CheckState.Checked,
                },
            };
        });
    }
}
