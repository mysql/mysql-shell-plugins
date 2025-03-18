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

#include <gtk/gtk.h>
#include <webkit/webkit.h>

// ----------------------------------------------------------------------------

static void destroyWindowCb(GtkWidget *widget, GtkWidget *window) {
  g_main_quit();
  g_print("Received message from JavaScript");
}

// ----------------------------------------------------------------------------

static gboolean closeWebViewCb(WebKitWebView *webView, GtkWidget *window) {
  g_widget_destroy(window);
  g_print("Received message from JavaScript");
  return TRUE;
}

// ----------------------------------------------------------------------------

static gboolean handle_script_message(WebKitUserContentManager *cm,
                                      GtkWidget *window) {
  g_widget_destroy(window);
  g_print("Received message from JavaScript");
  return TRUE;
}

// ----------------------------------------------------------------------------

static void web_view_javascript_finished(GObject *object, GAsyncResult *result,
                                         gpointer user_data) {
  GError *error = nullptr;
  JSCValue *value = webkit_web_view_evaluate_javascript_finish(
      WEBKIT_WEB_VIEW(object), result, &error);
  if (!value) {
    g_warning("Error running javascript: %s", error->message);
    g_error_free(error);
    return;
  }

  if (jsc_value_is_string(value)) {
    gchar *str_value = jsc_value_to_string(value);
    JSCException *exception =
        jsc_context_get_exception(jsc_value_get_context(value));
    if (exception)
      g_warning("Error running javascript: %s",
                jsc_exception_get_message(exception));
    else
      g_print("Script result: %s\n", str_value);
    g_free(str_value);
  } else {
    g_warning("Error running javascript: unexpected return value");
  }
  webkit_javascript_result_unref(result);
}

// ----------------------------------------------------------------------------

static void web_view_get_link_url(WebKitWebView *web_view,
                                  const gchar *link_id) {
  gchar *script =
      g_strdup_printf("window.document.getElementById('%s').href;", link_id);
  webkit_web_view_evaluate_javascript(web_view, script, -1, nullptr, nullptr,
                                      nullptr, web_view_javascript_finished,
                                      nullptr);
  g_free(script);
}

// ----------------------------------------------------------------------------

void activate(GtkApplication *app, gpointer) {
  GtkWidget *window = gtk_application_window_new(app);
  gtk_window_set_title(GTK_WINDOW(window), "NPC");
  gtk_window_set_default_size(GTK_WINDOW(window), 800, 600);

  GtkWidget *webView = webkit_web_view_new();

  gtk_window_set_child(GTK_WINDOW(window), webView);
  webkit_web_view_load_uri(WEBKIT_WEB_VIEW(webView), "http://localhost:3000/");

  g_signal_connect(window, "destroy", G_CALLBACK(destroyWindowCb), nullptr);
  g_signal_connect(webView, "close", G_CALLBACK(closeWebViewCb), window);

  WebKitUserContentManager *manager =
      webkit_web_view_get_user_content_manager(WEBKIT_WEB_VIEW(webView));
  g_signal_connect(manager, "script-message-received::command",
                   G_CALLBACK(handle_script_message), nullptr);
  webkit_user_content_manager_register_script_message_handler(
      manager, "command", "main");

  // cm->script_message_received.connect([&](auto& message) {
  //   g_print("Received message from JavaScript: %s\n",
  //            message->body().data());
  // });

  // cm->register_script_message_handler("post", [](auto& message) {
  //   g_print("Received message from JavaScript: %s\n",
  //           message->body().data());
  // });

  gtk_widget_show(window);
  gtk_window_present(GTK_WINDOW(window));
}

// ----------------------------------------------------------------------------

int main(int argc, char *argv[]) {
  GtkApplication *app = gtk_application_new("com.example.GtkApplication",
                                            G_APPLICATION_DEFAULT_FLAGS);
  g_signal_connect(app, "activate", G_CALLBACK(activate), nullptr);
  int status = g_application_run(G_APPLICATION(app), argc, argv);
  g_object_unref(app);

  return status;
}
