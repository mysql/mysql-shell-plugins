# Copyright (c) 2023, 2025, Oracle and/or its affiliates.
# MySQL Workbench Plugin
# Module with Audit Log Trigger function
# Written in MySQL Workbench 8.0.26

from wb import *
import grt
#import mforms

ModuleInfo = DefineModule("Audit_Log_Triggers", author="MikeZ", version="1.2", description="Contains Plugin Audit_Log_Triggers")

def get_wb_doc_dir(filename, *argv):
    """Returns the doc dir of the current model

    Args:
        *argv: The list of directories to be added to the path

    Returns:
        The plugin directory path as string
    """
    import os.path, platform

    home_dir = os.path.expanduser('~')
    if not home_dir:
        raise Exception("No home directory set")
    os_name = platform.system()
    if os_name == "Windows":
        wb_dir = os.path.join(
            home_dir, "AppData", "Roaming", "MySQL",
            "Workbench", filename + "d"
        )
    else:
        wb_dir = os.path.join(
            home_dir, "Library", "Application Support", "MySQL",
            "Workbench", filename + "d")

    for arg in argv:
        wb_dir = os.path.join(wb_dir, arg)

    return wb_dir

def create_audit_log_table():
    import datetime

    # iterate through all tables from schema
    schema = grt.root.wb.doc.physicalModels[0].catalog.schemata[0]

    # Check if audit_log table is already in the schema
    audit_log_table = False
    for table in schema.tables:
        if table.name == 'audit_log':
            audit_log_table = True
            break
    if not audit_log_table:
        audit_table = schema.addNewTable("db.mysql") # grt.classes.db_mysql_Table()
        audit_table.owner = grt.root.wb.doc.physicalModels[0].catalog.schemata[0]
        audit_table.name = "audit_log"
        audit_table.oldName = "audit_log"
        audit_table.tableEngine = "InnoDB"
        audit_table.createDate = f'{datetime.datetime.now():%Y-%m-%d %H:%M:%S}'
        audit_table.lastChangeDate = f'{datetime.datetime.now():%Y-%m-%d %H:%M:%S}'
        # Column ---------
        c_id = grt.classes.db_mysql_Column()
        c_id.autoIncrement = 1
        c_id.formattedType = "INT"
        c_id.isNotNull = 1
        c_id.length = -1
        c_id.name = "id"
        c_id.oldName = "id"
        c_id.precision = -1
        c_id.scale = -1
        c_id.owner = audit_table
        c_id.simpleType = grt.root.wb.doc.physicalModels[0].catalog.simpleDatatypes[3]
        audit_table.addColumn(c_id)
        # Column ---------
        c_t_n = grt.classes.db_mysql_Column()
        c_t_n.autoIncrement = 0
        c_t_n.formattedType = "VARCHAR(255)"
        c_t_n.isNotNull = 1
        c_t_n.length = 255
        c_t_n.name = "table_name"
        c_t_n.oldName = "table_name"
        c_t_n.precision = -1
        c_t_n.scale = -1
        c_t_n.owner = audit_table
        c_t_n.simpleType = grt.root.wb.doc.physicalModels[0].catalog.simpleDatatypes[11]
        audit_table.addColumn(c_t_n)
        # Column ---------
        c = grt.classes.db_mysql_Column()
        c.autoIncrement = 0
        c.datatypeExplicitParams = "('INSERT','UPDATE','DELETE')"
        c.formattedType = "ENUM('INSERT','UPDATE','DELETE')"
        c.isNotNull = 1
        c.length = -1
        c.name = "dml_type"
        c.oldName = "dml_type"
        c.precision = -1
        c.scale = -1
        c.owner = audit_table
        c.simpleType = grt.root.wb.doc.physicalModels[0].catalog.simpleDatatypes[42]
        audit_table.addColumn(c)
        # Column ---------
        c = grt.classes.db_mysql_Column()
        c.autoIncrement = 0
        c.formattedType = "JSON"
        c.isNotNull = 0
        c.length = -1
        c.name = "old_row_data"
        c.oldName = "old_row_data"
        c.precision = -1
        c.scale = -1
        c.owner = audit_table
        c.simpleType = grt.root.wb.doc.physicalModels[0].catalog.simpleDatatypes[23]
        audit_table.addColumn(c)
        # Column ---------
        c = grt.classes.db_mysql_Column()
        c.autoIncrement = 0
        c.formattedType = "JSON"
        c.isNotNull = 0
        c.length = -1
        c.name = "new_row_data"
        c.oldName = "new_row_data"
        c.precision = -1
        c.scale = -1
        c.owner = audit_table
        c.simpleType = grt.root.wb.doc.physicalModels[0].catalog.simpleDatatypes[23]
        audit_table.addColumn(c)
        # Column ---------
        c_c_b = grt.classes.db_mysql_Column()
        c_c_b.autoIncrement = 0
        c_c_b.formattedType = "VARCHAR(255)"
        c_c_b.isNotNull = 1
        c_c_b.length = 255
        c_c_b.name = "changed_by"
        c_c_b.oldName = "changed_by"
        c_c_b.precision = -1
        c_c_b.scale = -1
        c_c_b.owner = audit_table
        c_c_b.simpleType = grt.root.wb.doc.physicalModels[0].catalog.simpleDatatypes[11]
        audit_table.addColumn(c_c_b)
        # Column ---------
        c_c_a = grt.classes.db_mysql_Column()
        c_c_a.autoIncrement = 0
        c_c_a.formattedType = "TIMESTAMP"
        c_c_a.isNotNull = 1
        c_c_a.length = -1
        c_c_a.name = "changed_at"
        c_c_a.oldName = "changed_at"
        c_c_a.precision = -1
        c_c_a.scale = -1
        c_c_a.owner = audit_table
        c_c_a.simpleType = grt.root.wb.doc.physicalModels[0].catalog.simpleDatatypes[31]
        audit_table.addColumn(c_c_a)
        # Column ---------
        c_o_r_i = grt.classes.db_mysql_Column()
        c_o_r_i.autoIncrement = 0
        c_o_r_i.expression = 'old_row_data->"$.id"'
        c_o_r_i.formattedType = "INT"
        c_o_r_i.generated = 1
        c_o_r_i.isNotNull = 0
        c_o_r_i.length = -1
        c_o_r_i.name = "old_row_id"
        c_o_r_i.oldName = "old_row_id"
        c_o_r_i.precision = -1
        c_o_r_i.scale = -1
        c_o_r_i.owner = audit_table
        c_o_r_i.simpleType = grt.root.wb.doc.physicalModels[0].catalog.simpleDatatypes[3]
        audit_table.addColumn(c_o_r_i)
        # Column ---------
        c_n_r_i = grt.classes.db_mysql_Column()
        c_n_r_i.autoIncrement = 0
        c_n_r_i.expression = 'new_row_data->"$.id"'
        c_n_r_i.formattedType = "INT"
        c_n_r_i.generated = 1
        c_n_r_i.isNotNull = 0
        c_n_r_i.length = -1
        c_n_r_i.name = "new_row_id"
        c_n_r_i.oldName = "new_row_id"
        c_n_r_i.precision = -1
        c_n_r_i.scale = -1
        c_n_r_i.owner = audit_table
        c_n_r_i.simpleType = grt.root.wb.doc.physicalModels[0].catalog.simpleDatatypes[3]
        audit_table.addColumn(c_n_r_i)

        # Index ---------
        i = grt.classes.db_mysql_Index()
        i.name = "PRIMARY"
        i.oldName = "PRIMARY"
        i.indexType = "PRIMARY"
        i.owner = audit_table
        i.visible = 1
        i.isPrimary = 1
        # Index Column ---------
        ic = grt.classes.db_mysql_IndexColumn()
        ic.owner = i
        ic.referencedColumn = c_id
        i.columns.append(ic)
        audit_table.addIndex(i)
        audit_table.primaryKey = i

        # Index ---------
        i = grt.classes.db_mysql_Index()
        i.name = "idx_table_name"
        i.oldName = "idx_table_name"
        i.indexType = "INDEX"
        i.owner = audit_table
        i.visible = 1
        i.isPrimary = 0
        # Index Column ---------
        ic = grt.classes.db_mysql_IndexColumn()
        ic.owner = i
        ic.referencedColumn = c_t_n
        i.columns.append(ic)
        audit_table.addIndex(i)

        # Index ---------
        i = grt.classes.db_mysql_Index()
        i.name = "idx_changed_at"
        i.oldName = "idx_changed_at"
        i.indexType = "INDEX"
        i.owner = audit_table
        i.visible = 1
        i.isPrimary = 0
        # Index Column ---------
        ic = grt.classes.db_mysql_IndexColumn()
        ic.owner = i
        ic.referencedColumn = c_c_a
        i.columns.append(ic)
        audit_table.addIndex(i)

        # Index ---------
        i = grt.classes.db_mysql_Index()
        i.name = "idx_changed_by"
        i.oldName = "idx_changed_by"
        i.indexType = "INDEX"
        i.owner = audit_table
        i.visible = 1
        i.isPrimary = 0
        # Index Column ---------
        ic = grt.classes.db_mysql_IndexColumn()
        ic.owner = i
        ic.referencedColumn = c_c_b
        i.columns.append(ic)
        audit_table.addIndex(i)

        # Index ---------
        i = grt.classes.db_mysql_Index()
        i.name = "idx_new_row_id"
        i.oldName = "idx_new_row_id"
        i.indexType = "INDEX"
        i.owner = audit_table
        i.visible = 1
        i.isPrimary = 0
        # Index Column ---------
        ic = grt.classes.db_mysql_IndexColumn()
        ic.owner = i
        ic.referencedColumn = c_n_r_i
        i.columns.append(ic)
        audit_table.addIndex(i)

        # Index ---------
        i = grt.classes.db_mysql_Index()
        i.name = "idx_old_row_id"
        i.oldName = "idx_old_row_id"
        i.indexType = "INDEX"
        i.owner = audit_table
        i.visible = 1
        i.isPrimary = 0
        # Index Column ---------
        ic = grt.classes.db_mysql_IndexColumn()
        ic.owner = i
        ic.referencedColumn = c_o_r_i
        i.columns.append(ic)
        audit_table.addIndex(i)


