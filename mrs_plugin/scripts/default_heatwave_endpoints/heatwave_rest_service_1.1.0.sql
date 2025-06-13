/*
 * Copyright (c) 2025, Oracle and/or its affiliates.
 */

CREATE OR REPLACE REST SERVICE /HeatWave/v1
    OPTIONS {
        "http": {
            "allowedOrigin": "auto"
        },
        "headers": {
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Origin, X-Auth-Token",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Credentials": "true"
        },
        "passthroughDbUser": true
    }
    ADD AUTH APP 'MySQL'
    PUBLISHED;

CREATE OR REPLACE REST SCHEMA /ml ON SERVICE /HeatWave/v1
    FROM `sys`;

CREATE OR REPLACE REST FUNCTION /generate
    ON SERVICE /HeatWave/v1 SCHEMA /ml
    AS sys.ML_GENERATE FORCE
    PARAMETERS HeatWaveV1MlGenerateParams {
        input: input @IN @DATATYPE("LONGTEXT"),
        options: options @IN @DATATYPE("JSON")
    }
    RESULT HeatWaveV1MlGenerateResult {
        result: result @DATATYPE("JSON")
    }
    OPTIONS {
        "sqlQuery": {"timeout":120000},
        "mysqlTask": {
            "driver": "router"
        }
    }
    AUTHENTICATION REQUIRED;

CREATE OR REPLACE REST PROCEDURE /rag
    ON SERVICE /HeatWave/v1 SCHEMA /ml
    AS sys.ML_RAG FORCE
    PARAMETERS HeatWaveV1MlRagParams {
        input: input @IN @DATATYPE("LONGTEXT"),
        output: output @OUT @DATATYPE("JSON"),
        options: options @IN @DATATYPE("JSON")
    }
    OPTIONS {
        "sqlQuery": {"timeout":120000},
        "mysqlTask": {
            "driver": "router"
        }
    }
    AUTHENTICATION REQUIRED;

CREATE OR REPLACE REST FUNCTION /embed
    ON SERVICE /HeatWave/v1 SCHEMA /ml
    AS sys.ML_EMBED_ROW FORCE
    PARAMETERS HeatWaveV1MlEmbedRowParams {
        input: input @IN @DATATYPE("LONGTEXT"),
        options: options @IN @DATATYPE("JSON")
    }
    RESULT HeatWaveV1MlEmbedRowResult {
        result: result @DATATYPE("vector")
    }
    OPTIONS {
        "sqlQuery": {"timeout":60000},
        "mysqlTask": {
            "driver": "router"
        }
    }
    AUTHENTICATION REQUIRED;

-- with progress tracking
CREATE OR REPLACE REST PROCEDURE /chat
    ON SERVICE /HeatWave/v1 SCHEMA /ml
    AS sys.HEATWAVE_CHAT FORCE
    PARAMETERS HeatWavev1HeatwaveChatParams {
        query: query @IN @DATATYPE("LONGTEXT"),
        options: chat_options @INOUT @DATATYPE("JSON")
    }
    OPTIONS {
        "sqlQuery": {"timeout":180000},
        "mysqlTask": {
            "driver": "router",
            "eventSchema": "ML_SCHEMA_$username",
            "statusDataJsonSchema": {"details":"object", "lastUpdate":"string"},
            "userVariables": ["chat_options"]
        }
    }
    AUTHENTICATION REQUIRED;


CREATE OR REPLACE REST PROCEDURE /train
    ON SERVICE /HeatWave/v1 SCHEMA /ml
    AS sys.ML_TRAIN FORCE
    PARAMETERS HeatWaveV1MlTrainParams {
        tableName: table_name @IN @DATATYPE("VARCHAR(255)"),
        targetColumnName: target_column_name @IN @DATATYPE("VARCHAR(64)"),
        options: options @IN @DATATYPE("JSON"),
        modelHandle: model_handle @INOUT @DATATYPE("VARCHAR(255)")
    }
    OPTIONS {
        "sqlQuery": {"timeout":28800000},
        "mysqlTask": {
            "driver": "router",
            "monitoringSql": [
                "SELECT QEXEC_TEXT INTO @status FROM performance_schema.rpd_query_stats WHERE QUERY_TEXT = 'ML_TRAIN' AND CONNECTION_ID = @task_connection_id ORDER BY query_id DESC LIMIT 1;",
                "CALL mysql_tasks.add_task_log(@task_id, JSON_UNQUOTE(JSON_EXTRACT(@status, '$.status')), JSON_OBJECT('lastUpdate', NOW(), 'details', CAST(IF(@status IS NULL, '{}', JSON_EXTRACT(@status, '$.details')) AS JSON)), IF(@status IS NULL, 0, JSON_EXTRACT(@status, '$.completionPercentage')), 'RUNNING');"
            ],
            "eventSchema": "ML_SCHEMA_$username",
            "statusDataJsonSchema": {"details":"object", "lastUpdate":"string"}
        }
    }
    AUTHENTICATION REQUIRED;

