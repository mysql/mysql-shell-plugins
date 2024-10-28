/*
 * Copyright (c) 2020, 2024, Oracle and/or its affiliates.
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

import { ComponentChild, createRef } from "preact";

import { ITextResultEntry } from "../../script-execution/index.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { Button } from "../ui/Button/Button.js";
import { Codicon } from "../ui/Codicon.js";
import { IComponentProperties, ComponentBase } from "../ui/Component/ComponentBase.js";
import { Container, Orientation } from "../ui/Container/Container.js";
import { Icon } from "../ui/Icon/Icon.js";
import { JsonView } from "../ui/JsonView/JsonView.js";
import { Label } from "../ui/Label/Label.js";

// Have to declare this here because the type definition is missing in the TypeScript standard library:

// eslint-disable-next-line @typescript-eslint/naming-convention
interface CaretPosition {
    offsetNode: Node;
    offset: number;
}

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

    private outputRef = createRef<HTMLDivElement>();

    // When set to true, a selection process is ongoing. We have to do this manually because
    // simply setting user-select has no effect in certain browsers (e.g. Safari and Chrome)
    private trackingSelection = false;

    public constructor(props: IActionOutputProperties) {
        super(props);

        this.addHandledProperties("output", "contextId", "showIndexes", "onLabelClick");
    }

    public override componentDidUpdate(): void {
        const lastChild = this.outputRef.current?.lastElementChild;

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

            let useLabel = false;

            try {
                // Avoid throwing an exception for something which is obviously not JSON.
                if (entry.content.match(/^\s*{/)) {
                    const json = JSON.parse(entry.content);
                    cells.push(<JsonView json={json} />);
                } else {
                    useLabel = true;
                }
            } catch (e) {
                useLabel = true;
            }

            if (useLabel) {
                cells.push(<Label
                    className={`actionLabel${index === undefined ? "" : " clickable"}`}
                    id={index?.toString()}
                    language={entry.language ?? "ansi"}
                    key={entry.resultId}
                    caption={entry.content}
                    type={entry.type}
                    style={{ gridColumn: `span ${columnSpan}` }}
                    tabIndex={index === undefined ? -1 : 0}
                    data-tooltip={undefined}
                    onClick={this.handleLabelClick}
                />);
            }

            rows.push(
                <div className="actionRow">
                    {cells}
                </div>);
        });

        return (
            <>
                <Button
                    className="copyButton"
                    data-tooltip="Copy result to clipboard"
                    imageOnly
                    focusOnClick={false}
                    tabIndex={-1}
                    onPointerDown={this.copyToClipboard}
                >
                    <Icon src={Codicon.Copy} data-tooltip="inherit" />
                </Button>
                <Container
                    innerRef={this.outputRef}
                    orientation={Orientation.TopDown}
                    className={className}
                    onPointerDown={this.handlePointerDown}
                    onPointerMove={this.handlePointerMove}
                    onPointerUp={this.handlePointerUp}
                >
                    {rows}
                </Container>
            </>
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

    /**
     * Implements our special selection handling for render targets. Ths is needed because by default monaco-editor
     * does not allow to select text in view zones and simply enabling user-select on the render target does not work.
     *
     * @param e The mouse event.
     */
    private handlePointerDown = (e: PointerEvent): void => {
        if (e.buttons === 1) {
            const element = e.target as HTMLElement;
            element.focus();

            this.trackingSelection = true;
            const range = this.getMouseEventCaretRange(e);
            if (range !== null) {
                this.selectTextRange(range);
                element.setPointerCapture(e.pointerId);
            }
        }

    };

    private handlePointerMove = (e: PointerEvent): void => {
        if (this.trackingSelection) {
            const selection = window.getSelection();
            if (selection) {
                const range = this.getMouseEventCaretRange(e);
                if (range !== null) {
                    selection.extend(range.startContainer, range.startOffset);
                }
            }
        }
    };

    private handlePointerUp = (e: PointerEvent): void => {
        if (e.buttons === 0) {
            this.trackingSelection = false;
            const element = e.target as HTMLElement;
            element.releasePointerCapture(e.pointerId);
        }
    };

    /**
     * Retrieve the range of text under the mouse pointer.
     *
     * @param e The mouse event from which to get the position.
     *
     * @returns The range of text under the mouse pointer, or null if the position doesn't contain a text node.
     */
    private getMouseEventCaretRange = (e: PointerEvent): globalThis.Range | null => {
        let range;
        const x = e.clientX;
        const y = e.clientY;

        if ("caretPositionFromPoint" in document) {
            // See https://developer.mozilla.org/en-US/docs/Web/API/DocumentOrShadowRoot/caretPositionFromPoint.
            const caretPosition = (document.caretPositionFromPoint as (x: number, y: number) => CaretPosition)(x, y);

            // Convert the caret position to a range.
            range = document.createRange();
            range.setStart(caretPosition.offsetNode, caretPosition.offset);
        } else {
            range = document.caretRangeFromPoint(x, y);
        }

        return range;
    };

    private selectTextRange = (range: globalThis.Range): void => {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
    };

    private copyToClipboard = (): void => {
        if (this.outputRef.current) {
            const selection = window.getSelection();
            let text = selection?.toString() ?? "";
            if (text === "") {
                text = this.outputRef.current.innerText ?? "";
            }

            if (text.length > 0) {
                requisitions.writeToClipboard(text);
            }
        }
    };

}
