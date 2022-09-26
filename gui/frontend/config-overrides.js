/*
 * Copyright (c) 2020, 2022, Oracle and/or its affiliates.
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

const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
//const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const webpack = require("webpack");

const child = require('child_process');
const path = require("path");
const packageFile = path.resolve(__dirname, "package.json");

module.exports = function override(config, env) {
    config.plugins.push(new MonacoWebpackPlugin({
        languages: ["typescript", "javascript", "sql", "mysql", "python", "json", "markdown", "ini", "xml"]
    }),
        //new BundleAnalyzerPlugin({ analyzerMode: "disabled" }),
        new webpack.DefinePlugin({
            "process.env.buildNumber": webpack.DefinePlugin.runtimeValue(() => {
                // First try to get the hash from an environment variable, if that exists.
                let sha = process.env.PUSH_REVISION;
                if (sha) {
                    return `"${sha.substring(0, 7)}"`;
                }

                // Otherwise ask git directly.
                try {
                    sha = child.execSync("git rev-parse --short HEAD", { timeout: 10000 });
                    return `"${sha.toString().trim()}"`;
                } catch (e) {
                    return "<unknown>";
                }
            }, true),
            "process.env.versionNumber": JSON.stringify(require(packageFile).version),
        })
    );

    config.module.rules.push(
        {
            test: /\.(html|d\.ts)$/i,
            use: [
                {
                    loader: "raw-loader",
                    options: {
                        esModule: false,
                    },
                },
            ],
        },
    );
    config.module.noParse = /node_modules\/typescript\/lib\/typescript.js/;

    config.resolve = config.resolve || {};
    config.resolve.alias = config.resolve.alias || {};
    config.resolve.alias.react = 'preact/compat';
    config.resolve.alias['react/jsx-runtime'] = 'preact/jsx-runtime';

    // Need to avoid minimizing class names as they are needed in some spots (e.g. code completion).
    config.optimization.minimizer[0].options.terserOptions.keep_classnames = true;
    config.optimization.minimizer[0].options.terserOptions.keep_fnames = true;

    return config;
}
