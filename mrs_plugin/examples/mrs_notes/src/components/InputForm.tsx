/*
 * Copyright (c) 2022, 2024, Oracle and/or its affiliates.
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

import { Component, ComponentChild, ComponentChildren } from "preact";
import Icon from "./Icon";
import style from "./InputForm.module.css";

interface IInputFormProps {
    children: ComponentChildren;
    headerIcon: string;
    headerTitle: string;
    headerSubtitle: string;
    successContent: ComponentChild;
    back: () => void;
    submit: () => void;
    success: boolean;
    error?: string;
}

/**
 * A simple InputForm page Component that expects a list of form fields as children
 */
export default class InputForm extends Component<IInputFormProps> {
    public render = (props: IInputFormProps): ComponentChild => {
        const {
            children, headerIcon, headerTitle, headerSubtitle, successContent, back, submit, success, error,
        } = props;

        return (
            <>
                <div className={style.pageForm}>
                    <div className={style.pageFormContent}>
                        <div className={style.headerTitle}>
                            <Icon name={headerIcon} />
                            <h3>{headerTitle}</h3>
                            <p>{headerSubtitle}</p>
                        </div>
                        <div>{children}</div>
                        {success &&
                            <>
                                <div className={style.formSuccess}>
                                    <p>{successContent}</p>
                                </div>
                                <div className={style.formButtons}>
                                    <button onClick={() => { back(); }} className="flatButton">OK</button>
                                </div>
                            </>
                        }
                        {!success &&
                            <div className={style.formButtons}>
                                <button onClick={() => { back(); }} className="flatButton">Cancel</button>
                                <button onClick={() => { submit(); }} className="flatButton">Submit</button>
                            </div>
                        }
                        {(error !== undefined) &&
                            <div className={style.formError}>
                                <p>{error}</p>
                            </div>
                        }
                    </div>
                </div>
                <div className="footer">
                    <p>Copyright (c) 2022, 2024, Oracle and/or its affiliates.</p>
                </div>
            </>
        );
    };
}
