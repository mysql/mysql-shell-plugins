/*
 * Copyright (c) 2021, 2024, Oracle and/or its affiliates.
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

using System;
using System.Windows.Forms;

namespace MysqlShellGui {
  partial class MysqlShellGui {
    /// <summary>
    /// Required designer variable.
    /// </summary>
    private System.ComponentModel.IContainer components = null;

    #region Windows Form Designer generated code

    /// <summary>
    /// Required method for Designer support - do not modify
    /// the contents of this method with the code editor.
    /// </summary>
    private void InitializeComponent() {
      System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(MysqlShellGui));
      this.webView = new Microsoft.Web.WebView2.WinForms.WebView2();
      this.printDocument1 = new System.Drawing.Printing.PrintDocument();
      this.menuStrip1 = new System.Windows.Forms.MenuStrip();
      this.helpToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
      this.preferencesToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
      this.aboutToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
      ((System.ComponentModel.ISupportInitialize)(this.webView)).BeginInit();
      this.menuStrip1.SuspendLayout();
      this.SuspendLayout();
      //
      // webView
      //
      this.webView.CreationProperties = null;
      this.webView.Dock = System.Windows.Forms.DockStyle.Fill;
      this.webView.Location = new System.Drawing.Point(0, 33);
      this.webView.Name = "webView";
      this.webView.Size = new System.Drawing.Size(1200, 991);
      //this.webView.Source = new System.Uri("https://localhost:8000?token=236d84bc-5965-11eb-b3f9-003ee1ce36e8", System.UriKind.Absolute);
      this.webView.Source = new System.Uri(Url, System.UriKind.Absolute);
      this.webView.TabIndex = 0;
      this.webView.ZoomFactor = 1D;
      //
      // menuStrip1
      //
      this.menuStrip1.ImageScalingSize = new System.Drawing.Size(24, 24);
      this.menuStrip1.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.helpToolStripMenuItem});
      this.menuStrip1.Location = new System.Drawing.Point(0, 0);
      this.menuStrip1.Name = "menuStrip1";
      this.menuStrip1.Size = new System.Drawing.Size(1200, 33);
      this.menuStrip1.TabIndex = 1;
      this.menuStrip1.Text = "menuStrip1";
      //
      // helpToolStripMenuItem
      //
      this.helpToolStripMenuItem.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.preferencesToolStripMenuItem,
            this.aboutToolStripMenuItem});
      this.helpToolStripMenuItem.Name = "helpToolStripMenuItem";
      this.helpToolStripMenuItem.Size = new System.Drawing.Size(65, 29);
      this.helpToolStripMenuItem.Text = "&Help";
      //
      // preferencesToolStripMenuItem
      //
      this.preferencesToolStripMenuItem.Name = "preferencesToolStripMenuItem";
      this.preferencesToolStripMenuItem.Size = new System.Drawing.Size(270, 34);
      this.preferencesToolStripMenuItem.Text = "&Preferences";
      this.preferencesToolStripMenuItem.Click += new System.EventHandler(this.preferencesToolStripMenuItem_Click);
      //
      // aboutToolStripMenuItem
      //
      this.aboutToolStripMenuItem.Name = "aboutToolStripMenuItem";
      this.aboutToolStripMenuItem.Size = new System.Drawing.Size(270, 34);
      this.aboutToolStripMenuItem.Text = "&About";
      this.aboutToolStripMenuItem.Click += new System.EventHandler(this.aboutToolStripMenuItem_Click);
      //
      // MysqlShellGui
      //
      this.AutoScaleDimensions = new System.Drawing.SizeF(9F, 20F);
      this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
      this.ClientSize = new System.Drawing.Size(1200, 1024);
      this.Controls.Add(this.webView);
      this.Controls.Add(this.menuStrip1);
      this.ForeColor = System.Drawing.SystemColors.ControlText;
      this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
      this.MainMenuStrip = this.menuStrip1;
      this.Name = "MysqlShellGui";
      this.Text = "MSG";
      ((System.ComponentModel.ISupportInitialize)(this.webView)).EndInit();
      this.menuStrip1.ResumeLayout(false);
      this.menuStrip1.PerformLayout();
      this.ResumeLayout(false);
      this.PerformLayout();

    }

    #endregion

    private Microsoft.Web.WebView2.WinForms.WebView2 webView;
    private System.Drawing.Printing.PrintDocument printDocument1;
    private MenuStrip menuStrip1;
    private ToolStripMenuItem helpToolStripMenuItem;
    private ToolStripMenuItem preferencesToolStripMenuItem;
    private ToolStripMenuItem aboutToolStripMenuItem;
  }
}