# This plugin takes no arguments
@ModuleInfo.plugin("Audit_Log_Triggers", caption="Generate audit_log Table and Trigger Script", description="Generates an audit_log table and the corresponding Trigger statements for all tables in the model as an SQL script", input=[], pluginMenu="Utilities")
@ModuleInfo.export(grt.INT)
def Audit_Log_Triggers():
    import datetime

    # Create audit_log table if it has not been created yet
    create_audit_log_table()

    # iterate through all tables from schema
    schema = grt.root.wb.doc.physicalModels[0].catalog.schemata[0]

    # Check if the audit_log.old_row_id is a generated column
    generated_id_cols = False
    for table in schema.tables:
        if table.name == 'audit_log':
            for col in table.columns:
                if col.name == 'old_row_id':
                    generated_id_cols = col.generated == 1
                    break
            break

    sql_script = """-- -----------------------------------------------------
-- Create audit_log triggers
--

"""

    sql_script += "DELIMITER $$\n"
    trigger_footer = """
        SESSION_USER(),
        CURRENT_TIMESTAMP
    );
END$$"""

    # Loop over all schema tables
    for table in schema.tables:
        if table.name == 'audit_log':
            continue
        if "no_audit_log" in table.comment:
            continue
        insert_header = """
    INSERT INTO `mysql_rest_service_metadata`.`audit_log` (
        table_name, dml_type, old_row_data, new_row_data"""
        if not generated_id_cols:
            insert_header += ', old_row_id, new_row_id'
        insert_header += """, changed_by, changed_at)
    VALUES ("""
        insert_trigger = (
            f'DROP TRIGGER IF EXISTS `{schema.name}`.`{table.name}_AFTER_INSERT_AUDIT_LOG`$$\n'
            f'CREATE TRIGGER `{schema.name}`.`{table.name}_AFTER_INSERT_AUDIT_LOG`\n'
            f'    AFTER INSERT ON `{table.name}` FOR EACH ROW\nBEGIN{insert_header}\n'
            f'{" ":8}"{table.name}", \n{" ":8}"INSERT", \n{" ":8}NULL,\n{" ":8}JSON_OBJECT(\n')
        update_trigger = (
            f'DROP TRIGGER IF EXISTS `{schema.name}`.`{table.name}_AFTER_UPDATE_AUDIT_LOG`$$\n'
            f'CREATE TRIGGER `{schema.name}`.`{table.name}_AFTER_UPDATE_AUDIT_LOG`\n'
            f'    AFTER UPDATE ON `{table.name}` FOR EACH ROW\nBEGIN{insert_header}\n'
            f'{" ":8}"{table.name}", \n{" ":8}"UPDATE", \n{" ":8}JSON_OBJECT(\n')
        delete_trigger = (
            f'DROP TRIGGER IF EXISTS `{schema.name}`.`{table.name}_AFTER_DELETE_AUDIT_LOG`$$\n'
            f'CREATE TRIGGER `{schema.name}`.`{table.name}_AFTER_DELETE_AUDIT_LOG`\n'
            f'    AFTER DELETE ON `{table.name}` FOR EACH ROW\nBEGIN{insert_header}\n'
            f'{" ":8}"{table.name}", \n{" ":8}"DELETE", \n{" ":8}JSON_OBJECT(\n')
        old_rows = ""
        new_rows = ""
        for column in table.columns:
            data_type = column.formattedRawType.upper()
            if not ('BLOB' in data_type or 'TEXT' in data_type):
                old_rows += f'{" ":12}"{column.name}", OLD.{column.name},\n'
                new_rows += f'{" ":12}"{column.name}", NEW.{column.name},\n'

        old_rows = old_rows[:-2] + '),'
        new_rows = new_rows[:-2] + '),'

        # Check if table has at least one PK column, if so use the first column for old_row_id/new_row_id
        old_row_id = 'NULL,'
        new_row_id = 'NULL,'
        if len(table.primaryKey.columns) >= 1:
            old_row_id = 'OLD.' + table.primaryKey.columns[0].referencedColumn.name + ','
            new_row_id = 'NEW.' + table.primaryKey.columns[0].referencedColumn.name + ','

        insert_trigger += (new_rows
            + (f'\n{" ":8}NULL,\n{" ":8}{new_row_id}' if not generated_id_cols else '')
            + trigger_footer)
        update_trigger += (old_rows + f'\n{" ":8}JSON_OBJECT(\n' + new_rows
            + (f'\n{" ":8}{old_row_id}\n{" ":8}{new_row_id}' if not generated_id_cols else '')
            + trigger_footer)
        delete_trigger += (old_rows + f'\n{" ":8}NULL,'
            + (f'\n{" ":8}{old_row_id}\n{" ":8}NULL,' if not generated_id_cols else '')
            + trigger_footer)

        sql_script += insert_trigger + "\n\n" + update_trigger + "\n\n" + delete_trigger + "\n\n"

    sql_script += "DELIMITER ;\n\n"

    # Check if the script is already registered in the model
    scripts = grt.root.wb.doc.physicalModels[0].scripts
    file_name = None
    for script in scripts:
        if script.name == 'Audit Log Triggers':
            file_name = script.filename[9:]
            script.lastChangeDate = f'{datetime.datetime.now():%Y-%m-%d %H:%M:%S}'

    # If there is no 'Audit Log Triggers' script yet, add it
    if not file_name:
        file_name = 'audit_log_triggers.sql'
        script = grt.classes.db_Script()
        script.name = 'Audit Log Triggers'
        script.forwardEngineerScriptPosition = "bottom_file"
        script.createDate = f'{datetime.datetime.now():%Y-%m-%d %H:%M:%S}'
        script.lastChangeDate = f'{datetime.datetime.now():%Y-%m-%d %H:%M:%S}'
        script.filename = '@scripts/audit_log_triggers.sql'
        script.owner = grt.root.wb.doc.physicalModels[0]

        grt.root.wb.doc.physicalModels[0].scripts.append(script)

    # Write script to file inside the WB Doc's workdir
    import os.path
    wb_doc_script_dir = get_wb_doc_dir(os.path.basename(grt.root.wb.docPath), "@scripts")
    if not os.path.exists(wb_doc_script_dir):
        os.makedirs(wb_doc_script_dir)
    file_path = os.path.join(wb_doc_script_dir, 'audit_log_triggers.sql')

    if file_path:
        print(f"Writing file {file_path}...")
        with open(file_path, 'w') as out:
            out.write(sql_script)

    return 0
