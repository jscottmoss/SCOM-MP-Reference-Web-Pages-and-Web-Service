/*
    ScomMpXmlRepository_CreateTables.sql

    SQL Server schema for storing unsealed SCOM Management Pack XML without
    using the SCOM SDK. The design keeps raw XML and normalized query tables.

    Version safety:
      - mp.ManagementPackIdentity = logical MP name + public key token.
      - mp.ManagementPackVersion = logical identity + MP version.
      - mp.ManagementPackImport = one physical XML import. Every parsed table
        references import_id, so the same file name and same MP name can be
        imported repeatedly across versions without collisions.
*/

SET XACT_ABORT ON;
GO

IF SCHEMA_ID(N'mp') IS NULL
BEGIN
    EXEC(N'CREATE SCHEMA mp');
END
GO

BEGIN TRANSACTION;

IF OBJECT_ID(N'mp.ManagementPackIdentity', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ManagementPackIdentity
    (
        management_pack_identity_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ManagementPackIdentity PRIMARY KEY,
        system_name nvarchar(256) NOT NULL,
        public_key_token varchar(32) NULL,
        created_at_utc datetime2(0) NOT NULL
            CONSTRAINT DF_ManagementPackIdentity_Created DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_ManagementPackIdentity_NameToken
            UNIQUE (system_name, public_key_token)
    );
END;

IF OBJECT_ID(N'mp.ManagementPackVersion', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ManagementPackVersion
    (
        management_pack_version_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ManagementPackVersion PRIMARY KEY,
        management_pack_identity_id bigint NOT NULL
            CONSTRAINT FK_ManagementPackVersion_Identity
            REFERENCES mp.ManagementPackIdentity(management_pack_identity_id),
        mp_version nvarchar(64) NOT NULL,
        friendly_name nvarchar(256) NULL,
        schema_version nvarchar(32) NULL,
        content_readable bit NULL,
        first_seen_at_utc datetime2(0) NOT NULL
            CONSTRAINT DF_ManagementPackVersion_FirstSeen DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_ManagementPackVersion
            UNIQUE (management_pack_identity_id, mp_version)
    );
END;

IF OBJECT_ID(N'mp.ManagementPackImport', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ManagementPackImport
    (
        import_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ManagementPackImport PRIMARY KEY,
        management_pack_version_id bigint NOT NULL
            CONSTRAINT FK_ManagementPackImport_Version
            REFERENCES mp.ManagementPackVersion(management_pack_version_id),
        source_file_name nvarchar(260) NOT NULL,
        source_file_path nvarchar(4000) NULL,
        source_folder_version nvarchar(64) NULL,
        file_size_bytes bigint NULL,
        file_sha256 varbinary(32) NULL,
        imported_at_utc datetime2(0) NOT NULL
            CONSTRAINT DF_ManagementPackImport_Imported DEFAULT SYSUTCDATETIME(),
        import_label nvarchar(256) NULL,
        parser_version nvarchar(64) NULL,
        raw_xml xml NOT NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ManagementPackImport_FileName' AND object_id = OBJECT_ID(N'mp.ManagementPackImport'))
    CREATE INDEX IX_ManagementPackImport_FileName ON mp.ManagementPackImport(source_file_name, imported_at_utc);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ManagementPackImport_Hash' AND object_id = OBJECT_ID(N'mp.ManagementPackImport'))
    CREATE INDEX IX_ManagementPackImport_Hash ON mp.ManagementPackImport(file_sha256) WHERE file_sha256 IS NOT NULL;

IF OBJECT_ID(N'mp.ManagementPackReference', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ManagementPackReference
    (
        mp_reference_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ManagementPackReference PRIMARY KEY,
        import_id bigint NOT NULL
            CONSTRAINT FK_ManagementPackReference_Import
            REFERENCES mp.ManagementPackImport(import_id) ON DELETE CASCADE,
        alias nvarchar(128) NOT NULL,
        referenced_system_name nvarchar(256) NOT NULL,
        referenced_version nvarchar(64) NULL,
        referenced_public_key_token varchar(32) NULL,
        referenced_identity_id bigint NULL
            CONSTRAINT FK_ManagementPackReference_Identity
            REFERENCES mp.ManagementPackIdentity(management_pack_identity_id),
        referenced_version_id bigint NULL
            CONSTRAINT FK_ManagementPackReference_Version
            REFERENCES mp.ManagementPackVersion(management_pack_version_id),
        raw_xml xml NULL,
        CONSTRAINT UQ_ManagementPackReference_ImportAlias UNIQUE(import_id, alias)
    );
END;

IF OBJECT_ID(N'mp.MpElement', N'U') IS NULL
BEGIN
    CREATE TABLE mp.MpElement
    (
        mp_element_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_MpElement PRIMARY KEY,
        import_id bigint NOT NULL
            CONSTRAINT FK_MpElement_Import
            REFERENCES mp.ManagementPackImport(import_id) ON DELETE CASCADE,
        parent_mp_element_id bigint NULL
            CONSTRAINT FK_MpElement_Parent
            REFERENCES mp.MpElement(mp_element_id),
        section_name nvarchar(128) NOT NULL,
        element_kind nvarchar(128) NOT NULL,
        xml_id nvarchar(512) NULL,
        subelement_id nvarchar(512) NULL,
        display_name nvarchar(512) NULL,
        description nvarchar(max) NULL,
        accessibility nvarchar(64) NULL,
        target_ref nvarchar(512) NULL,
        category_value nvarchar(128) NULL,
        comment nvarchar(max) NULL,
        source_xpath nvarchar(1024) NULL,
        ordinal_in_import int NOT NULL
            CONSTRAINT DF_MpElement_Ordinal DEFAULT 0,
        raw_xml xml NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MpElement_ImportKind' AND object_id = OBJECT_ID(N'mp.MpElement'))
    CREATE INDEX IX_MpElement_ImportKind ON mp.MpElement(import_id, element_kind, xml_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_MpElement_DisplayName' AND object_id = OBJECT_ID(N'mp.MpElement'))
    CREATE INDEX IX_MpElement_DisplayName ON mp.MpElement(display_name) WHERE display_name IS NOT NULL;

IF OBJECT_ID(N'mp.ElementAttribute', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ElementAttribute
    (
        element_attribute_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ElementAttribute PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT FK_ElementAttribute_Element
            REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        attribute_name sysname NOT NULL,
        attribute_value nvarchar(max) NULL,
        attribute_order int NULL
    );
END;

IF OBJECT_ID(N'mp.ElementXmlFragment', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ElementXmlFragment
    (
        element_xml_fragment_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ElementXmlFragment PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT FK_ElementXmlFragment_Element
            REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        child_name sysname NOT NULL,
        child_order int NOT NULL,
        child_text nvarchar(max) NULL,
        child_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.ClassType', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ClassType
    (
        class_type_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ClassType PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_ClassType_Element UNIQUE
            CONSTRAINT FK_ClassType_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        class_ref nvarchar(512) NOT NULL,
        base_ref nvarchar(512) NULL,
        is_abstract bit NULL,
        is_hosted bit NULL,
        is_singleton bit NULL
    );
END;

IF OBJECT_ID(N'mp.ClassProperty', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ClassProperty
    (
        class_property_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ClassProperty PRIMARY KEY,
        class_type_id bigint NOT NULL
            CONSTRAINT FK_ClassProperty_ClassType
            REFERENCES mp.ClassType(class_type_id) ON DELETE CASCADE,
        property_ref nvarchar(256) NOT NULL,
        property_type_ref nvarchar(256) NULL,
        is_key bit NULL,
        max_length int NULL,
        property_order int NOT NULL,
        raw_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.RelationshipType', N'U') IS NULL
BEGIN
    CREATE TABLE mp.RelationshipType
    (
        relationship_type_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_RelationshipType PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_RelationshipType_Element UNIQUE
            CONSTRAINT FK_RelationshipType_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        relationship_ref nvarchar(512) NOT NULL,
        base_ref nvarchar(512) NULL,
        is_abstract bit NULL,
        source_id nvarchar(256) NULL,
        source_type_ref nvarchar(512) NULL,
        target_id nvarchar(256) NULL,
        target_type_ref nvarchar(512) NULL
    );
END;

IF OBJECT_ID(N'mp.SchemaType', N'U') IS NULL
BEGIN
    CREATE TABLE mp.SchemaType
    (
        schema_type_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_SchemaType PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_SchemaType_Element UNIQUE
            CONSTRAINT FK_SchemaType_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        schema_ref nvarchar(512) NOT NULL,
        schema_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.SecureReference', N'U') IS NULL
BEGIN
    CREATE TABLE mp.SecureReference
    (
        secure_reference_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_SecureReference PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_SecureReference_Element UNIQUE
            CONSTRAINT FK_SecureReference_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        secure_reference_ref nvarchar(512) NOT NULL,
        context_ref nvarchar(512) NULL
    );
END;

IF OBJECT_ID(N'mp.ModuleType', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ModuleType
    (
        module_type_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ModuleType PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_ModuleType_Element UNIQUE
            CONSTRAINT FK_ModuleType_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        module_type_ref nvarchar(512) NOT NULL,
        module_type_kind nvarchar(64) NOT NULL,
        run_as_ref nvarchar(512) NULL,
        batching bit NULL,
        pass_through bit NULL,
        stateful bit NULL,
        input_type_ref nvarchar(512) NULL,
        output_type_ref nvarchar(512) NULL,
        configuration_schema_xml xml NULL,
        implementation_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.OverrideableParameter', N'U') IS NULL
BEGIN
    CREATE TABLE mp.OverrideableParameter
    (
        overrideable_parameter_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_OverrideableParameter PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT FK_OverrideableParameter_Element
            REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        owner_kind nvarchar(64) NOT NULL,
        parameter_ref nvarchar(256) NOT NULL,
        selector nvarchar(1024) NULL,
        parameter_type nvarchar(128) NULL,
        parameter_order int NOT NULL
    );
END;

IF OBJECT_ID(N'mp.MonitorType', N'U') IS NULL
BEGIN
    CREATE TABLE mp.MonitorType
    (
        monitor_type_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_MonitorType PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_MonitorType_Element UNIQUE
            CONSTRAINT FK_MonitorType_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        monitor_type_ref nvarchar(512) NOT NULL,
        run_as_ref nvarchar(512) NULL,
        configuration_schema_xml xml NULL,
        monitor_implementation_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.MonitorTypeState', N'U') IS NULL
BEGIN
    CREATE TABLE mp.MonitorTypeState
    (
        monitor_type_state_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_MonitorTypeState PRIMARY KEY,
        monitor_type_id bigint NOT NULL
            CONSTRAINT FK_MonitorTypeState_MonitorType
            REFERENCES mp.MonitorType(monitor_type_id) ON DELETE CASCADE,
        state_ref nvarchar(256) NOT NULL,
        state_no_detection bit NULL,
        state_order int NOT NULL,
        raw_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.WorkflowModule', N'U') IS NULL
BEGIN
    CREATE TABLE mp.WorkflowModule
    (
        workflow_module_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_WorkflowModule PRIMARY KEY,
        import_id bigint NOT NULL
            CONSTRAINT FK_WorkflowModule_Import
            REFERENCES mp.ManagementPackImport(import_id) ON DELETE CASCADE,
        owner_mp_element_id bigint NOT NULL
            CONSTRAINT FK_WorkflowModule_OwnerElement
            REFERENCES mp.MpElement(mp_element_id),
        parent_workflow_module_id bigint NULL
            CONSTRAINT FK_WorkflowModule_ParentModule
            REFERENCES mp.WorkflowModule(workflow_module_id),
        owner_kind nvarchar(64) NOT NULL,
        module_role nvarchar(64) NOT NULL,
        module_order int NOT NULL,
        module_id nvarchar(256) NULL,
        type_id_ref nvarchar(512) NULL,
        run_as_ref nvarchar(512) NULL,
        configuration_xml xml NULL,
        raw_xml xml NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_WorkflowModule_Type' AND object_id = OBJECT_ID(N'mp.WorkflowModule'))
    CREATE INDEX IX_WorkflowModule_Type ON mp.WorkflowModule(import_id, type_id_ref, module_role);

IF OBJECT_ID(N'mp.ConfigurationValue', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ConfigurationValue
    (
        configuration_value_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ConfigurationValue PRIMARY KEY,
        import_id bigint NOT NULL
            CONSTRAINT FK_ConfigurationValue_Import
            REFERENCES mp.ManagementPackImport(import_id) ON DELETE CASCADE,
        mp_element_id bigint NULL
            CONSTRAINT FK_ConfigurationValue_Element
            REFERENCES mp.MpElement(mp_element_id),
        workflow_module_id bigint NULL
            CONSTRAINT FK_ConfigurationValue_WorkflowModule
            REFERENCES mp.WorkflowModule(workflow_module_id),
        owner_kind nvarchar(64) NOT NULL,
        value_name nvarchar(256) NOT NULL,
        value_order int NOT NULL,
        value_text nvarchar(max) NULL,
        value_xml xml NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ConfigurationValue_Name' AND object_id = OBJECT_ID(N'mp.ConfigurationValue'))
    CREATE INDEX IX_ConfigurationValue_Name ON mp.ConfigurationValue(import_id, value_name);

IF OBJECT_ID(N'mp.Rule', N'U') IS NULL
BEGIN
    CREATE TABLE mp.Rule
    (
        rule_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_Rule PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_Rule_Element UNIQUE
            CONSTRAINT FK_Rule_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        rule_ref nvarchar(512) NOT NULL,
        target_ref nvarchar(512) NULL,
        enabled_raw nvarchar(128) NULL,
        enabled_bit bit NULL,
        confirm_delivery bit NULL,
        discard_level int NULL,
        priority nvarchar(64) NULL,
        remotable bit NULL,
        category_value nvarchar(128) NULL,
        generates_alert bit NULL
    );
END;

IF OBJECT_ID(N'mp.Discovery', N'U') IS NULL
BEGIN
    CREATE TABLE mp.Discovery
    (
        discovery_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_Discovery PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_Discovery_Element UNIQUE
            CONSTRAINT FK_Discovery_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        discovery_ref nvarchar(512) NOT NULL,
        target_ref nvarchar(512) NULL,
        enabled_raw nvarchar(128) NULL,
        enabled_bit bit NULL,
        confirm_delivery bit NULL,
        priority nvarchar(64) NULL,
        remotable bit NULL,
        category_value nvarchar(128) NULL
    );
END;

IF OBJECT_ID(N'mp.DiscoveryTypeMapping', N'U') IS NULL
BEGIN
    CREATE TABLE mp.DiscoveryTypeMapping
    (
        discovery_type_mapping_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_DiscoveryTypeMapping PRIMARY KEY,
        discovery_id bigint NOT NULL
            CONSTRAINT FK_DiscoveryTypeMapping_Discovery
            REFERENCES mp.Discovery(discovery_id) ON DELETE CASCADE,
        mapping_kind nvarchar(64) NOT NULL,
        type_ref nvarchar(512) NOT NULL,
        mapping_order int NOT NULL,
        raw_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.Monitor', N'U') IS NULL
BEGIN
    CREATE TABLE mp.Monitor
    (
        monitor_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_Monitor PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_Monitor_Element UNIQUE
            CONSTRAINT FK_Monitor_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        monitor_ref nvarchar(512) NOT NULL,
        monitor_kind nvarchar(64) NOT NULL,
        type_id_ref nvarchar(512) NULL,
        target_ref nvarchar(512) NULL,
        parent_monitor_ref nvarchar(512) NULL,
        member_monitor_ref nvarchar(512) NULL,
        relationship_type_ref nvarchar(512) NULL,
        enabled_raw nvarchar(128) NULL,
        enabled_bit bit NULL,
        priority nvarchar(64) NULL,
        remotable bit NULL,
        category_value nvarchar(128) NULL,
        algorithm nvarchar(128) NULL,
        member_unavailable nvarchar(128) NULL,
        alert_on_state nvarchar(128) NULL,
        alert_severity nvarchar(64) NULL,
        alert_priority nvarchar(64) NULL,
        alert_auto_resolve bit NULL,
        alert_message_ref nvarchar(512) NULL
    );
END;

IF OBJECT_ID(N'mp.MonitorOperationalState', N'U') IS NULL
BEGIN
    CREATE TABLE mp.MonitorOperationalState
    (
        monitor_operational_state_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_MonitorOperationalState PRIMARY KEY,
        monitor_id bigint NOT NULL
            CONSTRAINT FK_MonitorOperationalState_Monitor
            REFERENCES mp.Monitor(monitor_id) ON DELETE CASCADE,
        state_ref nvarchar(256) NOT NULL,
        monitor_type_state_ref nvarchar(512) NULL,
        health_state nvarchar(64) NULL,
        state_order int NOT NULL,
        raw_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.AlertParameter', N'U') IS NULL
BEGIN
    CREATE TABLE mp.AlertParameter
    (
        alert_parameter_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_AlertParameter PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT FK_AlertParameter_Element
            REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        parameter_order int NOT NULL,
        parameter_value nvarchar(max) NULL,
        parameter_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.Task', N'U') IS NULL
BEGIN
    CREATE TABLE mp.Task
    (
        task_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_Task PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_Task_Element UNIQUE
            CONSTRAINT FK_Task_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        task_ref nvarchar(512) NOT NULL,
        task_kind nvarchar(64) NOT NULL,
        target_ref nvarchar(512) NULL,
        enabled_raw nvarchar(128) NULL,
        enabled_bit bit NULL,
        accessibility nvarchar(64) NULL,
        remotable bit NULL,
        category_value nvarchar(128) NULL
    );
END;

IF OBJECT_ID(N'mp.ConsoleTask', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ConsoleTask
    (
        console_task_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ConsoleTask PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_ConsoleTask_Element UNIQUE
            CONSTRAINT FK_ConsoleTask_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        console_task_ref nvarchar(512) NOT NULL,
        target_ref nvarchar(512) NULL,
        accessibility nvarchar(64) NULL,
        require_output bit NULL,
        assembly_ref nvarchar(512) NULL,
        handler nvarchar(512) NULL,
        parameters_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.Override', N'U') IS NULL
BEGIN
    CREATE TABLE mp.Override
    (
        override_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_Override PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_Override_Element UNIQUE
            CONSTRAINT FK_Override_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        override_ref nvarchar(512) NOT NULL,
        override_kind nvarchar(128) NOT NULL,
        context_ref nvarchar(512) NULL,
        workflow_ref nvarchar(512) NULL,
        workflow_kind nvarchar(64) NULL,
        property_name nvarchar(256) NULL,
        parameter_ref nvarchar(256) NULL,
        override_value nvarchar(max) NULL,
        enforced bit NULL
    );
END;

IF OBJECT_ID(N'mp.Category', N'U') IS NULL
BEGIN
    CREATE TABLE mp.Category
    (
        category_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_Category PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_Category_Element UNIQUE
            CONSTRAINT FK_Category_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        category_ref nvarchar(512) NULL,
        target_ref nvarchar(512) NULL,
        category_value nvarchar(128) NULL
    );
END;

IF OBJECT_ID(N'mp.ViewDefinition', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ViewDefinition
    (
        view_definition_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ViewDefinition PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_ViewDefinition_Element UNIQUE
            CONSTRAINT FK_ViewDefinition_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        view_ref nvarchar(512) NOT NULL,
        target_ref nvarchar(512) NULL,
        type_id_ref nvarchar(512) NULL,
        accessibility nvarchar(64) NULL,
        enabled_raw nvarchar(128) NULL,
        enabled_bit bit NULL,
        visible bit NULL,
        category_value nvarchar(128) NULL,
        criteria_xml xml NULL,
        presentation_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.Folder', N'U') IS NULL
BEGIN
    CREATE TABLE mp.Folder
    (
        folder_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_Folder PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_Folder_Element UNIQUE
            CONSTRAINT FK_Folder_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        folder_ref nvarchar(512) NOT NULL,
        parent_folder_ref nvarchar(512) NULL,
        accessibility nvarchar(64) NULL
    );
END;

IF OBJECT_ID(N'mp.FolderItem', N'U') IS NULL
BEGIN
    CREATE TABLE mp.FolderItem
    (
        folder_item_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_FolderItem PRIMARY KEY,
        import_id bigint NOT NULL
            CONSTRAINT FK_FolderItem_Import
            REFERENCES mp.ManagementPackImport(import_id) ON DELETE CASCADE,
        folder_ref nvarchar(512) NOT NULL,
        element_ref nvarchar(512) NOT NULL,
        folder_item_order int NOT NULL,
        raw_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.StringResource', N'U') IS NULL
BEGIN
    CREATE TABLE mp.StringResource
    (
        string_resource_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_StringResource PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_StringResource_Element UNIQUE
            CONSTRAINT FK_StringResource_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        string_resource_ref nvarchar(512) NOT NULL
    );
END;

IF OBJECT_ID(N'mp.ComponentType', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ComponentType
    (
        component_type_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ComponentType PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_ComponentType_Element UNIQUE
            CONSTRAINT FK_ComponentType_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        component_type_ref nvarchar(512) NOT NULL,
        base_ref nvarchar(512) NULL,
        accessibility nvarchar(64) NULL,
        component_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.ComponentImplementation', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ComponentImplementation
    (
        component_implementation_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ComponentImplementation PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_ComponentImplementation_Element UNIQUE
            CONSTRAINT FK_ComponentImplementation_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        component_implementation_ref nvarchar(512) NOT NULL,
        type_id_ref nvarchar(512) NULL,
        target_ref nvarchar(512) NULL,
        platform nvarchar(128) NULL,
        implementation_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.ComponentBehavior', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ComponentBehavior
    (
        component_behavior_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ComponentBehavior PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_ComponentBehavior_Element UNIQUE
            CONSTRAINT FK_ComponentBehavior_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        component_behavior_ref nvarchar(512) NOT NULL,
        component_type_ref nvarchar(512) NULL,
        behavior_type_ref nvarchar(512) NULL,
        bindings_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.ImageReference', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ImageReference
    (
        image_reference_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ImageReference PRIMARY KEY,
        import_id bigint NOT NULL
            CONSTRAINT FK_ImageReference_Import
            REFERENCES mp.ManagementPackImport(import_id) ON DELETE CASCADE,
        element_ref nvarchar(512) NOT NULL,
        image_ref nvarchar(512) NOT NULL,
        raw_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.LanguagePack', N'U') IS NULL
BEGIN
    CREATE TABLE mp.LanguagePack
    (
        language_pack_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_LanguagePack PRIMARY KEY,
        import_id bigint NOT NULL
            CONSTRAINT FK_LanguagePack_Import
            REFERENCES mp.ManagementPackImport(import_id) ON DELETE CASCADE,
        language_code nvarchar(16) NOT NULL,
        is_default bit NULL,
        raw_xml xml NULL,
        CONSTRAINT UQ_LanguagePack_ImportLanguage UNIQUE(import_id, language_code)
    );
END;

IF OBJECT_ID(N'mp.LocalizedText', N'U') IS NULL
BEGIN
    CREATE TABLE mp.LocalizedText
    (
        localized_text_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_LocalizedText PRIMARY KEY,
        language_pack_id bigint NOT NULL
            CONSTRAINT FK_LocalizedText_LanguagePack
            REFERENCES mp.LanguagePack(language_pack_id) ON DELETE CASCADE,
        element_ref nvarchar(512) NOT NULL,
        subelement_ref nvarchar(512) NULL,
        localized_name nvarchar(max) NULL,
        localized_description nvarchar(max) NULL,
        raw_xml xml NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_LocalizedText_Element' AND object_id = OBJECT_ID(N'mp.LocalizedText'))
    CREATE INDEX IX_LocalizedText_Element ON mp.LocalizedText(element_ref, subelement_ref);

IF OBJECT_ID(N'mp.KnowledgeArticle', N'U') IS NULL
BEGIN
    CREATE TABLE mp.KnowledgeArticle
    (
        knowledge_article_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_KnowledgeArticle PRIMARY KEY,
        language_pack_id bigint NOT NULL
            CONSTRAINT FK_KnowledgeArticle_LanguagePack
            REFERENCES mp.LanguagePack(language_pack_id) ON DELETE CASCADE,
        element_ref nvarchar(512) NOT NULL,
        visible bit NULL,
        maml_xml xml NULL,
        raw_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.ResourceDefinition', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ResourceDefinition
    (
        resource_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ResourceDefinition PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_ResourceDefinition_Element UNIQUE
            CONSTRAINT FK_ResourceDefinition_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        resource_ref nvarchar(512) NOT NULL,
        resource_kind nvarchar(64) NOT NULL,
        file_name nvarchar(1024) NULL,
        qualified_name nvarchar(1024) NULL,
        has_null_stream bit NULL,
        accessibility nvarchar(64) NULL
    );
END;

IF OBJECT_ID(N'mp.ResourceDependency', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ResourceDependency
    (
        resource_dependency_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ResourceDependency PRIMARY KEY,
        resource_id bigint NOT NULL
            CONSTRAINT FK_ResourceDependency_Resource
            REFERENCES mp.ResourceDefinition(resource_id) ON DELETE CASCADE,
        dependency_ref nvarchar(1024) NOT NULL,
        dependency_order int NOT NULL,
        raw_xml xml NULL
    );
END;

IF OBJECT_ID(N'mp.DataWarehouseScript', N'U') IS NULL
BEGIN
    CREATE TABLE mp.DataWarehouseScript
    (
        datawarehouse_script_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_DataWarehouseScript PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_DataWarehouseScript_Element UNIQUE
            CONSTRAINT FK_DataWarehouseScript_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        script_ref nvarchar(512) NOT NULL,
        accessibility nvarchar(64) NULL,
        install_script nvarchar(max) NULL,
        uninstall_script nvarchar(max) NULL,
        upgrade_script nvarchar(max) NULL
    );
END;

IF OBJECT_ID(N'mp.ReportDefinition', N'U') IS NULL
BEGIN
    CREATE TABLE mp.ReportDefinition
    (
        report_id bigint IDENTITY(1,1) NOT NULL
            CONSTRAINT PK_ReportDefinition PRIMARY KEY,
        mp_element_id bigint NOT NULL
            CONSTRAINT UQ_ReportDefinition_Element UNIQUE
            CONSTRAINT FK_ReportDefinition_Element REFERENCES mp.MpElement(mp_element_id) ON DELETE CASCADE,
        report_ref nvarchar(512) NOT NULL,
        report_kind nvarchar(64) NOT NULL,
        target_ref nvarchar(512) NULL,
        accessibility nvarchar(64) NULL,
        report_xml xml NULL
    );
END;

COMMIT TRANSACTION;
GO
