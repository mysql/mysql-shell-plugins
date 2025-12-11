/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
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

import { Component } from "preact";

import { formatEta } from "./helpers.js";
import { Container, Orientation } from "../../components/ui/Container/Container.js";
import { AnimatedProgressIndicator } from "./AnimatedProgressIndicator.js";

import {
    IWorkStageInfo,
    WorkStatus
} from "../../communication/ProtocolMigration.js";
import { LogBox } from "./LogBox.js";

interface IWorkProgressProps {
    help: string;
    type: string;
    workStage?: IWorkStageInfo;
    active: boolean;
    output?: string;
}

export class WorkProgressView extends Component<IWorkProgressProps> {
    public static override defaultProps: Partial<IWorkProgressProps> = {
    };

    public override render() {
        const { help, type, workStage, active, output } = this.props;
        if (!workStage) {
            return null;
        }

        const decimalPoints = type === "progress-precise" ? 2 : 0;
        const status = workStage.status;
        let progress = 0;

        if (status === WorkStatus.FINISHED) {
            progress = 100;
        } else if (workStage.current !== null && workStage.total) {
            progress = (workStage.current * 100 / workStage.total);
        }

        return (
            <div className={"work-progress-view"}>
                <p dangerouslySetInnerHTML={{ __html: help }} className="comment"></p>
                <div className={`progress-wrapper ${(active && status === WorkStatus.IN_PROGRESS)
                    ? "animated" : "static"}`}>
                    Progress:
                    <Container orientation={Orientation.LeftToRight} className="progress-line">
                        <AnimatedProgressIndicator
                            progress={progress}
                            width={300}
                            active={status === WorkStatus.IN_PROGRESS}
                        />
                        <div>
                            {(progress).toFixed(decimalPoints)}%
                        </div>
                        <div>
                            {formatEta(workStage.eta)}
                        </div>
                    </Container>
                </div>
                <p>
                    {workStage.message}
                </p>

                {workStage.errors.map((err) => {
                    return (<p>{err}</p>);
                })}

                {output !== undefined &&
                    <LogBox title="Task Output" height={400} collapsedText={`${workStage.logItems} lines`}>
                        {output}
                    </LogBox>}
            </div>
        );

    }
}
