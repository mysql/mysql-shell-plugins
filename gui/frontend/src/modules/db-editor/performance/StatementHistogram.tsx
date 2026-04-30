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

import { ComponentChild } from "preact";

import { ComponentBase, IComponentProperties } from "../../../components/ui/Component/ComponentBase.js";

export interface IStatementHistogramRow {
    label: string;
    timerLow: number;
    timerHigh?: number;
    observedTimerHigh?: number;
    countBucket: number;
}

export interface IStatementHistogramPercentile {
    label: string;
    tooltip: string;
    value: string;
}

interface IStatementHistogramProperties extends IComponentProperties {
    rows: IStatementHistogramRow[];
    global?: boolean;
}

const buckets: Array<Omit<IStatementHistogramRow, "countBucket">> = [
    { label: "< 100 µs", timerLow: 0, timerHigh: 100_000_000 },
    { label: "100–250 µs", timerLow: 100_000_000, timerHigh: 250_000_000 },
    { label: "250–500 µs", timerLow: 250_000_000, timerHigh: 500_000_000 },
    { label: "500 µs–1 ms", timerLow: 500_000_000, timerHigh: 1_000_000_000 },
    { label: "1–2 ms", timerLow: 1_000_000_000, timerHigh: 2_000_000_000 },
    { label: "2–5 ms", timerLow: 2_000_000_000, timerHigh: 5_000_000_000 },
    { label: "5–10 ms", timerLow: 5_000_000_000, timerHigh: 10_000_000_000 },
    { label: "10–20 ms", timerLow: 10_000_000_000, timerHigh: 20_000_000_000 },
    { label: "20–50 ms", timerLow: 20_000_000_000, timerHigh: 50_000_000_000 },
    { label: "50–100 ms", timerLow: 50_000_000_000, timerHigh: 100_000_000_000 },
    { label: "100–250 ms", timerLow: 100_000_000_000, timerHigh: 250_000_000_000 },
    { label: "250–500 ms", timerLow: 250_000_000_000, timerHigh: 500_000_000_000 },
    { label: "500 ms–1 s", timerLow: 500_000_000_000, timerHigh: 1_000_000_000_000 },
    { label: "1–2 s", timerLow: 1_000_000_000_000, timerHigh: 2_000_000_000_000 },
    { label: "2–5 s", timerLow: 2_000_000_000_000, timerHigh: 5_000_000_000_000 },
    { label: "> 5 s", timerLow: 5_000_000_000_000 },
];

export const formatStatementHistogramTimer = (timer: number): string => {
    if (timer < 1_000_000_000) {
        return `${Math.round(timer / 1_000_000).toLocaleString("en")} µs`;
    }

    if (timer < 1_000_000_000_000) {
        return `${formatValue(timer / 1_000_000_000)} ms`;
    }

    return `${formatValue(timer / 1_000_000_000_000)} s`;
};

export const formatStatementHistogramUpperBound = (timer: number): string => {
    const seconds = timer / 1_000_000_000_000;
    if (seconds < 60) {
        return `${Math.round(seconds).toLocaleString("en")} s`;
    }

    if (seconds < 3_600) {
        return `${Math.round(seconds / 60).toLocaleString("en")} m`;
    }

    if (seconds < 86_400) {
        return `${Math.round(seconds / 3_600).toLocaleString("en")} h`;
    }

    return `${Math.round(seconds / 86_400).toLocaleString("en")} d`;
};

export const parseStatementHistogramRows = (rows?: unknown[]): IStatementHistogramRow[] => {
    const result = buckets.map((bucket): IStatementHistogramRow => {
        return {
            ...bucket,
            countBucket: 0,
        };
    });

    (rows ?? []).forEach((row) => {
        const values = row as unknown[];
        const timerLow = Number(values[0] ?? 0);
        const timerHigh = Number(values[1] ?? timerLow);
        const countBucket = Number(values[2] ?? 0);
        const bucketTimer = timerHigh > timerLow
            ? timerLow + ((timerHigh - timerLow) / 2)
            : timerLow;
        const targetBucket = result.find((bucket) => {
            return bucketTimer >= bucket.timerLow &&
                (bucket.timerHigh === undefined || bucketTimer < bucket.timerHigh);
        }) ?? result[result.length - 1];

        targetBucket.countBucket += countBucket;
        if (targetBucket.timerHigh === undefined && Number.isFinite(timerHigh) &&
            timerHigh > targetBucket.timerLow) {
            targetBucket.observedTimerHigh = Math.max(targetBucket.observedTimerHigh ?? 0, timerHigh);
        }
    });

    result.forEach((bucket) => {
        if (bucket.timerHigh === undefined && bucket.observedTimerHigh !== undefined) {
            bucket.label = `${formatStatementHistogramTimer(bucket.timerLow)} .. ` +
                formatStatementHistogramUpperBound(bucket.observedTimerHigh);
        }
    });

    return result.some((bucket) => {
        return bucket.countBucket > 0;
    }) ? result : [];
};

