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

import "./assets/AdministrationPageFrame.css";

import { ComponentChild } from "preact";

import { ComponentBase, IComponentProperties } from "../../components/ui/Component/ComponentBase.js";

export interface IAdministrationPageFrameProperties extends IComponentProperties {
    /** Legacy title slot for administration pages that have not yet migrated. */
    heading?: ComponentChild;

    /** Legacy visual identifier displayed before the page title. */
    icon?: ComponentChild;

    /** Legacy detail displayed below the page title. */
    subtitle?: ComponentChild;

    /** Legacy current state displayed beside the page title. */
    status?: ComponentChild;

    /** Legacy actions displayed at the end of the heading. */
    actions?: ComponentChild;
}

/** Root layout for an administration page. */
export class AdministrationPageFrame extends ComponentBase<IAdministrationPageFrameProperties> {

    public constructor(props: IAdministrationPageFrameProperties) {
        super(props);

        this.addHandledProperties("heading", "icon", "subtitle", "status", "actions");
    }

    public render(): ComponentChild {
        const { actions, children, heading, icon, status, subtitle } = this.props;
        const className = this.getEffectiveClassNames(["administrationPageFrame"]);

        if (heading !== undefined) {
            return (
                <section className={className} {...this.unhandledProperties}>
                    <header className="administrationPageFrameHeader">
                        <div className="administrationPageFrameIdentity">
                            {icon && <div className="administrationPageFrameIcon">{icon}</div>}
                            <div className="administrationPageFrameTitle">
                                <h1>{heading}</h1>
                                {subtitle && <div className="administrationPageFrameSubtitle">{subtitle}</div>}
                            </div>
                        </div>
                        {(status !== undefined || actions !== undefined) && (
                            <div className="administrationPageFrameHeaderEnd">
                                {status && <div className="administrationPageFrameStatus">{status}</div>}
                                {actions && <div className="administrationPageFrameActions">{actions}</div>}
                            </div>
                        )}
                    </header>
                    <div className="administrationPageFrameContent">{children}</div>
                </section>
            );
        }

        return <main className={className} {...this.unhandledProperties}>{children}</main>;
    }
}

export interface IAdministrationPageHeadingProperties extends IComponentProperties {
    /** Main title for the administration page. */
    heading: ComponentChild;

    /** Optional visual identifier displayed before the page title. */
    icon?: ComponentChild;

    /** Optional detail displayed below the page title. */
    subtitle?: ComponentChild;

    /** Optional content displayed after the page title. */
    headerContent?: ComponentChild;

    /** Optional current state displayed beside the page title. */
    status?: ComponentChild;

    /** Optional actions displayed at the end of the heading. */
    actions?: ComponentChild;
}

/**
 * Common structural frame for administration pages. It supplies a consistent
 * heading while leaving summaries, toolbars, and page-specific content to the
 * caller.
 */
export class AdministrationPageHeading extends ComponentBase<IAdministrationPageHeadingProperties> {

    public constructor(props: IAdministrationPageHeadingProperties) {
        super(props);

        this.addHandledProperties("heading", "icon", "subtitle", "headerContent", "status", "actions");
    }

    public render(): ComponentChild {
        const { actions, children, headerContent, heading, icon, status, subtitle } = this.props;
        const className = this.getEffectiveClassNames(["administrationPageHeading"]);

        return (
            <section className={className} {...this.unhandledProperties}>
                <header className="administrationPageHeadingHeader">
                    <div className="administrationPageHeadingIdentity">
                        {icon && <div className="administrationPageHeadingIcon">{icon}</div>}
                        <div className="administrationPageHeadingTitle">
                            <h1>{heading}</h1>
                            {subtitle && <div className="administrationPageHeadingSubtitle">{subtitle}</div>}
                        </div>
                    </div>
                    {headerContent !== undefined &&
                        <div className="administrationPageHeadingHeaderContent">{headerContent}</div>}
                    {(status !== undefined || actions !== undefined) && (
                        <div className="administrationPageHeadingHeaderEnd">
                            {status && <div className="administrationPageHeadingStatus">{status}</div>}
                            {actions && <div className="administrationPageHeadingActions">{actions}</div>}
                        </div>
                    )}
                </header>
                {children && <div className="administrationPageHeadingContent">{children}</div>}
            </section>
        );
    }
}

/** Content area for an administration page. */
export class AdministrationPageBody extends ComponentBase<IComponentProperties> {

    public render(): ComponentChild {
        const className = this.getEffectiveClassNames(["administrationPageBody"]);

        return <section className={className} {...this.unhandledProperties}>{this.props.children}</section>;
    }
}
