/*
    ScomMpInventory_CreateTables.sql

    Lightweight SQL Server schema for storing SCOM Management Pack XML
    inventory extracted by PowerShell from unsealed XML files.

    Version-safe design:
      - mpref.ManagementPack has a BIGINT IDENTITY key for every imported
        file/version.
      - Child tables also have their own IDENTITY keys.
      - Native MP IDs are unique only inside a single management_pack_id,
        so the same rule, monitor, task, class, or override ID can exist
        in multiple MP versions without collision.
*/

SET XACT_ABORT ON;
GO

IF SCHEMA_ID(N'mpref') IS NULL
BEGIN
    EXEC(N'CREATE SCHEMA mpref');
END;
GO

BEGIN TRANSACTION;

IF OBJECT_ID(N'mpref.ManagementPack', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.ManagementPack
    (
        management_pack_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_ManagementPack PRIMARY KEY,
        mp_system_name nvarchar(256) NOT NULL,
        mp_friendly_name nvarchar(256) NULL,
        mp_version nvarchar(64) NOT NULL,
        public_key_token varchar(32) NULL,
        schema_version nvarchar(32) NULL,
        content_readable bit NULL,
        source_file_name nvarchar(260) NOT NULL,
        source_file_path nvarchar(4000) NULL,
        source_folder_version nvarchar(128) NULL,
        file_size_bytes bigint NULL,
        file_sha256 varbinary(32) NULL,
        imported_at_utc datetime2(0) NOT NULL
            CONSTRAINT DF_mpref_ManagementPack_ImportedAt DEFAULT SYSUTCDATETIME(),
        import_note nvarchar(512) NULL,
        raw_xml xml NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_mpref_ManagementPack_NameVersion' AND object_id = OBJECT_ID(N'mpref.ManagementPack'))
    CREATE INDEX IX_mpref_ManagementPack_NameVersion ON mpref.ManagementPack(mp_system_name, mp_version, public_key_token);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_mpref_ManagementPack_FileHash' AND object_id = OBJECT_ID(N'mpref.ManagementPack'))
    CREATE INDEX IX_mpref_ManagementPack_FileHash ON mpref.ManagementPack(file_sha256) WHERE file_sha256 IS NOT NULL;

IF OBJECT_ID(N'mpref.ManagementPackReference', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.ManagementPackReference
    (
        mp_reference_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_ManagementPackReference PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_ManagementPackReference_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        alias nvarchar(128) NOT NULL,
        referenced_system_name nvarchar(256) NOT NULL,
        referenced_version nvarchar(64) NULL,
        referenced_public_key_token varchar(32) NULL,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_ManagementPackReference_MP_Alias
            UNIQUE (management_pack_id, alias)
    );
END;

IF OBJECT_ID(N'mpref.DisplayString', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.DisplayString
    (
        display_string_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_DisplayString PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_DisplayString_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        element_xml_id nvarchar(512) NOT NULL,
        subelement_xml_id nvarchar(512) NULL,
        display_name nvarchar(512) NULL,
        description nvarchar(max) NULL,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_DisplayString_Element
            UNIQUE (management_pack_id, element_xml_id, subelement_xml_id)
    );
END;

IF OBJECT_ID(N'mpref.ClassType', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.ClassType
    (
        class_type_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_ClassType PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_ClassType_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        class_xml_id nvarchar(512) NOT NULL,
        display_name nvarchar(512) NULL,
        accessibility nvarchar(64) NULL,
        base_ref nvarchar(512) NULL,
        is_hosted bit NULL,
        is_abstract bit NULL,
        is_singleton bit NULL,
        is_extension bit NULL,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_ClassType_MP_ID UNIQUE (management_pack_id, class_xml_id)
    );
END;

IF OBJECT_ID(N'mpref.ClassProperty', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.ClassProperty
    (
        class_property_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_ClassProperty PRIMARY KEY,
        class_type_id bigint NOT NULL
            CONSTRAINT FK_mpref_ClassProperty_ClassType
            REFERENCES mpref.ClassType(class_type_id) ON DELETE CASCADE,
        property_xml_id nvarchar(256) NOT NULL,
        property_type_ref nvarchar(256) NULL,
        key_property bit NULL,
        max_length int NULL,
        property_order int NOT NULL
            CONSTRAINT DF_mpref_ClassProperty_Order DEFAULT 0,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_ClassProperty_Class_ID UNIQUE (class_type_id, property_xml_id)
    );
END;

IF OBJECT_ID(N'mpref.RelationshipType', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.RelationshipType
    (
        relationship_type_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_RelationshipType PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_RelationshipType_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        relationship_xml_id nvarchar(512) NOT NULL,
        display_name nvarchar(512) NULL,
        accessibility nvarchar(64) NULL,
        base_ref nvarchar(512) NULL,
        is_abstract bit NULL,
        source_id nvarchar(256) NULL,
        source_type_ref nvarchar(512) NULL,
        target_id nvarchar(256) NULL,
        target_type_ref nvarchar(512) NULL,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_RelationshipType_MP_ID UNIQUE (management_pack_id, relationship_xml_id)
    );
END;

IF OBJECT_ID(N'mpref.ModuleType', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.ModuleType
    (
        module_type_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_ModuleType PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_ModuleType_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        module_type_xml_id nvarchar(512) NOT NULL,
        module_kind nvarchar(64) NOT NULL,
        display_name nvarchar(512) NULL,
        accessibility nvarchar(64) NULL,
        batching bit NULL,
        run_as_ref nvarchar(512) NULL,
        input_type_ref nvarchar(512) NULL,
        output_type_ref nvarchar(512) NULL,
        configuration_schema_xml xml NULL,
        implementation_xml xml NULL,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_ModuleType_MP_ID UNIQUE (management_pack_id, module_type_xml_id)
    );
END;

IF OBJECT_ID(N'mpref.MonitorType', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.MonitorType
    (
        monitor_type_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_MonitorType PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_MonitorType_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        monitor_type_xml_id nvarchar(512) NOT NULL,
        display_name nvarchar(512) NULL,
        accessibility nvarchar(64) NULL,
        run_as_ref nvarchar(512) NULL,
        configuration_schema_xml xml NULL,
        implementation_xml xml NULL,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_MonitorType_MP_ID UNIQUE (management_pack_id, monitor_type_xml_id)
    );
END;

IF OBJECT_ID(N'mpref.OverrideableParameter', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.OverrideableParameter
    (
        overrideable_parameter_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_OverrideableParameter PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_OverrideableParameter_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        owner_kind nvarchar(64) NOT NULL,
        owner_xml_id nvarchar(512) NOT NULL,
        parameter_xml_id nvarchar(256) NOT NULL,
        selector nvarchar(1024) NULL,
        parameter_type nvarchar(128) NULL,
        parameter_order int NOT NULL
            CONSTRAINT DF_mpref_OverrideableParameter_Order DEFAULT 0,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_OverrideableParameter_MP_Owner_Param
            UNIQUE (management_pack_id, owner_xml_id, parameter_xml_id)
    );
END;

IF OBJECT_ID(N'mpref.Rule', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.Rule
    (
        rule_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_Rule PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_Rule_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        rule_xml_id nvarchar(512) NOT NULL,
        display_name nvarchar(512) NULL,
        target_ref nvarchar(512) NULL,
        enabled_raw nvarchar(128) NULL,
        enabled_bit bit NULL,
        category nvarchar(128) NULL,
        confirm_delivery bit NULL,
        remotable bit NULL,
        priority nvarchar(64) NULL,
        discard_level int NULL,
        generates_alert bit NULL,
        alert_message_ref nvarchar(512) NULL,
        alert_severity nvarchar(64) NULL,
        alert_priority nvarchar(64) NULL,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_Rule_MP_ID UNIQUE (management_pack_id, rule_xml_id)
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_mpref_Rule_TargetCategory' AND object_id = OBJECT_ID(N'mpref.Rule'))
    CREATE INDEX IX_mpref_Rule_TargetCategory ON mpref.Rule(management_pack_id, target_ref, category);

IF OBJECT_ID(N'mpref.Monitor', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.Monitor
    (
        monitor_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_Monitor PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_Monitor_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        monitor_xml_id nvarchar(512) NOT NULL,
        monitor_kind nvarchar(64) NOT NULL,
        display_name nvarchar(512) NULL,
        target_ref nvarchar(512) NULL,
        enabled_raw nvarchar(128) NULL,
        enabled_bit bit NULL,
        category nvarchar(128) NULL,
        type_id_ref nvarchar(512) NULL,
        parent_monitor_ref nvarchar(512) NULL,
        member_monitor_ref nvarchar(512) NULL,
        relationship_type_ref nvarchar(512) NULL,
        algorithm nvarchar(128) NULL,
        alert_on_state nvarchar(128) NULL,
        alert_severity nvarchar(64) NULL,
        alert_priority nvarchar(64) NULL,
        alert_auto_resolve bit NULL,
        alert_message_ref nvarchar(512) NULL,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_Monitor_MP_ID UNIQUE (management_pack_id, monitor_xml_id)
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_mpref_Monitor_TargetKind' AND object_id = OBJECT_ID(N'mpref.Monitor'))
    CREATE INDEX IX_mpref_Monitor_TargetKind ON mpref.Monitor(management_pack_id, target_ref, monitor_kind);

IF OBJECT_ID(N'mpref.MonitorState', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.MonitorState
    (
        monitor_state_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_MonitorState PRIMARY KEY,
        monitor_id bigint NOT NULL
            CONSTRAINT FK_mpref_MonitorState_Monitor
            REFERENCES mpref.Monitor(monitor_id) ON DELETE CASCADE,
        state_xml_id nvarchar(256) NOT NULL,
        monitor_type_state_ref nvarchar(512) NULL,
        health_state nvarchar(64) NULL,
        state_order int NOT NULL
            CONSTRAINT DF_mpref_MonitorState_Order DEFAULT 0,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_MonitorState_Monitor_ID UNIQUE (monitor_id, state_xml_id)
    );
END;

IF OBJECT_ID(N'mpref.Task', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.Task
    (
        task_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_Task PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_Task_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        task_xml_id nvarchar(512) NOT NULL,
        task_kind nvarchar(64) NOT NULL
            CONSTRAINT DF_mpref_Task_Kind DEFAULT N'Task',
        display_name nvarchar(512) NULL,
        target_ref nvarchar(512) NULL,
        enabled_raw nvarchar(128) NULL,
        enabled_bit bit NULL,
        accessibility nvarchar(64) NULL,
        remotable bit NULL,
        category nvarchar(128) NULL,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_Task_MP_ID UNIQUE (management_pack_id, task_xml_id)
    );
END;

IF OBJECT_ID(N'mpref.ConsoleTask', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.ConsoleTask
    (
        console_task_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_ConsoleTask PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_ConsoleTask_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        console_task_xml_id nvarchar(512) NOT NULL,
        display_name nvarchar(512) NULL,
        target_ref nvarchar(512) NULL,
        accessibility nvarchar(64) NULL,
        require_output bit NULL,
        assembly_ref nvarchar(512) NULL,
        handler nvarchar(512) NULL,
        parameters_xml xml NULL,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_ConsoleTask_MP_ID UNIQUE (management_pack_id, console_task_xml_id)
    );
END;

IF OBJECT_ID(N'mpref.MpOverride', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.MpOverride
    (
        override_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_MpOverride PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_MpOverride_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        override_xml_id nvarchar(512) NOT NULL,
        override_kind nvarchar(128) NOT NULL,
        display_name nvarchar(512) NULL,
        context_ref nvarchar(512) NULL,
        workflow_kind nvarchar(64) NULL,
        workflow_ref nvarchar(512) NULL,
        property_name nvarchar(256) NULL,
        parameter_ref nvarchar(256) NULL,
        override_value nvarchar(max) NULL,
        enforced bit NULL,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_MpOverride_MP_ID UNIQUE (management_pack_id, override_xml_id)
    );
END;

IF OBJECT_ID(N'mpref.WorkflowModule', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.WorkflowModule
    (
        workflow_module_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_WorkflowModule PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_WorkflowModule_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        owner_kind nvarchar(64) NOT NULL,
        owner_xml_id nvarchar(512) NOT NULL,
        module_role nvarchar(64) NOT NULL,
        module_xml_id nvarchar(256) NULL,
        module_type_ref nvarchar(512) NULL,
        module_order int NOT NULL
            CONSTRAINT DF_mpref_WorkflowModule_Order DEFAULT 0,
        configuration_xml xml NULL,
        raw_xml xml NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_mpref_WorkflowModule_Owner' AND object_id = OBJECT_ID(N'mpref.WorkflowModule'))
    CREATE INDEX IX_mpref_WorkflowModule_Owner ON mpref.WorkflowModule(management_pack_id, owner_kind, owner_xml_id, module_role);

IF OBJECT_ID(N'mpref.WorkflowConfigurationValue', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.WorkflowConfigurationValue
    (
        workflow_configuration_value_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_WorkflowConfigurationValue PRIMARY KEY,
        workflow_module_id bigint NOT NULL
            CONSTRAINT FK_mpref_WorkflowConfigurationValue_WorkflowModule
            REFERENCES mpref.WorkflowModule(workflow_module_id) ON DELETE CASCADE,
        value_name nvarchar(256) NOT NULL,
        value_text nvarchar(max) NULL,
        value_order int NOT NULL
            CONSTRAINT DF_mpref_WorkflowConfigurationValue_Order DEFAULT 0,
        value_xml xml NULL
    );
END;

IF OBJECT_ID(N'mpref.RulePerformanceCounter', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.RulePerformanceCounter
    (
        rule_performance_counter_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_RulePerformanceCounter PRIMARY KEY,
        rule_id bigint NOT NULL
            CONSTRAINT FK_mpref_RulePerformanceCounter_Rule
            REFERENCES mpref.Rule(rule_id) ON DELETE CASCADE,
        object_name nvarchar(512) NULL,
        counter_name nvarchar(512) NULL,
        instance_name nvarchar(512) NULL,
        value_expression nvarchar(max) NULL
    );
END;

IF OBJECT_ID(N'mpref.RuleEventFilter', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.RuleEventFilter
    (
        rule_event_filter_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_RuleEventFilter PRIMARY KEY,
        rule_id bigint NOT NULL
            CONSTRAINT FK_mpref_RuleEventFilter_Rule
            REFERENCES mpref.Rule(rule_id) ON DELETE CASCADE,
        log_name nvarchar(256) NULL,
        event_display_number nvarchar(64) NULL,
        publisher_name nvarchar(512) NULL,
        expression_xml xml NULL
    );
END;

IF OBJECT_ID(N'mpref.AlertParameter', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.AlertParameter
    (
        alert_parameter_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_AlertParameter PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_AlertParameter_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        owner_kind nvarchar(64) NOT NULL,
        owner_xml_id nvarchar(512) NOT NULL,
        parameter_number int NOT NULL,
        parameter_value nvarchar(max) NULL,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_AlertParameter_MP_Owner_Number
            UNIQUE (management_pack_id, owner_kind, owner_xml_id, parameter_number)
    );
END;

IF OBJECT_ID(N'mpref.Discovery', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.Discovery
    (
        discovery_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_Discovery PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_Discovery_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        discovery_xml_id nvarchar(512) NOT NULL,
        display_name nvarchar(512) NULL,
        target_ref nvarchar(512) NULL,
        enabled_raw nvarchar(128) NULL,
        enabled_bit bit NULL,
        category nvarchar(128) NULL,
        confirm_delivery bit NULL,
        remotable bit NULL,
        priority nvarchar(64) NULL,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_Discovery_MP_ID UNIQUE (management_pack_id, discovery_xml_id)
    );
END;

IF OBJECT_ID(N'mpref.Resource', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.Resource
    (
        resource_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_Resource PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_Resource_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        resource_xml_id nvarchar(512) NOT NULL,
        resource_kind nvarchar(64) NOT NULL,
        accessibility nvarchar(64) NULL,
        file_name nvarchar(512) NULL,
        qualified_name nvarchar(1024) NULL,
        has_null_stream bit NULL,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_Resource_MP_ID UNIQUE (management_pack_id, resource_xml_id)
    );
END;

IF OBJECT_ID(N'mpref.Category', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.Category
    (
        category_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_Category PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_Category_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        category_xml_id nvarchar(512) NULL,
        target_ref nvarchar(512) NULL,
        category_value nvarchar(512) NULL,
        raw_xml xml NULL
    );
END;

IF OBJECT_ID(N'mpref.KnowledgeArticle', N'U') IS NULL
BEGIN
    CREATE TABLE mpref.KnowledgeArticle
    (
        knowledge_article_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_mpref_KnowledgeArticle PRIMARY KEY,
        management_pack_id bigint NOT NULL
            CONSTRAINT FK_mpref_KnowledgeArticle_ManagementPack
            REFERENCES mpref.ManagementPack(management_pack_id) ON DELETE CASCADE,
        element_xml_id nvarchar(512) NOT NULL,
        display_name nvarchar(512) NULL,
        visible bit NULL,
        section_titles nvarchar(max) NULL,
        first_paragraph nvarchar(max) NULL,
        maml_xml xml NULL,
        raw_xml xml NULL,
        CONSTRAINT UQ_mpref_KnowledgeArticle_MP_Element
            UNIQUE (management_pack_id, element_xml_id)
    );
END;

COMMIT TRANSACTION;
GO

/*
    Helpful views for MP Viewer-style browsing.
*/

CREATE OR ALTER VIEW mpref.vRules
AS
SELECT
    mp.management_pack_id,
    mp.mp_system_name,
    mp.mp_version,
    r.rule_id,
    r.rule_xml_id,
    r.display_name,
    r.target_ref,
    r.enabled_raw,
    r.enabled_bit,
    r.category,
    r.generates_alert,
    r.alert_severity,
    r.alert_priority
FROM mpref.Rule AS r
INNER JOIN mpref.ManagementPack AS mp
    ON mp.management_pack_id = r.management_pack_id;
GO

CREATE OR ALTER VIEW mpref.vMonitors
AS
SELECT
    mp.management_pack_id,
    mp.mp_system_name,
    mp.mp_version,
    m.monitor_id,
    m.monitor_xml_id,
    m.monitor_kind,
    m.display_name,
    m.target_ref,
    m.enabled_raw,
    m.enabled_bit,
    m.type_id_ref,
    m.parent_monitor_ref,
    m.alert_on_state,
    m.alert_severity,
    m.alert_priority
FROM mpref.Monitor AS m
INNER JOIN mpref.ManagementPack AS mp
    ON mp.management_pack_id = m.management_pack_id;
GO

CREATE OR ALTER VIEW mpref.vTasks
AS
SELECT
    mp.management_pack_id,
    mp.mp_system_name,
    mp.mp_version,
    t.task_id,
    t.task_xml_id,
    t.task_kind,
    t.display_name,
    t.target_ref,
    t.enabled_raw,
    t.enabled_bit,
    t.accessibility
FROM mpref.Task AS t
INNER JOIN mpref.ManagementPack AS mp
    ON mp.management_pack_id = t.management_pack_id;
GO

CREATE OR ALTER VIEW mpref.vOverrides
AS
SELECT
    mp.management_pack_id,
    mp.mp_system_name,
    mp.mp_version,
    o.override_id,
    o.override_xml_id,
    o.override_kind,
    o.display_name,
    o.context_ref,
    o.workflow_kind,
    o.workflow_ref,
    o.property_name,
    o.parameter_ref,
    o.override_value,
    o.enforced
FROM mpref.MpOverride AS o
INNER JOIN mpref.ManagementPack AS mp
    ON mp.management_pack_id = o.management_pack_id;
GO

CREATE OR ALTER VIEW mpref.vPerformanceRules
AS
SELECT
    r.management_pack_id,
    r.mp_system_name,
    r.mp_version,
    r.rule_id,
    r.rule_xml_id,
    r.display_name,
    r.target_ref,
    pc.object_name,
    pc.counter_name,
    pc.instance_name,
    pc.value_expression
FROM mpref.vRules AS r
INNER JOIN mpref.RulePerformanceCounter AS pc
    ON pc.rule_id = r.rule_id;
GO

CREATE OR ALTER VIEW mpref.vEventRules
AS
SELECT
    r.management_pack_id,
    r.mp_system_name,
    r.mp_version,
    r.rule_id,
    r.rule_xml_id,
    r.display_name,
    r.target_ref,
    ef.log_name,
    ef.event_display_number,
    ef.publisher_name
FROM mpref.vRules AS r
INNER JOIN mpref.RuleEventFilter AS ef
    ON ef.rule_id = r.rule_id;
GO