export const statementHistogramPercentiles = (
    rows: IStatementHistogramRow[],
    global = false,
): IStatementHistogramPercentile[] => {
    return [0.5, 0.9, 0.95, 0.99, 0.999].map((percentile) => {
        const value = estimatePercentile(rows, percentile);
        const percentileValue = percentile * 100;
        const formattedPercentile = formatPercentile(percentileValue);
        const label = `p${formattedPercentile}`;
        const openEnded = value.startsWith("> ");

        return {
            label,
            tooltip: openEnded
                ? `The ${label} estimate is above ${value.slice(2)}.`
                : global
                    ? `${formattedPercentile}% of statements in this instance executed in ${value} or less.`
                    : `This statement executes in ${value} or less ${formattedPercentile}% of the time.`,
            value,
        };
    });
};

export class StatementHistogram extends ComponentBase<IStatementHistogramProperties> {

    public constructor(props: IStatementHistogramProperties) {
        super(props);

        this.addHandledProperties("rows", "global");
    }

    public render(): ComponentChild {
        const { global = false, id, rows } = this.props;
        const maximum = Math.max(1, ...rows.map((row) => {
            return row.countBucket;
        }));
        let cumulativeCount = 0;
        const totalCount = rows.reduce((sum, row) => {
            return sum + row.countBucket;
        }, 0);

        return <div
            id={id}
            className={this.getEffectiveClassNames(["statementHistogramGraph"])}
            {...this.unhandledProperties}
        >
            {rows.map((row) => {
                cumulativeCount += row.countBucket;
                const barWidth = `${Math.max(0, (row.countBucket / maximum) * 100)}%`;
                const displayedCount = row.timerHigh === undefined ? row.countBucket : cumulativeCount;
                const percentage = totalCount > 0 ? (displayedCount / totalCount) * 100 : 0;
                const formattedCount = displayedCount.toLocaleString("en");
                const formattedPercentage = formatPercentile(percentage);
                const tooltip = histogramTooltip(row, formattedCount, formattedPercentage, global);

                return <div className="statementHistogramBucket" key={row.label}>
                    <span className="statementHistogramBucketLabel">{row.label}</span>
                    <div className="statementHistogramBucketTrack" title={tooltip}>
                        <div
                            className="statementHistogramBucketBar"
                            style={{ width: barWidth }}
                        />
                    </div>
                    <span className="statementHistogramBucketValue">
                        {row.countBucket.toLocaleString("en")}
                    </span>
                </div>;
            })}
        </div>;
    }

}

const formatPercentile = (percentile: number): string => {
    return Number.isInteger(percentile)
        ? percentile.toLocaleString("en")
        : percentile.toLocaleString("en", { maximumFractionDigits: 1 });
};

const formatValue = (value: number): string => {
    if (value >= 100 || Number.isInteger(value)) {
        return Math.round(value).toLocaleString("en");
    }

    return value.toLocaleString("en", {
        maximumFractionDigits: value >= 10 ? 1 : 2,
        minimumFractionDigits: 0,
    });
};

const estimatePercentile = (rows: IStatementHistogramRow[], percentile: number): string => {
    const totalCount = rows.reduce((sum, row) => {
        return sum + row.countBucket;
    }, 0);
    if (totalCount <= 0) {
        return "-";
    }

    const target = totalCount * percentile;
    let cumulativeCount = 0;
    for (const row of rows) {
        const nextCumulativeCount = cumulativeCount + row.countBucket;
        if (target <= nextCumulativeCount) {
            if (row.timerHigh === undefined) {
                return `> ${formatStatementHistogramTimer(row.timerLow)}`;
            }

            const bucketPosition = row.countBucket > 0
                ? Math.max(0, Math.min(1, (target - cumulativeCount) / row.countBucket))
                : 0;
            const estimatedTimer = row.timerLow + ((row.timerHigh - row.timerLow) * bucketPosition);

            return formatStatementHistogramTimer(estimatedTimer);
        }

        cumulativeCount = nextCumulativeCount;
    }

    const lastBucket = rows[rows.length - 1];

    return lastBucket.timerHigh === undefined
        ? `> ${formatStatementHistogramTimer(lastBucket.timerLow)}`
        : formatStatementHistogramTimer(lastBucket.timerHigh);
};

const histogramTooltip = (
    row: IStatementHistogramRow,
    count: string,
    percentage: string,
    global: boolean,
): string => {
    let result: string;
    if (row.timerHigh === undefined) {
        if (row.observedTimerHigh === undefined) {
            result = global
                ? `${count} statements (${percentage}%) in this instance executed in more than ` +
                    formatStatementHistogramTimer(row.timerLow)
                : `${count} executions (${percentage}%) of this statement took more than ` +
                    formatStatementHistogramTimer(row.timerLow);
        } else {
            const range = `${formatStatementHistogramTimer(row.timerLow)} and ` +
                formatStatementHistogramUpperBound(row.observedTimerHigh);
            result = global
                ? `${count} statements (${percentage}%) in this instance executed between ${range}`
                : `${count} executions (${percentage}%) of this statement took between ${range}`;
        }
    } else {
        result = global
            ? `${count} statements (${percentage}%) in this instance executed in ` +
                `${formatStatementHistogramTimer(row.timerHigh)} or less`
            : `${count} executions (${percentage}%) of this statement completed in ` +
                `${formatStatementHistogramTimer(row.timerHigh)} or less`;
    }

    return `${result}.`;
};
