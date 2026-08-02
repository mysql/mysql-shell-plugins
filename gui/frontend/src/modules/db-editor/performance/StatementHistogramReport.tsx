/*
 * Copyright (c) 2026, Oracle and/or its affiliates.
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

import {
    ComponentBase, ComponentPlacement, IComponentProperties, IComponentState,
} from "../../../components/ui/Component/ComponentBase.js";
import { Container, Orientation } from "../../../components/ui/Container/Container.js";
import { IUIExplainerStep, UIExplainer } from "../../../components/ui/UIExplainer/UIExplainer.js";
import { ProfileState } from "../../../supplement/ProfileState.js";
import {
    IPerformanceReportCapabilities, ShellInterfaceSqlEditor,
} from "../../../supplement/ShellInterface/ShellInterfaceSqlEditor.js";
import {
    IStatementHistogramRow, parseStatementHistogramRows, StatementHistogram, statementHistogramPercentiles,
} from "./StatementHistogram.js";

interface IStatementHistogramReportProperties extends IComponentProperties {
    backend?: ShellInterfaceSqlEditor;
    capabilities?: IPerformanceReportCapabilities;
}

interface IStatementHistogramReportState extends IComponentState {
    loading: boolean;
    error?: string;
    rows: IStatementHistogramRow[];
}

export class StatementHistogramReport
    extends ComponentBase<IStatementHistogramReportProperties, IStatementHistogramReportState> {

    private readonly explainerRef = createRef<UIExplainer>();
    private readonly graphRef = createRef<HTMLDivElement>();
    private readonly percentilesRef = createRef<HTMLDivElement>();
    private readonly explainerSteps: IUIExplainerStep[] = [{
        id: "statement-percentiles",
        target: this.percentilesRef,
        title: "Percentiles",
        content: "Each percentile shows the estimated time within which that percentage of statements completed. " +
            "For example, p95 means 95% completed within that time.",
        placement: ComponentPlacement.BottomLeft,
    }, {
        id: "statement-distribution",
        target: this.graphRef,
        title: "Execution-time distribution",
        content: "The bars show how many statements fall within each execution-time range.",
        placement: ComponentPlacement.TopLeft,
    }];
    private requestId = 0;
    private explainerSeen = ProfileState.get("general.statementHistogramExplainerSeen", false);

    public constructor(props: IStatementHistogramReportProperties) {
        super(props);

        this.state = {
            loading: false,
            rows: [],
        };
        this.addHandledProperties("backend", "capabilities");
    }

    public override componentDidMount(): void {
        void this.updateValues();
    }

    public override componentDidUpdate(previousProps: IStatementHistogramReportProperties): void {
        if (previousProps.backend !== this.props.backend || previousProps.capabilities !== this.props.capabilities) {
            void this.updateValues();
        }
    }

    public override componentWillUnmount(): void {
        ++this.requestId;
    }

    public render(): ComponentChild {
        const { error, loading, rows } = this.state;
        const percentiles = statementHistogramPercentiles(rows, true);

        return <Container
            className="performanceDashboardReport statementHistogramReport"
            orientation={Orientation.TopDown}
        >
            {error && <div className="statementHistogramReportError">{error}</div>}
            {!error && loading && rows.length === 0 &&
                <div className="statementHistogramReportEmpty">Loading...</div>}
            {!error && !loading && rows.length === 0 &&
                <div className="statementHistogramReportEmpty">No statement histogram buckets found.</div>}
            {!error && rows.length > 0 &&
                <>
                    <div ref={this.percentilesRef} className="statementHistogramPercentiles">
                        <div className="statementHistogramPercentilesCaption">Percentiles</div>
                        <div className="statementHistogramPercentilesInline">
                            {percentiles.map((card) => {
                                return (
                                    <div
                                        className="statementHistogramPercentileInlineItem"
                                        data-tooltip={card.tooltip}
                                        key={card.label}
                                    >
                                        <span data-tooltip="inherit">{card.label}</span>
                                        <strong data-tooltip="inherit">{card.value}</strong>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div ref={this.graphRef} className="statementHistogramGraphHost">
                        <StatementHistogram
                            id="statementHistogramGraph"
                            rows={rows}
                            global
                        />
                    </div>
                    <UIExplainer
                        ref={this.explainerRef}
                        onClose={this.handleExplainerClose}
                        steps={this.explainerSteps}
                    />
                </>}
        </Container>;
    }

    public refresh(): void {
        void this.updateValues();
    }

    private async updateValues(): Promise<void> {
        const { backend } = this.props;
        if (!backend) {
            return;
        }

        if (this.props.capabilities && (!this.props.capabilities.performanceSchema ||
            !this.props.capabilities.statementHistogram)) {
            ++this.requestId;
            this.setState({
                loading: false,
                error: "Statement Histogram requires the Performance Schema histogram tables.",
                rows: [],
            });

            return;
        }

        const requestId = ++this.requestId;
        this.setState({ loading: true, error: undefined });

        try {
            const result = await backend.executeService(
                "select bucket_timer_low, bucket_timer_high, count_bucket " +
                "from performance_schema.events_statements_histogram_global order by bucket_timer_low",
            );
            if (requestId !== this.requestId) {
                return;
            }

            this.setState({
                loading: false,
                rows: parseStatementHistogramRows(result?.rows),
            }, this.startExplainer);
        } catch (reason) {
            if (requestId !== this.requestId) {
                return;
            }

            this.setState({
                loading: false,
                error: String(reason),
                rows: [],
            });
        }
    }

    private startExplainer = (): void => {
        if (!this.explainerSeen && this.state.rows.length > 0 && !this.explainerRef.current?.isOpen) {
            this.explainerRef.current?.start();
        }
    };

    private handleExplainerClose = (): void => {
        this.explainerSeen = true;
        ProfileState.set("general.statementHistogramExplainerSeen", true);
        ProfileState.saveState();
    };

}
