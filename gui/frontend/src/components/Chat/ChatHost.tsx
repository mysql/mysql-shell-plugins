/*
 * Copyright (c) 2024, 2025, Oracle and/or its affiliates.
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

import "./ChatHost.css";

import { ComponentChild } from "preact";

import { IMdsChatData } from "../../communication/ProtocolMds.js";
import { Assets } from "../../supplement/Assets.js";
import { requisitions } from "../../supplement/Requisitions.js";
import { Button } from "../ui/Button/Button.js";
import { ComponentBase, IComponentProperties, IComponentState } from "../ui/Component/ComponentBase.js";
import { Container, Orientation } from "../ui/Container/Container.js";
import { Icon } from "../ui/Icon/Icon.js";
import { Label } from "../ui/Label/Label.js";

export enum ChatAction {
    Execute,
    UpdateOptions,
}

export interface IChatHostProperties extends IComponentProperties {
    info?: string,
    error?: string,
    answer?: string,
    options?: IMdsChatData,
    onAction: (action: ChatAction, options?: IMdsChatData) => void,
    onUpdateOptions?: (options: IDictionary) => void,
}

export interface IChatHostState extends IComponentState {
}

export class ChatHost extends ComponentBase<IChatHostProperties, IChatHostState> {

    public constructor(props: IChatHostProperties) {
        super(props);

        this.addHandledProperties("info", "error", "answer", "options", "onAction", "onUpdateOptions");
    }

    public render(): ComponentChild {
        const { answer, info, error } = this.props;

        return (
            <Container className={this.getEffectiveClassNames(["chatResultPanel"])}>
                <Container className="chatResultAreaContainer" orientation={Orientation.TopDown}>
                    <Container className="chatResultTextContainer" orientation={Orientation.TopDown}>
                        <Container className="scopeToolbar" orientation={Orientation.RightToLeft}>
                            <Button className="chatScopeBtn" onClick={this.handleRefineChatScopeClick} imageOnly={true}
                            >
                                <Icon
                                    src={Assets.lakehouse.chatOptionsIcon}
                                    id="ChatOptionsIcon"
                                    data-tooltip="inherit"
                                />
                            </Button>
                        </Container>
                        {(answer !== undefined) &&
                            <Label className="chatResultText" language="ansi">
                                {answer}</Label>
                        }
                    </Container>
                    {(info !== undefined) &&
                        <Label className="chatResultInfo">{info}</Label>
                    }
                    {(error !== undefined) &&
                        <Label className="chatResultError">{error}</Label>
                    }
                </Container>
            </Container>
        );
    }

    private handleRefineChatScopeClick = (): void => {
        void requisitions.execute("showChatOptions", undefined);
    };
}
