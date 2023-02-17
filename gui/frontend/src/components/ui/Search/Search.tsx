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

import "./Search.css";

import { ComponentChild, createRef } from "preact";

import { ComponentBase, IComponentProperties } from "../Component/ComponentBase";
import { Codicon } from "../Codicon";
import { Container, Orientation } from "../Container/Container";
import { Icon } from "../Icon/Icon";
import { Input } from "../Input/Input";
import { Label } from "../Label/Label";
import { Button } from "../Button/Button";

// Input and output structure for search data.
export interface ISearchValues {
    value?: string;
    matchCase?: boolean;
    matchWholeWord?: boolean;
    useRegExp?: boolean;
}

export interface ISearchProperties extends IComponentProperties {
    placeholder?: string;
    autoFocus?: boolean;
    result?: string;

    buttons?: {
        matchChase?: boolean;
        matchWholeWord?: boolean;
        useRegExp?: boolean;
        clearAll?: boolean;
    };

    values?: ISearchValues;

    onChange?: (e: UIEvent, props: ISearchProperties, result: ISearchValues) => void;
    onConfirm?: (e: UIEvent, props: ISearchProperties, result: ISearchValues) => void;
}

export class Search extends ComponentBase<ISearchProperties> {

    private inputRef = createRef<HTMLInputElement>();

    public constructor(props: ISearchProperties) {
        super(props);

        this.addHandledProperties("placeholder", "autoFocus", "result", "buttons", "values", "onChange", "onConfirm");
    }

    public componentDidUpdate(): void {
        const { autoFocus } = this.mergedProps;
        if (autoFocus && this.inputRef.current) {
            this.inputRef.current.focus();
        }
    }

    public render(): ComponentChild {
        const { placeholder = "Search", values, autoFocus, result, buttons } = this.mergedProps;
        const className = this.getEffectiveClassNames(["search"]);

        return (
            <Container
                className="searchContainer"
                orientation={Orientation.LeftToRight}
                {...this.unhandledProperties}
            >
                <Input
                    id="search"
                    className={className}
                    placeholder={placeholder}
                    value={values?.value}
                    autoFocus={autoFocus}
                    onChange={this.handleChange}
                    onConfirm={this.handleConfirm}
                />
                {
                    result && <Label
                        id="searchResult"
                        data-tooltip="Search Result"
                    >
                        {result}
                    </Label>
                }
                {
                    buttons?.matchChase && <Button
                        id="toggleCase"
                        className={values?.matchCase ? "active" : undefined}
                        search-type="option"
                        data-tooltip="Match Case"
                        onClick={this.handleButtonClick}
                    >
                        <Icon src={Codicon.CaseSensitive} />
                    </Button>
                }
                {
                    buttons?.matchWholeWord && <Button
                        id="toggleWhole"
                        className={values?.matchWholeWord ? "active" : undefined}
                        search-type="option"
                        data-tooltip="Match Whole Word"
                        imageOnly={true}
                        onClick={this.handleButtonClick}
                    >
                        <Icon src={Codicon.WholeWord} />
                    </Button>
                }
                {
                    buttons?.useRegExp && <Button
                        id="toggleRegExp"
                        className={values?.useRegExp ? "active" : undefined}
                        search-type="option"
                        data-tooltip="Use Regular Expression"
                        onClick={this.handleButtonClick}
                    >
                        <Icon src={Codicon.Regex} />
                    </Button>
                }
                {
                    buttons?.clearAll && <Button
                        id="clearAll"
                        disabled={(values?.value ?? "").length === 0}
                        data-tooltip="Clear Search Input"
                        onClick={this.handleButtonClick}
                    >
                        <Icon src={Codicon.ClearAll} />
                    </Button>
                }
            </Container>
        );
    }

    private handleChange = (e: InputEvent): void => {
        const { values } = this.mergedProps;

        const value = (e.target as HTMLInputElement).value;
        this.sendChange(e, {
            value,
            matchCase: values?.matchCase,
            matchWholeWord: values?.matchWholeWord,
            useRegExp: values?.useRegExp,
        });
    };

    private handleConfirm = (e: KeyboardEvent): void => {
        this.sendChange(e);
    };

    private handleButtonClick = (e: MouseEvent | KeyboardEvent): void => {
        const { values } = this.mergedProps;

        if (e.currentTarget && "id" in e.currentTarget) {
            switch (e.currentTarget?.id) {
                case "toggleCase": {
                    this.sendChange(e, { matchCase: !(values?.matchCase ?? false) });
                    break;
                }

                case "toggleWhole": {
                    this.sendChange(e, { matchWholeWord: !(values?.matchWholeWord ?? false) });
                    break;
                }

                case "toggleRegExp": {
                    this.sendChange(e, { useRegExp: !(values?.useRegExp ?? false) });
                    break;
                }

                case "clearAll": {
                    this.sendChange(e, { value: "" });

                    break;
                }

                default: {
                    break;
                }
            }
        }
    };

    private sendChange = (e: UIEvent, change?: ISearchValues): void => {
        const { values, onChange, onConfirm } = this.mergedProps;

        if (change) {
            onChange?.(e, this.mergedProps, {
                value: change.value ?? values?.value,
                matchCase: change.matchCase === undefined ? values?.matchCase : change.matchCase,
                matchWholeWord: change.matchWholeWord === undefined ? values?.matchWholeWord : change.matchWholeWord,
                useRegExp: change.useRegExp === undefined ? values?.useRegExp : change.useRegExp,
            });
        } else {
            onConfirm?.(e, this.mergedProps, values ?? {});
        }
    };

}
