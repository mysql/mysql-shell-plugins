/*
 * Copyright (c) 2020, 2023, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0,
 * as published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms, as
 * designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an additional
 * permission to link the program and your derivative works with the
 * separately licensed software that they have included with MySQL.
 * This program is distributed in the hope that it will be useful,  but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See
 * the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301 USA
 */

import { ComponentChild, createRef } from "preact";

import { ITextResultEntry } from "../../script-execution";
import { requisitions } from "../../supplement/Requisitions";
import { IComponentProperties, ComponentBase } from "../ui/Component/ComponentBase";
import { Label } from "../ui/Label/Label";

interface IActionOutputProperties extends IComponentProperties {
    /** The output to display. */
    output?: ITextResultEntry[];

    /** The ID of the executing context. */
    contextId: string;

    /** Show label indexes only when this is set to true (default: false). */
    showIndexes?: boolean;
}

/**
 * A component to render a list of formatted labels with optional numbering and timestamp.
 * If given a line index and execution context ID for a label, this label becomes clickable and wil trigger
 * a callback for further processing this event.
 */
export class ActionOutput extends ComponentBase<IActionOutputProperties> {

    private gridRef = createRef<HTMLDivElement>();

    public constructor(props: IActionOutputProperties) {
        super(props);

        this.addHandledProperties("output", "contextId", "showIndexes", "onLabelClick");
    }

    public componentDidUpdate(): void {
        const lastChild = this.gridRef.current?.lastElementChild;

        /* istanbul ignore next */
        if (lastChild && "scrollIntoView" in lastChild) {
            lastChild.scrollIntoView();
        }
    }

    public render(): ComponentChild {
        const { output, showIndexes = false } = this.props;
        const className = this.getEffectiveClassNames(["actionOutput"]);

        // Note: no GridCell instance is used, as we always have only one entry per cell.
        const rows: ComponentChild[] = [];
        const canShowIndexes = showIndexes && output && output.length > 1;
        output?.forEach((entry) => {
            const index = entry.index !== undefined && entry.index >= 0 ? entry.index : undefined;
            const cells: ComponentChild[] = [];

            let columnSpan = 1;
            if (index !== undefined && canShowIndexes) {
                cells.push(
                    <Label className="commandIndex" caption={`#${index + 1}: `} />,
                );
            } else {
                columnSpan = 2;
            }

            cells.push(<Label
                className={`actionLabel${index === undefined ? "" : " clickable"}`}
                id={index?.toString()}
                language={entry.language ?? "ansi"}
                key={entry.resultId}
                caption={entry.content}
                type={entry.type}
                style={{ gridColumn: `span ${columnSpan}` }}
                tabIndex={index === undefined ? -1 : 0}
                onClick={this.handleLabelClick}
            />);

            rows.push(
                <div style={{ display: "flex", gap: "2px", flexDirection: "row" }}>
                    {cells}
                </div>);
        });

        return (
            <div className={className} style={{ display: "flex", gap: "2px", flexDirection: "column" }}>
                {rows}
            </div>
        );
    }

    private handleLabelClick = (e: MouseEvent | KeyboardEvent): void => {
        // The event may be sent from a child element of the label (because of auto generated content, depending
        // on the text language specified in the render call above). That's why we walk up to find the label.
        let label: HTMLLabelElement | undefined;
        for (const element of e.composedPath()) {
            const target = element as HTMLElement;
            if (target.classList.contains("actionLabel")) {
                label = target as HTMLLabelElement;
                break;
            }
        }

        if (label && label.id) {
            const { contextId } = this.props;

            void requisitions.execute("editorSelectStatement", { contextId, statementIndex: parseInt(label.id, 10) });
        }
    };
}