CREATE OR REPLACE REST FUNCTION /predict
    ON SERVICE /HeatWave/v1 SCHEMA /ml
    AS sys.ML_PREDICT_ROW FORCE
    PARAMETERS HeatWaveV1MlPredictRowParams {
        input: input @IN @DATATYPE("JSON"),
        modelHandle: model_handle @IN @DATATYPE("VARCHAR(255)"),
        options: options @IN @DATATYPE("JSON")
    }
    RESULT HeatWaveV1MlPredictRowResult {
        result: result @DATATYPE("json")
    }
    OPTIONS {
        "sqlQuery": {"timeout":60000},
        "mysqlTask": {
            "driver": "router",
            "monitoringSql": [
                "SELECT QEXEC_TEXT INTO @status FROM performance_schema.rpd_query_stats WHERE QUERY_TEXT = 'ML_MODEL_UNLOAD' AND AND CONNECTION_ID = @task_connection_id ORDER BY query_id DESC LIMIT 1;",
                "CALL mysql_tasks.add_task_log(@task_id, JSON_UNQUOTE(JSON_EXTRACT(@status, '$.status')), JSON_OBJECT('lastUpdate', NOW(6)), IF(@status IS NULL, 0, JSON_EXTRACT(@status, '$.completionPercentage')), 'RUNNING');"
            ],
            "eventSchema": "ML_SCHEMA_$username",
            "statusDataJsonSchema": {"details":"object", "lastUpdate":"string"}
        }
    }
    AUTHENTICATION REQUIRED;


CREATE OR REPLACE REST PROCEDURE /score
    ON SERVICE /HeatWave/v1 SCHEMA /ml
    AS sys.ML_SCORE FORCE
    PARAMETERS HeatWaveV1MlScoreParams {
        tableName: table_name @IN @DATATYPE("VARCHAR(255)"),
        targetColumnName: target_column_name @IN @DATATYPE("VARCHAR(64)"),
        modelHandle: model_handle @IN @DATATYPE("VARCHAR(255)"),
        metric: metric @IN @DATATYPE("VARCHAR(255)"),
        score: score @OUT @DATATYPE("FLOAT"),
        options: options @IN @DATATYPE("JSON")
    }
    OPTIONS {
        "sqlQuery": {"timeout":60000},
        "mysqlTask": {
            "driver": "router"
        }
    }
    AUTHENTICATION REQUIRED;

CREATE OR REPLACE REST PROCEDURE /explainModel
    ON SERVICE /HeatWave/v1 SCHEMA /ml
    AS sys.ML_EXPLAIN FORCE
    PARAMETERS HeatWaveV1MlExplainParams {
        tableName: table_name @IN @DATATYPE("VARCHAR(255)"),
        targetColumnName: target_column_name @IN @DATATYPE("VARCHAR(64)"),
        modelHandle: model_handle @IN @DATATYPE("VARCHAR(255)"),
        options: options @IN @DATATYPE("JSON")
    }
    OPTIONS {
        "sqlQuery": {"timeout":60000},
        "mysqlTask": {
            "driver": "router"
        }
    }
    AUTHENTICATION REQUIRED;

CREATE OR REPLACE REST FUNCTION /explainPrediction
    ON SERVICE /HeatWave/v1 SCHEMA /ml
    AS sys.ML_EXPLAIN_ROW FORCE
    PARAMETERS HeatWaveV1MlExplainRowParams {
        input: input @IN @DATATYPE("JSON"),
        modelHandle: model_handle @IN @DATATYPE("VARCHAR(255)"),
        options: options @IN @DATATYPE("JSON")
    }
    RESULT HeatWaveV1MlExplainRowResult {
        result: result @DATATYPE("json")
    }
    OPTIONS {
        "sqlQuery": {"timeout":60000},
        "mysqlTask": {
            "driver": "router"
        }
    }
    AUTHENTICATION REQUIRED;


CREATE OR REPLACE REST PROCEDURE /nlSql
    ON SERVICE /HeatWave/v1 SCHEMA /ml
    AS sys.NL_SQL FORCE
    PARAMETERS HeatWaveV1NlSqlParams {
        input: input @IN @DATATYPE("VARCHAR(255)"),
        output: output @OUT @DATATYPE("TEXT"),
        options: options @IN @DATATYPE("JSON")
    }
    OPTIONS {
        "sqlQuery": {"timeout":60000},
        "mysqlTask": {
            "driver": "router"
        }
    }
    AUTHENTICATION REQUIRED;
