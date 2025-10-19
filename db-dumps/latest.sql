--
-- PostgreSQL database dump
--

\restrict hcDVvM0YFNhPBL3v3jmXpTzZOHlaAnCuCnxIkZOTGRhmoBBXhdgSUdbFJk5k7Cg

-- Dumped from database version 15.14 (Debian 15.14-1.pgdg13+1)
-- Dumped by pg_dump version 15.14 (Debian 15.14-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Role" AS ENUM (
    'USER',
    'ADMIN',
    'SUPER_ADMIN'
);


ALTER TYPE public."Role" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: ai_refinements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_refinements (
    "responseId" uuid NOT NULL,
    request text NOT NULL,
    "refinedContent" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.ai_refinements OWNER TO postgres;

--
-- Name: ai_responses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ai_responses (
    "userId" uuid NOT NULL,
    prompt text NOT NULL,
    context text,
    "originalContent" text NOT NULL,
    "currentContent" text NOT NULL,
    "llmProvider" text NOT NULL,
    "llmModel" text NOT NULL,
    "sessionId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.ai_responses OWNER TO postgres;

--
-- Name: dev_methodologies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.dev_methodologies (
    id uuid NOT NULL,
    status character varying(255) DEFAULT 'draft'::character varying NOT NULL,
    sort integer,
    date_created timestamp with time zone,
    date_updated timestamp with time zone,
    name character varying(255),
    profile uuid NOT NULL
);


ALTER TABLE public.dev_methodologies OWNER TO postgres;

--
-- Name: directus_access; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_access (
    id uuid NOT NULL,
    role uuid,
    "user" uuid,
    policy uuid NOT NULL,
    sort integer
);


ALTER TABLE public.directus_access OWNER TO postgres;

--
-- Name: directus_activity; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_activity (
    id integer NOT NULL,
    action character varying(45) NOT NULL,
    "user" uuid,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip character varying(50),
    user_agent text,
    collection character varying(64) NOT NULL,
    item character varying(255) NOT NULL,
    origin character varying(255)
);


ALTER TABLE public.directus_activity OWNER TO postgres;

--
-- Name: directus_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.directus_activity_id_seq OWNER TO postgres;

--
-- Name: directus_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_activity_id_seq OWNED BY public.directus_activity.id;


--
-- Name: directus_collections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_collections (
    collection character varying(64) NOT NULL,
    icon character varying(64),
    note text,
    display_template character varying(255),
    hidden boolean DEFAULT false NOT NULL,
    singleton boolean DEFAULT false NOT NULL,
    translations json,
    archive_field character varying(64),
    archive_app_filter boolean DEFAULT true NOT NULL,
    archive_value character varying(255),
    unarchive_value character varying(255),
    sort_field character varying(64),
    accountability character varying(255) DEFAULT 'all'::character varying,
    color character varying(255),
    item_duplication_fields json,
    sort integer,
    "group" character varying(64),
    collapse character varying(255) DEFAULT 'open'::character varying NOT NULL,
    preview_url character varying(255),
    versioning boolean DEFAULT false NOT NULL
);


ALTER TABLE public.directus_collections OWNER TO postgres;

--
-- Name: directus_comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_comments (
    id uuid NOT NULL,
    collection character varying(64) NOT NULL,
    item character varying(255) NOT NULL,
    comment text NOT NULL,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    date_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid,
    user_updated uuid
);


ALTER TABLE public.directus_comments OWNER TO postgres;

--
-- Name: directus_dashboards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_dashboards (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    icon character varying(64) DEFAULT 'dashboard'::character varying NOT NULL,
    note text,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid,
    color character varying(255)
);


ALTER TABLE public.directus_dashboards OWNER TO postgres;

--
-- Name: directus_extensions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_extensions (
    enabled boolean DEFAULT true NOT NULL,
    id uuid NOT NULL,
    folder character varying(255) NOT NULL,
    source character varying(255) NOT NULL,
    bundle uuid
);


ALTER TABLE public.directus_extensions OWNER TO postgres;

--
-- Name: directus_fields; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_fields (
    id integer NOT NULL,
    collection character varying(64) NOT NULL,
    field character varying(64) NOT NULL,
    special character varying(64),
    interface character varying(64),
    options json,
    display character varying(64),
    display_options json,
    readonly boolean DEFAULT false NOT NULL,
    hidden boolean DEFAULT false NOT NULL,
    sort integer,
    width character varying(30) DEFAULT 'full'::character varying,
    translations json,
    note text,
    conditions json,
    required boolean DEFAULT false,
    "group" character varying(64),
    validation json,
    validation_message text
);


ALTER TABLE public.directus_fields OWNER TO postgres;

--
-- Name: directus_fields_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_fields_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.directus_fields_id_seq OWNER TO postgres;

--
-- Name: directus_fields_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_fields_id_seq OWNED BY public.directus_fields.id;


--
-- Name: directus_files; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_files (
    id uuid NOT NULL,
    storage character varying(255) NOT NULL,
    filename_disk character varying(255),
    filename_download character varying(255) NOT NULL,
    title character varying(255),
    type character varying(255),
    folder uuid,
    uploaded_by uuid,
    created_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    modified_by uuid,
    modified_on timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    charset character varying(50),
    filesize bigint,
    width integer,
    height integer,
    duration integer,
    embed character varying(200),
    description text,
    location text,
    tags text,
    metadata json,
    focal_point_x integer,
    focal_point_y integer,
    tus_id character varying(64),
    tus_data json,
    uploaded_on timestamp with time zone
);


ALTER TABLE public.directus_files OWNER TO postgres;

--
-- Name: directus_flows; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_flows (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    icon character varying(64),
    color character varying(255),
    description text,
    status character varying(255) DEFAULT 'active'::character varying NOT NULL,
    trigger character varying(255),
    accountability character varying(255) DEFAULT 'all'::character varying,
    options json,
    operation uuid,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid
);


ALTER TABLE public.directus_flows OWNER TO postgres;

--
-- Name: directus_folders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_folders (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    parent uuid
);


ALTER TABLE public.directus_folders OWNER TO postgres;

--
-- Name: directus_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_migrations (
    version character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.directus_migrations OWNER TO postgres;

--
-- Name: directus_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_notifications (
    id integer NOT NULL,
    "timestamp" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    status character varying(255) DEFAULT 'inbox'::character varying,
    recipient uuid NOT NULL,
    sender uuid,
    subject character varying(255) NOT NULL,
    message text,
    collection character varying(64),
    item character varying(255)
);


ALTER TABLE public.directus_notifications OWNER TO postgres;

--
-- Name: directus_notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.directus_notifications_id_seq OWNER TO postgres;

--
-- Name: directus_notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_notifications_id_seq OWNED BY public.directus_notifications.id;


--
-- Name: directus_operations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_operations (
    id uuid NOT NULL,
    name character varying(255),
    key character varying(255) NOT NULL,
    type character varying(255) NOT NULL,
    position_x integer NOT NULL,
    position_y integer NOT NULL,
    options json,
    resolve uuid,
    reject uuid,
    flow uuid NOT NULL,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid
);


ALTER TABLE public.directus_operations OWNER TO postgres;

--
-- Name: directus_panels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_panels (
    id uuid NOT NULL,
    dashboard uuid NOT NULL,
    name character varying(255),
    icon character varying(64) DEFAULT NULL::character varying,
    color character varying(10),
    show_header boolean DEFAULT false NOT NULL,
    note text,
    type character varying(255) NOT NULL,
    position_x integer NOT NULL,
    position_y integer NOT NULL,
    width integer NOT NULL,
    height integer NOT NULL,
    options json,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid
);


ALTER TABLE public.directus_panels OWNER TO postgres;

--
-- Name: directus_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_permissions (
    id integer NOT NULL,
    collection character varying(64) NOT NULL,
    action character varying(10) NOT NULL,
    permissions json,
    validation json,
    presets json,
    fields text,
    policy uuid NOT NULL
);


ALTER TABLE public.directus_permissions OWNER TO postgres;

--
-- Name: directus_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_permissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.directus_permissions_id_seq OWNER TO postgres;

--
-- Name: directus_permissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_permissions_id_seq OWNED BY public.directus_permissions.id;


--
-- Name: directus_policies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_policies (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    icon character varying(64) DEFAULT 'badge'::character varying NOT NULL,
    description text,
    ip_access text,
    enforce_tfa boolean DEFAULT false NOT NULL,
    admin_access boolean DEFAULT false NOT NULL,
    app_access boolean DEFAULT false NOT NULL
);


ALTER TABLE public.directus_policies OWNER TO postgres;

--
-- Name: directus_presets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_presets (
    id integer NOT NULL,
    bookmark character varying(255),
    "user" uuid,
    role uuid,
    collection character varying(64),
    search character varying(100),
    layout character varying(100) DEFAULT 'tabular'::character varying,
    layout_query json,
    layout_options json,
    refresh_interval integer,
    filter json,
    icon character varying(64) DEFAULT 'bookmark'::character varying,
    color character varying(255)
);


ALTER TABLE public.directus_presets OWNER TO postgres;

--
-- Name: directus_presets_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_presets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.directus_presets_id_seq OWNER TO postgres;

--
-- Name: directus_presets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_presets_id_seq OWNED BY public.directus_presets.id;


--
-- Name: directus_relations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_relations (
    id integer NOT NULL,
    many_collection character varying(64) NOT NULL,
    many_field character varying(64) NOT NULL,
    one_collection character varying(64),
    one_field character varying(64),
    one_collection_field character varying(64),
    one_allowed_collections text,
    junction_field character varying(64),
    sort_field character varying(64),
    one_deselect_action character varying(255) DEFAULT 'nullify'::character varying NOT NULL
);


ALTER TABLE public.directus_relations OWNER TO postgres;

--
-- Name: directus_relations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_relations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.directus_relations_id_seq OWNER TO postgres;

--
-- Name: directus_relations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_relations_id_seq OWNED BY public.directus_relations.id;


--
-- Name: directus_revisions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_revisions (
    id integer NOT NULL,
    activity integer NOT NULL,
    collection character varying(64) NOT NULL,
    item character varying(255) NOT NULL,
    data json,
    delta json,
    parent integer,
    version uuid
);


ALTER TABLE public.directus_revisions OWNER TO postgres;

--
-- Name: directus_revisions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_revisions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.directus_revisions_id_seq OWNER TO postgres;

--
-- Name: directus_revisions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_revisions_id_seq OWNED BY public.directus_revisions.id;


--
-- Name: directus_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_roles (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    icon character varying(64) DEFAULT 'supervised_user_circle'::character varying NOT NULL,
    description text,
    parent uuid
);


ALTER TABLE public.directus_roles OWNER TO postgres;

--
-- Name: directus_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_sessions (
    token character varying(64) NOT NULL,
    "user" uuid,
    expires timestamp with time zone NOT NULL,
    ip character varying(255),
    user_agent text,
    share uuid,
    origin character varying(255),
    next_token character varying(64)
);


ALTER TABLE public.directus_sessions OWNER TO postgres;

--
-- Name: directus_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_settings (
    id integer NOT NULL,
    project_name character varying(100) DEFAULT 'Directus'::character varying NOT NULL,
    project_url character varying(255),
    project_color character varying(255) DEFAULT '#6644FF'::character varying NOT NULL,
    project_logo uuid,
    public_foreground uuid,
    public_background uuid,
    public_note text,
    auth_login_attempts integer DEFAULT 25,
    auth_password_policy character varying(100),
    storage_asset_transform character varying(7) DEFAULT 'all'::character varying,
    storage_asset_presets json,
    custom_css text,
    storage_default_folder uuid,
    basemaps json,
    mapbox_key character varying(255),
    module_bar json,
    project_descriptor character varying(100),
    default_language character varying(255) DEFAULT 'en-US'::character varying NOT NULL,
    custom_aspect_ratios json,
    public_favicon uuid,
    default_appearance character varying(255) DEFAULT 'auto'::character varying NOT NULL,
    default_theme_light character varying(255),
    theme_light_overrides json,
    default_theme_dark character varying(255),
    theme_dark_overrides json,
    report_error_url character varying(255),
    report_bug_url character varying(255),
    report_feature_url character varying(255),
    public_registration boolean DEFAULT false NOT NULL,
    public_registration_verify_email boolean DEFAULT true NOT NULL,
    public_registration_role uuid,
    public_registration_email_filter json,
    visual_editor_urls json,
    accepted_terms boolean DEFAULT false,
    project_id uuid,
    mcp_enabled boolean DEFAULT false NOT NULL,
    mcp_allow_deletes boolean DEFAULT false NOT NULL,
    mcp_prompts_collection character varying(255) DEFAULT NULL::character varying,
    mcp_system_prompt_enabled boolean DEFAULT true NOT NULL,
    mcp_system_prompt text
);


ALTER TABLE public.directus_settings OWNER TO postgres;

--
-- Name: directus_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.directus_settings_id_seq OWNER TO postgres;

--
-- Name: directus_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_settings_id_seq OWNED BY public.directus_settings.id;


--
-- Name: directus_shares; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_shares (
    id uuid NOT NULL,
    name character varying(255),
    collection character varying(64) NOT NULL,
    item character varying(255) NOT NULL,
    role uuid,
    password character varying(255),
    user_created uuid,
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    date_start timestamp with time zone,
    date_end timestamp with time zone,
    times_used integer DEFAULT 0,
    max_uses integer
);


ALTER TABLE public.directus_shares OWNER TO postgres;

--
-- Name: directus_translations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_translations (
    id uuid NOT NULL,
    language character varying(255) NOT NULL,
    key character varying(255) NOT NULL,
    value text NOT NULL
);


ALTER TABLE public.directus_translations OWNER TO postgres;

--
-- Name: directus_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_users (
    id uuid NOT NULL,
    first_name character varying(50),
    last_name character varying(50),
    email character varying(128),
    password character varying(255),
    location character varying(255),
    title character varying(50),
    description text,
    tags json,
    avatar uuid,
    language character varying(255) DEFAULT NULL::character varying,
    tfa_secret character varying(255),
    status character varying(16) DEFAULT 'active'::character varying NOT NULL,
    role uuid,
    token character varying(255),
    last_access timestamp with time zone,
    last_page character varying(255),
    provider character varying(128) DEFAULT 'default'::character varying NOT NULL,
    external_identifier character varying(255),
    auth_data json,
    email_notifications boolean DEFAULT true,
    appearance character varying(255),
    theme_dark character varying(255),
    theme_light character varying(255),
    theme_light_overrides json,
    theme_dark_overrides json,
    text_direction character varying(255) DEFAULT 'auto'::character varying NOT NULL
);


ALTER TABLE public.directus_users OWNER TO postgres;

--
-- Name: directus_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_versions (
    id uuid NOT NULL,
    key character varying(64) NOT NULL,
    name character varying(255),
    collection character varying(64) NOT NULL,
    item character varying(255) NOT NULL,
    hash character varying(255),
    date_created timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    date_updated timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    user_created uuid,
    user_updated uuid,
    delta json
);


ALTER TABLE public.directus_versions OWNER TO postgres;

--
-- Name: directus_webhooks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.directus_webhooks (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    method character varying(10) DEFAULT 'POST'::character varying NOT NULL,
    url character varying(255) NOT NULL,
    status character varying(10) DEFAULT 'active'::character varying NOT NULL,
    data boolean DEFAULT true NOT NULL,
    actions character varying(100) NOT NULL,
    collections character varying(255) NOT NULL,
    headers json,
    was_active_before_deprecation boolean DEFAULT false NOT NULL,
    migrated_flow uuid
);


ALTER TABLE public.directus_webhooks OWNER TO postgres;

--
-- Name: directus_webhooks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.directus_webhooks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.directus_webhooks_id_seq OWNER TO postgres;

--
-- Name: directus_webhooks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.directus_webhooks_id_seq OWNED BY public.directus_webhooks.id;


--
-- Name: highlights; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.highlights (
    id uuid NOT NULL,
    status character varying(255) DEFAULT 'draft'::character varying NOT NULL,
    sort integer,
    date_created timestamp with time zone,
    date_updated timestamp with time zone,
    profile uuid,
    text character varying(255),
    fa_icon character varying(255)
);


ALTER TABLE public.highlights OWNER TO postgres;

--
-- Name: languages; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.languages (
    id uuid NOT NULL,
    status character varying(255) DEFAULT 'draft'::character varying NOT NULL,
    date_created timestamp with time zone,
    date_updated timestamp with time zone,
    name character varying(255),
    language_code character varying(255),
    proficiency character varying(255),
    profile uuid
);


ALTER TABLE public.languages OWNER TO postgres;

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    date_created timestamp with time zone,
    date_updated timestamp with time zone,
    name character varying(255),
    title character varying(255),
    location character varying(255),
    phone_number character varying(255),
    email_address character varying(255),
    personal_website character varying(255),
    subtitle character varying(255),
    core_stack character varying(255),
    linkedin_profile character varying(255),
    github_profile character varying(255),
    stackoverflow_profile character varying(255),
    headline character varying(255),
    profile_picture uuid
);


ALTER TABLE public.profiles OWNER TO postgres;

--
-- Name: resume_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resume_tokens (
    token text NOT NULL,
    name text NOT NULL,
    description text,
    "resumeType" text NOT NULL,
    "expiresAt" timestamp(3) without time zone,
    "viewCount" integer DEFAULT 0 NOT NULL,
    "maxViews" integer,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdBy" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.resume_tokens OWNER TO postgres;

--
-- Name: soft_skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.soft_skills (
    id uuid NOT NULL,
    status character varying(255) DEFAULT 'draft'::character varying NOT NULL,
    sort integer,
    date_created timestamp with time zone,
    date_updated timestamp with time zone,
    name character varying(255),
    profile uuid
);


ALTER TABLE public.soft_skills OWNER TO postgres;

--
-- Name: tech_skill_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tech_skill_categories (
    id uuid NOT NULL,
    status character varying(255) DEFAULT 'draft'::character varying NOT NULL,
    sort integer,
    date_created timestamp with time zone,
    date_updated timestamp with time zone,
    name character varying(255)
);


ALTER TABLE public.tech_skill_categories OWNER TO postgres;

--
-- Name: tech_skill_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tech_skill_types (
    id integer NOT NULL,
    status character varying(255) DEFAULT 'draft'::character varying NOT NULL,
    sort integer,
    date_created timestamp with time zone,
    date_updated timestamp with time zone,
    name character varying(255)
);


ALTER TABLE public.tech_skill_types OWNER TO postgres;

--
-- Name: tech_skill_types_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tech_skill_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tech_skill_types_id_seq OWNER TO postgres;

--
-- Name: tech_skill_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tech_skill_types_id_seq OWNED BY public.tech_skill_types.id;


--
-- Name: tech_skills; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tech_skills (
    id integer NOT NULL,
    status character varying(255) DEFAULT 'draft'::character varying NOT NULL,
    sort integer,
    date_created timestamp with time zone,
    date_updated timestamp with time zone,
    profile uuid,
    name character varying(255),
    category uuid,
    years_experience character varying(255),
    level character varying(255),
    tech_type integer
);


ALTER TABLE public.tech_skills OWNER TO postgres;

--
-- Name: tech_skills_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tech_skills_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.tech_skills_id_seq OWNER TO postgres;

--
-- Name: tech_skills_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tech_skills_id_seq OWNED BY public.tech_skills.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    email text NOT NULL,
    password text NOT NULL,
    "firstName" text,
    "lastName" text,
    "isEmailVerified" boolean DEFAULT false NOT NULL,
    "emailVerifyToken" text,
    "passwordResetToken" text,
    "passwordResetExpiry" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    role public."Role" DEFAULT 'USER'::public."Role" NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: work_experience_achievements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_experience_achievements (
    id uuid NOT NULL,
    status character varying(255) DEFAULT 'draft'::character varying NOT NULL,
    sort integer,
    date_created timestamp with time zone,
    date_updated timestamp with time zone,
    title character varying(255),
    description character varying(255),
    work_experience uuid,
    fa_icon character varying(255),
    tags json
);


ALTER TABLE public.work_experience_achievements OWNER TO postgres;

--
-- Name: work_experiences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_experiences (
    name text NOT NULL,
    location text NOT NULL,
    description text NOT NULL,
    "position" text NOT NULL,
    summary text NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    logo uuid,
    status character varying(255) DEFAULT 'draft'::character varying NOT NULL,
    sort integer,
    profile uuid,
    date_created timestamp with time zone,
    date_updated timestamp with time zone,
    start_date date,
    end_date date,
    website character varying(255)
);


ALTER TABLE public.work_experiences OWNER TO postgres;

--
-- Name: work_highlight_tags; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_highlight_tags (
    "highlightId" uuid NOT NULL,
    "tagName" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.work_highlight_tags OWNER TO postgres;

--
-- Name: work_highlights; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_highlights (
    "workExperienceId" uuid NOT NULL,
    title text,
    description text NOT NULL,
    "iconName" text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.work_highlights OWNER TO postgres;

--
-- Name: work_projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_projects (
    "workExperienceId" uuid NOT NULL,
    name text NOT NULL,
    "startDate" text NOT NULL,
    "endDate" text NOT NULL,
    summary text NOT NULL,
    description text NOT NULL,
    outcome text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.work_projects OWNER TO postgres;

--
-- Name: work_technologies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_technologies (
    "workExperienceId" uuid NOT NULL,
    "technologyName" text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


ALTER TABLE public.work_technologies OWNER TO postgres;

--
-- Name: directus_activity id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_activity ALTER COLUMN id SET DEFAULT nextval('public.directus_activity_id_seq'::regclass);


--
-- Name: directus_fields id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_fields ALTER COLUMN id SET DEFAULT nextval('public.directus_fields_id_seq'::regclass);


--
-- Name: directus_notifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_notifications ALTER COLUMN id SET DEFAULT nextval('public.directus_notifications_id_seq'::regclass);


--
-- Name: directus_permissions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_permissions ALTER COLUMN id SET DEFAULT nextval('public.directus_permissions_id_seq'::regclass);


--
-- Name: directus_presets id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_presets ALTER COLUMN id SET DEFAULT nextval('public.directus_presets_id_seq'::regclass);


--
-- Name: directus_relations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_relations ALTER COLUMN id SET DEFAULT nextval('public.directus_relations_id_seq'::regclass);


--
-- Name: directus_revisions id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_revisions ALTER COLUMN id SET DEFAULT nextval('public.directus_revisions_id_seq'::regclass);


--
-- Name: directus_settings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_settings ALTER COLUMN id SET DEFAULT nextval('public.directus_settings_id_seq'::regclass);


--
-- Name: directus_webhooks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_webhooks ALTER COLUMN id SET DEFAULT nextval('public.directus_webhooks_id_seq'::regclass);


--
-- Name: tech_skill_types id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tech_skill_types ALTER COLUMN id SET DEFAULT nextval('public.tech_skill_types_id_seq'::regclass);


--
-- Name: tech_skills id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tech_skills ALTER COLUMN id SET DEFAULT nextval('public.tech_skills_id_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
01b0c92e-5b32-441d-ac4c-36b0c61a6209	6f75a511317f52c801637057bfa239227482e4464687a83ac8b57547b0a590d0	2025-10-15 11:34:25.859255+00	20250828150944_init	\N	\N	2025-10-15 11:34:25.853886+00	1
2750efec-a5ed-45f8-9579-e91a6836e630	11afbeb0fcae4e489583fd55cc25e9835f016e65f8d27e3535d41c1a3ba5741d	2025-10-15 11:34:25.861738+00	20250828155716_add_user_roles	\N	\N	2025-10-15 11:34:25.859797+00	1
bbb5000a-c54f-4ab0-83f7-578cd23c26ad	18a8cbd87255f697493dfee84f0bf9ce0a2b4730dc4d31267559ba2250bd70f9	2025-10-15 11:34:25.868483+00	20250828161348_add_resume_tokens	\N	\N	2025-10-15 11:34:25.86224+00	1
ec688bd1-81b0-4521-ad28-34e67afb1e0d	111d08880ff5af0f9654acdf1b66cc585a113a91f225e4ee91184dc346fdb429	2025-10-15 11:34:25.877879+00	20250905110242_add_ai_responses_refinements	\N	\N	2025-10-15 11:34:25.869137+00	1
651f0cf5-8a11-4777-8a7a-8a1f2643ed40	24131d2168f288587e37859652816d9663f6570e8a5fde2089ee99d84bb20f01	2025-10-15 11:34:25.892008+00	20250905131408_add_work_experience_tables	\N	\N	2025-10-15 11:34:25.87871+00	1
340222fa-aa90-469a-9def-108f5a2e117b	c11450bef14cbe1f01da89aa768f8d99d5fdb91579873e74b0fed6df6931acc7	2025-10-15 11:34:25.9055+00	20250906141612_use_postgres_gen_random_uuid_for_work_experience	\N	\N	2025-10-15 11:34:25.892536+00	1
29ef25f4-1daf-4781-9edb-64238b7a1d58	6351ecc3d0577a365d0382c0d87bb5db1cfa062fb75c8c1140de071c96b5772b	2025-10-15 11:34:25.933525+00	20250906150352_convert_all_cuid_to_uuid	\N	\N	2025-10-15 11:34:25.906277+00	1
db7d5ea4-2423-40a1-9c8e-4dfd491bcf8c	e007dd1db84eebfec72b2d729b52b3522237775a0923922f57316de012c236fc	2025-10-15 11:34:25.935911+00	20251001145143_logo_to_uuid_for_directus_upload	\N	\N	2025-10-15 11:34:25.934076+00	1
\.


--
-- Data for Name: ai_refinements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_refinements ("responseId", request, "refinedContent", "createdAt", id) FROM stdin;
\.


--
-- Data for Name: ai_responses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ai_responses ("userId", prompt, context, "originalContent", "currentContent", "llmProvider", "llmModel", "sessionId", "createdAt", "updatedAt", id) FROM stdin;
\.


--
-- Data for Name: dev_methodologies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.dev_methodologies (id, status, sort, date_created, date_updated, name, profile) FROM stdin;
6eff8fef-bded-49f0-b58a-711aea500221	published	\N	2025-10-19 16:17:34.022+00	\N	Agile	0eeb942b-e35a-44e8-a37d-52b9cdb24309
84a7411e-3601-44d3-abc7-251348ece546	published	\N	2025-10-19 16:19:23.9+00	\N	Scrum	0eeb942b-e35a-44e8-a37d-52b9cdb24309
01d355bd-7b80-4806-a9c3-c5277a945996	published	\N	2025-10-19 16:19:23.903+00	\N	Kanban	0eeb942b-e35a-44e8-a37d-52b9cdb24309
856ee579-71ba-434b-b9e2-7355b8cd8e13	published	\N	2025-10-19 16:19:23.906+00	\N	Extreme Programming (XP)	0eeb942b-e35a-44e8-a37d-52b9cdb24309
fd9086a3-071a-458c-9e50-accbf3bff907	published	\N	2025-10-19 16:19:23.91+00	\N	AI-accelerated development	0eeb942b-e35a-44e8-a37d-52b9cdb24309
44f7c501-4fef-47b8-8f4f-8a98fe155ed2	published	\N	2025-10-19 16:19:23.912+00	\N	Secure by design	0eeb942b-e35a-44e8-a37d-52b9cdb24309
4831ab97-9ffa-4518-a701-844fe0a3e5d2	published	\N	2025-10-19 16:19:23.914+00	\N	Test-driven development (TDD)	0eeb942b-e35a-44e8-a37d-52b9cdb24309
9beb25c0-e7f2-4699-88d5-8619ac65f060	published	\N	2025-10-19 16:19:23.915+00	\N	User experience design (UXD)	0eeb942b-e35a-44e8-a37d-52b9cdb24309
94c1e7c6-f687-4a45-b870-1c922baacd2d	published	\N	2025-10-19 16:19:23.916+00	\N	Asynchronous Workflows	0eeb942b-e35a-44e8-a37d-52b9cdb24309
af4c406b-bf9e-4f65-b196-5ff37c57eba9	published	\N	2025-10-19 16:19:23.918+00	\N	Component-based development	0eeb942b-e35a-44e8-a37d-52b9cdb24309
c9622a84-fb17-4bfe-87c4-cac33d30ef5c	published	\N	2025-10-19 16:19:23.919+00	\N	Extensive code reviewing	0eeb942b-e35a-44e8-a37d-52b9cdb24309
fc191739-71ff-444f-a64f-c4ff739ceadf	published	\N	2025-10-19 16:19:23.921+00	\N	Writing and maintaining documentation	0eeb942b-e35a-44e8-a37d-52b9cdb24309
a80c302e-c184-4e50-8b7d-c4e4bee261c8	published	\N	2025-10-19 16:19:23.924+00	\N	Pair-programming	0eeb942b-e35a-44e8-a37d-52b9cdb24309
\.


--
-- Data for Name: directus_access; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_access (id, role, "user", policy, sort) FROM stdin;
0e236704-23fc-4110-9406-ba58510239e4	\N	\N	abf8a154-5b1c-4a46-ac9c-7300570f4f17	1
66e8420c-0a37-41e6-92e6-3492ad5b740c	17756a67-2cbc-42b5-bb7c-906f79444fb3	\N	0a0d53b2-3692-4892-bacc-3be26b02c0e3	\N
\.


--
-- Data for Name: directus_activity; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_activity (id, action, "user", "timestamp", ip, user_agent, collection, item, origin) FROM stdin;
368	login	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 11:49:17.375+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_users	157238bb-6930-4f26-be9c-8b31a9e11ab8	http://localhost:8055
369	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 11:50:57.633+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	30	http://localhost:8055
370	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 11:50:57.638+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	31	http://localhost:8055
371	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 11:50:57.64+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	32	http://localhost:8055
372	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 11:50:57.643+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	33	http://localhost:8055
373	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 11:50:57.647+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
374	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 11:51:09.57+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	34	http://localhost:8055
375	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 11:51:13.212+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	34	http://localhost:8055
376	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 11:52:12.816+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	35	http://localhost:8055
377	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 11:52:16.961+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	35	http://localhost:8055
378	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 11:52:47.27+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	35	http://localhost:8055
379	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 11:55:36.918+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	36	http://localhost:8055
380	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 11:56:55.63+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	37	http://localhost:8055
381	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 11:58:34.094+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	37	http://localhost:8055
382	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:00:18.672+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	25	http://localhost:8055
383	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:00:35.564+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profiles	http://localhost:8055
384	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:00:35.572+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
385	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:00:35.597+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
386	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:00:35.627+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
387	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:01:43.821+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	38	http://localhost:8055
388	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:01:43.891+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
389	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:01:58.481+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
390	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:02:18.086+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
391	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:02:18.094+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
392	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:02:18.099+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
393	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:02:18.103+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
394	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:02:18.109+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
395	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:02:18.115+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
396	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:02:18.119+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
397	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:02:18.123+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
398	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:02:18.128+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
399	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:02:18.132+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	29	http://localhost:8055
400	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:02:18.135+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
401	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:02:18.14+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
402	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:03:30.885+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	languages	b636a780-6a9f-4342-adfa-eed183447a17	http://localhost:8055
403	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:03:30.888+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	languages	7024cec2-289e-44e5-a4e8-721805a151a0	http://localhost:8055
404	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:03:30.89+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
405	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:03:49.398+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
406	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:04:07.807+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
407	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:04:10.815+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
408	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:04:12.953+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
409	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:05:34.24+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_settings	1	http://localhost:8055
410	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:37:43.617+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	40	http://localhost:8055
411	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:37:43.621+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	41	http://localhost:8055
412	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:37:43.624+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	42	http://localhost:8055
413	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:37:43.627+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	43	http://localhost:8055
414	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:37:43.631+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	headlines	http://localhost:8055
415	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:42:12.515+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	44	http://localhost:8055
416	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:42:20.769+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	45	http://localhost:8055
417	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:43:27.154+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	46	http://localhost:8055
418	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:43:27.232+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	47	http://localhost:8055
419	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:43:43.316+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
420	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:43:43.321+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
421	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:43:43.327+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
422	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:43:43.332+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
423	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:43:43.336+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
424	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:43:43.34+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
425	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:43:43.345+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
426	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:43:43.35+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
427	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:43:43.355+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
428	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:43:43.363+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	29	http://localhost:8055
429	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:43:43.367+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
430	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:43:43.37+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	47	http://localhost:8055
431	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:43:43.374+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
432	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:44:04.868+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
433	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:44:15.499+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	47	http://localhost:8055
434	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:07.433+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	headlines	http://localhost:8055
435	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:07.433+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profiles	http://localhost:8055
436	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:07.439+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
437	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:07.443+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
438	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:07.45+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
439	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:19.302+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profiles	http://localhost:8055
440	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:19.306+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
441	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:19.311+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	headlines	http://localhost:8055
442	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:19.318+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
443	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:19.321+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
444	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:26.836+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profiles	http://localhost:8055
445	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:26.839+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
446	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:26.842+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	headlines	http://localhost:8055
447	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:26.846+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
448	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:26.849+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
449	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:35.132+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
451	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:35.136+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	headlines	http://localhost:8055
455	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:37.203+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profiles	http://localhost:8055
457	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:37.208+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
459	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:46:41+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	headlines	http://localhost:8055
450	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:35.132+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profiles	http://localhost:8055
452	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:35.136+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
453	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:35.141+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
454	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:37.202+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
456	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:37.206+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	headlines	http://localhost:8055
458	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:45:37.212+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
461	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:47:02.108+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
462	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:48:00.671+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	47	http://localhost:8055
463	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:48:36.929+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	44	http://localhost:8055
464	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:49:02.992+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	headlines	http://localhost:8055
465	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:49:13.791+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	47	http://localhost:8055
466	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:08.664+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
467	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:15.316+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
468	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:33.671+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
469	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:37.563+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
470	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:37.567+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
471	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:37.571+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
472	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:37.578+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
473	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:37.583+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
474	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:37.586+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
475	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:37.592+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
476	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:37.596+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
477	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:37.6+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
478	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:37.604+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
479	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:37.61+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	29	http://localhost:8055
480	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:37.613+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
481	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:37.618+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	47	http://localhost:8055
482	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:04:37.623+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
483	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:05:01.081+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
484	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:05:04.015+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
485	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:05:15.037+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
486	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:16.359+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	49	http://localhost:8055
487	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:20.818+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
488	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:20.823+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
489	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:20.827+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
490	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:20.832+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
491	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:20.836+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
492	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:20.84+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	49	http://localhost:8055
493	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:20.843+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
494	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:20.849+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
495	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:20.852+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
496	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:20.857+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
497	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:20.86+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
498	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:20.866+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	29	http://localhost:8055
499	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:20.869+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
500	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:20.872+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	47	http://localhost:8055
501	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:20.875+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
502	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:09:30.225+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
503	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:36:43.033+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	49	http://localhost:8055
504	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:40:13.905+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
505	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:41:17.814+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
506	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:41:52.665+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	29	http://localhost:8055
507	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:13.781+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	50	http://localhost:8055
508	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:17.471+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	50	http://localhost:8055
509	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:30.224+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	51	http://localhost:8055
510	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:33.372+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	51	http://localhost:8055
511	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:43.726+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
512	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:43.773+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
513	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:43.784+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
514	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:43.79+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
515	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:43.795+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
516	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:43.799+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	49	http://localhost:8055
517	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:43.805+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
518	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:43.808+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
519	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:43.811+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
520	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:43.814+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
521	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:43.82+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
522	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:43.823+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	50	http://localhost:8055
523	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:43.826+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
524	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:43.828+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	47	http://localhost:8055
525	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:43.831+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
526	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:43.838+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	51	http://localhost:8055
527	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:46.905+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
528	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:46.908+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
529	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:46.912+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
530	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:46.916+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
531	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:46.923+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
532	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:46.927+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	49	http://localhost:8055
533	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:46.931+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
534	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:46.935+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
535	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:46.939+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
536	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:46.942+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
537	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:46.945+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
538	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:46.948+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	50	http://localhost:8055
539	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:46.954+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	51	http://localhost:8055
540	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:46.959+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
541	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:46.962+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	47	http://localhost:8055
542	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:42:46.967+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
543	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:43:14.91+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
544	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:21.904+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	52	http://localhost:8055
545	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:26.596+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	52	http://localhost:8055
546	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.022+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
547	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.025+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
548	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.029+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
549	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.032+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
550	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.035+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
551	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.041+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	49	http://localhost:8055
552	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.045+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
553	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.048+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
554	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.051+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
555	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.056+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
556	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.059+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
557	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.062+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	50	http://localhost:8055
558	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.067+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	51	http://localhost:8055
559	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.072+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	52	http://localhost:8055
560	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.076+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
561	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.079+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	47	http://localhost:8055
562	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:29.083+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
563	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:41.83+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
564	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:53.763+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	52	http://localhost:8055
565	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:56.021+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	50	http://localhost:8055
566	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:44:58.308+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	51	http://localhost:8055
567	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 13:45:02.448+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
568	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:26:43.848+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	47	http://localhost:8055
569	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:26:49.939+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	headlines	http://localhost:8055
570	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:26:49.941+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	40	http://localhost:8055
571	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:26:49.942+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	41	http://localhost:8055
572	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:26:49.942+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	42	http://localhost:8055
573	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:26:49.942+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	43	http://localhost:8055
574	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:26:49.943+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	45	http://localhost:8055
575	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:26:49.943+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	46	http://localhost:8055
576	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:23.986+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	53	http://localhost:8055
577	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.881+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
578	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.885+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
579	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.888+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
580	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.895+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
581	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.899+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
582	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.902+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	49	http://localhost:8055
583	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.905+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
584	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.91+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
585	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.913+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
586	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.916+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	53	http://localhost:8055
587	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.921+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
588	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.925+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
589	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.928+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	50	http://localhost:8055
590	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.931+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	51	http://localhost:8055
591	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.934+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	52	http://localhost:8055
592	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.937+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
593	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:27.941+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
594	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.322+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
595	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.33+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
596	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.334+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
597	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.337+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
598	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.341+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
599	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.347+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	49	http://localhost:8055
600	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.351+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
601	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.354+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	53	http://localhost:8055
602	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.358+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
603	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.363+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
604	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.366+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
605	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.369+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
606	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.372+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	50	http://localhost:8055
607	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.377+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	51	http://localhost:8055
608	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.381+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	52	http://localhost:8055
609	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.384+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
610	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:33.387+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
611	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:28:43.419+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
612	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:08.443+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	54	http://localhost:8055
613	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.88+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
614	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.885+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
615	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.889+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
616	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.892+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
617	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.898+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
618	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.901+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	49	http://localhost:8055
619	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.904+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
620	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.907+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	53	http://localhost:8055
621	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.91+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
622	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.914+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
623	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.918+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
624	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.922+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	54	http://localhost:8055
625	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.925+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
626	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.93+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	50	http://localhost:8055
627	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.933+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	51	http://localhost:8055
628	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.936+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	52	http://localhost:8055
629	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.939+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
630	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:11.942+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
631	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:44.846+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_files	e12c8ec6-2cbe-4672-98e9-a33d6ed5869a	http://localhost:8055
632	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:47.39+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
633	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:06.617+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	54	http://localhost:8055
634	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:21.478+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	54	http://localhost:8055
635	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.019+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
636	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.024+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
637	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.028+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
638	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.033+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
639	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.038+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
640	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.041+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	49	http://localhost:8055
641	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.045+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
642	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.05+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	53	http://localhost:8055
643	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.054+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	54	http://localhost:8055
644	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.056+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
645	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.06+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
646	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.063+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
647	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.069+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
648	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.073+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	50	http://localhost:8055
649	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.076+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	51	http://localhost:8055
650	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.079+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	52	http://localhost:8055
651	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.084+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
652	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:32:59.088+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
653	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.274+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
654	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.278+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
655	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.285+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
656	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.29+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
657	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.294+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
658	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.3+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	49	http://localhost:8055
659	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.304+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
660	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.309+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	53	http://localhost:8055
661	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.312+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	54	http://localhost:8055
662	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.316+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
663	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.32+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
664	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.323+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
665	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.326+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
666	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.331+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	50	http://localhost:8055
667	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.335+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	51	http://localhost:8055
668	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.339+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	52	http://localhost:8055
669	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.342+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
670	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:33:09.346+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
671	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:34:49.044+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	55	http://localhost:8055
672	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:34:49.047+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	56	http://localhost:8055
673	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:34:49.049+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	57	http://localhost:8055
674	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:34:49.051+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	58	http://localhost:8055
675	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:34:49.053+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	59	http://localhost:8055
676	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:34:49.056+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	highlights	http://localhost:8055
677	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:35:23.494+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	60	http://localhost:8055
678	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:35:23.6+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	61	http://localhost:8055
679	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:35:50.353+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	62	http://localhost:8055
680	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:35:57.908+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	highlights	http://localhost:8055
681	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:05.031+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profiles	http://localhost:8055
682	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:05.032+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
683	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:05.036+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
684	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:05.038+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	highlights	http://localhost:8055
685	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:05.042+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
686	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.277+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
687	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.281+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
688	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.285+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
689	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.289+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
690	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.294+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
691	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.297+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	49	http://localhost:8055
692	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.3+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
693	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.303+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	53	http://localhost:8055
694	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.307+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	54	http://localhost:8055
695	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.31+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
696	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.313+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
697	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.317+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
698	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.32+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
699	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.324+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	50	http://localhost:8055
700	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.327+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	51	http://localhost:8055
701	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.33+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	52	http://localhost:8055
702	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.333+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
703	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.335+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	61	http://localhost:8055
704	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:29.339+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
705	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:36:45.198+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	61	http://localhost:8055
706	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:38:05.592+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	highlights	00483bae-b8ef-46bb-8230-0f84c989f971	http://localhost:8055
707	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:38:05.595+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	highlights	85956023-2be3-4fa9-9643-fc677ffd97cb	http://localhost:8055
708	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:38:05.596+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	highlights	bf60fa32-c241-4a49-9edf-d0a21c3a4b3d	http://localhost:8055
709	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:38:05.598+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	highlights	82700d7e-0a60-43af-82a7-1ca8a4fcb43f	http://localhost:8055
710	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:38:05.601+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	highlights	912a4cfd-44d1-4b88-bd32-0a67ce05e1bc	http://localhost:8055
711	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:38:05.602+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	highlights	311f493d-c89f-4a35-86fc-9605e93f639d	http://localhost:8055
712	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:38:05.604+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	highlights	e30e3468-9f74-4bdb-9f33-abcef8eb6f7b	http://localhost:8055
713	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:38:05.607+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
714	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:58:06.033+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	63	http://localhost:8055
715	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:58:06.041+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	64	http://localhost:8055
716	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:58:06.045+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	65	http://localhost:8055
717	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:58:06.048+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	66	http://localhost:8055
718	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:58:06.051+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	67	http://localhost:8055
719	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:58:06.056+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skills	http://localhost:8055
720	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:58:35.549+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	68	http://localhost:8055
721	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:58:35.624+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	69	http://localhost:8055
722	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:59:04.248+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	70	http://localhost:8055
723	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:59:44.348+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skills	http://localhost:8055
724	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:59:47.956+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skills	http://localhost:8055
725	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:59:47.958+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profiles	http://localhost:8055
726	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:59:47.964+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
727	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:59:50.695+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
728	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:59:50.699+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	highlights	http://localhost:8055
729	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:59:50.706+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skills	http://localhost:8055
730	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:59:50.711+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
731	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:16.931+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
732	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:16.936+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
733	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:16.943+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
734	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:16.949+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
735	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:16.954+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
736	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:16.959+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	49	http://localhost:8055
737	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:16.963+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
738	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:16.967+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	53	http://localhost:8055
739	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:16.972+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	54	http://localhost:8055
740	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:16.978+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
741	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:16.983+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
742	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:16.988+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
743	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:16.993+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
744	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:16.998+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	50	http://localhost:8055
745	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:17.002+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	51	http://localhost:8055
746	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:17.007+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	52	http://localhost:8055
747	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:17.011+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
748	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:17.017+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	61	http://localhost:8055
749	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:17.022+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	69	http://localhost:8055
750	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:17.026+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
751	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:00:31.92+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	69	http://localhost:8055
752	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:04:28.583+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	71	http://localhost:8055
753	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:04:28.586+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	72	http://localhost:8055
754	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:04:28.589+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	73	http://localhost:8055
755	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:04:28.592+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	74	http://localhost:8055
756	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:04:28.594+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	75	http://localhost:8055
757	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:04:28.599+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skill_categories	http://localhost:8055
758	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:04:44.077+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	76	http://localhost:8055
759	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:04:57.675+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
760	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:04:57.678+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profiles	http://localhost:8055
761	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:04:57.685+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	highlights	http://localhost:8055
762	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:04:57.688+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
763	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:04:57.691+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skills	http://localhost:8055
764	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:04:57.694+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
765	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:04:57.701+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skill_categories	http://localhost:8055
766	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:06:00.583+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skill_categories	http://localhost:8055
767	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:06:00.584+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
768	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:06:00.59+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	highlights	http://localhost:8055
769	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:06:00.594+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skills	http://localhost:8055
770	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:06:00.601+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
771	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:08:40.717+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	77	http://localhost:8055
772	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:08:40.81+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	78	http://localhost:8055
773	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:11:13.879+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_categories	e6875da0-e556-45f0-be1e-e469fdaed3a7	http://localhost:8055
774	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:11:24.359+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_categories	78c235f4-2456-40e6-939d-19c855a30aa1	http://localhost:8055
775	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:11:59.896+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	1	http://localhost:8055
776	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:11:59.898+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
777	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:12:09.051+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	1	http://localhost:8055
778	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:12:09.054+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_categories	e6875da0-e556-45f0-be1e-e469fdaed3a7	http://localhost:8055
779	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:12:51.929+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_categories	0bcc8c53-eb96-4d3b-8bd5-81faf33000a5	http://localhost:8055
780	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:13:43.19+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	78	http://localhost:8055
781	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:13:50.231+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	77	http://localhost:8055
782	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:17:15.458+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
783	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:17:15.462+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	highlights	http://localhost:8055
784	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:17:15.469+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skill_categories	http://localhost:8055
785	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:17:15.473+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skills	http://localhost:8055
786	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:17:15.476+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
787	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:17:17.322+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skills	http://localhost:8055
788	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:17:17.322+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
789	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:17:17.327+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	highlights	http://localhost:8055
790	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:17:17.332+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skill_categories	http://localhost:8055
791	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:17:17.337+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
792	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:19:30.224+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	79	http://localhost:8055
793	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:19:30.311+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	80	http://localhost:8055
794	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:22:04.913+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	79	http://localhost:8055
795	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:22:32.527+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skill_categories	http://localhost:8055
796	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:23:47.6+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	68	http://localhost:8055
797	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:31.544+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	63	http://localhost:8055
798	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:31.549+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	65	http://localhost:8055
799	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:31.552+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	64	http://localhost:8055
800	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:31.558+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	66	http://localhost:8055
801	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:31.562+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	67	http://localhost:8055
802	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:31.566+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	68	http://localhost:8055
803	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:31.569+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	70	http://localhost:8055
804	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:31.573+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	79	http://localhost:8055
805	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:44.186+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	63	http://localhost:8055
806	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:44.193+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	65	http://localhost:8055
807	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:44.199+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	66	http://localhost:8055
808	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:44.203+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	67	http://localhost:8055
809	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:44.209+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	64	http://localhost:8055
810	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:44.216+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	68	http://localhost:8055
811	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:44.22+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	70	http://localhost:8055
812	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:44.225+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	79	http://localhost:8055
813	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:52.262+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	68	http://localhost:8055
814	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:53.998+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	64	http://localhost:8055
815	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:59.808+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	63	http://localhost:8055
816	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:59.816+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	65	http://localhost:8055
817	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:59.82+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	66	http://localhost:8055
818	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:59.826+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	67	http://localhost:8055
819	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:59.832+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	68	http://localhost:8055
820	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:59.836+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	64	http://localhost:8055
821	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:59.84+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	70	http://localhost:8055
822	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:24:59.845+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	79	http://localhost:8055
823	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:25:34.398+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	1	http://localhost:8055
824	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:25:47.313+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	70	http://localhost:8055
825	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:25:49.383+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	79	http://localhost:8055
826	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:26:19.808+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	68	http://localhost:8055
827	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:26:53.89+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	68	http://localhost:8055
828	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:27:14.972+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	79	http://localhost:8055
829	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:27:44.81+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	81	http://localhost:8055
830	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:27:48.036+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	71	http://localhost:8055
831	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:27:48.039+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	72	http://localhost:8055
832	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:27:48.043+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	73	http://localhost:8055
833	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:27:48.049+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	74	http://localhost:8055
834	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:27:48.053+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	75	http://localhost:8055
835	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:27:48.057+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	81	http://localhost:8055
836	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:27:48.061+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	76	http://localhost:8055
837	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:27:48.067+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	80	http://localhost:8055
838	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:29:21.475+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_categories	78c235f4-2456-40e6-939d-19c855a30aa1	http://localhost:8055
839	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:29:24.927+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_categories	0bcc8c53-eb96-4d3b-8bd5-81faf33000a5	http://localhost:8055
840	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:29:31.196+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_categories	e6875da0-e556-45f0-be1e-e469fdaed3a7	http://localhost:8055
841	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:29:43.556+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skill_categories	http://localhost:8055
842	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:29:52.605+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	76	http://localhost:8055
843	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:33:00.161+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	81	http://localhost:8055
844	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:34:26.629+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	80	http://localhost:8055
845	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:34:47.969+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	80	http://localhost:8055
846	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:34:55.894+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	79	http://localhost:8055
847	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:36:22.105+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	82	http://localhost:8055
848	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:36:22.203+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	83	http://localhost:8055
849	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:36:25.648+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	82	http://localhost:8055
850	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:36:40+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	82	http://localhost:8055
851	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:36:49.585+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	1	http://localhost:8055
852	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:37:17.846+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	82	http://localhost:8055
853	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:39:08.932+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	60	http://localhost:8055
854	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:39:49.627+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	38	http://localhost:8055
855	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:40:00.45+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	30	http://localhost:8055
856	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:40:00.457+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	38	http://localhost:8055
857	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:40:00.462+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	31	http://localhost:8055
858	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:40:00.471+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	32	http://localhost:8055
859	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:40:00.475+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	33	http://localhost:8055
860	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:40:00.481+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	34	http://localhost:8055
861	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:40:00.485+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	35	http://localhost:8055
862	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:40:00.489+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	36	http://localhost:8055
863	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:40:02.721+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	38	http://localhost:8055
864	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:40:04.925+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	31	http://localhost:8055
865	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:43:13.528+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skills	http://localhost:8055
866	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:43:19.878+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
867	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:43:19.885+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	highlights	http://localhost:8055
868	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:43:19.895+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skills	http://localhost:8055
869	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:43:19.899+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skill_categories	http://localhost:8055
870	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:43:19.905+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
871	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:43:21.605+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skill_categories	http://localhost:8055
872	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:43:21.608+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
873	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:43:21.614+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	highlights	http://localhost:8055
874	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:43:21.624+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skills	http://localhost:8055
875	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:43:21.627+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
876	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:43:55.277+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	84	http://localhost:8055
877	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:43:58.732+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	84	http://localhost:8055
878	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:44:03.517+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	1	http://localhost:8055
879	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:49:55.871+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	85	http://localhost:8055
880	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:49:59.482+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	85	http://localhost:8055
881	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:50:06.874+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	1	http://localhost:8055
882	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:57:39.768+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	86	http://localhost:8055
883	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:57:39.771+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	87	http://localhost:8055
884	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:57:39.774+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	88	http://localhost:8055
885	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:57:39.777+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	89	http://localhost:8055
886	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:57:39.78+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	90	http://localhost:8055
887	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:57:39.783+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skill_types	http://localhost:8055
888	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:57:55.347+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skill_categories	http://localhost:8055
889	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:57:55.351+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profiles	http://localhost:8055
890	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:57:55.36+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skill_types	http://localhost:8055
891	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:57:55.364+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
892	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:58:24.719+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	91	http://localhost:8055
893	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:59:29.671+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	92	http://localhost:8055
894	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 15:59:29.771+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	93	http://localhost:8055
895	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:00:04.592+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	1	http://localhost:8055
896	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:00:17.188+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	92	http://localhost:8055
897	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:00:27.566+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skill_types	http://localhost:8055
898	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:00:38.295+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	1	http://localhost:8055
899	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:02:34.59+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	2	http://localhost:8055
900	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:03:18.662+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	3	http://localhost:8055
901	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:03:56.916+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	92	http://localhost:8055
902	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:05:12.816+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	92	http://localhost:8055
903	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:12:04.982+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	92	http://localhost:8055
904	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:12:32.576+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	92	http://localhost:8055
905	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:13:13.81+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	2	http://localhost:8055
906	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:13:56.352+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	3	http://localhost:8055
907	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:14:17.041+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	4	http://localhost:8055
908	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:16:07.213+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	3	http://localhost:8055
909	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:16:57.043+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	5	http://localhost:8055
910	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:17:48.009+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	6	http://localhost:8055
911	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:18:19.613+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	7	http://localhost:8055
912	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:19:03.303+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	8	http://localhost:8055
913	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:31:49.718+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	9	http://localhost:8055
914	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:32:08.104+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	8	http://localhost:8055
915	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:32:13.688+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	9	http://localhost:8055
916	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:32:28.959+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	8	http://localhost:8055
917	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:32:37.134+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	8	http://localhost:8055
918	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:34:46.404+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	10	http://localhost:8055
919	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:35:09.267+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	6	http://localhost:8055
920	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:35:19.999+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	9	http://localhost:8055
921	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:35:43.384+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	8	http://localhost:8055
922	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:35:54.992+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	11	http://localhost:8055
923	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:36:38.703+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	12	http://localhost:8055
924	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:37:50.809+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	3	http://localhost:8055
925	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:38:48.186+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	4	http://localhost:8055
926	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:38:57.19+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	2	http://localhost:8055
927	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:39:01.21+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	4	http://localhost:8055
928	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:39:04.054+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	1	http://localhost:8055
929	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:39:09.099+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	5	http://localhost:8055
930	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:39:12.457+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	5	http://localhost:8055
931	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:39:17.913+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	4	http://localhost:8055
932	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:39:20.546+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	1	http://localhost:8055
933	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:39:43.293+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	8	http://localhost:8055
934	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:39:54.391+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	8	http://localhost:8055
935	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:40:10.861+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	2	http://localhost:8055
936	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:40:22.606+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	11	http://localhost:8055
937	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:40:33.896+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	9	http://localhost:8055
938	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:40:43.682+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	8	http://localhost:8055
939	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:40:54.132+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	6	http://localhost:8055
940	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:41:04.776+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	12	http://localhost:8055
941	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:42:03.763+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	5	http://localhost:8055
942	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:42:47.555+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	6	http://localhost:8055
943	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:43:46.248+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	7	http://localhost:8055
944	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:45:28.784+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	8	http://localhost:8055
945	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:47:36.872+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_types	13	http://localhost:8055
946	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:49:12.45+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	9	http://localhost:8055
947	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:49:12.455+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
948	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:49:46.514+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	69	http://localhost:8055
949	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:50:23.214+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	69	http://localhost:8055
950	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:53:10.395+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	10	http://localhost:8055
951	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:55:49.757+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	11	http://localhost:8055
952	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:55:49.762+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
953	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:56:44.834+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	12	http://localhost:8055
954	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:56:44.836+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
955	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:57:04.64+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	13	http://localhost:8055
956	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 16:57:04.642+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
957	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 17:00:54.584+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_categories	a2c07ea5-050e-4ad0-adad-7bfd7908e4ad	http://localhost:8055
958	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 17:01:46.444+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	14	http://localhost:8055
959	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 17:01:46.446+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
960	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 17:04:22.336+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	15	http://localhost:8055
961	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 17:04:43.061+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	16	http://localhost:8055
962	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 17:04:59.918+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	17	http://localhost:8055
963	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 17:06:28.289+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	18	http://localhost:8055
964	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 17:07:14.547+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	19	http://localhost:8055
965	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 17:07:50.875+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	20	http://localhost:8055
966	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 17:08:46.46+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	21	http://localhost:8055
967	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 17:09:24.63+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	22	http://localhost:8055
968	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 17:09:52.918+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	23	http://localhost:8055
969	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 17:12:02.59+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skill_categories	6d549daa-2775-4af9-85c9-c3a50ef155c0	http://localhost:8055
970	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 17:12:49.095+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	24	http://localhost:8055
971	login	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 15:42:07.71+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_users	157238bb-6930-4f26-be9c-8b31a9e11ab8	http://localhost:8055
972	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 15:44:59.014+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_projects	http://localhost:8055
973	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 15:45:09.292+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_projects	http://localhost:8055
974	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:06:59.792+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	94	http://localhost:8055
975	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:06:59.796+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	95	http://localhost:8055
976	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:06:59.799+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	96	http://localhost:8055
977	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:06:59.801+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	97	http://localhost:8055
978	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:06:59.804+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	98	http://localhost:8055
979	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:06:59.81+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	soft_skills	http://localhost:8055
980	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:07:36.901+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	99	http://localhost:8055
981	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:07.145+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	100	http://localhost:8055
982	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:07.222+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	101	http://localhost:8055
983	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:15.797+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	soft_skills	http://localhost:8055
984	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:40.82+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	soft_skills	http://localhost:8055
985	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:40.821+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profiles	http://localhost:8055
986	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:40.83+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
987	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:40.834+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_projects	http://localhost:8055
988	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:45.933+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
989	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:45.941+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	highlights	http://localhost:8055
990	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:45.949+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skills	http://localhost:8055
991	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:45.952+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
992	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:45.955+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	soft_skills	http://localhost:8055
993	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:49.762+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
994	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:49.767+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	highlights	http://localhost:8055
995	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:49.772+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skills	http://localhost:8055
996	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:49.779+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	soft_skills	http://localhost:8055
997	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:08:49.788+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
998	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.584+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
999	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.59+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
1000	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.597+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
1001	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.601+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
1002	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.606+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
1003	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.611+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	49	http://localhost:8055
1004	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.615+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
1005	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.619+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	53	http://localhost:8055
1006	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.625+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	54	http://localhost:8055
1007	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.63+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
1008	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.634+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
1009	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.639+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
1010	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.644+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
1011	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.648+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	50	http://localhost:8055
1012	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.651+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	51	http://localhost:8055
1013	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.657+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	52	http://localhost:8055
1014	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.663+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
1015	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.667+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	61	http://localhost:8055
1016	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.671+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	69	http://localhost:8055
1017	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.676+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	101	http://localhost:8055
1018	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:01.681+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
1019	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:31.744+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	94	http://localhost:8055
1020	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:31.75+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	100	http://localhost:8055
1021	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:31.754+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	95	http://localhost:8055
1022	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:31.761+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	96	http://localhost:8055
1023	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:31.765+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	97	http://localhost:8055
1024	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:31.77+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	98	http://localhost:8055
1025	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:31.776+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	99	http://localhost:8055
1026	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:34.445+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	100	http://localhost:8055
1027	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:36.884+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	95	http://localhost:8055
1028	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:09:43.106+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	100	http://localhost:8055
1029	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:10:00.784+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	soft_skills	9f0d1372-15fe-48c5-9c5f-e80e1b82f2a3	http://localhost:8055
1030	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:10:16.761+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	100	http://localhost:8055
1031	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:10:39.192+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	100	http://localhost:8055
1032	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:11:40.552+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	101	http://localhost:8055
1033	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:12:44.699+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	soft_skills	7e34478e-9073-43f5-b54b-0e1a774a0cd3	http://localhost:8055
1042	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:15:20.544+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	102	http://localhost:8055
1034	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:12:44.702+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	soft_skills	9db2e160-3d6f-43c3-9dbd-acc209f4e4fe	http://localhost:8055
1035	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:12:44.703+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	soft_skills	a74f913e-037c-4548-a8d7-d6b96ebaf22f	http://localhost:8055
1036	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:12:44.706+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	soft_skills	89c42056-807c-41e6-9e1f-9d7fa08f1b2b	http://localhost:8055
1037	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:12:44.707+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	soft_skills	1cc282e5-4323-41a8-a527-c5db37a92da6	http://localhost:8055
1038	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:12:44.709+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	soft_skills	b3049619-b765-429d-9700-4522df069f1b	http://localhost:8055
1039	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:12:44.71+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	soft_skills	68c01e2b-5d94-4c58-adbf-ba74ffe6f8b7	http://localhost:8055
1040	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:12:44.712+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	soft_skills	d28caf31-29e1-4334-8108-c7b6ee0197e4	http://localhost:8055
1041	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:12:44.716+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
1043	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:15:20.547+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	103	http://localhost:8055
1044	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:15:20.55+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	104	http://localhost:8055
1045	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:15:20.554+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	105	http://localhost:8055
1046	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:15:20.556+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	106	http://localhost:8055
1047	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:15:20.559+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	dev_methodologies	http://localhost:8055
1048	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:15:52.823+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	107	http://localhost:8055
1049	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:16:20.633+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	108	http://localhost:8055
1050	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:16:20.739+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	109	http://localhost:8055
1051	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:16:29.37+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	dev_methodologies	http://localhost:8055
1052	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:16:44.279+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	dev_methodologies	http://localhost:8055
1053	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:16:44.281+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profiles	http://localhost:8055
1054	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:16:44.288+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
1055	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:16:44.292+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_projects	http://localhost:8055
1056	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:16:50.458+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	languages	http://localhost:8055
1057	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:16:50.461+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	highlights	http://localhost:8055
1058	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:16:50.467+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	tech_skills	http://localhost:8055
1059	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:16:50.473+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	soft_skills	http://localhost:8055
1060	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:16:50.477+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	dev_methodologies	http://localhost:8055
1061	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:16:50.479+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
1062	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:14.327+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	102	http://localhost:8055
1063	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:14.332+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	108	http://localhost:8055
1064	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:14.336+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	103	http://localhost:8055
1065	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:14.341+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	104	http://localhost:8055
1066	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:14.344+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	105	http://localhost:8055
1067	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:14.348+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	106	http://localhost:8055
1068	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:14.354+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	107	http://localhost:8055
1069	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:16.598+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	108	http://localhost:8055
1070	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:18.988+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	103	http://localhost:8055
1071	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:22.459+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	108	http://localhost:8055
1072	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:34.024+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	dev_methodologies	6eff8fef-bded-49f0-b58a-711aea500221	http://localhost:8055
1073	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:49.933+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
1074	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:49.94+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
1075	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:49.946+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
1076	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:49.949+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
1077	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:49.953+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
1078	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:49.958+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	49	http://localhost:8055
1079	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:49.962+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	48	http://localhost:8055
1080	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:49.965+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	53	http://localhost:8055
1081	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:49.968+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	54	http://localhost:8055
1082	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:49.975+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
1083	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:49.978+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
1084	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:49.981+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
1085	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:49.985+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
1086	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:49.993+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	50	http://localhost:8055
1087	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:49.999+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	51	http://localhost:8055
1088	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:50.004+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	52	http://localhost:8055
1089	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:50.009+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	39	http://localhost:8055
1090	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:50.012+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	61	http://localhost:8055
1091	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:50.016+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	69	http://localhost:8055
1092	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:50.019+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	101	http://localhost:8055
1093	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:50.025+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	109	http://localhost:8055
1094	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:17:50.028+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
1095	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:19:23.901+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	dev_methodologies	84a7411e-3601-44d3-abc7-251348ece546	http://localhost:8055
1096	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:19:23.904+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	dev_methodologies	01d355bd-7b80-4806-a9c3-c5277a945996	http://localhost:8055
1097	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:19:23.908+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	dev_methodologies	856ee579-71ba-434b-b9e2-7355b8cd8e13	http://localhost:8055
1098	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:19:23.91+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	dev_methodologies	fd9086a3-071a-458c-9e50-accbf3bff907	http://localhost:8055
1099	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:19:23.913+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	dev_methodologies	44f7c501-4fef-47b8-8f4f-8a98fe155ed2	http://localhost:8055
1100	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:19:23.914+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	dev_methodologies	4831ab97-9ffa-4518-a701-844fe0a3e5d2	http://localhost:8055
1101	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:19:23.915+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	dev_methodologies	9beb25c0-e7f2-4699-88d5-8619ac65f060	http://localhost:8055
1102	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:19:23.917+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	dev_methodologies	94c1e7c6-f687-4a45-b870-1c922baacd2d	http://localhost:8055
1103	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:19:23.918+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	dev_methodologies	af4c406b-bf9e-4f65-b196-5ff37c57eba9	http://localhost:8055
1104	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:19:23.92+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	dev_methodologies	c9622a84-fb17-4bfe-87c4-cac33d30ef5c	http://localhost:8055
1105	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:19:23.922+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	dev_methodologies	fc191739-71ff-444f-a64f-c4ff739ceadf	http://localhost:8055
1106	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:19:23.925+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	dev_methodologies	a80c302e-c184-4e50-8b7d-c4e4bee261c8	http://localhost:8055
1107	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:19:23.928+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
1108	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:20:47.757+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	22	http://localhost:8055
1109	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:20:52.947+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
1110	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:08.692+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1111	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:13.541+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1112	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:16.678+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
1113	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:16.688+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	22	http://localhost:8055
1114	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:16.693+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1115	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:16.7+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1116	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:16.707+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1117	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:16.713+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
1118	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:16.719+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1119	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:16.726+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1120	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:16.733+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
1121	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:16.738+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
1122	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:16.743+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1123	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:16.751+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
1124	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:16.756+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
1125	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:16.761+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
1126	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:58:16.767+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
1127	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:59:08.802+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_translations	477e76f0-e099-49ab-a993-d55f72cf2931	http://localhost:8055
1128	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:59:15.821+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_translations	c530a32f-84cb-4ab9-8a61-7a12a5bcb7e6	http://localhost:8055
1129	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 16:59:22.925+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_translations	39d9db6d-c7a4-4298-b997-cc4ce6d427b3	http://localhost:8055
1130	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:00:52.551+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1131	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:01:29.666+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1132	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:02:39.71+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1133	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:03:09.127+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1134	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:03:35.059+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1135	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:04:04.114+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
1136	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:05:22.667+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	111	http://localhost:8055
1137	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:05:32.696+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
1138	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:18:17.033+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
1139	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:18:17.038+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	22	http://localhost:8055
1140	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:18:17.043+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1141	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:18:17.052+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1142	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:18:17.056+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1143	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:18:17.062+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1144	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:18:17.068+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
1145	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:18:17.073+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1146	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:18:17.081+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
1147	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:18:17.085+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
1148	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:18:17.088+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1149	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:18:17.094+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
1150	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:18:17.099+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
1151	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:18:17.103+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
1152	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:18:17.107+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	111	http://localhost:8055
1153	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:11.288+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
1154	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:11.291+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	22	http://localhost:8055
1155	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:30.132+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1156	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:30.309+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	113	http://localhost:8055
1157	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:35.074+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1158	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:38.648+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
1159	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:38.654+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1160	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:38.658+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1161	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:38.663+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1162	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:38.669+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1163	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:38.674+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1164	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:38.678+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
1165	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:38.683+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1166	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:38.687+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
1167	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:38.692+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
1168	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:38.698+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1169	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:38.703+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
1170	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:38.707+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
1171	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:38.713+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
1172	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:38.722+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	111	http://localhost:8055
1173	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:43.92+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
1174	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:43.965+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1175	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:43.969+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1176	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:43.973+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1177	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:43.978+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1178	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:43.983+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1179	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:43.987+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
1180	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:43.99+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1181	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:43.993+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
1182	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:43.998+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
1183	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:44.003+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1184	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:44.008+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
1185	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:44.013+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
1186	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:44.019+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
1187	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:44.022+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	111	http://localhost:8055
1188	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:19:49.095+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1189	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:20:00.715+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	http://localhost:8055
1190	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:20:07.021+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	http://localhost:8055
1191	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:21:55.225+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
1192	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:21:55.23+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1193	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:21:55.238+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1194	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:21:55.242+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1195	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:21:55.246+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1196	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:21:55.253+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1197	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:21:55.256+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
1198	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:21:55.259+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1199	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:21:55.262+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
1200	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:21:55.268+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
1201	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:21:55.272+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1202	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:21:55.276+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
1203	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:21:55.279+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
1204	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:21:55.287+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
1205	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:21:55.292+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	111	http://localhost:8055
1206	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:22:12.033+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	102	http://localhost:8055
1207	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:22:12.041+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	108	http://localhost:8055
1208	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:22:12.045+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	103	http://localhost:8055
1209	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:22:12.049+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	104	http://localhost:8055
1210	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:22:12.054+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	106	http://localhost:8055
1211	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:22:12.058+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	105	http://localhost:8055
1212	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:22:12.062+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	107	http://localhost:8055
1213	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:23:27.191+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	114	http://localhost:8055
1214	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:23:31.06+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	114	http://localhost:8055
1215	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:24:58.244+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	115	http://localhost:8055
1216	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:02.804+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	115	http://localhost:8055
1217	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:20.547+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
1218	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:24.429+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
1219	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:30.115+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
1220	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:30.118+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1221	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:30.125+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1222	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:30.131+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1223	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:30.135+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1224	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:30.143+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1225	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:30.147+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
1226	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:30.15+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1227	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:30.156+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
1228	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:30.162+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
1229	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:30.166+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1230	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:30.17+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
1231	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:30.177+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	114	http://localhost:8055
1232	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:30.181+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	115	http://localhost:8055
1233	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:30.185+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	111	http://localhost:8055
1234	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:25:57.674+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	116	http://localhost:8055
1235	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:01.015+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	116	http://localhost:8055
1236	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:12.568+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	117	http://localhost:8055
1237	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:15.31+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	117	http://localhost:8055
1238	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.383+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
1239	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.387+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1240	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.395+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1241	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.399+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1242	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.404+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1243	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.41+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1244	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.413+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
1245	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.416+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1246	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.419+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	116	http://localhost:8055
1247	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.427+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
1248	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.43+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
1249	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.434+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1250	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.437+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
1251	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.443+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	114	http://localhost:8055
1252	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.447+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	115	http://localhost:8055
1253	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.451+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	111	http://localhost:8055
1254	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:18.456+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	117	http://localhost:8055
1255	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.463+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
1256	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.508+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1257	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.512+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1258	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.515+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1259	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.518+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1260	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.522+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1261	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.529+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
1262	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.534+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1263	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.54+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	116	http://localhost:8055
1264	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.544+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	117	http://localhost:8055
1265	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.548+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
1266	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.551+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
1267	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.555+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1268	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.56+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
1269	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.564+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	114	http://localhost:8055
1270	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.568+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	115	http://localhost:8055
1271	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:23.571+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	111	http://localhost:8055
1272	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:47.101+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	http://localhost:8055
1273	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:52.414+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	http://localhost:8055
1274	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:26:56.683+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
1275	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:27:00.399+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
1276	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:27:45.967+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	http://localhost:8055
1277	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:27:59.626+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	http://localhost:8055
1278	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:28:54.448+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	http://localhost:8055
1279	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:29:58.29+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	http://localhost:8055
1280	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:31:27.193+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
1281	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:31:50.06+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
1282	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:32:07.293+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
1283	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:32:34.153+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
1284	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:34:13.512+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
1285	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:34:35.363+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
1286	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:35:51.597+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	116	http://localhost:8055
1287	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:35:54.718+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	117	http://localhost:8055
1288	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:36:51.328+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	118	http://localhost:8055
1289	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:36:56.778+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	118	http://localhost:8055
1290	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:37:20.561+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	119	http://localhost:8055
1291	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:37:23.618+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	119	http://localhost:8055
1292	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:38:44.12+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	http://localhost:8055
1293	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:38:57.006+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
1294	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:38:57.016+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1295	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:38:57.021+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1296	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:38:57.03+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1297	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:38:57.034+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1298	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:38:57.038+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1299	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:38:57.045+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
1300	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:38:57.05+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	118	http://localhost:8055
1301	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:38:57.055+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1302	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:38:57.063+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1303	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:38:57.068+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
1304	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:38:57.073+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	114	http://localhost:8055
1305	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:38:57.079+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	115	http://localhost:8055
1306	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:38:57.084+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	111	http://localhost:8055
1307	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:38:57.087+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	119	http://localhost:8055
1308	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:00.045+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
1309	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:00.091+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1310	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:00.096+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1311	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:00.099+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1312	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:00.102+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1313	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:00.107+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1314	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:00.111+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
1315	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:00.115+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	118	http://localhost:8055
1316	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:00.121+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	119	http://localhost:8055
1317	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:00.128+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1318	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:00.133+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1319	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:00.139+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
1320	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:00.158+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	114	http://localhost:8055
1321	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:00.165+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	115	http://localhost:8055
1322	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:00.169+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	111	http://localhost:8055
1323	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:21.912+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
1324	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:21.916+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1325	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:21.92+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1326	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:21.925+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1327	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:21.93+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1328	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:21.934+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1329	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:21.938+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
1330	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:21.945+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	118	http://localhost:8055
1331	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:21.949+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	119	http://localhost:8055
1332	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:21.952+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1333	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:21.955+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1334	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:21.961+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
1335	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:21.966+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	114	http://localhost:8055
1336	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:21.971+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	115	http://localhost:8055
1337	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:21.978+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	111	http://localhost:8055
1338	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:23.594+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
1339	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:23.598+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1340	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:23.601+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1341	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:23.605+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1342	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:23.611+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1343	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:23.614+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1344	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:23.617+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
1345	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:23.62+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1346	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:23.626+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	118	http://localhost:8055
1347	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:23.63+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	119	http://localhost:8055
1348	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:23.633+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1349	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:23.636+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
1350	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:23.639+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	114	http://localhost:8055
1351	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:23.645+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	115	http://localhost:8055
1352	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:23.648+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	111	http://localhost:8055
1353	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:32.226+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
1354	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:32.234+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1355	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:32.238+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1356	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:32.244+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1357	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:32.249+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1358	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:32.253+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1359	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:32.257+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
1360	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:32.264+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1361	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:32.269+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	118	http://localhost:8055
1362	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:32.274+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	119	http://localhost:8055
1363	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:32.28+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
1364	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:32.286+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1365	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:32.29+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	114	http://localhost:8055
1366	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:32.296+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	115	http://localhost:8055
1367	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:39:32.301+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	111	http://localhost:8055
1368	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:40:16.553+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1369	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:40:58.017+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1370	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:41:34.384+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1371	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:09.871+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1372	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:32.77+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
1373	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:41.17+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	120	http://localhost:8055
1374	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:44.996+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	120	http://localhost:8055
1375	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:52.692+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
1376	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:52.697+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1377	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:52.703+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1378	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:52.706+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1379	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:52.709+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1380	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:52.715+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1381	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:52.718+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	120	http://localhost:8055
1382	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:52.721+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1383	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:52.723+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	118	http://localhost:8055
1384	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:52.726+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	119	http://localhost:8055
1385	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:52.73+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
1386	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:52.734+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1387	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:52.736+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	114	http://localhost:8055
1388	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:52.74+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	115	http://localhost:8055
1389	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:42:52.744+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	111	http://localhost:8055
1390	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:43:08.187+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	120	http://localhost:8055
1391	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:45:05.043+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	http://localhost:8055
1392	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:45:59.162+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	http://localhost:8055
1393	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:46:24.905+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	118	http://localhost:8055
1394	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:46:40.74+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	119	http://localhost:8055
1395	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:50:04.196+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	http://localhost:8055
1396	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:53:03.464+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	121	http://localhost:8055
1397	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:53:03.469+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	122	http://localhost:8055
1398	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:53:03.472+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	123	http://localhost:8055
1399	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:53:03.475+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	124	http://localhost:8055
1400	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:53:03.478+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	125	http://localhost:8055
1401	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:53:03.482+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experience_achievements	http://localhost:8055
1402	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:53:30.705+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	126	http://localhost:8055
1403	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:53:44.012+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	127	http://localhost:8055
1404	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:54:52.285+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	128	http://localhost:8055
1405	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:54:52.358+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	129	http://localhost:8055
1406	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:55:02.577+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	121	http://localhost:8055
1407	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:55:02.585+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	122	http://localhost:8055
1408	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:55:02.589+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	123	http://localhost:8055
1409	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:55:02.593+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	124	http://localhost:8055
1410	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:55:02.597+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	125	http://localhost:8055
1411	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:55:02.604+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	128	http://localhost:8055
1412	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:55:02.608+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	126	http://localhost:8055
1413	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:55:02.611+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	127	http://localhost:8055
1414	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:55:19.855+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	128	http://localhost:8055
1415	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:55:53.074+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	8e32e85b-f8d8-4fcf-af76-cb8f18ad91d9	http://localhost:8055
1416	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:56:01.144+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	121	http://localhost:8055
1417	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:56:01.151+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	128	http://localhost:8055
1418	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:56:01.159+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	122	http://localhost:8055
1419	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:56:01.163+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	123	http://localhost:8055
1420	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:56:01.17+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	124	http://localhost:8055
1421	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:56:01.175+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	125	http://localhost:8055
1422	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:56:01.179+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	126	http://localhost:8055
1423	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:56:01.183+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	127	http://localhost:8055
1424	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:56:03.716+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	128	http://localhost:8055
1425	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:56:06.122+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	122	http://localhost:8055
1426	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:56:39.883+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experience_achievements	http://localhost:8055
1427	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:56:39.883+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profiles	http://localhost:8055
1428	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:56:39.891+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
1429	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:56:39.894+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_projects	http://localhost:8055
1430	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:57:08.896+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experience_achievements	http://localhost:8055
1431	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:57:40.728+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experience_achievements	http://localhost:8055
1432	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:58:31.293+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	130	http://localhost:8055
1433	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:58:34.996+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	130	http://localhost:8055
1434	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:58:37.49+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	126	http://localhost:8055
1435	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:58:39.49+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	121	http://localhost:8055
1436	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:58:39.497+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	128	http://localhost:8055
1437	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:58:39.5+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	122	http://localhost:8055
1438	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:58:39.506+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	123	http://localhost:8055
1439	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:58:39.513+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	124	http://localhost:8055
1440	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:58:39.518+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	125	http://localhost:8055
1441	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:58:39.523+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	126	http://localhost:8055
1442	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:58:39.527+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	130	http://localhost:8055
1443	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:58:39.533+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	127	http://localhost:8055
1444	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 17:59:35.316+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	130	http://localhost:8055
1445	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:04:15.489+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	131	http://localhost:8055
1446	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:04:20.147+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	131	http://localhost:8055
1447	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:04:21.764+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	121	http://localhost:8055
1448	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:04:21.768+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	128	http://localhost:8055
1449	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:04:21.772+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	122	http://localhost:8055
1450	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:04:21.777+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	123	http://localhost:8055
1451	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:04:21.786+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	124	http://localhost:8055
1452	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:04:21.79+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	125	http://localhost:8055
1453	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:04:21.794+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	126	http://localhost:8055
1454	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:04:21.801+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	131	http://localhost:8055
1455	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:04:21.804+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	127	http://localhost:8055
1456	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:04:44.152+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	8e32e85b-f8d8-4fcf-af76-cb8f18ad91d9	http://localhost:8055
1457	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:05:23.057+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	128	http://localhost:8055
1458	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:05:42.636+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	128	http://localhost:8055
1459	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:05:59.624+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	128	http://localhost:8055
1460	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:08:59.835+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
1461	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:08:59.843+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1462	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:08:59.847+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1463	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:08:59.851+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1464	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:08:59.858+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1465	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:08:59.861+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1466	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:08:59.865+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	120	http://localhost:8055
1467	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:08:59.873+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1468	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:08:59.876+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	118	http://localhost:8055
1469	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:08:59.879+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	119	http://localhost:8055
1470	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:08:59.882+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
1471	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:08:59.886+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1472	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:08:59.891+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	129	http://localhost:8055
1473	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:08:59.894+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	114	http://localhost:8055
1474	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:08:59.897+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	115	http://localhost:8055
1475	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:08:59.901+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	111	http://localhost:8055
1476	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:05.725+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
1477	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:05.728+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	112	http://localhost:8055
1478	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:05.732+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	110	http://localhost:8055
1479	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:05.736+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
1480	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:05.741+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
1481	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:05.745+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
1482	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:05.749+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	120	http://localhost:8055
1483	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:05.754+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
1484	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:05.759+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	118	http://localhost:8055
1485	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:05.763+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	119	http://localhost:8055
1486	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:05.769+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
1487	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:05.775+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	129	http://localhost:8055
1488	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:05.779+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
1489	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:05.784+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	114	http://localhost:8055
1490	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:05.789+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	115	http://localhost:8055
1491	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:05.793+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	111	http://localhost:8055
1492	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:09:14.083+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	129	http://localhost:8055
1493	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:10:23.886+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	1a595ecc-42aa-4d7a-a51f-084d69aa63d5	http://localhost:8055
1494	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:10:23.892+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	http://localhost:8055
1495	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:10:23.897+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
1496	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:10:33.244+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	1a595ecc-42aa-4d7a-a51f-084d69aa63d5	http://localhost:8055
1497	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:11:44.418+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	102	http://localhost:8055
1498	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:11:44.427+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	108	http://localhost:8055
1499	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:11:44.433+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	103	http://localhost:8055
1500	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:11:44.437+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	107	http://localhost:8055
1501	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:11:44.443+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	104	http://localhost:8055
1502	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:11:44.447+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	106	http://localhost:8055
1503	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:11:44.451+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	105	http://localhost:8055
1504	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:12:01.053+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	108	http://localhost:8055
1505	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:12:20.664+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	108	http://localhost:8055
1506	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:14:57.199+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	tech_skills	20	http://localhost:8055
1507	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:15:57.72+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	38	http://localhost:8055
1508	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:17:58.719+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	56	http://localhost:8055
1509	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:05.517+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	55	http://localhost:8055
1510	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:05.523+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	56	http://localhost:8055
1511	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:05.527+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	60	http://localhost:8055
1512	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:05.53+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	57	http://localhost:8055
1513	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:05.535+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	58	http://localhost:8055
1514	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:05.538+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	59	http://localhost:8055
1515	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:05.542+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	62	http://localhost:8055
1516	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:08.079+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	60	http://localhost:8055
1517	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:14.371+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	60	http://localhost:8055
1518	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:38.949+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	55	http://localhost:8055
1519	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:38.954+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	56	http://localhost:8055
1520	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:38.958+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	60	http://localhost:8055
1521	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:38.963+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	62	http://localhost:8055
1522	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:38.969+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	57	http://localhost:8055
1523	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:38.974+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	58	http://localhost:8055
1524	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:38.979+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	59	http://localhost:8055
1525	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:46.463+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	132	http://localhost:8055
1526	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:18:58.907+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	132	http://localhost:8055
1527	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:19:12.523+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	highlights	00483bae-b8ef-46bb-8230-0f84c989f971	http://localhost:8055
1528	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:19:19.644+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	highlights	bf60fa32-c241-4a49-9edf-d0a21c3a4b3d	http://localhost:8055
1529	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:19:28.603+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	highlights	912a4cfd-44d1-4b88-bd32-0a67ce05e1bc	http://localhost:8055
1530	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:19:48.121+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	highlights	82700d7e-0a60-43af-82a7-1ca8a4fcb43f	http://localhost:8055
1531	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:20:08.169+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	highlights	85956023-2be3-4fa9-9643-fc677ffd97cb	http://localhost:8055
1533	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:20:53.613+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	highlights	912a4cfd-44d1-4b88-bd32-0a67ce05e1bc	http://localhost:8055
1534	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:21:00.714+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	highlights	311f493d-c89f-4a35-86fc-9605e93f639d	http://localhost:8055
1532	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:20:40.132+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	highlights	bf60fa32-c241-4a49-9edf-d0a21c3a4b3d	http://localhost:8055
1535	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:21:05.816+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	highlights	e30e3468-9f74-4bdb-9f33-abcef8eb6f7b	http://localhost:8055
1536	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:27:11.387+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	133	http://localhost:8055
1537	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:27:43.93+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	1a595ecc-42aa-4d7a-a51f-084d69aa63d5	http://localhost:8055
1538	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:30:45.828+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	d5bad162-74be-4a66-8c77-86b6251b2650	http://localhost:8055
1539	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:33:56.479+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	da618368-554c-4e9b-a86e-ae43cad7ef0e	http://localhost:8055
1540	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:34:07.106+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	da618368-554c-4e9b-a86e-ae43cad7ef0e	http://localhost:8055
1541	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:38:08.18+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	da618368-554c-4e9b-a86e-ae43cad7ef0e	http://localhost:8055
1542	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:40:34.508+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	5a835ff9-e397-4b01-8cba-ac927bd4a7f0	http://localhost:8055
1543	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:41:12.226+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	5a835ff9-e397-4b01-8cba-ac927bd4a7f0	http://localhost:8055
1544	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:41:43.94+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	5a835ff9-e397-4b01-8cba-ac927bd4a7f0	http://localhost:8055
1545	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:43:09.219+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	1cc82d6b-b1cb-4ede-b822-fa38aef450b8	http://localhost:8055
1546	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:44:23.22+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	64c7245f-4f93-4e78-9f12-5a1d4748044e	http://localhost:8055
1547	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:45:13.313+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	2a4f664b-0ba2-490f-8606-7c06268d9f5e	http://localhost:8055
1548	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:47:02.993+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	0aa6ac47-e106-4614-a626-ef94f80ced3e	http://localhost:8055
1549	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:49:52.95+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	dbbfe692-24b5-42ee-be27-bf901d1bb5c9	http://localhost:8055
1550	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:50:01.073+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	dbbfe692-24b5-42ee-be27-bf901d1bb5c9	http://localhost:8055
1551	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:51:40.479+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	b48c5e14-e385-4ee6-8965-32ce56bbfaa2	http://localhost:8055
1552	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:52:26.342+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experience_achievements	298270af-97ca-461f-8497-b7f24c9a56bf	http://localhost:8055
\.


--
-- Data for Name: directus_collections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_collections (collection, icon, note, display_template, hidden, singleton, translations, archive_field, archive_app_filter, archive_value, unarchive_value, sort_field, accountability, color, item_duplication_fields, sort, "group", collapse, preview_url, versioning) FROM stdin;
soft_skills	\N	\N	{{name}}	f	f	\N	status	t	archived	draft	sort	all	\N	\N	4	profiles	open	\N	f
dev_methodologies	\N	\N	{{name}}	f	f	\N	status	t	archived	draft	sort	all	\N	\N	5	profiles	open	\N	f
work_experiences	\N	\N	{{name}} | {{location}} | {{position}} | {{start_date}} - {{end_date}}	f	f	\N	\N	t	\N	\N	sort	all	\N	\N	6	profiles	open	\N	f
profiles	\N	\N	{{name}}	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	1	\N	open	\N	f
users	\N	\N	\N	t	f	\N	\N	t	\N	\N	\N	all	\N	\N	2	\N	open	\N	f
work_projects	\N	\N	\N	t	f	\N	\N	t	\N	\N	\N	all	\N	\N	3	\N	open	\N	f
work_experience_achievements	\N	\N	{{description}}	f	f	\N	status	t	archived	draft	sort	all	\N	\N	1	work_experiences	open	\N	f
tech_skill_categories	\N	\N	{{name}}	f	f	\N	status	t	archived	draft	sort	all	\N	\N	1	tech_skills	open	\N	f
tech_skill_types	\N	\N	{{name}}	f	f	\N	status	t	archived	draft	sort	all	\N	\N	2	tech_skills	open	\N	f
languages	\N	\N	{{name}}	f	f	\N	status	t	archived	draft	\N	all	\N	\N	1	profiles	open	\N	f
highlights	\N	\N	{{text}}	f	f	\N	status	t	archived	draft	sort	all	\N	\N	2	profiles	open	\N	f
tech_skills	\N	\N	{{name}}	f	f	\N	status	t	archived	draft	sort	all	\N	\N	3	profiles	open	\N	f
\.


--
-- Data for Name: directus_comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_comments (id, collection, item, comment, date_created, date_updated, user_created, user_updated) FROM stdin;
\.


--
-- Data for Name: directus_dashboards; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_dashboards (id, name, icon, note, date_created, user_created, color) FROM stdin;
\.


--
-- Data for Name: directus_extensions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_extensions (enabled, id, folder, source, bundle) FROM stdin;
\.


--
-- Data for Name: directus_fields; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_fields (id, collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message) FROM stdin;
16	users	password	\N	\N	\N	\N	\N	f	t	\N	full	\N	\N	\N	f	\N	\N	\N
36	languages	proficiency	\N	select-radio	{"choices":[{"text":"Native","value":"native"},{"text":"Fluent","value":"fluent"},{"text":"Proficient","value":"proficient"},{"text":"Conversational","value":"conversational"},{"text":"Basic","value":"basic"}]}	\N	\N	f	f	8	full	\N	\N	\N	f	\N	\N	\N
49	profiles	core_stack	\N	input	\N	\N	\N	f	f	6	full	\N	Short list of your core technology stack that you are most familiar with.	\N	f	\N	\N	\N
60	highlights	profile	m2o	select-dropdown-m2o	\N	related-values	{"template":"{{name}}"}	f	f	3	half	\N	\N	\N	f	\N	\N	\N
48	profiles	subtitle	\N	input	\N	\N	\N	f	f	7	full	\N	A short sentence complementing your work title, giving more insight to your expertise.	\N	f	\N	\N	\N
53	profiles	headline	\N	input	\N	\N	\N	f	f	8	full	\N	Brief professional tagline that summarizes your key qualifications.	\N	f	\N	\N	\N
54	profiles	profile_picture	file	file-image	{"crop":false}	\N	\N	f	f	9	half	\N	\N	\N	f	\N	\N	\N
21	profiles	title	\N	input	\N	\N	\N	f	f	5	full	\N	Your job title, a phrase describing your profession.	\N	t	\N	\N	\N
24	profiles	location	\N	input	\N	\N	\N	f	f	11	half	\N	Where you are currently based.	\N	f	\N	\N	\N
28	profiles	personal_website	\N	input	\N	\N	\N	f	f	13	full	\N	\N	\N	f	\N	\N	\N
50	profiles	linkedin_profile	\N	input	\N	\N	\N	f	f	14	full	\N	\N	\N	f	\N	\N	\N
51	profiles	github_profile	\N	input	\N	\N	\N	f	f	15	full	\N	\N	\N	f	\N	\N	\N
52	profiles	stackoverflow_profile	\N	input	\N	\N	\N	f	f	16	full	\N	\N	\N	f	\N	\N	\N
39	profiles	languages	o2m	list-o2m	{"enableSelect":false}	\N	\N	f	f	17	full	\N	\N	\N	f	\N	\N	\N
9	work_experiences	summary	\N	\N	\N	\N	\N	f	f	11	full	\N	\N	\N	f	\N	\N	\N
27	profiles	email_address	\N	input	\N	\N	\N	f	f	10	half	\N	\N	\N	f	\N	\N	\N
26	profiles	phone_number	\N	input	\N	\N	\N	f	f	12	half	\N	\N	\N	f	\N	\N	\N
62	highlights	text	\N	input	\N	\N	\N	f	f	4	full	\N	\N	\N	t	\N	\N	\N
1	work_experiences	name	\N	input	\N	\N	\N	f	f	4	half	\N	Name of the company / organization that was your employer during this time.	\N	f	\N	\N	\N
17	profiles	id	uuid	input	\N	\N	\N	t	t	1	full	\N	\N	\N	f	\N	\N	\N
61	profiles	highlights	o2m	list-o2m	{"enableSelect":false}	\N	\N	f	f	18	full	\N	\N	\N	f	\N	\N	\N
65	tech_skills	sort	\N	input	\N	\N	\N	f	t	2	full	\N	\N	\N	f	\N	\N	\N
18	profiles	date_created	date-created	datetime	\N	datetime	{"relative":true}	t	t	2	half	\N	\N	\N	f	\N	\N	\N
32	languages	date_created	date-created	datetime	\N	datetime	{"relative":true}	t	t	4	half	\N	\N	\N	f	\N	\N	\N
30	languages	id	uuid	input	\N	\N	\N	t	t	1	full	\N	\N	\N	f	\N	\N	\N
63	tech_skills	id	\N	input	\N	\N	\N	t	t	1	full	\N	\N	\N	f	\N	\N	\N
19	profiles	date_updated	date-updated	datetime	\N	datetime	{"relative":true}	t	t	3	half	\N	\N	\N	f	\N	\N	\N
20	profiles	name	\N	input	\N	\N	\N	f	f	4	full	\N	\N	\N	t	\N	\N	\N
33	languages	date_updated	date-updated	datetime	\N	datetime	{"relative":true}	t	t	5	half	\N	\N	\N	f	\N	\N	\N
34	languages	name	\N	input	\N	\N	\N	f	f	6	half	\N	\N	\N	f	\N	\N	\N
35	languages	language_code	\N	input	\N	\N	\N	f	f	7	half	\N	2-letter ISO 639 language code	\N	f	\N	\N	\N
31	languages	status	\N	select-dropdown	{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]}	labels	{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]}	f	f	3	half	\N	\N	\N	f	\N	\N	\N
3	work_experiences	location	\N	input	\N	\N	\N	f	f	5	half	\N	The location of the company / organization or where you did your work.	\N	f	\N	\N	\N
57	highlights	sort	\N	input	\N	\N	\N	f	t	5	full	\N	\N	\N	f	\N	\N	\N
15	work_experiences	logo	file	file-image	{"crop":false}	image	\N	f	f	13	full	\N	\N	\N	f	\N	\N	\N
4	work_experiences	description	\N	input	\N	\N	\N	f	f	6	half	\N	Describe what kind of company / organization this was.	\N	f	\N	\N	\N
5	work_experiences	position	\N	input	\N	\N	\N	f	f	8	full	\N	What position you held within the company / organization.	\N	f	\N	\N	\N
38	languages	profile	m2o	select-dropdown-m2o	\N	related-values	{"template":"{{name}}"}	f	f	2	half	\N	\N	\N	f	\N	\N	\N
2	work_experiences	id	uuid	\N	\N	\N	\N	t	f	1	full	\N	\N	\N	f	\N	\N	\N
58	highlights	date_created	date-created	datetime	\N	datetime	{"relative":true}	t	t	6	half	\N	\N	\N	f	\N	\N	\N
55	highlights	id	uuid	input	\N	\N	\N	t	t	1	full	\N	\N	\N	f	\N	\N	\N
56	highlights	status	\N	select-dropdown	{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]}	labels	{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]}	f	f	2	half	\N	\N	\N	f	\N	\N	\N
59	highlights	date_updated	date-updated	datetime	\N	datetime	{"relative":true}	t	t	7	half	\N	\N	\N	f	\N	\N	\N
85	tech_skills	level	\N	select-dropdown	{"choices":[{"text":"Expert","value":"expert"},{"text":"Proficient","value":"proficient"},{"text":"Intermediate","value":"intermediate"},{"text":"Beginner","value":"beginner"}],"allowNone":true}	\N	\N	f	f	10	half	\N	\N	\N	f	\N	\N	\N
70	tech_skills	name	\N	input	\N	\N	\N	f	f	7	half	\N	\N	\N	f	\N	\N	\N
86	tech_skill_types	id	\N	input	\N	\N	\N	t	t	1	full	\N	\N	\N	f	\N	\N	\N
87	tech_skill_types	status	\N	select-dropdown	{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]}	labels	{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]}	f	f	2	full	\N	\N	\N	f	\N	\N	\N
68	tech_skills	profile	m2o	select-dropdown-m2o	{"template":null}	related-values	{"template":"{{name}}"}	f	f	5	half	\N	\N	\N	f	\N	\N	\N
88	tech_skill_types	sort	\N	input	\N	\N	\N	f	t	3	full	\N	\N	\N	f	\N	\N	\N
71	tech_skill_categories	id	uuid	input	\N	\N	\N	t	t	1	full	\N	\N	\N	f	\N	\N	\N
72	tech_skill_categories	status	\N	select-dropdown	{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]}	labels	{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]}	f	f	2	full	\N	\N	\N	f	\N	\N	\N
73	tech_skill_categories	sort	\N	input	\N	\N	\N	f	t	3	full	\N	\N	\N	f	\N	\N	\N
74	tech_skill_categories	date_created	date-created	datetime	\N	datetime	{"relative":true}	t	t	4	half	\N	\N	\N	f	\N	\N	\N
89	tech_skill_types	date_created	date-created	datetime	\N	datetime	{"relative":true}	t	t	4	half	\N	\N	\N	f	\N	\N	\N
90	tech_skill_types	date_updated	date-updated	datetime	\N	datetime	{"relative":true}	t	t	5	half	\N	\N	\N	f	\N	\N	\N
75	tech_skill_categories	date_updated	date-updated	datetime	\N	datetime	{"relative":true}	t	t	5	half	\N	\N	\N	f	\N	\N	\N
91	tech_skill_types	name	\N	input	\N	\N	\N	f	f	6	full	\N	\N	\N	f	\N	\N	\N
66	tech_skills	date_created	date-created	datetime	\N	datetime	{"relative":true}	t	t	3	half	\N	\N	\N	f	\N	\N	\N
67	tech_skills	date_updated	date-updated	datetime	\N	datetime	{"relative":true}	t	t	4	half	\N	\N	\N	f	\N	\N	\N
64	tech_skills	status	\N	select-dropdown	{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]}	labels	{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]}	f	f	6	half	\N	\N	\N	f	\N	\N	\N
93	tech_skill_types	tech_skills	o2m	list-o2m	\N	\N	\N	f	f	7	full	\N	\N	\N	f	\N	\N	\N
81	tech_skill_categories	name	\N	input	\N	raw	\N	f	f	6	full	\N	\N	\N	t	\N	\N	\N
83	tech_skill_categories	tech_skills	o2m	list-o2m	\N	\N	\N	f	f	7	full	\N	\N	\N	f	\N	\N	\N
101	profiles	soft_skills	o2m	list-o2m	{"enableSelect":false}	\N	\N	f	f	20	full	\N	\N	\N	f	\N	\N	\N
92	tech_skills	tech_type	m2o	select-dropdown-m2o	{}	related-values	{"template":"{{name}}"}	f	f	11	full	\N	\N	\N	f	\N	\N	\N
82	tech_skills	category	m2o	select-dropdown-m2o	\N	related-values	{"template":"{{name}}"}	f	f	8	half	\N	\N	\N	f	\N	\N	\N
84	tech_skills	years_experience	\N	input	\N	\N	\N	f	f	9	half	\N	\N	\N	f	\N	\N	\N
94	soft_skills	id	uuid	input	\N	\N	\N	t	t	1	full	\N	\N	\N	f	\N	\N	\N
96	soft_skills	sort	\N	input	\N	\N	\N	f	t	4	full	\N	\N	\N	f	\N	\N	\N
97	soft_skills	date_created	date-created	datetime	\N	datetime	{"relative":true}	t	t	5	half	\N	\N	\N	f	\N	\N	\N
98	soft_skills	date_updated	date-updated	datetime	\N	datetime	{"relative":true}	t	t	6	half	\N	\N	\N	f	\N	\N	\N
99	soft_skills	name	\N	input	\N	\N	\N	f	f	7	full	\N	\N	\N	t	\N	\N	\N
100	soft_skills	profile	m2o	select-dropdown-m2o	\N	related-values	{"template":"{{name}}"}	f	f	2	half	\N	\N	\N	f	\N	\N	\N
69	profiles	tech_skills	o2m	list-o2m	{"enableSelect":false}	\N	\N	f	f	19	full	\N	\N	\N	f	\N	\N	\N
95	soft_skills	status	\N	select-dropdown	{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]}	labels	{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]}	f	f	3	half	\N	\N	\N	f	\N	\N	\N
103	dev_methodologies	status	\N	select-dropdown	{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]}	labels	{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]}	f	f	3	half	\N	\N	\N	f	\N	\N	\N
109	profiles	dev_methodologies	o2m	list-o2m	\N	\N	\N	f	f	21	full	\N	\N	\N	f	\N	\N	\N
113	profiles	work_experiences	o2m	list-o2m	\N	\N	\N	f	f	\N	full	\N	\N	\N	f	\N	\N	\N
120	work_experiences	website	\N	input	\N	\N	\N	f	f	7	half	\N	Website of the company / organization you worked for.	\N	f	\N	\N	\N
124	work_experience_achievements	date_created	date-created	datetime	\N	datetime	{"relative":true}	t	t	5	half	\N	\N	\N	f	\N	\N	\N
107	dev_methodologies	name	\N	input	\N	\N	\N	f	f	4	full	\N	\N	\N	t	\N	\N	\N
122	work_experience_achievements	status	\N	select-dropdown	{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]}	labels	{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]}	f	f	3	half	\N	\N	\N	f	\N	\N	\N
118	work_experiences	start_date	\N	datetime	{}	datetime	{"format":"short"}	f	f	9	half	\N	\N	\N	f	\N	\N	\N
104	dev_methodologies	sort	\N	input	\N	\N	\N	f	t	5	full	\N	\N	\N	f	\N	\N	\N
106	dev_methodologies	date_updated	date-updated	datetime	\N	datetime	{"relative":true}	t	t	6	half	\N	\N	\N	f	\N	\N	\N
105	dev_methodologies	date_created	date-created	datetime	\N	datetime	{"relative":true}	t	t	7	half	\N	\N	\N	f	\N	\N	\N
119	work_experiences	end_date	\N	datetime	\N	datetime	{"format":"short"}	f	f	10	half	\N	\N	\N	f	\N	\N	\N
114	work_experiences	date_created	date-created	datetime	\N	datetime	{"relative":true}	t	t	14	half	\N	\N	\N	f	\N	\N	\N
115	work_experiences	date_updated	date-updated	datetime	\N	datetime	{"relative":true}	t	t	15	half	\N	\N	\N	f	\N	\N	\N
111	work_experiences	sort	\N	input	\N	\N	\N	f	t	16	full	\N	\N	\N	f	\N	\N	\N
129	work_experiences	achievements	o2m	list-o2m	{"enableSelect":false}	\N	\N	f	f	12	full	\N	\N	\N	f	\N	\N	\N
123	work_experience_achievements	sort	\N	input	\N	\N	\N	f	t	4	full	\N	\N	\N	f	\N	\N	\N
125	work_experience_achievements	date_updated	date-updated	datetime	\N	datetime	{"relative":true}	t	t	6	half	\N	\N	\N	f	\N	\N	\N
126	work_experience_achievements	title	\N	input	\N	\N	\N	f	f	7	half	\N	\N	\N	f	\N	\N	\N
131	work_experience_achievements	fa_icon	\N	input	\N	\N	\N	f	f	8	half	\N	Font Awesome icon name	\N	f	\N	\N	\N
108	dev_methodologies	profile	m2o	select-dropdown-m2o	{"template":null}	related-values	{"template":"{{name}}"}	f	f	2	half	\N	\N	\N	f	\N	\N	\N
127	work_experience_achievements	description	\N	input	\N	\N	\N	f	f	9	full	\N	\N	\N	f	\N	\N	\N
132	highlights	fa_icon	\N	input	\N	\N	\N	f	f	8	full	\N	Font Awesome icon name	\N	f	\N	\N	\N
133	work_experience_achievements	tags	cast-json	tags	{"whitespace":"-","capitalization":"lowercase","alphabetize":true}	\N	\N	f	f	10	full	\N	\N	\N	f	\N	\N	\N
112	work_experiences	profile	m2o	select-dropdown-m2o	\N	\N	\N	f	f	2	half	\N	\N	\N	f	\N	\N	\N
121	work_experience_achievements	id	uuid	input	\N	\N	\N	t	t	1	full	\N	\N	\N	f	\N	\N	\N
110	work_experiences	status	\N	select-dropdown	{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]}	labels	{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true}	f	f	3	half	\N	\N	\N	f	\N	\N	\N
128	work_experience_achievements	work_experience	m2o	select-dropdown-m2o	\N	related-values	{"template":"{{name}}"}	f	f	2	half	\N	\N	\N	f	\N	\N	\N
102	dev_methodologies	id	uuid	input	\N	\N	\N	t	t	1	full	\N	\N	\N	f	\N	\N	\N
\.


--
-- Data for Name: directus_files; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_files (id, storage, filename_disk, filename_download, title, type, folder, uploaded_by, created_on, modified_by, modified_on, charset, filesize, width, height, duration, embed, description, location, tags, metadata, focal_point_x, focal_point_y, tus_id, tus_data, uploaded_on) FROM stdin;
8127127c-d1cf-480e-87ea-5cbfbfc12e36	local	8127127c-d1cf-480e-87ea-5cbfbfc12e36.png	chipta-logo.png	Chipta Logo	image/png	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:31:28.781+00	\N	2025-10-15 15:31:28.796+00	\N	18182	558	270	\N	\N	\N	\N	\N	{}	\N	\N	\N	\N	2025-10-15 15:31:28.795+00
d6beca5c-5fc3-4f31-aa57-fc1a8209a97c	local	d6beca5c-5fc3-4f31-aa57-fc1a8209a97c.png	tender-it-logo.png	Tender It Logo	image/png	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:31:52.439+00	\N	2025-10-15 15:31:52.448+00	\N	24609	558	270	\N	\N	\N	\N	\N	{}	\N	\N	\N	\N	2025-10-15 15:31:52.448+00
e12c8ec6-2cbe-4672-98e9-a33d6ed5869a	local	e12c8ec6-2cbe-4672-98e9-a33d6ed5869a.png	profile-pic.png	Profile Pic	image/png	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:31:44.844+00	\N	2025-10-17 14:31:44.87+00	\N	1146192	750	1024	\N	\N	\N	\N	\N	{}	\N	\N	\N	\N	2025-10-17 14:31:44.869+00
\.


--
-- Data for Name: directus_flows; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_flows (id, name, icon, color, description, status, trigger, accountability, options, operation, date_created, user_created) FROM stdin;
\.


--
-- Data for Name: directus_folders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_folders (id, name, parent) FROM stdin;
\.


--
-- Data for Name: directus_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_migrations (version, name, "timestamp") FROM stdin;
20201028A	Remove Collection Foreign Keys	2025-10-15 11:34:39.592076+00
20201029A	Remove System Relations	2025-10-15 11:34:39.59634+00
20201029B	Remove System Collections	2025-10-15 11:34:39.601006+00
20201029C	Remove System Fields	2025-10-15 11:34:39.60932+00
20201105A	Add Cascade System Relations	2025-10-15 11:34:39.634062+00
20201105B	Change Webhook URL Type	2025-10-15 11:34:39.642474+00
20210225A	Add Relations Sort Field	2025-10-15 11:34:39.646632+00
20210304A	Remove Locked Fields	2025-10-15 11:34:39.64877+00
20210312A	Webhooks Collections Text	2025-10-15 11:34:39.653542+00
20210331A	Add Refresh Interval	2025-10-15 11:34:39.657357+00
20210415A	Make Filesize Nullable	2025-10-15 11:34:39.661967+00
20210416A	Add Collections Accountability	2025-10-15 11:34:39.664807+00
20210422A	Remove Files Interface	2025-10-15 11:34:39.666472+00
20210506A	Rename Interfaces	2025-10-15 11:34:39.681806+00
20210510A	Restructure Relations	2025-10-15 11:34:39.785936+00
20210518A	Add Foreign Key Constraints	2025-10-15 11:34:39.791101+00
20210519A	Add System Fk Triggers	2025-10-15 11:34:39.811102+00
20210521A	Add Collections Icon Color	2025-10-15 11:34:39.813231+00
20210525A	Add Insights	2025-10-15 11:34:39.82634+00
20210608A	Add Deep Clone Config	2025-10-15 11:34:39.828547+00
20210626A	Change Filesize Bigint	2025-10-15 11:34:39.83615+00
20210716A	Add Conditions to Fields	2025-10-15 11:34:39.838242+00
20210721A	Add Default Folder	2025-10-15 11:34:39.842129+00
20210802A	Replace Groups	2025-10-15 11:34:39.845392+00
20210803A	Add Required to Fields	2025-10-15 11:34:39.847357+00
20210805A	Update Groups	2025-10-15 11:34:39.850366+00
20210805B	Change Image Metadata Structure	2025-10-15 11:34:39.853252+00
20210811A	Add Geometry Config	2025-10-15 11:34:39.855265+00
20210831A	Remove Limit Column	2025-10-15 11:34:39.857037+00
20210903A	Add Auth Provider	2025-10-15 11:34:39.866518+00
20210907A	Webhooks Collections Not Null	2025-10-15 11:34:39.870999+00
20210910A	Move Module Setup	2025-10-15 11:34:39.873482+00
20210920A	Webhooks URL Not Null	2025-10-15 11:34:39.877929+00
20210924A	Add Collection Organization	2025-10-15 11:34:39.881908+00
20210927A	Replace Fields Group	2025-10-15 11:34:39.887654+00
20210927B	Replace M2M Interface	2025-10-15 11:34:39.889174+00
20210929A	Rename Login Action	2025-10-15 11:34:39.890612+00
20211007A	Update Presets	2025-10-15 11:34:39.894492+00
20211009A	Add Auth Data	2025-10-15 11:34:39.896289+00
20211016A	Add Webhook Headers	2025-10-15 11:34:39.897901+00
20211103A	Set Unique to User Token	2025-10-15 11:34:39.90049+00
20211103B	Update Special Geometry	2025-10-15 11:34:39.902044+00
20211104A	Remove Collections Listing	2025-10-15 11:34:39.903734+00
20211118A	Add Notifications	2025-10-15 11:34:39.912262+00
20211211A	Add Shares	2025-10-15 11:34:39.923124+00
20211230A	Add Project Descriptor	2025-10-15 11:34:39.924999+00
20220303A	Remove Default Project Color	2025-10-15 11:34:39.929454+00
20220308A	Add Bookmark Icon and Color	2025-10-15 11:34:39.931341+00
20220314A	Add Translation Strings	2025-10-15 11:34:39.933073+00
20220322A	Rename Field Typecast Flags	2025-10-15 11:34:39.93579+00
20220323A	Add Field Validation	2025-10-15 11:34:39.937661+00
20220325A	Fix Typecast Flags	2025-10-15 11:34:39.940841+00
20220325B	Add Default Language	2025-10-15 11:34:39.946497+00
20220402A	Remove Default Value Panel Icon	2025-10-15 11:34:39.951203+00
20220429A	Add Flows	2025-10-15 11:34:39.969306+00
20220429B	Add Color to Insights Icon	2025-10-15 11:34:39.971227+00
20220429C	Drop Non Null From IP of Activity	2025-10-15 11:34:39.972995+00
20220429D	Drop Non Null From Sender of Notifications	2025-10-15 11:34:39.974679+00
20220614A	Rename Hook Trigger to Event	2025-10-15 11:34:39.976103+00
20220801A	Update Notifications Timestamp Column	2025-10-15 11:34:39.980768+00
20220802A	Add Custom Aspect Ratios	2025-10-15 11:34:39.982847+00
20220826A	Add Origin to Accountability	2025-10-15 11:34:39.985517+00
20230401A	Update Material Icons	2025-10-15 11:34:39.991392+00
20230525A	Add Preview Settings	2025-10-15 11:34:39.994531+00
20230526A	Migrate Translation Strings	2025-10-15 11:34:40.000929+00
20230721A	Require Shares Fields	2025-10-15 11:34:40.004623+00
20230823A	Add Content Versioning	2025-10-15 11:34:40.015282+00
20230927A	Themes	2025-10-15 11:34:40.023811+00
20231009A	Update CSV Fields to Text	2025-10-15 11:34:40.026901+00
20231009B	Update Panel Options	2025-10-15 11:34:40.028558+00
20231010A	Add Extensions	2025-10-15 11:34:40.031596+00
20231215A	Add Focalpoints	2025-10-15 11:34:40.033525+00
20240122A	Add Report URL Fields	2025-10-15 11:34:40.035412+00
20240204A	Marketplace	2025-10-15 11:34:40.048741+00
20240305A	Change Useragent Type	2025-10-15 11:34:40.054691+00
20240311A	Deprecate Webhooks	2025-10-15 11:34:40.060103+00
20240422A	Public Registration	2025-10-15 11:34:40.063639+00
20240515A	Add Session Window	2025-10-15 11:34:40.065543+00
20240701A	Add Tus Data	2025-10-15 11:34:40.067398+00
20240716A	Update Files Date Fields	2025-10-15 11:34:40.071444+00
20240806A	Permissions Policies	2025-10-15 11:34:40.097988+00
20240817A	Update Icon Fields Length	2025-10-15 11:34:40.112319+00
20240909A	Separate Comments	2025-10-15 11:34:40.119581+00
20240909B	Consolidate Content Versioning	2025-10-15 11:34:40.127238+00
20240924A	Migrate Legacy Comments	2025-10-15 11:34:40.131822+00
20240924B	Populate Versioning Deltas	2025-10-15 11:34:40.135374+00
20250224A	Visual Editor	2025-10-15 11:34:40.138099+00
20250609A	License Banner	2025-10-15 11:34:40.141294+00
20250613A	Add Project ID	2025-10-15 11:34:40.148277+00
20250718A	Add Direction	2025-10-15 11:34:40.150205+00
20250813A	Add MCP	2025-10-15 11:34:40.152756+00
\.


--
-- Data for Name: directus_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_notifications (id, "timestamp", status, recipient, sender, subject, message, collection, item) FROM stdin;
\.


--
-- Data for Name: directus_operations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_operations (id, name, key, type, position_x, position_y, options, resolve, reject, flow, date_created, user_created) FROM stdin;
\.


--
-- Data for Name: directus_panels; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_panels (id, dashboard, name, icon, color, show_header, note, type, position_x, position_y, width, height, options, date_created, user_created) FROM stdin;
\.


--
-- Data for Name: directus_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_permissions (id, collection, action, permissions, validation, presets, fields, policy) FROM stdin;
\.


--
-- Data for Name: directus_policies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_policies (id, name, icon, description, ip_access, enforce_tfa, admin_access, app_access) FROM stdin;
abf8a154-5b1c-4a46-ac9c-7300570f4f17	$t:public_label	public	$t:public_description	\N	f	f	f
0a0d53b2-3692-4892-bacc-3be26b02c0e3	Administrator	verified	$t:admin_description	\N	f	t	t
\.


--
-- Data for Name: directus_presets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_presets (id, bookmark, "user", role, collection, search, layout, layout_query, layout_options, refresh_interval, filter, icon, color) FROM stdin;
2	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	users	\N	\N	{"tabular":{"page":1}}	\N	\N	\N	bookmark	\N
1	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	work_experiences	\N	\N	{"tabular":{"fields":["name","position","location","description","start_date","end_date","status"],"page":1}}	{"tabular":{"widths":{"name":126.5999755859375,"position":140.79998779296875,"location":114.4000244140625,"description":160.79998779296875,"start_date":117,"end_date":120,"status":91}}}	\N	\N	bookmark	\N
6	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	tech_skills	\N	tabular	{"tabular":{"fields":["name","category","years_experience","level","status","profile"],"page":1}}	{"tabular":{"widths":{"name":273,"category":183,"years_experience":101.4000244140625,"level":119.2000732421875,"status":96,"profile":124},"align":{"status":"left"}}}	\N	\N	bookmark	\N
8	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	highlights	\N	\N	{"tabular":{"fields":["text","fa_icon","status","profile"],"page":1}}	{"tabular":{"widths":{"text":584.800048828125,"fa_icon":99.4000244140625,"status":91,"profile":121.7999267578125}}}	\N	\N	bookmark	\N
7	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	tech_skill_categories	\N	\N	{"tabular":{"fields":["name","status"]}}	{"tabular":{"widths":{"name":708.199951171875,"status":98.6666259765625}}}	\N	\N	bookmark	\N
4	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	languages	\N	\N	{"tabular":{"page":1,"fields":["name","language_code","proficiency","status","profile"]}}	{"tabular":{"widths":{"name":287.60003662109375,"language_code":165.20001220703125,"proficiency":176.4000244140625,"status":96.4000244140625,"profile":132.39990234375}}}	\N	\N	bookmark	\N
9	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	tech_skill_types	\N	\N	{"tabular":{"fields":["name","status"]}}	{"tabular":{"widths":{"name":696.3999633789062,"status":118}}}	\N	\N	bookmark	\N
11	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	work_experience_achievements	\N	\N	{"tabular":{"fields":["title","description","work_experience","status"],"page":1}}	{"tabular":{"widths":{"title":213.5999755859375,"description":388,"work_experience":162.2000732421875,"status":90}}}	\N	\N	bookmark	\N
3	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	profiles	\N	\N	{"tabular":{"page":1,"fields":["name","title","core_stack","subtitle"]}}	{"tabular":{"widths":{"name":126.66665649414062,"title":231.66668701171875,"core_stack":278.3333740234375,"subtitle":343.3333740234375}}}	\N	\N	bookmark	\N
10	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	soft_skills	\N	\N	{"tabular":{"page":1,"fields":["name","status","profile"]}}	{"tabular":{"widths":{"name":587,"status":98.5999755859375,"profile":125.199951171875}}}	\N	\N	bookmark	\N
12	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	dev_methodologies	\N	\N	{"tabular":{"page":1,"fields":["name","status","profile"]}}	{"tabular":{"widths":{"name":591,"status":94.5999755859375,"profile":132.60003662109375}}}	\N	\N	bookmark	\N
\.


--
-- Data for Name: directus_relations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_relations (id, many_collection, many_field, one_collection, one_field, one_collection_field, one_allowed_collections, junction_field, sort_field, one_deselect_action) FROM stdin;
1	work_experiences	logo	directus_files	\N	\N	\N	\N	\N	nullify
3	languages	profile	profiles	languages	\N	\N	\N	\N	nullify
5	profiles	profile_picture	directus_files	\N	\N	\N	\N	\N	nullify
6	highlights	profile	profiles	highlights	\N	\N	\N	\N	nullify
7	tech_skills	profile	profiles	tech_skills	\N	\N	\N	\N	nullify
10	tech_skills	category	tech_skill_categories	tech_skills	\N	\N	\N	\N	nullify
11	tech_skills	tech_type	tech_skill_types	tech_skills	\N	\N	\N	\N	nullify
12	soft_skills	profile	profiles	soft_skills	\N	\N	\N	\N	nullify
13	dev_methodologies	profile	profiles	dev_methodologies	\N	\N	\N	\N	nullify
14	work_experiences	profile	profiles	work_experiences	\N	\N	\N	\N	nullify
15	work_experience_achievements	work_experience	work_experiences	achievements	\N	\N	\N	\N	nullify
\.


--
-- Data for Name: directus_revisions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_revisions (id, activity, collection, item, data, delta, parent, version) FROM stdin;
356	369	directus_fields	30	{"sort":1,"hidden":true,"readonly":true,"interface":"input","special":["uuid"],"field":"id","collection":"languages"}	{"sort":1,"hidden":true,"readonly":true,"interface":"input","special":["uuid"],"field":"id","collection":"languages"}	\N	\N
357	370	directus_fields	31	{"sort":2,"width":"full","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"interface":"select-dropdown","display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"field":"status","collection":"languages"}	{"sort":2,"width":"full","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"interface":"select-dropdown","display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"field":"status","collection":"languages"}	\N	\N
358	371	directus_fields	32	{"sort":3,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"languages"}	{"sort":3,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"languages"}	\N	\N
359	372	directus_fields	33	{"sort":4,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"languages"}	{"sort":4,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"languages"}	\N	\N
360	373	directus_collections	languages	{"archive_field":"status","archive_value":"archived","unarchive_value":"draft","singleton":false,"collection":"languages"}	{"archive_field":"status","archive_value":"archived","unarchive_value":"draft","singleton":false,"collection":"languages"}	\N	\N
361	374	directus_fields	34	{"sort":5,"interface":"input","special":null,"collection":"languages","field":"name"}	{"sort":5,"interface":"input","special":null,"collection":"languages","field":"name"}	\N	\N
362	375	directus_fields	34	{"id":34,"collection":"languages","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"languages","field":"name","width":"half"}	\N	\N
363	376	directus_fields	35	{"sort":6,"interface":"input","special":null,"collection":"languages","field":"language_code"}	{"sort":6,"interface":"input","special":null,"collection":"languages","field":"language_code"}	\N	\N
364	377	directus_fields	35	{"id":35,"collection":"languages","field":"language_code","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"languages","field":"language_code","width":"half"}	\N	\N
365	378	directus_fields	35	{"id":35,"collection":"languages","field":"language_code","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":"2-letter ISO 639 language code","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"languages","field":"language_code","note":"2-letter ISO 639 language code"}	\N	\N
366	379	directus_fields	36	{"sort":7,"interface":"select-radio","special":null,"options":{"choices":[{"text":"Native","value":"native"},{"text":"Fluent","value":"fluent"},{"text":"Proficient","value":"proficient"},{"text":"Conversational","value":"conversational"},{"text":"Basic","value":"basic"}]},"collection":"languages","field":"proficiency"}	{"sort":7,"interface":"select-radio","special":null,"options":{"choices":[{"text":"Native","value":"native"},{"text":"Fluent","value":"fluent"},{"text":"Proficient","value":"proficient"},{"text":"Conversational","value":"conversational"},{"text":"Basic","value":"basic"}]},"collection":"languages","field":"proficiency"}	\N	\N
367	380	directus_fields	37	{"sort":8,"special":["o2m"],"collection":"languages","field":"profile"}	{"sort":8,"special":["o2m"],"collection":"languages","field":"profile"}	\N	\N
368	383	directus_collections	profiles	{"collection":"profiles","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":null}	\N	\N
369	384	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":null}	\N	\N
370	385	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":null}	\N	\N
492	509	directus_fields	51	{"sort":17,"interface":"input","special":null,"collection":"profiles","field":"github_profile"}	{"sort":17,"interface":"input","special":null,"collection":"profiles","field":"github_profile"}	\N	\N
371	386	directus_collections	users	{"collection":"users","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":4,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":4,"group":null}	\N	\N
372	387	directus_fields	38	{"sort":8,"special":["m2o"],"collection":"languages","field":"profile"}	{"sort":8,"special":["m2o"],"collection":"languages","field":"profile"}	\N	\N
373	388	directus_fields	39	{"sort":13,"special":["o2m"],"interface":"list-o2m","collection":"profiles","field":"languages"}	{"sort":13,"special":["o2m"],"interface":"list-o2m","collection":"profiles","field":"languages"}	\N	\N
374	389	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}}"}	\N	\N
375	390	directus_fields	17	{"id":17,"collection":"profiles","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"id","sort":1,"group":null}	\N	\N
376	391	directus_fields	18	{"id":18,"collection":"profiles","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_created","sort":2,"group":null}	\N	\N
377	392	directus_fields	19	{"id":19,"collection":"profiles","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_updated","sort":3,"group":null}	\N	\N
378	393	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","sort":4,"group":null}	\N	\N
379	394	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","sort":5,"group":null}	\N	\N
380	395	directus_fields	27	{"id":27,"collection":"profiles","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"email_address","sort":6,"group":null}	\N	\N
381	396	directus_fields	26	{"id":26,"collection":"profiles","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"phone_number","sort":7,"group":null}	\N	\N
382	397	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","sort":8,"group":null}	\N	\N
383	398	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","sort":9,"group":null}	\N	\N
384	399	directus_fields	29	{"id":29,"collection":"profiles","field":"linkedin_url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_url","sort":10,"group":null}	\N	\N
385	400	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":11,"group":null}	\N	\N
386	401	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":12,"group":null}	\N	\N
387	402	languages	b636a780-6a9f-4342-adfa-eed183447a17	{"status":"published","name":"Dutch","language_code":"nl","proficiency":"native","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"status":"published","name":"Dutch","language_code":"nl","proficiency":"native","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	389	\N
407	422	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","sort":4,"group":null}	\N	\N
802	829	directus_fields	81	{"sort":8,"interface":"input","special":null,"required":true,"collection":"tech_skill_categories","field":"name"}	{"sort":8,"interface":"input","special":null,"required":true,"collection":"tech_skill_categories","field":"name"}	\N	\N
389	404	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T12:03:30.881Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","linkedin_url":"https://www.linkedin.com/in/rik-wanders-software/","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"]}	{"date_updated":"2025-10-17T12:03:30.881Z"}	\N	\N
388	403	languages	7024cec2-289e-44e5-a4e8-721805a151a0	{"status":"published","name":"English","language_code":"en","proficiency":"fluent","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"status":"published","name":"English","language_code":"en","proficiency":"fluent","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	389	\N
390	405	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","width":"half"}	\N	\N
391	406	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","width":"full"}	\N	\N
392	407	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"fill","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","width":"fill"}	\N	\N
393	408	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","width":"full"}	\N	\N
394	409	directus_settings	1	{"id":1,"project_name":"Smart Job Seeker","project_url":null,"project_color":"#6644FF","project_logo":null,"public_foreground":null,"public_background":null,"public_note":null,"auth_login_attempts":25,"auth_password_policy":null,"storage_asset_transform":"all","storage_asset_presets":null,"custom_css":null,"storage_default_folder":null,"basemaps":null,"mapbox_key":null,"module_bar":null,"project_descriptor":null,"default_language":"en-US","custom_aspect_ratios":null,"public_favicon":null,"default_appearance":"auto","default_theme_light":null,"theme_light_overrides":null,"default_theme_dark":null,"theme_dark_overrides":null,"report_error_url":null,"report_bug_url":null,"report_feature_url":null,"public_registration":false,"public_registration_verify_email":true,"public_registration_role":null,"public_registration_email_filter":null,"visual_editor_urls":null,"accepted_terms":true,"project_id":"0199e7a6-9d13-72dc-af68-381958575f19","mcp_enabled":false,"mcp_allow_deletes":false,"mcp_prompts_collection":null,"mcp_system_prompt_enabled":true,"mcp_system_prompt":null}	{"project_name":"Smart Job Seeker"}	\N	\N
395	410	directus_fields	40	{"sort":1,"hidden":true,"interface":"input","readonly":true,"field":"id","collection":"headlines"}	{"sort":1,"hidden":true,"interface":"input","readonly":true,"field":"id","collection":"headlines"}	\N	\N
396	411	directus_fields	41	{"sort":2,"interface":"input","hidden":true,"field":"sort","collection":"headlines"}	{"sort":2,"interface":"input","hidden":true,"field":"sort","collection":"headlines"}	\N	\N
397	412	directus_fields	42	{"sort":3,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"headlines"}	{"sort":3,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"headlines"}	\N	\N
398	413	directus_fields	43	{"sort":4,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"headlines"}	{"sort":4,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"headlines"}	\N	\N
399	414	directus_collections	headlines	{"sort_field":"sort","singleton":false,"collection":"headlines"}	{"sort_field":"sort","singleton":false,"collection":"headlines"}	\N	\N
400	415	directus_fields	44	{"sort":5,"interface":"input","special":null,"collection":"headlines","field":"name"}	{"sort":5,"interface":"input","special":null,"collection":"headlines","field":"name"}	\N	\N
401	416	directus_fields	45	{"sort":6,"interface":"input","special":null,"collection":"headlines","field":"text"}	{"sort":6,"interface":"input","special":null,"collection":"headlines","field":"text"}	\N	\N
402	417	directus_fields	46	{"sort":7,"special":["m2o"],"collection":"headlines","field":"profile"}	{"sort":7,"special":["m2o"],"collection":"headlines","field":"profile"}	\N	\N
403	418	directus_fields	47	{"sort":13,"special":["o2m"],"interface":"list-o2m","collection":"profiles","field":"headlines"}	{"sort":13,"special":["o2m"],"interface":"list-o2m","collection":"profiles","field":"headlines"}	\N	\N
404	419	directus_fields	17	{"id":17,"collection":"profiles","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"id","sort":1,"group":null}	\N	\N
405	420	directus_fields	18	{"id":18,"collection":"profiles","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_created","sort":2,"group":null}	\N	\N
406	421	directus_fields	19	{"id":19,"collection":"profiles","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_updated","sort":3,"group":null}	\N	\N
408	423	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","sort":5,"group":null}	\N	\N
409	424	directus_fields	27	{"id":27,"collection":"profiles","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"email_address","sort":6,"group":null}	\N	\N
410	425	directus_fields	26	{"id":26,"collection":"profiles","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"phone_number","sort":7,"group":null}	\N	\N
411	426	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","sort":8,"group":null}	\N	\N
412	427	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","sort":9,"group":null}	\N	\N
413	428	directus_fields	29	{"id":29,"collection":"profiles","field":"linkedin_url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_url","sort":10,"group":null}	\N	\N
414	429	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":11,"group":null}	\N	\N
415	430	directus_fields	47	{"id":47,"collection":"profiles","field":"headlines","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headlines","sort":12,"group":null}	\N	\N
416	431	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":13,"group":null}	\N	\N
417	432	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","options":{"enableSelect":false}}	\N	\N
418	433	directus_fields	47	{"id":47,"collection":"profiles","field":"headlines","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headlines","options":{"enableSelect":false}}	\N	\N
419	434	directus_collections	headlines	{"collection":"headlines","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"languages","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"languages"}	\N	\N
420	435	directus_collections	profiles	{"collection":"profiles","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":null}	\N	\N
421	436	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":null}	\N	\N
422	437	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":null}	\N	\N
423	438	directus_collections	users	{"collection":"users","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":4,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":4,"group":null}	\N	\N
424	439	directus_collections	profiles	{"collection":"profiles","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":null}	\N	\N
425	440	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":null}	\N	\N
426	441	directus_collections	headlines	{"collection":"headlines","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":null}	\N	\N
427	442	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":4,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":4,"group":null}	\N	\N
428	443	directus_collections	users	{"collection":"users","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":5,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":5,"group":null}	\N	\N
429	444	directus_collections	profiles	{"collection":"profiles","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":null}	\N	\N
430	445	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"profiles"}	\N	\N
431	446	directus_collections	headlines	{"collection":"headlines","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":null}	\N	\N
432	447	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":null}	\N	\N
433	448	directus_collections	users	{"collection":"users","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":4,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":4,"group":null}	\N	\N
434	449	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"profiles"}	\N	\N
435	450	directus_collections	profiles	{"collection":"profiles","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":null}	\N	\N
436	451	directus_collections	headlines	{"collection":"headlines","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":"profiles"}	\N	\N
437	452	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":null}	\N	\N
438	453	directus_collections	users	{"collection":"users","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":null}	\N	\N
440	455	directus_collections	profiles	{"collection":"profiles","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":null}	\N	\N
442	457	directus_collections	users	{"collection":"users","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":null}	\N	\N
892	922	tech_skill_types	11	{"name":"Cloud Platforms & Services","status":"published"}	{"name":"Cloud Platforms & Services","status":"published"}	\N	\N
439	454	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"profiles"}	\N	\N
441	456	directus_collections	headlines	{"collection":"headlines","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":"profiles"}	\N	\N
443	458	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":"profiles"}	\N	\N
444	459	directus_collections	headlines	{"collection":"headlines","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}}"}	\N	\N
446	461	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T12:47:02.102Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","linkedin_url":"https://www.linkedin.com/in/rik-wanders-software/","work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"],"languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"headlines":[1]}	{"date_updated":"2025-10-17T12:47:02.102Z"}	\N	\N
893	923	tech_skill_types	12	{"name":"Networking & Load Balancing","status":"published"}	{"name":"Networking & Load Balancing","status":"published"}	\N	\N
447	462	directus_fields	47	{"id":47,"collection":"profiles","field":"headlines","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false,"template":"{{text}}"},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headlines","options":{"enableSelect":false,"template":"{{text}}"}}	\N	\N
448	464	directus_collections	headlines	{"collection":"headlines","icon":null,"note":null,"display_template":"{{text}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{text}}"}	\N	\N
449	465	directus_fields	47	{"id":47,"collection":"profiles","field":"headlines","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false,"template":null},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headlines","options":{"enableSelect":false,"template":null}}	\N	\N
450	466	directus_fields	48	{"sort":14,"interface":"input","special":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","collection":"profiles","field":"subtitle"}	{"sort":14,"interface":"input","special":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","collection":"profiles","field":"subtitle"}	\N	\N
451	467	directus_fields	48	{"id":48,"collection":"profiles","field":"subtitle","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"half","translations":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"subtitle","width":"half"}	\N	\N
452	468	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","width":"full"}	\N	\N
453	469	directus_fields	17	{"id":17,"collection":"profiles","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"id","sort":1,"group":null}	\N	\N
454	470	directus_fields	18	{"id":18,"collection":"profiles","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_created","sort":2,"group":null}	\N	\N
455	471	directus_fields	19	{"id":19,"collection":"profiles","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_updated","sort":3,"group":null}	\N	\N
456	472	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","sort":4,"group":null}	\N	\N
457	473	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","sort":5,"group":null}	\N	\N
458	474	directus_fields	48	{"id":48,"collection":"profiles","field":"subtitle","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"subtitle","sort":6,"group":null}	\N	\N
459	475	directus_fields	27	{"id":27,"collection":"profiles","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"email_address","sort":7,"group":null}	\N	\N
460	476	directus_fields	26	{"id":26,"collection":"profiles","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"phone_number","sort":8,"group":null}	\N	\N
461	477	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","sort":9,"group":null}	\N	\N
462	478	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","sort":10,"group":null}	\N	\N
463	479	directus_fields	29	{"id":29,"collection":"profiles","field":"linkedin_url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_url","sort":11,"group":null}	\N	\N
464	480	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":12,"group":null}	\N	\N
465	481	directus_fields	47	{"id":47,"collection":"profiles","field":"headlines","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false,"template":null},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headlines","sort":13,"group":null}	\N	\N
466	482	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":14,"group":null}	\N	\N
467	483	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","width":"full"}	\N	\N
468	484	directus_fields	48	{"id":48,"collection":"profiles","field":"subtitle","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"subtitle","width":"full"}	\N	\N
469	485	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T13:05:15.036Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","linkedin_url":"https://www.linkedin.com/in/rik-wanders-software/","subtitle":"Building scalable web applications for remote teams","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"headlines":[1],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"]}	{"subtitle":"Building scalable web applications for remote teams","date_updated":"2025-10-17T13:05:15.036Z"}	\N	\N
470	486	directus_fields	49	{"sort":15,"interface":"input","special":null,"collection":"profiles","field":"core_stack"}	{"sort":15,"interface":"input","special":null,"collection":"profiles","field":"core_stack"}	\N	\N
471	487	directus_fields	17	{"id":17,"collection":"profiles","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"id","sort":1,"group":null}	\N	\N
472	488	directus_fields	18	{"id":18,"collection":"profiles","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_created","sort":2,"group":null}	\N	\N
473	489	directus_fields	19	{"id":19,"collection":"profiles","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_updated","sort":3,"group":null}	\N	\N
474	490	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","sort":4,"group":null}	\N	\N
475	491	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","sort":5,"group":null}	\N	\N
476	492	directus_fields	49	{"id":49,"collection":"profiles","field":"core_stack","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"core_stack","sort":6,"group":null}	\N	\N
477	493	directus_fields	48	{"id":48,"collection":"profiles","field":"subtitle","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"subtitle","sort":7,"group":null}	\N	\N
478	494	directus_fields	27	{"id":27,"collection":"profiles","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"email_address","sort":8,"group":null}	\N	\N
479	495	directus_fields	26	{"id":26,"collection":"profiles","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"phone_number","sort":9,"group":null}	\N	\N
480	496	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","sort":10,"group":null}	\N	\N
481	497	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","sort":11,"group":null}	\N	\N
482	498	directus_fields	29	{"id":29,"collection":"profiles","field":"linkedin_url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_url","sort":12,"group":null}	\N	\N
483	499	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":13,"group":null}	\N	\N
484	500	directus_fields	47	{"id":47,"collection":"profiles","field":"headlines","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false,"template":null},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headlines","sort":14,"group":null}	\N	\N
485	501	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":15,"group":null}	\N	\N
486	502	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T13:09:30.224Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","linkedin_url":"https://www.linkedin.com/in/rik-wanders-software/","subtitle":"Building scalable web applications for remote teams","core_stack":"Python • Node.js • CI/CD • DevOps","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"headlines":[1],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"]}	{"core_stack":"Python • Node.js • CI/CD • DevOps","date_updated":"2025-10-17T13:09:30.224Z"}	\N	\N
487	503	directus_fields	49	{"id":49,"collection":"profiles","field":"core_stack","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":"Short list of your core technology stack that you are most familiar with.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"core_stack","note":"Short list of your core technology stack that you are most familiar with."}	\N	\N
488	504	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":"Your job title, a phrase describing your profession.","conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","note":"Your job title, a phrase describing your profession."}	\N	\N
489	505	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":"Where you are currently based.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","note":"Where you are currently based."}	\N	\N
490	507	directus_fields	50	{"sort":16,"interface":"input","special":null,"collection":"profiles","field":"linkedin_profile"}	{"sort":16,"interface":"input","special":null,"collection":"profiles","field":"linkedin_profile"}	\N	\N
491	508	directus_fields	50	{"id":50,"collection":"profiles","field":"linkedin_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_profile","width":"half"}	\N	\N
493	510	directus_fields	51	{"id":51,"collection":"profiles","field":"github_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":17,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"github_profile","width":"half"}	\N	\N
494	511	directus_fields	17	{"id":17,"collection":"profiles","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"id","sort":1,"group":null}	\N	\N
495	512	directus_fields	18	{"id":18,"collection":"profiles","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_created","sort":2,"group":null}	\N	\N
496	513	directus_fields	19	{"id":19,"collection":"profiles","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_updated","sort":3,"group":null}	\N	\N
497	514	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","sort":4,"group":null}	\N	\N
498	515	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":"Your job title, a phrase describing your profession.","conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","sort":5,"group":null}	\N	\N
499	516	directus_fields	49	{"id":49,"collection":"profiles","field":"core_stack","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":"Short list of your core technology stack that you are most familiar with.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"core_stack","sort":6,"group":null}	\N	\N
500	517	directus_fields	48	{"id":48,"collection":"profiles","field":"subtitle","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"subtitle","sort":7,"group":null}	\N	\N
501	518	directus_fields	27	{"id":27,"collection":"profiles","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"email_address","sort":8,"group":null}	\N	\N
502	519	directus_fields	26	{"id":26,"collection":"profiles","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"phone_number","sort":9,"group":null}	\N	\N
503	520	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":"Where you are currently based.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","sort":10,"group":null}	\N	\N
504	521	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","sort":11,"group":null}	\N	\N
505	522	directus_fields	50	{"id":50,"collection":"profiles","field":"linkedin_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_profile","sort":12,"group":null}	\N	\N
506	523	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":13,"group":null}	\N	\N
507	524	directus_fields	47	{"id":47,"collection":"profiles","field":"headlines","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false,"template":null},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headlines","sort":14,"group":null}	\N	\N
508	525	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":15,"group":null}	\N	\N
509	526	directus_fields	51	{"id":51,"collection":"profiles","field":"github_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"github_profile","sort":16,"group":null}	\N	\N
510	527	directus_fields	17	{"id":17,"collection":"profiles","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"id","sort":1,"group":null}	\N	\N
511	528	directus_fields	18	{"id":18,"collection":"profiles","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_created","sort":2,"group":null}	\N	\N
512	529	directus_fields	19	{"id":19,"collection":"profiles","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_updated","sort":3,"group":null}	\N	\N
513	530	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","sort":4,"group":null}	\N	\N
514	531	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":"Your job title, a phrase describing your profession.","conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","sort":5,"group":null}	\N	\N
515	532	directus_fields	49	{"id":49,"collection":"profiles","field":"core_stack","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":"Short list of your core technology stack that you are most familiar with.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"core_stack","sort":6,"group":null}	\N	\N
516	533	directus_fields	48	{"id":48,"collection":"profiles","field":"subtitle","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"subtitle","sort":7,"group":null}	\N	\N
517	534	directus_fields	27	{"id":27,"collection":"profiles","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"email_address","sort":8,"group":null}	\N	\N
518	535	directus_fields	26	{"id":26,"collection":"profiles","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"phone_number","sort":9,"group":null}	\N	\N
519	536	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":"Where you are currently based.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","sort":10,"group":null}	\N	\N
520	537	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","sort":11,"group":null}	\N	\N
521	538	directus_fields	50	{"id":50,"collection":"profiles","field":"linkedin_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_profile","sort":12,"group":null}	\N	\N
522	539	directus_fields	51	{"id":51,"collection":"profiles","field":"github_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"github_profile","sort":13,"group":null}	\N	\N
523	540	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":14,"group":null}	\N	\N
524	541	directus_fields	47	{"id":47,"collection":"profiles","field":"headlines","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false,"template":null},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headlines","sort":15,"group":null}	\N	\N
525	542	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":16,"group":null}	\N	\N
527	544	directus_fields	52	{"sort":17,"interface":"input","special":null,"collection":"profiles","field":"stackoverflow_profile"}	{"sort":17,"interface":"input","special":null,"collection":"profiles","field":"stackoverflow_profile"}	\N	\N
526	543	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T13:43:14.909Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","subtitle":"Building scalable web applications for remote teams","core_stack":"Python • Node.js • CI/CD • DevOps","linkedin_profile":"https://www.linkedin.com/in/rik-wanders-software","github_profile":"https://github.com/gitaarik","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"headlines":[1],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"]}	{"linkedin_profile":"https://www.linkedin.com/in/rik-wanders-software","github_profile":"https://github.com/gitaarik","date_updated":"2025-10-17T13:43:14.909Z"}	\N	\N
528	545	directus_fields	52	{"id":52,"collection":"profiles","field":"stackoverflow_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":17,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"stackoverflow_profile","width":"half"}	\N	\N
529	546	directus_fields	17	{"id":17,"collection":"profiles","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"id","sort":1,"group":null}	\N	\N
530	547	directus_fields	18	{"id":18,"collection":"profiles","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_created","sort":2,"group":null}	\N	\N
531	548	directus_fields	19	{"id":19,"collection":"profiles","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_updated","sort":3,"group":null}	\N	\N
532	549	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","sort":4,"group":null}	\N	\N
533	550	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":"Your job title, a phrase describing your profession.","conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","sort":5,"group":null}	\N	\N
534	551	directus_fields	49	{"id":49,"collection":"profiles","field":"core_stack","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":"Short list of your core technology stack that you are most familiar with.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"core_stack","sort":6,"group":null}	\N	\N
535	552	directus_fields	48	{"id":48,"collection":"profiles","field":"subtitle","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"subtitle","sort":7,"group":null}	\N	\N
536	553	directus_fields	27	{"id":27,"collection":"profiles","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"email_address","sort":8,"group":null}	\N	\N
537	554	directus_fields	26	{"id":26,"collection":"profiles","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"phone_number","sort":9,"group":null}	\N	\N
538	555	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":"Where you are currently based.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","sort":10,"group":null}	\N	\N
539	556	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","sort":11,"group":null}	\N	\N
540	557	directus_fields	50	{"id":50,"collection":"profiles","field":"linkedin_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_profile","sort":12,"group":null}	\N	\N
541	558	directus_fields	51	{"id":51,"collection":"profiles","field":"github_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"github_profile","sort":13,"group":null}	\N	\N
821	851	tech_skills	1	{"id":1,"status":"published","sort":null,"date_created":"2025-10-17T15:11:59.895Z","date_updated":"2025-10-17T15:36:49.584Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","name":"Python","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7"}	{"category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","date_updated":"2025-10-17T15:36:49.584Z"}	\N	\N
542	559	directus_fields	52	{"id":52,"collection":"profiles","field":"stackoverflow_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"stackoverflow_profile","sort":14,"group":null}	\N	\N
543	560	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":15,"group":null}	\N	\N
544	561	directus_fields	47	{"id":47,"collection":"profiles","field":"headlines","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false,"template":null},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headlines","sort":16,"group":null}	\N	\N
545	562	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":17,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":17,"group":null}	\N	\N
546	563	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T13:44:41.829Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","subtitle":"Building scalable web applications for remote teams","core_stack":"Python • Node.js • CI/CD • DevOps","linkedin_profile":"https://www.linkedin.com/in/rik-wanders-software","github_profile":"https://github.com/gitaarik","stackoverflow_profile":"https://stackoverflow.com/users/1248175/gitaarik","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"headlines":[1],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"]}	{"stackoverflow_profile":"https://stackoverflow.com/users/1248175/gitaarik","date_updated":"2025-10-17T13:44:41.829Z"}	\N	\N
547	564	directus_fields	52	{"id":52,"collection":"profiles","field":"stackoverflow_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"stackoverflow_profile","width":"full"}	\N	\N
548	565	directus_fields	50	{"id":50,"collection":"profiles","field":"linkedin_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_profile","width":"full"}	\N	\N
549	566	directus_fields	51	{"id":51,"collection":"profiles","field":"github_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"github_profile","width":"full"}	\N	\N
550	567	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","width":"full"}	\N	\N
551	576	directus_fields	53	{"sort":18,"interface":"input","special":null,"note":"Brief professional tagline that summarizes your key qualifications.","collection":"profiles","field":"headline"}	{"sort":18,"interface":"input","special":null,"note":"Brief professional tagline that summarizes your key qualifications.","collection":"profiles","field":"headline"}	\N	\N
552	577	directus_fields	17	{"id":17,"collection":"profiles","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"id","sort":1,"group":null}	\N	\N
553	578	directus_fields	18	{"id":18,"collection":"profiles","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_created","sort":2,"group":null}	\N	\N
554	579	directus_fields	19	{"id":19,"collection":"profiles","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_updated","sort":3,"group":null}	\N	\N
555	580	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","sort":4,"group":null}	\N	\N
556	581	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":"Your job title, a phrase describing your profession.","conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","sort":5,"group":null}	\N	\N
557	582	directus_fields	49	{"id":49,"collection":"profiles","field":"core_stack","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":"Short list of your core technology stack that you are most familiar with.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"core_stack","sort":6,"group":null}	\N	\N
558	583	directus_fields	48	{"id":48,"collection":"profiles","field":"subtitle","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"subtitle","sort":7,"group":null}	\N	\N
559	584	directus_fields	27	{"id":27,"collection":"profiles","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"email_address","sort":8,"group":null}	\N	\N
560	585	directus_fields	26	{"id":26,"collection":"profiles","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"phone_number","sort":9,"group":null}	\N	\N
561	586	directus_fields	53	{"id":53,"collection":"profiles","field":"headline","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"full","translations":null,"note":"Brief professional tagline that summarizes your key qualifications.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headline","sort":10,"group":null}	\N	\N
562	587	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":"Where you are currently based.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","sort":11,"group":null}	\N	\N
563	588	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","sort":12,"group":null}	\N	\N
564	589	directus_fields	50	{"id":50,"collection":"profiles","field":"linkedin_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_profile","sort":13,"group":null}	\N	\N
565	590	directus_fields	51	{"id":51,"collection":"profiles","field":"github_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"github_profile","sort":14,"group":null}	\N	\N
566	591	directus_fields	52	{"id":52,"collection":"profiles","field":"stackoverflow_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"stackoverflow_profile","sort":15,"group":null}	\N	\N
567	592	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":16,"group":null}	\N	\N
568	593	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":17,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":17,"group":null}	\N	\N
569	594	directus_fields	17	{"id":17,"collection":"profiles","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"id","sort":1,"group":null}	\N	\N
570	595	directus_fields	18	{"id":18,"collection":"profiles","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_created","sort":2,"group":null}	\N	\N
571	596	directus_fields	19	{"id":19,"collection":"profiles","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_updated","sort":3,"group":null}	\N	\N
572	597	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","sort":4,"group":null}	\N	\N
573	598	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":"Your job title, a phrase describing your profession.","conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","sort":5,"group":null}	\N	\N
574	599	directus_fields	49	{"id":49,"collection":"profiles","field":"core_stack","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":"Short list of your core technology stack that you are most familiar with.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"core_stack","sort":6,"group":null}	\N	\N
575	600	directus_fields	48	{"id":48,"collection":"profiles","field":"subtitle","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"subtitle","sort":7,"group":null}	\N	\N
576	601	directus_fields	53	{"id":53,"collection":"profiles","field":"headline","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":"Brief professional tagline that summarizes your key qualifications.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headline","sort":8,"group":null}	\N	\N
577	602	directus_fields	27	{"id":27,"collection":"profiles","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"email_address","sort":9,"group":null}	\N	\N
894	924	tech_skills	3	{"id":3,"status":"published","sort":null,"date_created":"2025-10-17T16:03:18.660Z","date_updated":"2025-10-17T16:37:50.808Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","name":"PostgreSQL","category":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","years_experience":"4","level":"expert","tech_type":3}	{"tech_type":3,"date_updated":"2025-10-17T16:37:50.808Z"}	\N	\N
578	603	directus_fields	26	{"id":26,"collection":"profiles","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"phone_number","sort":10,"group":null}	\N	\N
579	604	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":"Where you are currently based.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","sort":11,"group":null}	\N	\N
580	605	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","sort":12,"group":null}	\N	\N
581	606	directus_fields	50	{"id":50,"collection":"profiles","field":"linkedin_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_profile","sort":13,"group":null}	\N	\N
582	607	directus_fields	51	{"id":51,"collection":"profiles","field":"github_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"github_profile","sort":14,"group":null}	\N	\N
583	608	directus_fields	52	{"id":52,"collection":"profiles","field":"stackoverflow_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"stackoverflow_profile","sort":15,"group":null}	\N	\N
584	609	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":16,"group":null}	\N	\N
585	610	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":17,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":17,"group":null}	\N	\N
586	611	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T14:28:43.418Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","subtitle":"Building scalable web applications for remote teams","core_stack":"Python • Node.js • CI/CD • DevOps","linkedin_profile":"https://www.linkedin.com/in/rik-wanders-software","github_profile":"https://github.com/gitaarik","stackoverflow_profile":"https://stackoverflow.com/users/1248175/gitaarik","headline":"Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"]}	{"headline":"Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI","date_updated":"2025-10-17T14:28:43.418Z"}	\N	\N
587	612	directus_fields	54	{"sort":18,"interface":"file-image","special":["file"],"collection":"profiles","field":"profile_picture"}	{"sort":18,"interface":"file-image","special":["file"],"collection":"profiles","field":"profile_picture"}	\N	\N
588	613	directus_fields	17	{"id":17,"collection":"profiles","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"id","sort":1,"group":null}	\N	\N
589	614	directus_fields	18	{"id":18,"collection":"profiles","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_created","sort":2,"group":null}	\N	\N
590	615	directus_fields	19	{"id":19,"collection":"profiles","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_updated","sort":3,"group":null}	\N	\N
591	616	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","sort":4,"group":null}	\N	\N
592	617	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":"Your job title, a phrase describing your profession.","conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","sort":5,"group":null}	\N	\N
593	618	directus_fields	49	{"id":49,"collection":"profiles","field":"core_stack","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":"Short list of your core technology stack that you are most familiar with.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"core_stack","sort":6,"group":null}	\N	\N
594	619	directus_fields	48	{"id":48,"collection":"profiles","field":"subtitle","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"subtitle","sort":7,"group":null}	\N	\N
595	620	directus_fields	53	{"id":53,"collection":"profiles","field":"headline","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":"Brief professional tagline that summarizes your key qualifications.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headline","sort":8,"group":null}	\N	\N
596	621	directus_fields	27	{"id":27,"collection":"profiles","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"email_address","sort":9,"group":null}	\N	\N
597	622	directus_fields	26	{"id":26,"collection":"profiles","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"phone_number","sort":10,"group":null}	\N	\N
598	623	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":"Where you are currently based.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","sort":11,"group":null}	\N	\N
599	624	directus_fields	54	{"id":54,"collection":"profiles","field":"profile_picture","special":["file"],"interface":"file-image","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"profile_picture","sort":12,"group":null}	\N	\N
600	625	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","sort":13,"group":null}	\N	\N
601	626	directus_fields	50	{"id":50,"collection":"profiles","field":"linkedin_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_profile","sort":14,"group":null}	\N	\N
602	627	directus_fields	51	{"id":51,"collection":"profiles","field":"github_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"github_profile","sort":15,"group":null}	\N	\N
603	628	directus_fields	52	{"id":52,"collection":"profiles","field":"stackoverflow_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"stackoverflow_profile","sort":16,"group":null}	\N	\N
604	629	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":17,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":17,"group":null}	\N	\N
605	630	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":18,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":18,"group":null}	\N	\N
606	631	directus_files	e12c8ec6-2cbe-4672-98e9-a33d6ed5869a	{"title":"Profile Pic","filename_download":"profile-pic.png","type":"image/png","storage":"local"}	{"title":"Profile Pic","filename_download":"profile-pic.png","type":"image/png","storage":"local"}	\N	\N
607	632	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T14:31:47.389Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","subtitle":"Building scalable web applications for remote teams","core_stack":"Python • Node.js • CI/CD • DevOps","linkedin_profile":"https://www.linkedin.com/in/rik-wanders-software","github_profile":"https://github.com/gitaarik","stackoverflow_profile":"https://stackoverflow.com/users/1248175/gitaarik","headline":"Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI","profile_picture":"e12c8ec6-2cbe-4672-98e9-a33d6ed5869a","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"]}	{"profile_picture":"e12c8ec6-2cbe-4672-98e9-a33d6ed5869a","date_updated":"2025-10-17T14:31:47.389Z"}	\N	\N
608	633	directus_fields	54	{"id":54,"collection":"profiles","field":"profile_picture","special":["file"],"interface":"file-image","options":{"crop":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"profile_picture","options":{"crop":false}}	\N	\N
899	929	tech_skill_types	5	{"id":5,"status":"published","sort":5,"date_created":"2025-10-17T16:16:57.042Z","date_updated":"2025-10-17T16:39:09.098Z","name":"NoSQL Databases","tech_skills":[]}	{"name":"NoSQL Databases","date_updated":"2025-10-17T16:39:09.098Z"}	\N	\N
609	634	directus_fields	54	{"id":54,"collection":"profiles","field":"profile_picture","special":["file"],"interface":"file-image","options":{"crop":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"profile_picture","width":"half"}	\N	\N
610	635	directus_fields	17	{"id":17,"collection":"profiles","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"id","sort":1,"group":null}	\N	\N
611	636	directus_fields	18	{"id":18,"collection":"profiles","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_created","sort":2,"group":null}	\N	\N
612	637	directus_fields	19	{"id":19,"collection":"profiles","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_updated","sort":3,"group":null}	\N	\N
613	638	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","sort":4,"group":null}	\N	\N
614	639	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":"Your job title, a phrase describing your profession.","conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","sort":5,"group":null}	\N	\N
615	640	directus_fields	49	{"id":49,"collection":"profiles","field":"core_stack","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":"Short list of your core technology stack that you are most familiar with.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"core_stack","sort":6,"group":null}	\N	\N
616	641	directus_fields	48	{"id":48,"collection":"profiles","field":"subtitle","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"subtitle","sort":7,"group":null}	\N	\N
617	642	directus_fields	53	{"id":53,"collection":"profiles","field":"headline","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":"Brief professional tagline that summarizes your key qualifications.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headline","sort":8,"group":null}	\N	\N
618	643	directus_fields	54	{"id":54,"collection":"profiles","field":"profile_picture","special":["file"],"interface":"file-image","options":{"crop":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"profile_picture","sort":9,"group":null}	\N	\N
619	644	directus_fields	27	{"id":27,"collection":"profiles","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"email_address","sort":10,"group":null}	\N	\N
620	645	directus_fields	26	{"id":26,"collection":"profiles","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"phone_number","sort":11,"group":null}	\N	\N
621	646	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"half","translations":null,"note":"Where you are currently based.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","sort":12,"group":null}	\N	\N
622	647	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","sort":13,"group":null}	\N	\N
623	648	directus_fields	50	{"id":50,"collection":"profiles","field":"linkedin_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_profile","sort":14,"group":null}	\N	\N
624	649	directus_fields	51	{"id":51,"collection":"profiles","field":"github_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"github_profile","sort":15,"group":null}	\N	\N
625	650	directus_fields	52	{"id":52,"collection":"profiles","field":"stackoverflow_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"stackoverflow_profile","sort":16,"group":null}	\N	\N
661	686	directus_fields	17	{"id":17,"collection":"profiles","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"id","sort":1,"group":null}	\N	\N
626	651	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":17,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":17,"group":null}	\N	\N
627	652	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":18,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":18,"group":null}	\N	\N
628	653	directus_fields	17	{"id":17,"collection":"profiles","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"id","sort":1,"group":null}	\N	\N
629	654	directus_fields	18	{"id":18,"collection":"profiles","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_created","sort":2,"group":null}	\N	\N
630	655	directus_fields	19	{"id":19,"collection":"profiles","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_updated","sort":3,"group":null}	\N	\N
631	656	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","sort":4,"group":null}	\N	\N
632	657	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":"Your job title, a phrase describing your profession.","conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","sort":5,"group":null}	\N	\N
633	658	directus_fields	49	{"id":49,"collection":"profiles","field":"core_stack","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":"Short list of your core technology stack that you are most familiar with.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"core_stack","sort":6,"group":null}	\N	\N
634	659	directus_fields	48	{"id":48,"collection":"profiles","field":"subtitle","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"subtitle","sort":7,"group":null}	\N	\N
635	660	directus_fields	53	{"id":53,"collection":"profiles","field":"headline","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":"Brief professional tagline that summarizes your key qualifications.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headline","sort":8,"group":null}	\N	\N
636	661	directus_fields	54	{"id":54,"collection":"profiles","field":"profile_picture","special":["file"],"interface":"file-image","options":{"crop":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"profile_picture","sort":9,"group":null}	\N	\N
637	662	directus_fields	27	{"id":27,"collection":"profiles","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"email_address","sort":10,"group":null}	\N	\N
638	663	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":"Where you are currently based.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","sort":11,"group":null}	\N	\N
639	664	directus_fields	26	{"id":26,"collection":"profiles","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"phone_number","sort":12,"group":null}	\N	\N
640	665	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","sort":13,"group":null}	\N	\N
641	666	directus_fields	50	{"id":50,"collection":"profiles","field":"linkedin_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_profile","sort":14,"group":null}	\N	\N
1075	1106	dev_methodologies	a80c302e-c184-4e50-8b7d-c4e4bee261c8	{"name":"Pair-programming","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"name":"Pair-programming","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1076	\N
642	667	directus_fields	51	{"id":51,"collection":"profiles","field":"github_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"github_profile","sort":15,"group":null}	\N	\N
643	668	directus_fields	52	{"id":52,"collection":"profiles","field":"stackoverflow_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"stackoverflow_profile","sort":16,"group":null}	\N	\N
644	669	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":17,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":17,"group":null}	\N	\N
645	670	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":18,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":18,"group":null}	\N	\N
646	671	directus_fields	55	{"sort":1,"hidden":true,"readonly":true,"interface":"input","special":["uuid"],"field":"id","collection":"highlights"}	{"sort":1,"hidden":true,"readonly":true,"interface":"input","special":["uuid"],"field":"id","collection":"highlights"}	\N	\N
647	672	directus_fields	56	{"sort":2,"width":"full","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"interface":"select-dropdown","display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"field":"status","collection":"highlights"}	{"sort":2,"width":"full","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"interface":"select-dropdown","display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"field":"status","collection":"highlights"}	\N	\N
648	673	directus_fields	57	{"sort":3,"interface":"input","hidden":true,"field":"sort","collection":"highlights"}	{"sort":3,"interface":"input","hidden":true,"field":"sort","collection":"highlights"}	\N	\N
649	674	directus_fields	58	{"sort":4,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"highlights"}	{"sort":4,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"highlights"}	\N	\N
650	675	directus_fields	59	{"sort":5,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"highlights"}	{"sort":5,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"highlights"}	\N	\N
651	676	directus_collections	highlights	{"sort_field":"sort","archive_field":"status","archive_value":"archived","unarchive_value":"draft","singleton":false,"collection":"highlights"}	{"sort_field":"sort","archive_field":"status","archive_value":"archived","unarchive_value":"draft","singleton":false,"collection":"highlights"}	\N	\N
652	677	directus_fields	60	{"sort":6,"special":["m2o"],"collection":"highlights","field":"profile"}	{"sort":6,"special":["m2o"],"collection":"highlights","field":"profile"}	\N	\N
653	678	directus_fields	61	{"sort":19,"special":["o2m"],"interface":"list-o2m","collection":"profiles","field":"highlights"}	{"sort":19,"special":["o2m"],"interface":"list-o2m","collection":"profiles","field":"highlights"}	\N	\N
654	679	directus_fields	62	{"sort":7,"interface":"input","special":null,"required":true,"collection":"highlights","field":"text"}	{"sort":7,"interface":"input","special":null,"required":true,"collection":"highlights","field":"text"}	\N	\N
655	680	directus_collections	highlights	{"collection":"highlights","icon":null,"note":null,"display_template":"{{text}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":null,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{text}}"}	\N	\N
656	681	directus_collections	profiles	{"collection":"profiles","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":null}	\N	\N
657	682	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"profiles"}	\N	\N
658	683	directus_collections	users	{"collection":"users","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":null}	\N	\N
659	684	directus_collections	highlights	{"collection":"highlights","icon":null,"note":null,"display_template":"{{text}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":"profiles"}	\N	\N
660	685	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":"profiles"}	\N	\N
662	687	directus_fields	18	{"id":18,"collection":"profiles","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_created","sort":2,"group":null}	\N	\N
663	688	directus_fields	19	{"id":19,"collection":"profiles","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_updated","sort":3,"group":null}	\N	\N
664	689	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","sort":4,"group":null}	\N	\N
665	690	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":"Your job title, a phrase describing your profession.","conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","sort":5,"group":null}	\N	\N
666	691	directus_fields	49	{"id":49,"collection":"profiles","field":"core_stack","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":"Short list of your core technology stack that you are most familiar with.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"core_stack","sort":6,"group":null}	\N	\N
667	692	directus_fields	48	{"id":48,"collection":"profiles","field":"subtitle","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"subtitle","sort":7,"group":null}	\N	\N
668	693	directus_fields	53	{"id":53,"collection":"profiles","field":"headline","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":"Brief professional tagline that summarizes your key qualifications.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headline","sort":8,"group":null}	\N	\N
669	694	directus_fields	54	{"id":54,"collection":"profiles","field":"profile_picture","special":["file"],"interface":"file-image","options":{"crop":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"profile_picture","sort":9,"group":null}	\N	\N
670	695	directus_fields	27	{"id":27,"collection":"profiles","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"email_address","sort":10,"group":null}	\N	\N
671	696	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":"Where you are currently based.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","sort":11,"group":null}	\N	\N
672	697	directus_fields	26	{"id":26,"collection":"profiles","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"phone_number","sort":12,"group":null}	\N	\N
673	698	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","sort":13,"group":null}	\N	\N
674	699	directus_fields	50	{"id":50,"collection":"profiles","field":"linkedin_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_profile","sort":14,"group":null}	\N	\N
675	700	directus_fields	51	{"id":51,"collection":"profiles","field":"github_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"github_profile","sort":15,"group":null}	\N	\N
676	701	directus_fields	52	{"id":52,"collection":"profiles","field":"stackoverflow_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"stackoverflow_profile","sort":16,"group":null}	\N	\N
677	702	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":17,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":17,"group":null}	\N	\N
1402	1445	directus_fields	131	{"sort":10,"interface":"input","special":null,"note":"Font Awesome icon name","collection":"work_experience_achievements","field":"fa_icon"}	{"sort":10,"interface":"input","special":null,"note":"Font Awesome icon name","collection":"work_experience_achievements","field":"fa_icon"}	\N	\N
678	703	directus_fields	61	{"id":61,"collection":"profiles","field":"highlights","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":18,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"highlights","sort":18,"group":null}	\N	\N
679	704	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":19,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":19,"group":null}	\N	\N
680	705	directus_fields	61	{"id":61,"collection":"profiles","field":"highlights","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":18,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"highlights","options":{"enableSelect":false}}	\N	\N
688	713	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T14:38:05.588Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","subtitle":"Building scalable web applications for remote teams","core_stack":"Python • Node.js • CI/CD • DevOps","linkedin_profile":"https://www.linkedin.com/in/rik-wanders-software","github_profile":"https://github.com/gitaarik","stackoverflow_profile":"https://stackoverflow.com/users/1248175/gitaarik","headline":"Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI","profile_picture":"e12c8ec6-2cbe-4672-98e9-a33d6ed5869a","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"],"highlights":["00483bae-b8ef-46bb-8230-0f84c989f971","85956023-2be3-4fa9-9643-fc677ffd97cb","bf60fa32-c241-4a49-9edf-d0a21c3a4b3d","82700d7e-0a60-43af-82a7-1ca8a4fcb43f","912a4cfd-44d1-4b88-bd32-0a67ce05e1bc","311f493d-c89f-4a35-86fc-9605e93f639d","e30e3468-9f74-4bdb-9f33-abcef8eb6f7b"]}	{"date_updated":"2025-10-17T14:38:05.588Z"}	\N	\N
681	706	highlights	00483bae-b8ef-46bb-8230-0f84c989f971	{"status":"published","text":"18+ years of full stack development experience","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"status":"published","text":"18+ years of full stack development experience","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	688	\N
682	707	highlights	85956023-2be3-4fa9-9643-fc677ffd97cb	{"text":"Expertise in modern Python, JavaScript & Node.js ecosystems","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"text":"Expertise in modern Python, JavaScript & Node.js ecosystems","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	688	\N
683	708	highlights	bf60fa32-c241-4a49-9edf-d0a21c3a4b3d	{"text":"Team leadership and project management experience","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"text":"Team leadership and project management experience","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	688	\N
684	709	highlights	82700d7e-0a60-43af-82a7-1ca8a4fcb43f	{"text":"Additional experience in DevOps & CI/CD","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"text":"Additional experience in DevOps & CI/CD","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	688	\N
685	710	highlights	912a4cfd-44d1-4b88-bd32-0a67ce05e1bc	{"text":"Skilled in developing scalable solutions for high-traffic applications","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"text":"Skilled in developing scalable solutions for high-traffic applications","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	688	\N
686	711	highlights	311f493d-c89f-4a35-86fc-9605e93f639d	{"text":"5+ years remote work and distributed team collaboration experience","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"text":"5+ years remote work and distributed team collaboration experience","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	688	\N
687	712	highlights	e30e3468-9f74-4bdb-9f33-abcef8eb6f7b	{"text":"AI-accelerated development skills with security best practices","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"text":"AI-accelerated development skills with security best practices","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	688	\N
689	714	directus_fields	63	{"sort":1,"hidden":true,"interface":"input","readonly":true,"field":"id","collection":"tech_skills"}	{"sort":1,"hidden":true,"interface":"input","readonly":true,"field":"id","collection":"tech_skills"}	\N	\N
690	715	directus_fields	64	{"sort":2,"width":"full","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"interface":"select-dropdown","display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"field":"status","collection":"tech_skills"}	{"sort":2,"width":"full","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"interface":"select-dropdown","display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"field":"status","collection":"tech_skills"}	\N	\N
691	716	directus_fields	65	{"sort":3,"interface":"input","hidden":true,"field":"sort","collection":"tech_skills"}	{"sort":3,"interface":"input","hidden":true,"field":"sort","collection":"tech_skills"}	\N	\N
692	717	directus_fields	66	{"sort":4,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"tech_skills"}	{"sort":4,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"tech_skills"}	\N	\N
693	718	directus_fields	67	{"sort":5,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"tech_skills"}	{"sort":5,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"tech_skills"}	\N	\N
694	719	directus_collections	tech_skills	{"sort_field":"sort","archive_field":"status","archive_value":"archived","unarchive_value":"draft","singleton":false,"collection":"tech_skills"}	{"sort_field":"sort","archive_field":"status","archive_value":"archived","unarchive_value":"draft","singleton":false,"collection":"tech_skills"}	\N	\N
695	720	directus_fields	68	{"sort":6,"special":["m2o"],"collection":"tech_skills","field":"profile"}	{"sort":6,"special":["m2o"],"collection":"tech_skills","field":"profile"}	\N	\N
696	721	directus_fields	69	{"sort":20,"special":["o2m"],"interface":"list-o2m","collection":"profiles","field":"tech_skills"}	{"sort":20,"special":["o2m"],"interface":"list-o2m","collection":"profiles","field":"tech_skills"}	\N	\N
697	722	directus_fields	70	{"sort":7,"interface":"input","special":null,"collection":"tech_skills","field":"name"}	{"sort":7,"interface":"input","special":null,"collection":"tech_skills","field":"name"}	\N	\N
698	723	directus_collections	tech_skills	{"collection":"tech_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":null,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}}"}	\N	\N
699	724	directus_collections	tech_skills	{"collection":"tech_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"work_experiences","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"work_experiences"}	\N	\N
700	725	directus_collections	profiles	{"collection":"profiles","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":null}	\N	\N
701	726	directus_collections	users	{"collection":"users","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":null}	\N	\N
702	727	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"profiles"}	\N	\N
703	728	directus_collections	highlights	{"collection":"highlights","icon":null,"note":null,"display_template":"{{text}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":"profiles"}	\N	\N
704	729	directus_collections	tech_skills	{"collection":"tech_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":"profiles"}	\N	\N
705	730	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":4,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":4,"group":"profiles"}	\N	\N
706	731	directus_fields	17	{"id":17,"collection":"profiles","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"id","sort":1,"group":null}	\N	\N
707	732	directus_fields	18	{"id":18,"collection":"profiles","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_created","sort":2,"group":null}	\N	\N
708	733	directus_fields	19	{"id":19,"collection":"profiles","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_updated","sort":3,"group":null}	\N	\N
709	734	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","sort":4,"group":null}	\N	\N
710	735	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":"Your job title, a phrase describing your profession.","conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","sort":5,"group":null}	\N	\N
711	736	directus_fields	49	{"id":49,"collection":"profiles","field":"core_stack","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":"Short list of your core technology stack that you are most familiar with.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"core_stack","sort":6,"group":null}	\N	\N
712	737	directus_fields	48	{"id":48,"collection":"profiles","field":"subtitle","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"subtitle","sort":7,"group":null}	\N	\N
713	738	directus_fields	53	{"id":53,"collection":"profiles","field":"headline","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":"Brief professional tagline that summarizes your key qualifications.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headline","sort":8,"group":null}	\N	\N
714	739	directus_fields	54	{"id":54,"collection":"profiles","field":"profile_picture","special":["file"],"interface":"file-image","options":{"crop":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"profile_picture","sort":9,"group":null}	\N	\N
715	740	directus_fields	27	{"id":27,"collection":"profiles","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"email_address","sort":10,"group":null}	\N	\N
716	741	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":"Where you are currently based.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","sort":11,"group":null}	\N	\N
717	742	directus_fields	26	{"id":26,"collection":"profiles","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"phone_number","sort":12,"group":null}	\N	\N
718	743	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","sort":13,"group":null}	\N	\N
719	744	directus_fields	50	{"id":50,"collection":"profiles","field":"linkedin_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_profile","sort":14,"group":null}	\N	\N
720	745	directus_fields	51	{"id":51,"collection":"profiles","field":"github_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"github_profile","sort":15,"group":null}	\N	\N
721	746	directus_fields	52	{"id":52,"collection":"profiles","field":"stackoverflow_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"stackoverflow_profile","sort":16,"group":null}	\N	\N
722	747	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":17,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":17,"group":null}	\N	\N
723	748	directus_fields	61	{"id":61,"collection":"profiles","field":"highlights","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":18,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"highlights","sort":18,"group":null}	\N	\N
724	749	directus_fields	69	{"id":69,"collection":"profiles","field":"tech_skills","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":19,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"tech_skills","sort":19,"group":null}	\N	\N
725	750	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":20,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":20,"group":null}	\N	\N
726	751	directus_fields	69	{"id":69,"collection":"profiles","field":"tech_skills","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":19,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"tech_skills","options":{"enableSelect":false}}	\N	\N
727	752	directus_fields	71	{"sort":1,"hidden":true,"readonly":true,"interface":"input","special":["uuid"],"field":"id","collection":"tech_skill_categories"}	{"sort":1,"hidden":true,"readonly":true,"interface":"input","special":["uuid"],"field":"id","collection":"tech_skill_categories"}	\N	\N
728	753	directus_fields	72	{"sort":2,"width":"full","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"interface":"select-dropdown","display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"field":"status","collection":"tech_skill_categories"}	{"sort":2,"width":"full","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"interface":"select-dropdown","display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"field":"status","collection":"tech_skill_categories"}	\N	\N
729	754	directus_fields	73	{"sort":3,"interface":"input","hidden":true,"field":"sort","collection":"tech_skill_categories"}	{"sort":3,"interface":"input","hidden":true,"field":"sort","collection":"tech_skill_categories"}	\N	\N
730	755	directus_fields	74	{"sort":4,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"tech_skill_categories"}	{"sort":4,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"tech_skill_categories"}	\N	\N
731	756	directus_fields	75	{"sort":5,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"tech_skill_categories"}	{"sort":5,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"tech_skill_categories"}	\N	\N
732	757	directus_collections	tech_skill_categories	{"sort_field":"sort","archive_field":"status","archive_value":"archived","unarchive_value":"draft","singleton":false,"collection":"tech_skill_categories"}	{"sort_field":"sort","archive_field":"status","archive_value":"archived","unarchive_value":"draft","singleton":false,"collection":"tech_skill_categories"}	\N	\N
733	758	directus_fields	76	{"sort":6,"interface":"input","special":null,"collection":"tech_skill_categories","field":"text"}	{"sort":6,"interface":"input","special":null,"collection":"tech_skill_categories","field":"text"}	\N	\N
734	759	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"profiles"}	\N	\N
735	760	directus_collections	profiles	{"collection":"profiles","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":null}	\N	\N
736	761	directus_collections	highlights	{"collection":"highlights","icon":null,"note":null,"display_template":"{{text}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":"profiles"}	\N	\N
737	762	directus_collections	users	{"collection":"users","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":null}	\N	\N
738	763	directus_collections	tech_skills	{"collection":"tech_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":"profiles"}	\N	\N
739	764	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":4,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":4,"group":"profiles"}	\N	\N
803	830	directus_fields	71	{"id":71,"collection":"tech_skill_categories","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skill_categories","field":"id","sort":1,"group":null}	\N	\N
740	765	directus_collections	tech_skill_categories	{"collection":"tech_skill_categories","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":5,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":5,"group":"profiles"}	\N	\N
741	766	directus_collections	tech_skill_categories	{"collection":"tech_skill_categories","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"tech_skills","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"tech_skills"}	\N	\N
742	767	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"profiles"}	\N	\N
743	768	directus_collections	highlights	{"collection":"highlights","icon":null,"note":null,"display_template":"{{text}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":"profiles"}	\N	\N
744	769	directus_collections	tech_skills	{"collection":"tech_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":"profiles"}	\N	\N
745	770	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":4,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":4,"group":"profiles"}	\N	\N
746	771	directus_fields	77	{"sort":8,"special":["m2o"],"collection":"tech_skills","field":"category"}	{"sort":8,"special":["m2o"],"collection":"tech_skills","field":"category"}	\N	\N
747	772	directus_fields	78	{"sort":7,"special":["o2m"],"interface":"list-o2m","collection":"tech_skill_categories","field":"tech_skills"}	{"sort":7,"special":["o2m"],"interface":"list-o2m","collection":"tech_skill_categories","field":"tech_skills"}	\N	\N
748	773	tech_skill_categories	e6875da0-e556-45f0-be1e-e469fdaed3a7	{"status":"published","text":"Backend"}	{"status":"published","text":"Backend"}	\N	\N
749	774	tech_skill_categories	78c235f4-2456-40e6-939d-19c855a30aa1	{"text":"Frontend","status":"published"}	{"text":"Frontend","status":"published"}	\N	\N
751	776	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T15:11:59.894Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","subtitle":"Building scalable web applications for remote teams","core_stack":"Python • Node.js • CI/CD • DevOps","linkedin_profile":"https://www.linkedin.com/in/rik-wanders-software","github_profile":"https://github.com/gitaarik","stackoverflow_profile":"https://stackoverflow.com/users/1248175/gitaarik","headline":"Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI","profile_picture":"e12c8ec6-2cbe-4672-98e9-a33d6ed5869a","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"highlights":["00483bae-b8ef-46bb-8230-0f84c989f971","85956023-2be3-4fa9-9643-fc677ffd97cb","bf60fa32-c241-4a49-9edf-d0a21c3a4b3d","82700d7e-0a60-43af-82a7-1ca8a4fcb43f","912a4cfd-44d1-4b88-bd32-0a67ce05e1bc","311f493d-c89f-4a35-86fc-9605e93f639d","e30e3468-9f74-4bdb-9f33-abcef8eb6f7b"],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"],"tech_skills":[1]}	{"date_updated":"2025-10-17T15:11:59.894Z"}	\N	\N
750	775	tech_skills	1	{"name":"Python","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"name":"Python","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	751	\N
753	778	tech_skill_categories	e6875da0-e556-45f0-be1e-e469fdaed3a7	{"id":"e6875da0-e556-45f0-be1e-e469fdaed3a7","status":"published","sort":null,"date_created":"2025-10-17T15:11:13.878Z","date_updated":"2025-10-17T15:12:09.049Z","text":"Backend","tech_skills":[1]}	{"date_updated":"2025-10-17T15:12:09.049Z"}	\N	\N
752	777	tech_skills	1	{"id":1,"status":"published","sort":null,"date_created":"2025-10-17T15:11:59.895Z","date_updated":"2025-10-17T15:12:09.051Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","name":"Python","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7"}	{"category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","date_updated":"2025-10-17T15:12:09.051Z"}	753	\N
754	779	tech_skill_categories	0bcc8c53-eb96-4d3b-8bd5-81faf33000a5	{"text":"Databases","status":"published"}	{"text":"Databases","status":"published"}	\N	\N
755	782	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"profiles"}	\N	\N
756	783	directus_collections	highlights	{"collection":"highlights","icon":null,"note":null,"display_template":"{{text}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":"profiles"}	\N	\N
757	784	directus_collections	tech_skill_categories	{"collection":"tech_skill_categories","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":"profiles"}	\N	\N
758	785	directus_collections	tech_skills	{"collection":"tech_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":4,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":4,"group":"profiles"}	\N	\N
759	786	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":5,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":5,"group":"profiles"}	\N	\N
760	787	directus_collections	tech_skills	{"collection":"tech_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"tech_skill_categories","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"tech_skill_categories"}	\N	\N
761	788	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"profiles"}	\N	\N
762	789	directus_collections	highlights	{"collection":"highlights","icon":null,"note":null,"display_template":"{{text}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":"profiles"}	\N	\N
763	790	directus_collections	tech_skill_categories	{"collection":"tech_skill_categories","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":"profiles"}	\N	\N
764	791	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":4,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":4,"group":"profiles"}	\N	\N
765	792	directus_fields	79	{"sort":8,"special":["m2o"],"collection":"tech_skills","field":"category"}	{"sort":8,"special":["m2o"],"collection":"tech_skills","field":"category"}	\N	\N
766	793	directus_fields	80	{"sort":7,"special":["o2m"],"interface":"list-o2m","collection":"tech_skill_categories","field":"tech_skills"}	{"sort":7,"special":["o2m"],"interface":"list-o2m","collection":"tech_skill_categories","field":"tech_skills"}	\N	\N
767	794	directus_fields	79	{"id":79,"collection":"tech_skills","field":"category","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"category","interface":"select-dropdown-m2o"}	\N	\N
768	795	directus_collections	tech_skill_categories	{"collection":"tech_skill_categories","icon":null,"note":null,"display_template":"{{text}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{text}}"}	\N	\N
769	796	directus_fields	68	{"id":68,"collection":"tech_skills","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"profile","interface":"select-dropdown-m2o"}	\N	\N
770	797	directus_fields	63	{"id":63,"collection":"tech_skills","field":"id","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"id","sort":1,"group":null}	\N	\N
771	798	directus_fields	65	{"id":65,"collection":"tech_skills","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"sort","sort":2,"group":null}	\N	\N
772	799	directus_fields	64	{"id":64,"collection":"tech_skills","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":3,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"status","sort":3,"group":null}	\N	\N
773	800	directus_fields	66	{"id":66,"collection":"tech_skills","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"date_created","sort":4,"group":null}	\N	\N
774	801	directus_fields	67	{"id":67,"collection":"tech_skills","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"date_updated","sort":5,"group":null}	\N	\N
775	802	directus_fields	68	{"id":68,"collection":"tech_skills","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"profile","sort":6,"group":null}	\N	\N
776	803	directus_fields	70	{"id":70,"collection":"tech_skills","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"name","sort":7,"group":null}	\N	\N
777	804	directus_fields	79	{"id":79,"collection":"tech_skills","field":"category","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"category","sort":8,"group":null}	\N	\N
778	805	directus_fields	63	{"id":63,"collection":"tech_skills","field":"id","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"id","sort":1,"group":null}	\N	\N
779	806	directus_fields	65	{"id":65,"collection":"tech_skills","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"sort","sort":2,"group":null}	\N	\N
780	807	directus_fields	66	{"id":66,"collection":"tech_skills","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"date_created","sort":3,"group":null}	\N	\N
781	808	directus_fields	67	{"id":67,"collection":"tech_skills","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"date_updated","sort":4,"group":null}	\N	\N
782	809	directus_fields	64	{"id":64,"collection":"tech_skills","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"status","sort":5,"group":null}	\N	\N
783	810	directus_fields	68	{"id":68,"collection":"tech_skills","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"profile","sort":6,"group":null}	\N	\N
784	811	directus_fields	70	{"id":70,"collection":"tech_skills","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"name","sort":7,"group":null}	\N	\N
785	812	directus_fields	79	{"id":79,"collection":"tech_skills","field":"category","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"category","sort":8,"group":null}	\N	\N
786	813	directus_fields	68	{"id":68,"collection":"tech_skills","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"profile","width":"half"}	\N	\N
799	826	directus_fields	68	{"id":68,"collection":"tech_skills","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":{"template":"{{name}}"},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"profile","options":{"template":"{{name}}"}}	\N	\N
787	814	directus_fields	64	{"id":64,"collection":"tech_skills","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"status","width":"half"}	\N	\N
788	815	directus_fields	63	{"id":63,"collection":"tech_skills","field":"id","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"id","sort":1,"group":null}	\N	\N
789	816	directus_fields	65	{"id":65,"collection":"tech_skills","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"sort","sort":2,"group":null}	\N	\N
790	817	directus_fields	66	{"id":66,"collection":"tech_skills","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"date_created","sort":3,"group":null}	\N	\N
791	818	directus_fields	67	{"id":67,"collection":"tech_skills","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"date_updated","sort":4,"group":null}	\N	\N
792	819	directus_fields	68	{"id":68,"collection":"tech_skills","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"profile","sort":5,"group":null}	\N	\N
793	820	directus_fields	64	{"id":64,"collection":"tech_skills","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"status","sort":6,"group":null}	\N	\N
794	821	directus_fields	70	{"id":70,"collection":"tech_skills","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"name","sort":7,"group":null}	\N	\N
795	822	directus_fields	79	{"id":79,"collection":"tech_skills","field":"category","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"category","sort":8,"group":null}	\N	\N
796	823	tech_skills	1	{"id":1,"status":"published","sort":null,"date_created":"2025-10-17T15:11:59.895Z","date_updated":"2025-10-17T15:25:34.397Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","name":"Python","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7"}	{"category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","date_updated":"2025-10-17T15:25:34.397Z"}	\N	\N
797	824	directus_fields	70	{"id":70,"collection":"tech_skills","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"name","width":"half"}	\N	\N
798	825	directus_fields	79	{"id":79,"collection":"tech_skills","field":"category","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"category","width":"half"}	\N	\N
800	827	directus_fields	68	{"id":68,"collection":"tech_skills","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":{"template":null},"display":"related-values","display_options":{"template":"{{name}}"},"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"profile","options":{"template":null},"display":"related-values","display_options":{"template":"{{name}}"}}	\N	\N
801	828	directus_fields	79	{"id":79,"collection":"tech_skills","field":"category","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":"related-values","display_options":{"template":"{{text}}"},"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"category","display":"related-values","display_options":{"template":"{{text}}"}}	\N	\N
804	831	directus_fields	72	{"id":72,"collection":"tech_skill_categories","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skill_categories","field":"status","sort":2,"group":null}	\N	\N
805	832	directus_fields	73	{"id":73,"collection":"tech_skill_categories","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":3,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skill_categories","field":"sort","sort":3,"group":null}	\N	\N
806	833	directus_fields	74	{"id":74,"collection":"tech_skill_categories","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skill_categories","field":"date_created","sort":4,"group":null}	\N	\N
807	834	directus_fields	75	{"id":75,"collection":"tech_skill_categories","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skill_categories","field":"date_updated","sort":5,"group":null}	\N	\N
808	835	directus_fields	81	{"id":81,"collection":"tech_skill_categories","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skill_categories","field":"name","sort":6,"group":null}	\N	\N
809	836	directus_fields	76	{"id":76,"collection":"tech_skill_categories","field":"text","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skill_categories","field":"text","sort":7,"group":null}	\N	\N
810	837	directus_fields	80	{"id":80,"collection":"tech_skill_categories","field":"tech_skills","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skill_categories","field":"tech_skills","sort":8,"group":null}	\N	\N
811	838	tech_skill_categories	78c235f4-2456-40e6-939d-19c855a30aa1	{"id":"78c235f4-2456-40e6-939d-19c855a30aa1","status":"published","sort":null,"date_created":"2025-10-17T15:11:24.359Z","date_updated":"2025-10-17T15:29:21.475Z","text":"Frontend","name":"Frontend","tech_skills":[]}	{"name":"Frontend","date_updated":"2025-10-17T15:29:21.475Z"}	\N	\N
812	839	tech_skill_categories	0bcc8c53-eb96-4d3b-8bd5-81faf33000a5	{"id":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","status":"published","sort":null,"date_created":"2025-10-17T15:12:51.928Z","date_updated":"2025-10-17T15:29:24.926Z","text":"Databases","name":"Databases","tech_skills":[]}	{"name":"Databases","date_updated":"2025-10-17T15:29:24.926Z"}	\N	\N
813	840	tech_skill_categories	e6875da0-e556-45f0-be1e-e469fdaed3a7	{"id":"e6875da0-e556-45f0-be1e-e469fdaed3a7","status":"published","sort":null,"date_created":"2025-10-17T15:11:13.878Z","date_updated":"2025-10-17T15:29:31.195Z","text":"Backend","name":"Backend","tech_skills":[1]}	{"name":"Backend","date_updated":"2025-10-17T15:29:31.195Z"}	\N	\N
814	841	directus_collections	tech_skill_categories	{"collection":"tech_skill_categories","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}}"}	\N	\N
815	843	directus_fields	81	{"id":81,"collection":"tech_skill_categories","field":"name","special":null,"interface":"input","options":null,"display":"raw","display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skill_categories","field":"name","display":"raw"}	\N	\N
816	844	directus_fields	80	{"id":80,"collection":"tech_skill_categories","field":"tech_skills","special":["o2m"],"interface":"list-o2m","options":null,"display":"related-values","display_options":{"template":"{{name}}"},"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skill_categories","field":"tech_skills","display":"related-values","display_options":{"template":"{{name}}"}}	\N	\N
817	847	directus_fields	82	{"sort":8,"special":["m2o"],"collection":"tech_skills","field":"category"}	{"sort":8,"special":["m2o"],"collection":"tech_skills","field":"category"}	\N	\N
818	848	directus_fields	83	{"sort":7,"special":["o2m"],"interface":"list-o2m","collection":"tech_skill_categories","field":"tech_skills"}	{"sort":7,"special":["o2m"],"interface":"list-o2m","collection":"tech_skill_categories","field":"tech_skills"}	\N	\N
819	849	directus_fields	82	{"id":82,"collection":"tech_skills","field":"category","special":["m2o"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"category","width":"half"}	\N	\N
820	850	directus_fields	82	{"id":82,"collection":"tech_skills","field":"category","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"category","interface":"select-dropdown-m2o"}	\N	\N
822	852	directus_fields	82	{"id":82,"collection":"tech_skills","field":"category","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":"related-values","display_options":{"template":"{{name}}"},"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"category","display":"related-values","display_options":{"template":"{{name}}"}}	\N	\N
823	853	directus_fields	60	{"id":60,"collection":"highlights","field":"profile","special":["m2o"],"interface":null,"options":null,"display":"related-values","display_options":{"template":"{{name}}"},"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"profile","display":"related-values","display_options":{"template":"{{name}}"}}	\N	\N
824	854	directus_fields	38	{"id":38,"collection":"languages","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"languages","field":"profile","interface":"select-dropdown-m2o"}	\N	\N
825	855	directus_fields	30	{"id":30,"collection":"languages","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"languages","field":"id","sort":1,"group":null}	\N	\N
826	856	directus_fields	38	{"id":38,"collection":"languages","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"languages","field":"profile","sort":2,"group":null}	\N	\N
827	857	directus_fields	31	{"id":31,"collection":"languages","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":3,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"languages","field":"status","sort":3,"group":null}	\N	\N
828	858	directus_fields	32	{"id":32,"collection":"languages","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"languages","field":"date_created","sort":4,"group":null}	\N	\N
829	859	directus_fields	33	{"id":33,"collection":"languages","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"languages","field":"date_updated","sort":5,"group":null}	\N	\N
830	860	directus_fields	34	{"id":34,"collection":"languages","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"languages","field":"name","sort":6,"group":null}	\N	\N
831	861	directus_fields	35	{"id":35,"collection":"languages","field":"language_code","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":"2-letter ISO 639 language code","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"languages","field":"language_code","sort":7,"group":null}	\N	\N
832	862	directus_fields	36	{"id":36,"collection":"languages","field":"proficiency","special":null,"interface":"select-radio","options":{"choices":[{"text":"Native","value":"native"},{"text":"Fluent","value":"fluent"},{"text":"Proficient","value":"proficient"},{"text":"Conversational","value":"conversational"},{"text":"Basic","value":"basic"}]},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"languages","field":"proficiency","sort":8,"group":null}	\N	\N
833	863	directus_fields	38	{"id":38,"collection":"languages","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"languages","field":"profile","width":"half"}	\N	\N
849	879	directus_fields	85	{"sort":10,"interface":"select-dropdown","special":null,"options":{"choices":[{"text":"Expert","value":"expert"},{"text":"Proficient","value":"proficient"},{"text":"Intermediate","value":"intermediate"},{"text":"Beginner","value":"beginner"}],"allowNone":true},"collection":"tech_skills","field":"level"}	{"sort":10,"interface":"select-dropdown","special":null,"options":{"choices":[{"text":"Expert","value":"expert"},{"text":"Proficient","value":"proficient"},{"text":"Intermediate","value":"intermediate"},{"text":"Beginner","value":"beginner"}],"allowNone":true},"collection":"tech_skills","field":"level"}	\N	\N
834	864	directus_fields	31	{"id":31,"collection":"languages","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"languages","field":"status","width":"half"}	\N	\N
835	865	directus_collections	tech_skills	{"collection":"tech_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"highlights","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"highlights"}	\N	\N
836	866	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"profiles"}	\N	\N
837	867	directus_collections	highlights	{"collection":"highlights","icon":null,"note":null,"display_template":"{{text}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":"profiles"}	\N	\N
838	868	directus_collections	tech_skills	{"collection":"tech_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":"profiles"}	\N	\N
839	869	directus_collections	tech_skill_categories	{"collection":"tech_skill_categories","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":4,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":4,"group":"profiles"}	\N	\N
840	870	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":5,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":5,"group":"profiles"}	\N	\N
841	871	directus_collections	tech_skill_categories	{"collection":"tech_skill_categories","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"tech_skills","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"tech_skills"}	\N	\N
842	872	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"profiles"}	\N	\N
843	873	directus_collections	highlights	{"collection":"highlights","icon":null,"note":null,"display_template":"{{text}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":"profiles"}	\N	\N
844	874	directus_collections	tech_skills	{"collection":"tech_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":"profiles"}	\N	\N
845	875	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":4,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":4,"group":"profiles"}	\N	\N
846	876	directus_fields	84	{"sort":9,"interface":"input","special":null,"collection":"tech_skills","field":"years_experience"}	{"sort":9,"interface":"input","special":null,"collection":"tech_skills","field":"years_experience"}	\N	\N
847	877	directus_fields	84	{"id":84,"collection":"tech_skills","field":"years_experience","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"years_experience","width":"half"}	\N	\N
848	878	tech_skills	1	{"id":1,"status":"published","sort":null,"date_created":"2025-10-17T15:11:59.895Z","date_updated":"2025-10-17T15:44:03.516Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","name":"Python","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"12"}	{"years_experience":"12","date_updated":"2025-10-17T15:44:03.516Z"}	\N	\N
850	880	directus_fields	85	{"id":85,"collection":"tech_skills","field":"level","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"Expert","value":"expert"},{"text":"Proficient","value":"proficient"},{"text":"Intermediate","value":"intermediate"},{"text":"Beginner","value":"beginner"}],"allowNone":true},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"level","width":"half"}	\N	\N
851	881	tech_skills	1	{"id":1,"status":"published","sort":null,"date_created":"2025-10-17T15:11:59.895Z","date_updated":"2025-10-17T15:50:06.873Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","name":"Python","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"12","level":"expert"}	{"level":"expert","date_updated":"2025-10-17T15:50:06.873Z"}	\N	\N
852	882	directus_fields	86	{"sort":1,"hidden":true,"interface":"input","readonly":true,"field":"id","collection":"tech_skill_types"}	{"sort":1,"hidden":true,"interface":"input","readonly":true,"field":"id","collection":"tech_skill_types"}	\N	\N
853	883	directus_fields	87	{"sort":2,"width":"full","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"interface":"select-dropdown","display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"field":"status","collection":"tech_skill_types"}	{"sort":2,"width":"full","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"interface":"select-dropdown","display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"field":"status","collection":"tech_skill_types"}	\N	\N
854	884	directus_fields	88	{"sort":3,"interface":"input","hidden":true,"field":"sort","collection":"tech_skill_types"}	{"sort":3,"interface":"input","hidden":true,"field":"sort","collection":"tech_skill_types"}	\N	\N
855	885	directus_fields	89	{"sort":4,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"tech_skill_types"}	{"sort":4,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"tech_skill_types"}	\N	\N
856	886	directus_fields	90	{"sort":5,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"tech_skill_types"}	{"sort":5,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"tech_skill_types"}	\N	\N
857	887	directus_collections	tech_skill_types	{"sort_field":"sort","archive_field":"status","archive_value":"archived","unarchive_value":"draft","singleton":false,"collection":"tech_skill_types"}	{"sort_field":"sort","archive_field":"status","archive_value":"archived","unarchive_value":"draft","singleton":false,"collection":"tech_skill_types"}	\N	\N
858	888	directus_collections	tech_skill_categories	{"collection":"tech_skill_categories","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"tech_skills","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"tech_skills"}	\N	\N
859	889	directus_collections	profiles	{"collection":"profiles","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":null}	\N	\N
860	890	directus_collections	tech_skill_types	{"collection":"tech_skill_types","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"tech_skills","collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":"tech_skills"}	\N	\N
861	891	directus_collections	users	{"collection":"users","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":null}	\N	\N
862	892	directus_fields	91	{"sort":6,"interface":"input","special":null,"collection":"tech_skill_types","field":"name"}	{"sort":6,"interface":"input","special":null,"collection":"tech_skill_types","field":"name"}	\N	\N
863	893	directus_fields	92	{"sort":11,"special":["m2o"],"collection":"tech_skills","field":"tech_type"}	{"sort":11,"special":["m2o"],"collection":"tech_skills","field":"tech_type"}	\N	\N
864	894	directus_fields	93	{"sort":7,"special":["o2m"],"interface":"list-o2m","collection":"tech_skill_types","field":"tech_skills"}	{"sort":7,"special":["o2m"],"interface":"list-o2m","collection":"tech_skill_types","field":"tech_skills"}	\N	\N
865	895	tech_skill_types	1	{"name":"Programming Language","status":"published"}	{"name":"Programming Language","status":"published"}	\N	\N
891	921	tech_skill_types	8	{"id":8,"status":"published","sort":8,"date_created":"2025-10-17T16:19:03.302Z","date_updated":"2025-10-17T16:35:43.383Z","name":"Container & Orchestration Technologies","tech_skills":[]}	{"name":"Container & Orchestration Technologies","date_updated":"2025-10-17T16:35:43.383Z"}	\N	\N
866	896	directus_fields	92	{"id":92,"collection":"tech_skills","field":"tech_type","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"tech_type","interface":"select-dropdown-m2o"}	\N	\N
867	897	directus_collections	tech_skill_types	{"collection":"tech_skill_types","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"tech_skills","collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}}"}	\N	\N
868	898	tech_skills	1	{"id":1,"status":"published","sort":null,"date_created":"2025-10-17T15:11:59.895Z","date_updated":"2025-10-17T16:00:38.293Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","name":"Python","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"12","level":"expert","tech_type":1}	{"tech_type":1,"date_updated":"2025-10-17T16:00:38.293Z"}	\N	\N
869	899	tech_skills	2	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"JavaScript","category":"78c235f4-2456-40e6-939d-19c855a30aa1","years_experience":"18","level":"expert","tech_type":1}	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"JavaScript","category":"78c235f4-2456-40e6-939d-19c855a30aa1","years_experience":"18","level":"expert","tech_type":1}	\N	\N
870	900	tech_skills	3	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"PostgreSQL","category":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","years_experience":"4","level":"expert"}	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"PostgreSQL","category":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","years_experience":"4","level":"expert"}	\N	\N
871	901	directus_fields	92	{"id":92,"collection":"tech_skills","field":"tech_type","special":["m2o"],"interface":"select-dropdown-m2o","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"tech_type","options":{}}	\N	\N
872	902	directus_fields	92	{"id":92,"collection":"tech_skills","field":"tech_type","special":["m2o"],"interface":"select-dropdown-m2o","options":{},"display":"related-values","display_options":{"template":"{{name}}"},"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"tech_type","options":{},"display":"related-values","display_options":{"template":"{{name}}"}}	\N	\N
873	903	directus_fields	92	{"id":92,"collection":"tech_skills","field":"tech_type","special":["m2o"],"interface":"select-dropdown-m2o","options":{"enableLink":true},"display":"related-values","display_options":{"template":"{{name}}"},"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"tech_type","interface":"select-dropdown-m2o","options":{"enableLink":true}}	\N	\N
874	904	directus_fields	92	{"id":92,"collection":"tech_skills","field":"tech_type","special":["m2o"],"interface":"select-dropdown-m2o","options":{},"display":"related-values","display_options":{"template":"{{name}}"},"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"tech_skills","field":"tech_type","options":{}}	\N	\N
875	905	tech_skill_types	2	{"status":"published","name":"Framework / Library"}	{"status":"published","name":"Framework / Library"}	\N	\N
876	906	tech_skill_types	3	{"status":"published","name":"Database Engine"}	{"status":"published","name":"Database Engine"}	\N	\N
877	907	tech_skill_types	4	{"name":"Development Tool","status":"published"}	{"name":"Development Tool","status":"published"}	\N	\N
878	908	tech_skill_types	3	{"id":3,"status":"published","sort":null,"date_created":"2025-10-17T16:13:56.351Z","date_updated":"2025-10-17T16:16:07.212Z","name":"Relational Database","tech_skills":[]}	{"name":"Relational Database","date_updated":"2025-10-17T16:16:07.212Z"}	\N	\N
879	909	tech_skill_types	5	{"name":"NoSQL Database","status":"published"}	{"name":"NoSQL Database","status":"published"}	\N	\N
880	910	tech_skill_types	6	{"status":"published","name":"Version Control System"}	{"status":"published","name":"Version Control System"}	\N	\N
881	911	tech_skill_types	7	{"status":"published","name":"Code editor / IDE"}	{"status":"published","name":"Code editor / IDE"}	\N	\N
882	912	tech_skill_types	8	{"status":"published","name":"Containerization Tools"}	{"status":"published","name":"Containerization Tools"}	\N	\N
883	913	tech_skill_types	9	{"status":"published","name":"CI/CD Tools"}	{"status":"published","name":"CI/CD Tools"}	\N	\N
884	914	tech_skill_types	8	{"id":8,"status":"published","sort":null,"date_created":"2025-10-17T16:19:03.302Z","date_updated":"2025-10-17T16:32:08.104Z","name":"Containerization Tool","tech_skills":[]}	{"name":"Containerization Tool","date_updated":"2025-10-17T16:32:08.104Z"}	\N	\N
885	915	tech_skill_types	9	{"id":9,"status":"published","sort":null,"date_created":"2025-10-17T16:31:49.716Z","date_updated":"2025-10-17T16:32:13.688Z","name":"CI/CD Tool","tech_skills":[]}	{"name":"CI/CD Tool","date_updated":"2025-10-17T16:32:13.688Z"}	\N	\N
886	916	tech_skill_types	8	{"id":8,"status":"published","sort":8,"date_created":"2025-10-17T16:19:03.302Z","date_updated":"2025-10-17T16:32:28.957Z","name":"Containerization Toolz","tech_skills":[]}	{"name":"Containerization Toolz","date_updated":"2025-10-17T16:32:28.957Z"}	\N	\N
887	917	tech_skill_types	8	{"id":8,"status":"published","sort":8,"date_created":"2025-10-17T16:19:03.302Z","date_updated":"2025-10-17T16:32:37.133Z","name":"Containerization Tool","tech_skills":[]}	{"name":"Containerization Tool","date_updated":"2025-10-17T16:32:37.133Z"}	\N	\N
888	918	tech_skill_types	10	{"name":"Infrastructure as Code","status":"published"}	{"name":"Infrastructure as Code","status":"published"}	\N	\N
889	919	tech_skill_types	6	{"id":6,"status":"published","sort":6,"date_created":"2025-10-17T16:17:48.008Z","date_updated":"2025-10-17T16:35:09.266Z","name":"Version Control & Collaboration","tech_skills":[]}	{"name":"Version Control & Collaboration","date_updated":"2025-10-17T16:35:09.266Z"}	\N	\N
890	920	tech_skill_types	9	{"id":9,"status":"published","sort":9,"date_created":"2025-10-17T16:31:49.716Z","date_updated":"2025-10-17T16:35:19.998Z","name":"CI/CD & Automation Tools","tech_skills":[]}	{"name":"CI/CD & Automation Tools","date_updated":"2025-10-17T16:35:19.998Z"}	\N	\N
895	925	tech_skills	4	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"Django","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"12","level":"expert","tech_type":2}	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"Django","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"12","level":"expert","tech_type":2}	\N	\N
896	926	tech_skill_types	2	{"id":2,"status":"published","sort":2,"date_created":"2025-10-17T16:13:13.810Z","date_updated":"2025-10-17T16:38:57.189Z","name":"Frameworks & Libraries","tech_skills":[4]}	{"name":"Frameworks & Libraries","date_updated":"2025-10-17T16:38:57.189Z"}	\N	\N
897	927	tech_skill_types	4	{"id":4,"status":"published","sort":3,"date_created":"2025-10-17T16:14:17.040Z","date_updated":"2025-10-17T16:39:01.208Z","name":"Development Tools","tech_skills":[]}	{"name":"Development Tools","date_updated":"2025-10-17T16:39:01.208Z"}	\N	\N
898	928	tech_skill_types	1	{"id":1,"status":"published","sort":1,"date_created":"2025-10-17T16:00:04.591Z","date_updated":"2025-10-17T16:39:04.053Z","name":"Programming Languages","tech_skills":[1,2]}	{"name":"Programming Languages","date_updated":"2025-10-17T16:39:04.053Z"}	\N	\N
900	930	tech_skill_types	5	{"id":5,"status":"published","sort":5,"date_created":"2025-10-17T16:16:57.042Z","date_updated":"2025-10-17T16:39:12.457Z","name":"NoSQL Database","tech_skills":[]}	{"name":"NoSQL Database","date_updated":"2025-10-17T16:39:12.457Z"}	\N	\N
901	931	tech_skill_types	4	{"id":4,"status":"published","sort":3,"date_created":"2025-10-17T16:14:17.040Z","date_updated":"2025-10-17T16:39:17.912Z","name":"Development Tool","tech_skills":[]}	{"name":"Development Tool","date_updated":"2025-10-17T16:39:17.912Z"}	\N	\N
902	932	tech_skill_types	1	{"id":1,"status":"published","sort":1,"date_created":"2025-10-17T16:00:04.591Z","date_updated":"2025-10-17T16:39:20.546Z","name":"Programming Language","tech_skills":[1,2]}	{"name":"Programming Language","date_updated":"2025-10-17T16:39:20.546Z"}	\N	\N
903	933	tech_skill_types	8	{"id":8,"status":"published","sort":8,"date_created":"2025-10-17T16:19:03.302Z","date_updated":"2025-10-17T16:39:43.292Z","name":"Container & Orchestration Tool","tech_skills":[]}	{"name":"Container & Orchestration Tool","date_updated":"2025-10-17T16:39:43.292Z"}	\N	\N
904	934	tech_skill_types	8	{"id":8,"status":"published","sort":8,"date_created":"2025-10-17T16:19:03.302Z","date_updated":"2025-10-17T16:39:54.390Z","name":"Container & Orchestration","tech_skills":[]}	{"name":"Container & Orchestration","date_updated":"2025-10-17T16:39:54.390Z"}	\N	\N
905	935	tech_skill_types	2	{"id":2,"status":"published","sort":2,"date_created":"2025-10-17T16:13:13.810Z","date_updated":"2025-10-17T16:40:10.860Z","name":"Framework / Library","tech_skills":[4]}	{"name":"Framework / Library","date_updated":"2025-10-17T16:40:10.860Z"}	\N	\N
906	936	tech_skill_types	11	{"id":11,"status":"published","sort":null,"date_created":"2025-10-17T16:35:54.991Z","date_updated":"2025-10-17T16:40:22.606Z","name":"Cloud Platform / Service","tech_skills":[]}	{"name":"Cloud Platform / Service","date_updated":"2025-10-17T16:40:22.606Z"}	\N	\N
907	937	tech_skill_types	9	{"id":9,"status":"published","sort":9,"date_created":"2025-10-17T16:31:49.716Z","date_updated":"2025-10-17T16:40:33.895Z","name":"CI/CD / Automation Tool","tech_skills":[]}	{"name":"CI/CD / Automation Tool","date_updated":"2025-10-17T16:40:33.895Z"}	\N	\N
908	938	tech_skill_types	8	{"id":8,"status":"published","sort":8,"date_created":"2025-10-17T16:19:03.302Z","date_updated":"2025-10-17T16:40:43.682Z","name":"Container / Orchestration Tool","tech_skills":[]}	{"name":"Container / Orchestration Tool","date_updated":"2025-10-17T16:40:43.682Z"}	\N	\N
909	939	tech_skill_types	6	{"id":6,"status":"published","sort":6,"date_created":"2025-10-17T16:17:48.008Z","date_updated":"2025-10-17T16:40:54.131Z","name":"Version Control / Collaboration Tool","tech_skills":[]}	{"name":"Version Control / Collaboration Tool","date_updated":"2025-10-17T16:40:54.131Z"}	\N	\N
910	940	tech_skill_types	12	{"id":12,"status":"published","sort":null,"date_created":"2025-10-17T16:36:38.701Z","date_updated":"2025-10-17T16:41:04.775Z","name":"Networking / Load Balancing","tech_skills":[]}	{"name":"Networking / Load Balancing","date_updated":"2025-10-17T16:41:04.775Z"}	\N	\N
911	941	tech_skills	5	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"Django REST Framework (DRF)","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"12","level":"expert","tech_type":2}	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"Django REST Framework (DRF)","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"12","level":"expert","tech_type":2}	\N	\N
912	942	tech_skills	6	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"Flask","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"4","level":"proficient","tech_type":2}	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"Flask","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"4","level":"proficient","tech_type":2}	\N	\N
913	943	tech_skills	7	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"FastAPI","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"1","level":"proficient","tech_type":2}	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"FastAPI","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"1","level":"proficient","tech_type":2}	\N	\N
914	944	tech_skills	8	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"RESTful APIs","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"12","level":"expert"}	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"RESTful APIs","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"12","level":"expert"}	\N	\N
915	945	tech_skill_types	13	{"name":"APIs & Integration Technologies","status":"published"}	{"name":"APIs & Integration Technologies","status":"published"}	\N	\N
916	946	tech_skills	9	{"status":"published","name":"LLM integrations","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"1","level":"proficient","tech_type":13,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"status":"published","name":"LLM integrations","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"1","level":"proficient","tech_type":13,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	917	\N
942	973	directus_collections	work_projects	{"collection":"work_projects","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":null,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"hidden":true}	\N	\N
943	974	directus_fields	94	{"sort":1,"hidden":true,"readonly":true,"interface":"input","special":["uuid"],"field":"id","collection":"soft_skills"}	{"sort":1,"hidden":true,"readonly":true,"interface":"input","special":["uuid"],"field":"id","collection":"soft_skills"}	\N	\N
917	947	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T16:49:12.446Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","subtitle":"Building scalable web applications for remote teams","core_stack":"Python • Node.js • CI/CD • DevOps","linkedin_profile":"https://www.linkedin.com/in/rik-wanders-software","github_profile":"https://github.com/gitaarik","stackoverflow_profile":"https://stackoverflow.com/users/1248175/gitaarik","headline":"Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI","profile_picture":"e12c8ec6-2cbe-4672-98e9-a33d6ed5869a","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"highlights":["00483bae-b8ef-46bb-8230-0f84c989f971","85956023-2be3-4fa9-9643-fc677ffd97cb","bf60fa32-c241-4a49-9edf-d0a21c3a4b3d","82700d7e-0a60-43af-82a7-1ca8a4fcb43f","912a4cfd-44d1-4b88-bd32-0a67ce05e1bc","311f493d-c89f-4a35-86fc-9605e93f639d","e30e3468-9f74-4bdb-9f33-abcef8eb6f7b"],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"],"tech_skills":[1,3,4,5,6,7,2,8,9]}	{"date_updated":"2025-10-17T16:49:12.446Z"}	\N	\N
918	948	directus_fields	69	{"id":69,"collection":"profiles","field":"tech_skills","special":["o2m"],"interface":"list-o2m-tree-view","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":19,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"tech_skills","interface":"list-o2m-tree-view"}	\N	\N
919	949	directus_fields	69	{"id":69,"collection":"profiles","field":"tech_skills","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":19,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"tech_skills","interface":"list-o2m","options":{"enableSelect":false}}	\N	\N
920	950	tech_skills	10	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"pytest","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"12","level":"proficient","tech_type":2}	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"pytest","category":"e6875da0-e556-45f0-be1e-e469fdaed3a7","years_experience":"12","level":"proficient","tech_type":2}	\N	\N
922	952	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T16:55:49.754Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","subtitle":"Building scalable web applications for remote teams","core_stack":"Python • Node.js • CI/CD • DevOps","linkedin_profile":"https://www.linkedin.com/in/rik-wanders-software","github_profile":"https://github.com/gitaarik","stackoverflow_profile":"https://stackoverflow.com/users/1248175/gitaarik","headline":"Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI","profile_picture":"e12c8ec6-2cbe-4672-98e9-a33d6ed5869a","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"highlights":["00483bae-b8ef-46bb-8230-0f84c989f971","85956023-2be3-4fa9-9643-fc677ffd97cb","bf60fa32-c241-4a49-9edf-d0a21c3a4b3d","82700d7e-0a60-43af-82a7-1ca8a4fcb43f","912a4cfd-44d1-4b88-bd32-0a67ce05e1bc","311f493d-c89f-4a35-86fc-9605e93f639d","e30e3468-9f74-4bdb-9f33-abcef8eb6f7b"],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"],"tech_skills":[1,3,4,5,6,7,8,9,10,2,11]}	{"date_updated":"2025-10-17T16:55:49.754Z"}	\N	\N
921	951	tech_skills	11	{"status":"published","name":"Node.js","category":"78c235f4-2456-40e6-939d-19c855a30aa1","years_experience":"12","level":"expert","tech_type":1,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"status":"published","name":"Node.js","category":"78c235f4-2456-40e6-939d-19c855a30aa1","years_experience":"12","level":"expert","tech_type":1,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	922	\N
924	954	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T16:56:44.832Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","subtitle":"Building scalable web applications for remote teams","core_stack":"Python • Node.js • CI/CD • DevOps","linkedin_profile":"https://www.linkedin.com/in/rik-wanders-software","github_profile":"https://github.com/gitaarik","stackoverflow_profile":"https://stackoverflow.com/users/1248175/gitaarik","headline":"Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI","profile_picture":"e12c8ec6-2cbe-4672-98e9-a33d6ed5869a","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"highlights":["00483bae-b8ef-46bb-8230-0f84c989f971","85956023-2be3-4fa9-9643-fc677ffd97cb","bf60fa32-c241-4a49-9edf-d0a21c3a4b3d","82700d7e-0a60-43af-82a7-1ca8a4fcb43f","912a4cfd-44d1-4b88-bd32-0a67ce05e1bc","311f493d-c89f-4a35-86fc-9605e93f639d","e30e3468-9f74-4bdb-9f33-abcef8eb6f7b"],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"],"tech_skills":[1,3,4,5,6,7,8,9,10,2,11,12]}	{"date_updated":"2025-10-17T16:56:44.832Z"}	\N	\N
923	953	tech_skills	12	{"status":"published","name":"TypeScript","category":"78c235f4-2456-40e6-939d-19c855a30aa1","years_experience":"2","level":"proficient","tech_type":1,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"status":"published","name":"TypeScript","category":"78c235f4-2456-40e6-939d-19c855a30aa1","years_experience":"2","level":"proficient","tech_type":1,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	924	\N
925	955	tech_skills	13	{"status":"published","name":"React","category":"78c235f4-2456-40e6-939d-19c855a30aa1","years_experience":"12","level":"expert","tech_type":2,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"status":"published","name":"React","category":"78c235f4-2456-40e6-939d-19c855a30aa1","years_experience":"12","level":"expert","tech_type":2,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	926	\N
959	990	directus_collections	tech_skills	{"collection":"tech_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":"profiles"}	\N	\N
926	956	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T16:57:04.637Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","subtitle":"Building scalable web applications for remote teams","core_stack":"Python • Node.js • CI/CD • DevOps","linkedin_profile":"https://www.linkedin.com/in/rik-wanders-software","github_profile":"https://github.com/gitaarik","stackoverflow_profile":"https://stackoverflow.com/users/1248175/gitaarik","headline":"Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI","profile_picture":"e12c8ec6-2cbe-4672-98e9-a33d6ed5869a","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"highlights":["00483bae-b8ef-46bb-8230-0f84c989f971","85956023-2be3-4fa9-9643-fc677ffd97cb","bf60fa32-c241-4a49-9edf-d0a21c3a4b3d","82700d7e-0a60-43af-82a7-1ca8a4fcb43f","912a4cfd-44d1-4b88-bd32-0a67ce05e1bc","311f493d-c89f-4a35-86fc-9605e93f639d","e30e3468-9f74-4bdb-9f33-abcef8eb6f7b"],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"],"tech_skills":[1,3,4,5,6,7,8,9,10,2,11,12,13]}	{"date_updated":"2025-10-17T16:57:04.637Z"}	\N	\N
927	957	tech_skill_categories	a2c07ea5-050e-4ad0-adad-7bfd7908e4ad	{"name":"Mobile","status":"published"}	{"name":"Mobile","status":"published"}	\N	\N
929	959	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T17:01:46.441Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","subtitle":"Building scalable web applications for remote teams","core_stack":"Python • Node.js • CI/CD • DevOps","linkedin_profile":"https://www.linkedin.com/in/rik-wanders-software","github_profile":"https://github.com/gitaarik","stackoverflow_profile":"https://stackoverflow.com/users/1248175/gitaarik","headline":"Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI","profile_picture":"e12c8ec6-2cbe-4672-98e9-a33d6ed5869a","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"highlights":["00483bae-b8ef-46bb-8230-0f84c989f971","85956023-2be3-4fa9-9643-fc677ffd97cb","bf60fa32-c241-4a49-9edf-d0a21c3a4b3d","82700d7e-0a60-43af-82a7-1ca8a4fcb43f","912a4cfd-44d1-4b88-bd32-0a67ce05e1bc","311f493d-c89f-4a35-86fc-9605e93f639d","e30e3468-9f74-4bdb-9f33-abcef8eb6f7b"],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"],"tech_skills":[1,3,4,5,6,7,8,9,10,2,14,11,12,13]}	{"date_updated":"2025-10-17T17:01:46.441Z"}	\N	\N
928	958	tech_skills	14	{"status":"published","name":"React Native","category":"a2c07ea5-050e-4ad0-adad-7bfd7908e4ad","years_experience":"3","level":"proficient","tech_type":2,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"status":"published","name":"React Native","category":"a2c07ea5-050e-4ad0-adad-7bfd7908e4ad","years_experience":"3","level":"proficient","tech_type":2,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	929	\N
930	960	tech_skills	15	{"status":"published","name":"Svelte","category":"78c235f4-2456-40e6-939d-19c855a30aa1","years_experience":"2","level":"proficient","tech_type":2}	{"status":"published","name":"Svelte","category":"78c235f4-2456-40e6-939d-19c855a30aa1","years_experience":"2","level":"proficient","tech_type":2}	\N	\N
931	961	tech_skills	16	{"status":"published","name":"Tailwind CSS","category":"78c235f4-2456-40e6-939d-19c855a30aa1","years_experience":"2","level":"proficient","tech_type":2}	{"status":"published","name":"Tailwind CSS","category":"78c235f4-2456-40e6-939d-19c855a30aa1","years_experience":"2","level":"proficient","tech_type":2}	\N	\N
932	962	tech_skills	17	{"status":"published","name":"Jest","category":"78c235f4-2456-40e6-939d-19c855a30aa1","years_experience":"2","level":"proficient","tech_type":2}	{"status":"published","name":"Jest","category":"78c235f4-2456-40e6-939d-19c855a30aa1","years_experience":"2","level":"proficient","tech_type":2}	\N	\N
933	963	tech_skills	18	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"MySQL","category":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","years_experience":"10","level":"expert","tech_type":3}	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"MySQL","category":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","years_experience":"10","level":"expert","tech_type":3}	\N	\N
934	964	tech_skills	19	{"status":"published","name":"MariaDB","category":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","years_experience":"12","level":"expert","tech_type":3}	{"status":"published","name":"MariaDB","category":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","years_experience":"12","level":"expert","tech_type":3}	\N	\N
935	965	tech_skills	20	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","name":"SQLite","category":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","years_experience":"5","level":"proficient","tech_type":3}	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","name":"SQLite","category":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","years_experience":"5","level":"proficient","tech_type":3}	\N	\N
936	966	tech_skills	21	{"status":"published","name":"SQL optimization","category":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","years_experience":"12","level":"proficient","tech_type":3}	{"status":"published","name":"SQL optimization","category":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","years_experience":"12","level":"proficient","tech_type":3}	\N	\N
937	967	tech_skills	22	{"status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","name":"Elasticsearch","category":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","years_experience":"3","level":"proficient","tech_type":5}	{"status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","name":"Elasticsearch","category":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","years_experience":"3","level":"proficient","tech_type":5}	\N	\N
938	968	tech_skills	23	{"status":"published","name":"MongoDB","category":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","years_experience":"2","level":"proficient","tech_type":5}	{"status":"published","name":"MongoDB","category":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","years_experience":"2","level":"proficient","tech_type":5}	\N	\N
939	969	tech_skill_categories	6d549daa-2775-4af9-85c9-c3a50ef155c0	{"status":"published","name":"Development Tools"}	{"status":"published","name":"Development Tools"}	\N	\N
940	970	tech_skills	24	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"Git","category":"6d549daa-2775-4af9-85c9-c3a50ef155c0","years_experience":"12","level":"expert","tech_type":6}	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"Git","category":"6d549daa-2775-4af9-85c9-c3a50ef155c0","years_experience":"12","level":"expert","tech_type":6}	\N	\N
941	972	directus_collections	work_projects	{"collection":"work_projects"}	{"collection":"work_projects"}	\N	\N
944	975	directus_fields	95	{"sort":2,"width":"full","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"interface":"select-dropdown","display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"field":"status","collection":"soft_skills"}	{"sort":2,"width":"full","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"interface":"select-dropdown","display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"field":"status","collection":"soft_skills"}	\N	\N
945	976	directus_fields	96	{"sort":3,"interface":"input","hidden":true,"field":"sort","collection":"soft_skills"}	{"sort":3,"interface":"input","hidden":true,"field":"sort","collection":"soft_skills"}	\N	\N
946	977	directus_fields	97	{"sort":4,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"soft_skills"}	{"sort":4,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"soft_skills"}	\N	\N
947	978	directus_fields	98	{"sort":5,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"soft_skills"}	{"sort":5,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"soft_skills"}	\N	\N
948	979	directus_collections	soft_skills	{"sort_field":"sort","archive_field":"status","archive_value":"archived","unarchive_value":"draft","singleton":false,"collection":"soft_skills"}	{"sort_field":"sort","archive_field":"status","archive_value":"archived","unarchive_value":"draft","singleton":false,"collection":"soft_skills"}	\N	\N
949	980	directus_fields	99	{"sort":6,"interface":"input","special":null,"required":true,"collection":"soft_skills","field":"name"}	{"sort":6,"interface":"input","special":null,"required":true,"collection":"soft_skills","field":"name"}	\N	\N
950	981	directus_fields	100	{"sort":7,"special":["m2o"],"collection":"soft_skills","field":"profile"}	{"sort":7,"special":["m2o"],"collection":"soft_skills","field":"profile"}	\N	\N
951	982	directus_fields	101	{"sort":21,"special":["o2m"],"interface":"list-o2m","collection":"profiles","field":"soft_skills"}	{"sort":21,"special":["o2m"],"interface":"list-o2m","collection":"profiles","field":"soft_skills"}	\N	\N
952	983	directus_collections	soft_skills	{"collection":"soft_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":null,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}}"}	\N	\N
953	984	directus_collections	soft_skills	{"collection":"soft_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"work_experiences","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"work_experiences"}	\N	\N
954	985	directus_collections	profiles	{"collection":"profiles","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":null}	\N	\N
955	986	directus_collections	users	{"collection":"users","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":null}	\N	\N
956	987	directus_collections	work_projects	{"collection":"work_projects","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":null}	\N	\N
957	988	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"profiles"}	\N	\N
958	989	directus_collections	highlights	{"collection":"highlights","icon":null,"note":null,"display_template":"{{text}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":"profiles"}	\N	\N
976	1007	directus_fields	27	{"id":27,"collection":"profiles","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"email_address","sort":10,"group":null}	\N	\N
960	991	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":4,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":4,"group":"profiles"}	\N	\N
961	992	directus_collections	soft_skills	{"collection":"soft_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":5,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":5,"group":"profiles"}	\N	\N
962	993	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"profiles"}	\N	\N
963	994	directus_collections	highlights	{"collection":"highlights","icon":null,"note":null,"display_template":"{{text}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":"profiles"}	\N	\N
964	995	directus_collections	tech_skills	{"collection":"tech_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":"profiles"}	\N	\N
965	996	directus_collections	soft_skills	{"collection":"soft_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":4,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":4,"group":"profiles"}	\N	\N
966	997	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":5,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":5,"group":"profiles"}	\N	\N
967	998	directus_fields	17	{"id":17,"collection":"profiles","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"id","sort":1,"group":null}	\N	\N
968	999	directus_fields	18	{"id":18,"collection":"profiles","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_created","sort":2,"group":null}	\N	\N
969	1000	directus_fields	19	{"id":19,"collection":"profiles","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_updated","sort":3,"group":null}	\N	\N
970	1001	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","sort":4,"group":null}	\N	\N
971	1002	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":"Your job title, a phrase describing your profession.","conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","sort":5,"group":null}	\N	\N
972	1003	directus_fields	49	{"id":49,"collection":"profiles","field":"core_stack","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":"Short list of your core technology stack that you are most familiar with.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"core_stack","sort":6,"group":null}	\N	\N
973	1004	directus_fields	48	{"id":48,"collection":"profiles","field":"subtitle","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"subtitle","sort":7,"group":null}	\N	\N
974	1005	directus_fields	53	{"id":53,"collection":"profiles","field":"headline","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":"Brief professional tagline that summarizes your key qualifications.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headline","sort":8,"group":null}	\N	\N
975	1006	directus_fields	54	{"id":54,"collection":"profiles","field":"profile_picture","special":["file"],"interface":"file-image","options":{"crop":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"profile_picture","sort":9,"group":null}	\N	\N
977	1008	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":"Where you are currently based.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","sort":11,"group":null}	\N	\N
978	1009	directus_fields	26	{"id":26,"collection":"profiles","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"phone_number","sort":12,"group":null}	\N	\N
979	1010	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","sort":13,"group":null}	\N	\N
980	1011	directus_fields	50	{"id":50,"collection":"profiles","field":"linkedin_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_profile","sort":14,"group":null}	\N	\N
981	1012	directus_fields	51	{"id":51,"collection":"profiles","field":"github_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"github_profile","sort":15,"group":null}	\N	\N
982	1013	directus_fields	52	{"id":52,"collection":"profiles","field":"stackoverflow_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"stackoverflow_profile","sort":16,"group":null}	\N	\N
983	1014	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":17,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":17,"group":null}	\N	\N
984	1015	directus_fields	61	{"id":61,"collection":"profiles","field":"highlights","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":18,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"highlights","sort":18,"group":null}	\N	\N
985	1016	directus_fields	69	{"id":69,"collection":"profiles","field":"tech_skills","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":19,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"tech_skills","sort":19,"group":null}	\N	\N
986	1017	directus_fields	101	{"id":101,"collection":"profiles","field":"soft_skills","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":20,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"soft_skills","sort":20,"group":null}	\N	\N
987	1018	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":21,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":21,"group":null}	\N	\N
988	1019	directus_fields	94	{"id":94,"collection":"soft_skills","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"soft_skills","field":"id","sort":1,"group":null}	\N	\N
989	1020	directus_fields	100	{"id":100,"collection":"soft_skills","field":"profile","special":["m2o"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"soft_skills","field":"profile","sort":2,"group":null}	\N	\N
990	1021	directus_fields	95	{"id":95,"collection":"soft_skills","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":3,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"soft_skills","field":"status","sort":3,"group":null}	\N	\N
991	1022	directus_fields	96	{"id":96,"collection":"soft_skills","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"soft_skills","field":"sort","sort":4,"group":null}	\N	\N
1013	1044	directus_fields	104	{"sort":3,"interface":"input","hidden":true,"field":"sort","collection":"dev_methodologies"}	{"sort":3,"interface":"input","hidden":true,"field":"sort","collection":"dev_methodologies"}	\N	\N
992	1023	directus_fields	97	{"id":97,"collection":"soft_skills","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"soft_skills","field":"date_created","sort":5,"group":null}	\N	\N
993	1024	directus_fields	98	{"id":98,"collection":"soft_skills","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"soft_skills","field":"date_updated","sort":6,"group":null}	\N	\N
994	1025	directus_fields	99	{"id":99,"collection":"soft_skills","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"soft_skills","field":"name","sort":7,"group":null}	\N	\N
995	1026	directus_fields	100	{"id":100,"collection":"soft_skills","field":"profile","special":["m2o"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"soft_skills","field":"profile","width":"half"}	\N	\N
996	1027	directus_fields	95	{"id":95,"collection":"soft_skills","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"soft_skills","field":"status","width":"half"}	\N	\N
997	1028	directus_fields	100	{"id":100,"collection":"soft_skills","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"soft_skills","field":"profile","interface":"select-dropdown-m2o"}	\N	\N
998	1029	soft_skills	9f0d1372-15fe-48c5-9c5f-e80e1b82f2a3	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"Responsible"}	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"Responsible"}	\N	\N
999	1030	directus_fields	100	{"id":100,"collection":"soft_skills","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":"related-values","display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"soft_skills","field":"profile","display":"related-values"}	\N	\N
1000	1031	directus_fields	100	{"id":100,"collection":"soft_skills","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":"related-values","display_options":{"template":"{{name}}"},"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"soft_skills","field":"profile","display_options":{"template":"{{name}}"}}	\N	\N
1001	1032	directus_fields	101	{"id":101,"collection":"profiles","field":"soft_skills","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":20,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"soft_skills","options":{"enableSelect":false}}	\N	\N
1002	1033	soft_skills	7e34478e-9073-43f5-b54b-0e1a774a0cd3	{"name":"Independent","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"name":"Independent","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1010	\N
1003	1034	soft_skills	9db2e160-3d6f-43c3-9dbd-acc209f4e4fe	{"status":"published","name":"Disciplined","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"status":"published","name":"Disciplined","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1010	\N
1011	1042	directus_fields	102	{"sort":1,"hidden":true,"readonly":true,"interface":"input","special":["uuid"],"field":"id","collection":"dev_methodologies"}	{"sort":1,"hidden":true,"readonly":true,"interface":"input","special":["uuid"],"field":"id","collection":"dev_methodologies"}	\N	\N
1012	1043	directus_fields	103	{"sort":2,"width":"full","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"interface":"select-dropdown","display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"field":"status","collection":"dev_methodologies"}	{"sort":2,"width":"full","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"interface":"select-dropdown","display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"field":"status","collection":"dev_methodologies"}	\N	\N
1010	1041	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-19T16:12:44.696Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","subtitle":"Building scalable web applications for remote teams","core_stack":"Python • Node.js • CI/CD • DevOps","linkedin_profile":"https://www.linkedin.com/in/rik-wanders-software","github_profile":"https://github.com/gitaarik","stackoverflow_profile":"https://stackoverflow.com/users/1248175/gitaarik","headline":"Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI","profile_picture":"e12c8ec6-2cbe-4672-98e9-a33d6ed5869a","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"highlights":["00483bae-b8ef-46bb-8230-0f84c989f971","85956023-2be3-4fa9-9643-fc677ffd97cb","bf60fa32-c241-4a49-9edf-d0a21c3a4b3d","82700d7e-0a60-43af-82a7-1ca8a4fcb43f","912a4cfd-44d1-4b88-bd32-0a67ce05e1bc","311f493d-c89f-4a35-86fc-9605e93f639d","e30e3468-9f74-4bdb-9f33-abcef8eb6f7b"],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"],"tech_skills":[1,4,5,6,7,8,9,10,3,18,20,22,2,11,12,14,13,24],"soft_skills":["9f0d1372-15fe-48c5-9c5f-e80e1b82f2a3","7e34478e-9073-43f5-b54b-0e1a774a0cd3","9db2e160-3d6f-43c3-9dbd-acc209f4e4fe","a74f913e-037c-4548-a8d7-d6b96ebaf22f","89c42056-807c-41e6-9e1f-9d7fa08f1b2b","1cc282e5-4323-41a8-a527-c5db37a92da6","b3049619-b765-429d-9700-4522df069f1b","68c01e2b-5d94-4c58-adbf-ba74ffe6f8b7","d28caf31-29e1-4334-8108-c7b6ee0197e4"]}	{"date_updated":"2025-10-19T16:12:44.696Z"}	\N	\N
1004	1035	soft_skills	a74f913e-037c-4548-a8d7-d6b96ebaf22f	{"status":"published","name":"Organized","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"status":"published","name":"Organized","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1010	\N
1005	1036	soft_skills	89c42056-807c-41e6-9e1f-9d7fa08f1b2b	{"status":"published","name":"Proactive","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"status":"published","name":"Proactive","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1010	\N
1006	1037	soft_skills	1cc282e5-4323-41a8-a527-c5db37a92da6	{"name":"Creative","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"name":"Creative","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1010	\N
1007	1038	soft_skills	b3049619-b765-429d-9700-4522df069f1b	{"name":"Problem solving","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"name":"Problem solving","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1010	\N
1008	1039	soft_skills	68c01e2b-5d94-4c58-adbf-ba74ffe6f8b7	{"name":"Result-oriented","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"name":"Result-oriented","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1010	\N
1009	1040	soft_skills	d28caf31-29e1-4334-8108-c7b6ee0197e4	{"status":"published","name":"Determined","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"status":"published","name":"Determined","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1010	\N
1014	1045	directus_fields	105	{"sort":4,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"dev_methodologies"}	{"sort":4,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"dev_methodologies"}	\N	\N
1015	1046	directus_fields	106	{"sort":5,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"dev_methodologies"}	{"sort":5,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"dev_methodologies"}	\N	\N
1016	1047	directus_collections	dev_methodologies	{"sort_field":"sort","archive_field":"status","archive_value":"archived","unarchive_value":"draft","singleton":false,"collection":"dev_methodologies"}	{"sort_field":"sort","archive_field":"status","archive_value":"archived","unarchive_value":"draft","singleton":false,"collection":"dev_methodologies"}	\N	\N
1017	1048	directus_fields	107	{"sort":6,"interface":"input","special":null,"required":true,"collection":"dev_methodologies","field":"name"}	{"sort":6,"interface":"input","special":null,"required":true,"collection":"dev_methodologies","field":"name"}	\N	\N
1018	1049	directus_fields	108	{"sort":7,"special":["m2o"],"collection":"dev_methodologies","field":"profile"}	{"sort":7,"special":["m2o"],"collection":"dev_methodologies","field":"profile"}	\N	\N
1019	1050	directus_fields	109	{"sort":22,"special":["o2m"],"interface":"list-o2m","collection":"profiles","field":"dev_methodologies"}	{"sort":22,"special":["o2m"],"interface":"list-o2m","collection":"profiles","field":"dev_methodologies"}	\N	\N
1020	1051	directus_collections	dev_methodologies	{"collection":"dev_methodologies","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":null,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}}"}	\N	\N
1021	1052	directus_collections	dev_methodologies	{"collection":"dev_methodologies","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"soft_skills","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"soft_skills"}	\N	\N
1022	1053	directus_collections	profiles	{"collection":"profiles","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":null}	\N	\N
1023	1054	directus_collections	users	{"collection":"users","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":null}	\N	\N
1024	1055	directus_collections	work_projects	{"collection":"work_projects","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":null}	\N	\N
1025	1056	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"profiles"}	\N	\N
1026	1057	directus_collections	highlights	{"collection":"highlights","icon":null,"note":null,"display_template":"{{text}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":"profiles"}	\N	\N
1027	1058	directus_collections	tech_skills	{"collection":"tech_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":"profiles"}	\N	\N
1028	1059	directus_collections	soft_skills	{"collection":"soft_skills","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":4,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":4,"group":"profiles"}	\N	\N
1029	1060	directus_collections	dev_methodologies	{"collection":"dev_methodologies","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":5,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":5,"group":"profiles"}	\N	\N
1030	1061	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":6,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":6,"group":"profiles"}	\N	\N
1073	1104	dev_methodologies	c9622a84-fb17-4bfe-87c4-cac33d30ef5c	{"name":"Extensive code reviewing","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"name":"Extensive code reviewing","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1076	\N
1031	1062	directus_fields	102	{"id":102,"collection":"dev_methodologies","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"id","sort":1,"group":null}	\N	\N
1032	1063	directus_fields	108	{"id":108,"collection":"dev_methodologies","field":"profile","special":["m2o"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"profile","sort":2,"group":null}	\N	\N
1033	1064	directus_fields	103	{"id":103,"collection":"dev_methodologies","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":3,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"status","sort":3,"group":null}	\N	\N
1034	1065	directus_fields	104	{"id":104,"collection":"dev_methodologies","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"sort","sort":4,"group":null}	\N	\N
1035	1066	directus_fields	105	{"id":105,"collection":"dev_methodologies","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"date_created","sort":5,"group":null}	\N	\N
1036	1067	directus_fields	106	{"id":106,"collection":"dev_methodologies","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"date_updated","sort":6,"group":null}	\N	\N
1037	1068	directus_fields	107	{"id":107,"collection":"dev_methodologies","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"name","sort":7,"group":null}	\N	\N
1038	1069	directus_fields	108	{"id":108,"collection":"dev_methodologies","field":"profile","special":["m2o"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"profile","width":"half"}	\N	\N
1039	1070	directus_fields	103	{"id":103,"collection":"dev_methodologies","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"status","width":"half"}	\N	\N
1040	1071	directus_fields	108	{"id":108,"collection":"dev_methodologies","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"profile","interface":"select-dropdown-m2o"}	\N	\N
1041	1072	dev_methodologies	6eff8fef-bded-49f0-b58a-711aea500221	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"Agile"}	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","status":"published","name":"Agile"}	\N	\N
1042	1073	directus_fields	17	{"id":17,"collection":"profiles","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"id","sort":1,"group":null}	\N	\N
1043	1074	directus_fields	18	{"id":18,"collection":"profiles","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_created","sort":2,"group":null}	\N	\N
1044	1075	directus_fields	19	{"id":19,"collection":"profiles","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"date_updated","sort":3,"group":null}	\N	\N
1045	1076	directus_fields	20	{"id":20,"collection":"profiles","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"name","sort":4,"group":null}	\N	\N
1046	1077	directus_fields	21	{"id":21,"collection":"profiles","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":"Your job title, a phrase describing your profession.","conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"title","sort":5,"group":null}	\N	\N
1047	1078	directus_fields	49	{"id":49,"collection":"profiles","field":"core_stack","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":"Short list of your core technology stack that you are most familiar with.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"core_stack","sort":6,"group":null}	\N	\N
1048	1079	directus_fields	48	{"id":48,"collection":"profiles","field":"subtitle","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":"A short sentence complementing your work title, giving more insight to your expertise.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"subtitle","sort":7,"group":null}	\N	\N
1049	1080	directus_fields	53	{"id":53,"collection":"profiles","field":"headline","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":"Brief professional tagline that summarizes your key qualifications.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headline","sort":8,"group":null}	\N	\N
1050	1081	directus_fields	54	{"id":54,"collection":"profiles","field":"profile_picture","special":["file"],"interface":"file-image","options":{"crop":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"profile_picture","sort":9,"group":null}	\N	\N
1051	1082	directus_fields	27	{"id":27,"collection":"profiles","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"email_address","sort":10,"group":null}	\N	\N
1052	1083	directus_fields	24	{"id":24,"collection":"profiles","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":"Where you are currently based.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"location","sort":11,"group":null}	\N	\N
1053	1084	directus_fields	26	{"id":26,"collection":"profiles","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"phone_number","sort":12,"group":null}	\N	\N
1054	1085	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","sort":13,"group":null}	\N	\N
1055	1086	directus_fields	50	{"id":50,"collection":"profiles","field":"linkedin_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_profile","sort":14,"group":null}	\N	\N
1056	1087	directus_fields	51	{"id":51,"collection":"profiles","field":"github_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"github_profile","sort":15,"group":null}	\N	\N
1057	1088	directus_fields	52	{"id":52,"collection":"profiles","field":"stackoverflow_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"stackoverflow_profile","sort":16,"group":null}	\N	\N
1058	1089	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":17,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":17,"group":null}	\N	\N
1059	1090	directus_fields	61	{"id":61,"collection":"profiles","field":"highlights","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":18,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"highlights","sort":18,"group":null}	\N	\N
1060	1091	directus_fields	69	{"id":69,"collection":"profiles","field":"tech_skills","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":19,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"tech_skills","sort":19,"group":null}	\N	\N
1074	1105	dev_methodologies	fc191739-71ff-444f-a64f-c4ff739ceadf	{"name":"Writing and maintaining documentation","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"name":"Writing and maintaining documentation","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1076	\N
1061	1092	directus_fields	101	{"id":101,"collection":"profiles","field":"soft_skills","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":20,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"soft_skills","sort":20,"group":null}	\N	\N
1062	1093	directus_fields	109	{"id":109,"collection":"profiles","field":"dev_methodologies","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":21,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"dev_methodologies","sort":21,"group":null}	\N	\N
1063	1094	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":22,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":22,"group":null}	\N	\N
1076	1107	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-19T16:19:23.899Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","subtitle":"Building scalable web applications for remote teams","core_stack":"Python • Node.js • CI/CD • DevOps","linkedin_profile":"https://www.linkedin.com/in/rik-wanders-software","github_profile":"https://github.com/gitaarik","stackoverflow_profile":"https://stackoverflow.com/users/1248175/gitaarik","headline":"Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI","profile_picture":"e12c8ec6-2cbe-4672-98e9-a33d6ed5869a","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"],"highlights":["00483bae-b8ef-46bb-8230-0f84c989f971","85956023-2be3-4fa9-9643-fc677ffd97cb","bf60fa32-c241-4a49-9edf-d0a21c3a4b3d","82700d7e-0a60-43af-82a7-1ca8a4fcb43f","912a4cfd-44d1-4b88-bd32-0a67ce05e1bc","311f493d-c89f-4a35-86fc-9605e93f639d","e30e3468-9f74-4bdb-9f33-abcef8eb6f7b"],"soft_skills":["9f0d1372-15fe-48c5-9c5f-e80e1b82f2a3","7e34478e-9073-43f5-b54b-0e1a774a0cd3","9db2e160-3d6f-43c3-9dbd-acc209f4e4fe","a74f913e-037c-4548-a8d7-d6b96ebaf22f","89c42056-807c-41e6-9e1f-9d7fa08f1b2b","1cc282e5-4323-41a8-a527-c5db37a92da6","b3049619-b765-429d-9700-4522df069f1b","68c01e2b-5d94-4c58-adbf-ba74ffe6f8b7","d28caf31-29e1-4334-8108-c7b6ee0197e4"],"tech_skills":[1,4,5,6,7,8,9,10,3,18,20,22,2,11,12,14,13,24],"dev_methodologies":["6eff8fef-bded-49f0-b58a-711aea500221","84a7411e-3601-44d3-abc7-251348ece546","01d355bd-7b80-4806-a9c3-c5277a945996","856ee579-71ba-434b-b9e2-7355b8cd8e13","fd9086a3-071a-458c-9e50-accbf3bff907","44f7c501-4fef-47b8-8f4f-8a98fe155ed2","4831ab97-9ffa-4518-a701-844fe0a3e5d2","9beb25c0-e7f2-4699-88d5-8619ac65f060","94c1e7c6-f687-4a45-b870-1c922baacd2d","af4c406b-bf9e-4f65-b196-5ff37c57eba9","c9622a84-fb17-4bfe-87c4-cac33d30ef5c","fc191739-71ff-444f-a64f-c4ff739ceadf","a80c302e-c184-4e50-8b7d-c4e4bee261c8"]}	{"date_updated":"2025-10-19T16:19:23.899Z"}	\N	\N
1064	1095	dev_methodologies	84a7411e-3601-44d3-abc7-251348ece546	{"status":"published","name":"Scrum","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"status":"published","name":"Scrum","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1076	\N
1065	1096	dev_methodologies	01d355bd-7b80-4806-a9c3-c5277a945996	{"status":"published","name":"Kanban","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"status":"published","name":"Kanban","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1076	\N
1066	1097	dev_methodologies	856ee579-71ba-434b-b9e2-7355b8cd8e13	{"name":"Extreme Programming (XP)","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"name":"Extreme Programming (XP)","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1076	\N
1067	1098	dev_methodologies	fd9086a3-071a-458c-9e50-accbf3bff907	{"name":"AI-accelerated development","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"name":"AI-accelerated development","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1076	\N
1068	1099	dev_methodologies	44f7c501-4fef-47b8-8f4f-8a98fe155ed2	{"name":"Secure by design","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"name":"Secure by design","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1076	\N
1069	1100	dev_methodologies	4831ab97-9ffa-4518-a701-844fe0a3e5d2	{"name":"Test-driven development (TDD)","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"name":"Test-driven development (TDD)","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1076	\N
1070	1101	dev_methodologies	9beb25c0-e7f2-4699-88d5-8619ac65f060	{"name":"User experience design (UXD)","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"name":"User experience design (UXD)","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1076	\N
1071	1102	dev_methodologies	94c1e7c6-f687-4a45-b870-1c922baacd2d	{"name":"Asynchronous Workflows","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"name":"Asynchronous Workflows","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1076	\N
1072	1103	dev_methodologies	af4c406b-bf9e-4f65-b196-5ff37c57eba9	{"name":"Component-based development","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"name":"Component-based development","status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	1076	\N
1077	1108	directus_fields	22	{"id":22,"collection":"work_experiences","field":"profiles","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":"related-values","display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profiles","width":"half"}	\N	\N
1078	1110	directus_fields	110	{"sort":16,"interface":"select-dropdown","special":null,"options":{"choices":[{"text":"Draft","value":"draft"},{"text":"Published","value":"published"},{"text":"Archived","value":"archived"}]},"collection":"work_experiences","field":"status"}	{"sort":16,"interface":"select-dropdown","special":null,"options":{"choices":[{"text":"Draft","value":"draft"},{"text":"Published","value":"published"},{"text":"Archived","value":"archived"}]},"collection":"work_experiences","field":"status"}	\N	\N
1079	1111	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"Draft","value":"draft"},{"text":"Published","value":"published"},{"text":"Archived","value":"archived"}]},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","width":"half"}	\N	\N
1080	1112	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
1081	1113	directus_fields	22	{"id":22,"collection":"work_experiences","field":"profiles","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":"related-values","display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profiles","sort":2,"group":null}	\N	\N
1082	1114	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":3,"group":null}	\N	\N
1083	1115	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":4,"group":null}	\N	\N
1084	1116	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":5,"group":null}	\N	\N
1085	1117	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":6,"group":null}	\N	\N
1086	1118	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"Draft","value":"draft"},{"text":"Published","value":"published"},{"text":"Archived","value":"archived"}]},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","sort":7,"group":null}	\N	\N
1087	1119	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":8,"group":null}	\N	\N
1088	1120	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":9,"group":null}	\N	\N
1089	1121	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":10,"group":null}	\N	\N
1090	1122	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":11,"group":null}	\N	\N
1091	1123	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":12,"group":null}	\N	\N
1092	1124	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":["date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":13,"group":null}	\N	\N
1093	1125	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":["date-updated","date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":14,"group":null}	\N	\N
1094	1126	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":15,"group":null}	\N	\N
1095	1127	directus_translations	477e76f0-e099-49ab-a993-d55f72cf2931	{"language":"en-US","key":"published","value":"Published"}	{"language":"en-US","key":"published","value":"Published"}	\N	\N
1096	1128	directus_translations	c530a32f-84cb-4ab9-8a61-7a12a5bcb7e6	{"language":"en-US","key":"draft","value":"Draft"}	{"language":"en-US","key":"draft","value":"Draft"}	\N	\N
1097	1129	directus_translations	39d9db6d-c7a4-4298-b997-cc4ce6d427b3	{"language":"en-US","key":"archived","value":"Archived"}	{"language":"en-US","key":"archived","value":"Archived"}	\N	\N
1098	1130	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published"},{"text":"$t:draft","value":"draft"},{"text":"$t:archived","value":"archived"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","options":{"choices":[{"text":"$t:published","value":"published"},{"text":"$t:draft","value":"draft"},{"text":"$t:archived","value":"archived"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true}}	\N	\N
1129	1164	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":7,"group":null}	\N	\N
1099	1131	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]}}	\N	\N
1100	1132	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","options":{"crop":false}}	\N	\N
1101	1133	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","display":"image"}	\N	\N
1102	1134	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","display":"image"}	\N	\N
1103	1136	directus_fields	111	{"sort":15,"interface":"input","special":null,"hidden":true,"collection":"work_experiences","field":"sort"}	{"sort":15,"interface":"input","special":null,"hidden":true,"collection":"work_experiences","field":"sort"}	\N	\N
1104	1137	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":6,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort_field":"sort"}	\N	\N
1105	1138	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
1106	1139	directus_fields	22	{"id":22,"collection":"work_experiences","field":"profiles","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":"related-values","display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profiles","sort":2,"group":null}	\N	\N
1107	1140	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","sort":3,"group":null}	\N	\N
1108	1141	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":4,"group":null}	\N	\N
1109	1142	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
1110	1143	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
1111	1144	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":7,"group":null}	\N	\N
1112	1145	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":8,"group":null}	\N	\N
1113	1146	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":9,"group":null}	\N	\N
1114	1147	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":10,"group":null}	\N	\N
1115	1148	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":11,"group":null}	\N	\N
1116	1149	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":12,"group":null}	\N	\N
1117	1150	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":["date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":13,"group":null}	\N	\N
1118	1151	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":["date-updated","date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":14,"group":null}	\N	\N
1119	1152	directus_fields	111	{"id":111,"collection":"work_experiences","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sort","sort":15,"group":null}	\N	\N
1120	1155	directus_fields	112	{"sort":16,"special":["m2o"],"collection":"work_experiences","field":"profile"}	{"sort":16,"special":["m2o"],"collection":"work_experiences","field":"profile"}	\N	\N
1121	1156	directus_fields	113	{"special":["o2m"],"interface":"list-o2m","collection":"profiles","field":"work_experiences"}	{"special":["o2m"],"interface":"list-o2m","collection":"profiles","field":"work_experiences"}	\N	\N
1122	1157	directus_fields	112	{"id":112,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","width":"half"}	\N	\N
1123	1158	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
1124	1159	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","sort":2,"group":null}	\N	\N
1125	1160	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":3,"group":null}	\N	\N
1126	1161	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":4,"group":null}	\N	\N
1127	1162	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":5,"group":null}	\N	\N
1128	1163	directus_fields	112	{"id":112,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","sort":6,"group":null}	\N	\N
1130	1165	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":8,"group":null}	\N	\N
1131	1166	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":9,"group":null}	\N	\N
1132	1167	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":10,"group":null}	\N	\N
1133	1168	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":11,"group":null}	\N	\N
1134	1169	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":12,"group":null}	\N	\N
1135	1170	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":["date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":13,"group":null}	\N	\N
1136	1171	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":["date-updated","date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":14,"group":null}	\N	\N
1137	1172	directus_fields	111	{"id":111,"collection":"work_experiences","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sort","sort":15,"group":null}	\N	\N
1138	1173	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
1139	1174	directus_fields	112	{"id":112,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","sort":2,"group":null}	\N	\N
1140	1175	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","sort":3,"group":null}	\N	\N
1141	1176	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":4,"group":null}	\N	\N
1142	1177	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
1143	1178	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
1144	1179	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":7,"group":null}	\N	\N
1145	1180	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":8,"group":null}	\N	\N
1146	1181	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":9,"group":null}	\N	\N
1147	1182	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":10,"group":null}	\N	\N
1148	1183	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":11,"group":null}	\N	\N
1149	1184	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":12,"group":null}	\N	\N
1150	1185	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":["date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":13,"group":null}	\N	\N
1151	1186	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":["date-updated","date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":14,"group":null}	\N	\N
1152	1187	directus_fields	111	{"id":111,"collection":"work_experiences","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sort","sort":15,"group":null}	\N	\N
1153	1188	directus_fields	112	{"id":112,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","interface":"select-dropdown-m2o"}	\N	\N
1154	1189	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	{"name":"Chipta","location":"Amsterdam","description":"Ticketing company","position":"Lead Developer","url":"https://chipta.com/en/","startDate":"2017","endDate":"2024","summary":"Was fun","createdAt":"2025-10-15T15:24:10","updatedAt":"2025-10-19T17:20:00","id":"a37c89e0-2b6d-44e1-911a-c1399611562a","logo":"8127127c-d1cf-480e-87ea-5cbfbfc12e36","status":"published","sort":1,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","updatedAt":"2025-10-19T17:20:00"}	\N	\N
1155	1190	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	{"name":"Tender-it","location":"Amsterdam","description":"Tender platform","position":"Lead Developer","url":null,"startDate":"2014","endDate":"2017","summary":"Was cool","createdAt":"2025-10-22T12:00:00","updatedAt":"2025-10-19T17:20:07","id":"f044625e-b180-4603-b03a-42a5a397403a","logo":"d6beca5c-5fc3-4f31-aa57-fc1a8209a97c","status":"published","sort":2,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"status":"published","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","updatedAt":"2025-10-19T17:20:07"}	\N	\N
1156	1191	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
1157	1192	directus_fields	112	{"id":112,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","sort":2,"group":null}	\N	\N
1158	1193	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","sort":3,"group":null}	\N	\N
1159	1194	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":4,"group":null}	\N	\N
1160	1195	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
1161	1196	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
1162	1197	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":7,"group":null}	\N	\N
1163	1198	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":8,"group":null}	\N	\N
1164	1199	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":9,"group":null}	\N	\N
1165	1200	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":10,"group":null}	\N	\N
1166	1201	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":11,"group":null}	\N	\N
1167	1202	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":12,"group":null}	\N	\N
1168	1203	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":["date-updated","date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":13,"group":null}	\N	\N
1169	1204	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":["date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":14,"group":null}	\N	\N
1170	1205	directus_fields	111	{"id":111,"collection":"work_experiences","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sort","sort":15,"group":null}	\N	\N
1171	1206	directus_fields	102	{"id":102,"collection":"dev_methodologies","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"id","sort":1,"group":null}	\N	\N
1172	1207	directus_fields	108	{"id":108,"collection":"dev_methodologies","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"profile","sort":2,"group":null}	\N	\N
1173	1208	directus_fields	103	{"id":103,"collection":"dev_methodologies","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"status","sort":3,"group":null}	\N	\N
1174	1209	directus_fields	104	{"id":104,"collection":"dev_methodologies","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"sort","sort":4,"group":null}	\N	\N
1175	1210	directus_fields	106	{"id":106,"collection":"dev_methodologies","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"date_updated","sort":5,"group":null}	\N	\N
1176	1211	directus_fields	105	{"id":105,"collection":"dev_methodologies","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"date_created","sort":6,"group":null}	\N	\N
1177	1212	directus_fields	107	{"id":107,"collection":"dev_methodologies","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"name","sort":7,"group":null}	\N	\N
1178	1213	directus_fields	114	{"sort":16,"interface":"datetime","special":["date-created"],"readonly":true,"hidden":true,"display":"datetime","display_options":{"relative":true},"collection":"work_experiences","field":"date_created"}	{"sort":16,"interface":"datetime","special":["date-created"],"readonly":true,"hidden":true,"display":"datetime","display_options":{"relative":true},"collection":"work_experiences","field":"date_created"}	\N	\N
1179	1214	directus_fields	114	{"id":114,"collection":"work_experiences","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":16,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_created","width":"half"}	\N	\N
1180	1215	directus_fields	115	{"sort":17,"interface":"datetime","special":["date-updated"],"readonly":true,"hidden":true,"display":"datetime","display_options":{"relative":true},"collection":"work_experiences","field":"date_updated"}	{"sort":17,"interface":"datetime","special":["date-updated"],"readonly":true,"hidden":true,"display":"datetime","display_options":{"relative":true},"collection":"work_experiences","field":"date_updated"}	\N	\N
1181	1216	directus_fields	115	{"id":115,"collection":"work_experiences","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":17,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_updated","width":"half"}	\N	\N
1182	1219	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
1183	1220	directus_fields	112	{"id":112,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","sort":2,"group":null}	\N	\N
1184	1221	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","sort":3,"group":null}	\N	\N
1185	1222	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":4,"group":null}	\N	\N
1186	1223	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
1187	1224	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
1188	1225	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":7,"group":null}	\N	\N
1189	1226	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":8,"group":null}	\N	\N
1190	1227	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":9,"group":null}	\N	\N
1191	1228	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":10,"group":null}	\N	\N
1192	1229	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":11,"group":null}	\N	\N
1193	1230	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":12,"group":null}	\N	\N
1194	1231	directus_fields	114	{"id":114,"collection":"work_experiences","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_created","sort":13,"group":null}	\N	\N
1195	1232	directus_fields	115	{"id":115,"collection":"work_experiences","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_updated","sort":14,"group":null}	\N	\N
1196	1233	directus_fields	111	{"id":111,"collection":"work_experiences","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sort","sort":15,"group":null}	\N	\N
1197	1234	directus_fields	116	{"sort":16,"interface":"input","special":null,"collection":"work_experiences","field":"start_date"}	{"sort":16,"interface":"input","special":null,"collection":"work_experiences","field":"start_date"}	\N	\N
1198	1235	directus_fields	116	{"id":116,"collection":"work_experiences","field":"start_date","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"start_date","width":"half"}	\N	\N
1199	1236	directus_fields	117	{"sort":17,"interface":"input","special":null,"collection":"work_experiences","field":"end_date"}	{"sort":17,"interface":"input","special":null,"collection":"work_experiences","field":"end_date"}	\N	\N
1200	1237	directus_fields	117	{"id":117,"collection":"work_experiences","field":"end_date","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":17,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"end_date","width":"half"}	\N	\N
1201	1238	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
1202	1239	directus_fields	112	{"id":112,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","sort":2,"group":null}	\N	\N
1203	1240	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","sort":3,"group":null}	\N	\N
1204	1241	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":4,"group":null}	\N	\N
1205	1242	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
1206	1243	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
1207	1244	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":7,"group":null}	\N	\N
1208	1245	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":8,"group":null}	\N	\N
1209	1246	directus_fields	116	{"id":116,"collection":"work_experiences","field":"start_date","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"start_date","sort":9,"group":null}	\N	\N
1210	1247	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":10,"group":null}	\N	\N
1211	1248	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":11,"group":null}	\N	\N
1212	1249	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":12,"group":null}	\N	\N
1213	1250	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":13,"group":null}	\N	\N
1214	1251	directus_fields	114	{"id":114,"collection":"work_experiences","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_created","sort":14,"group":null}	\N	\N
1215	1252	directus_fields	115	{"id":115,"collection":"work_experiences","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":15,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_updated","sort":15,"group":null}	\N	\N
1216	1253	directus_fields	111	{"id":111,"collection":"work_experiences","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":16,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sort","sort":16,"group":null}	\N	\N
1217	1254	directus_fields	117	{"id":117,"collection":"work_experiences","field":"end_date","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":17,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"end_date","sort":17,"group":null}	\N	\N
1218	1255	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
1219	1256	directus_fields	112	{"id":112,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","sort":2,"group":null}	\N	\N
1220	1257	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","sort":3,"group":null}	\N	\N
1221	1258	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":4,"group":null}	\N	\N
1222	1259	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
1223	1260	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
1224	1261	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":7,"group":null}	\N	\N
1225	1262	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":8,"group":null}	\N	\N
1226	1263	directus_fields	116	{"id":116,"collection":"work_experiences","field":"start_date","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"start_date","sort":9,"group":null}	\N	\N
1227	1264	directus_fields	117	{"id":117,"collection":"work_experiences","field":"end_date","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"end_date","sort":10,"group":null}	\N	\N
1228	1265	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":11,"group":null}	\N	\N
1229	1266	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":12,"group":null}	\N	\N
1230	1267	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":13,"group":null}	\N	\N
1231	1268	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":14,"group":null}	\N	\N
1232	1269	directus_fields	114	{"id":114,"collection":"work_experiences","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":15,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_created","sort":15,"group":null}	\N	\N
1233	1270	directus_fields	115	{"id":115,"collection":"work_experiences","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":16,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_updated","sort":16,"group":null}	\N	\N
1234	1271	directus_fields	111	{"id":111,"collection":"work_experiences","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":17,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sort","sort":17,"group":null}	\N	\N
1235	1272	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	{"name":"Chipta","location":"Amsterdam","description":"Ticketing company","position":"Lead Developer","url":"https://chipta.com/en/","startDate":"2017","endDate":"2024","summary":"Was fun","id":"a37c89e0-2b6d-44e1-911a-c1399611562a","logo":"8127127c-d1cf-480e-87ea-5cbfbfc12e36","status":"published","sort":1,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":null,"date_updated":"2025-10-19T17:26:47.100Z","start_date":"2017","end_date":"2024"}	{"start_date":"2017","end_date":"2024","date_updated":"2025-10-19T17:26:47.100Z"}	\N	\N
1236	1273	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	{"name":"Tender-it","location":"Amsterdam","description":"Tender platform","position":"Lead Developer","url":null,"startDate":"2014","endDate":"2017","summary":"Was cool","id":"f044625e-b180-4603-b03a-42a5a397403a","logo":"d6beca5c-5fc3-4f31-aa57-fc1a8209a97c","status":"published","sort":2,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":null,"date_updated":"2025-10-19T17:26:52.414Z","start_date":"2014","end_date":"2017"}	{"start_date":"2014","end_date":"2017","date_updated":"2025-10-19T17:26:52.414Z"}	\N	\N
1237	1276	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	{"name":"Chipta","location":"Amsterdam","description":"Ticketing company","position":"Lead Developer","url":"https://chipta.com/en/","summary":"Was fun","id":"a37c89e0-2b6d-44e1-911a-c1399611562a","logo":"8127127c-d1cf-480e-87ea-5cbfbfc12e36","status":"published","sort":1,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":null,"date_updated":"2025-10-19T17:27:45.966Z","start_date":"Sep 2017","end_date":"Sep 2024"}	{"start_date":"Sep 2017","end_date":"Sep 2024","date_updated":"2025-10-19T17:27:45.966Z"}	\N	\N
1238	1277	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	{"name":"Tender-it","location":"Amsterdam","description":"Tender platform","position":"Lead Developer","url":null,"summary":"Was cool","id":"f044625e-b180-4603-b03a-42a5a397403a","logo":"d6beca5c-5fc3-4f31-aa57-fc1a8209a97c","status":"published","sort":2,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":null,"date_updated":"2025-10-19T17:27:59.624Z","start_date":"Mar 2014","end_date":"Jun 2017"}	{"start_date":"Mar 2014","end_date":"Jun 2017","date_updated":"2025-10-19T17:27:59.624Z"}	\N	\N
1239	1278	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	{"name":"Chipta","location":"Amsterdam","description":"Ticketing company","position":"Lead Developer","url":"https://chipta.com/","summary":"Was fun","id":"a37c89e0-2b6d-44e1-911a-c1399611562a","logo":"8127127c-d1cf-480e-87ea-5cbfbfc12e36","status":"published","sort":1,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":null,"date_updated":"2025-10-19T17:28:54.447Z","start_date":"Sep 2017","end_date":"Sep 2024"}	{"url":"https://chipta.com/","date_updated":"2025-10-19T17:28:54.447Z"}	\N	\N
1240	1279	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	{"name":"Chipta","location":"Amsterdam","description":"Ticketing company","position":"Lead Developer","url":"https://chipta.com/","summary":"Led teams of 3-5 developers at innovative ticketing platform for over 7 years, scaling the platform from concept to processing thousands of orders per minute. Optimized platform performance by 30-60%, implemented comprehensive testing suites, and orchestrated CI/CD systems. Built React Native mobile apps that contributed to a 40% revenue increase, modernized frontend interfaces with React, increasing user engagement by 30%. And integrated critical payment systems processing tens of millions in transactions.","id":"a37c89e0-2b6d-44e1-911a-c1399611562a","logo":"8127127c-d1cf-480e-87ea-5cbfbfc12e36","status":"published","sort":1,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":null,"date_updated":"2025-10-19T17:29:58.289Z","start_date":"Sep 2017","end_date":"Sep 2024"}	{"summary":"Led teams of 3-5 developers at innovative ticketing platform for over 7 years, scaling the platform from concept to processing thousands of orders per minute. Optimized platform performance by 30-60%, implemented comprehensive testing suites, and orchestrated CI/CD systems. Built React Native mobile apps that contributed to a 40% revenue increase, modernized frontend interfaces with React, increasing user engagement by 30%. And integrated critical payment systems processing tens of millions in transactions.","date_updated":"2025-10-19T17:29:58.289Z"}	\N	\N
1241	1280	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":6,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}}"}	\N	\N
1242	1281	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{start_date}}-{{end_date}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":6,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}} ({{start_date}}-{{end_date}})"}	\N	\N
1243	1282	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{start_date}} - {{end_date}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":6,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}} ({{start_date}} - {{end_date}})"}	\N	\N
1244	1283	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} - {{position}} ({{start_date}} - {{end_date}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":6,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}} - {{position}} ({{start_date}} - {{end_date}})"}	\N	\N
1245	1284	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} | {{location}} | {{position}} |{{start_date}} - {{end_date}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":6,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}} | {{location}} | {{position}} |{{start_date}} - {{end_date}}"}	\N	\N
1246	1285	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} | {{location}} | {{position}} | {{start_date}} - {{end_date}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":6,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}} | {{location}} | {{position}} | {{start_date}} - {{end_date}}"}	\N	\N
1247	1288	directus_fields	118	{"sort":18,"interface":"datetime","special":null,"options":{},"collection":"work_experiences","field":"start_date"}	{"sort":18,"interface":"datetime","special":null,"options":{},"collection":"work_experiences","field":"start_date"}	\N	\N
1248	1289	directus_fields	118	{"id":118,"collection":"work_experiences","field":"start_date","special":null,"interface":"datetime","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":18,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"start_date","width":"half"}	\N	\N
1249	1290	directus_fields	119	{"sort":19,"interface":"datetime","special":null,"collection":"work_experiences","field":"end_date"}	{"sort":19,"interface":"datetime","special":null,"collection":"work_experiences","field":"end_date"}	\N	\N
1250	1291	directus_fields	119	{"id":119,"collection":"work_experiences","field":"end_date","special":null,"interface":"datetime","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":19,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"end_date","width":"half"}	\N	\N
1251	1292	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	{"name":"Chipta","location":"Amsterdam","description":"Ticketing company","position":"Lead Developer","url":"https://chipta.com/","summary":"Led teams of 3-5 developers at innovative ticketing platform for over 7 years, scaling the platform from concept to processing thousands of orders per minute. Optimized platform performance by 30-60%, implemented comprehensive testing suites, and orchestrated CI/CD systems. Built React Native mobile apps that contributed to a 40% revenue increase, modernized frontend interfaces with React, increasing user engagement by 30%. And integrated critical payment systems processing tens of millions in transactions.","id":"a37c89e0-2b6d-44e1-911a-c1399611562a","logo":"8127127c-d1cf-480e-87ea-5cbfbfc12e36","status":"published","sort":1,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":null,"date_updated":"2025-10-19T17:38:44.119Z","start_date":"2014-03-02","end_date":"2017-06-16"}	{"start_date":"2014-03-02","end_date":"2017-06-16","date_updated":"2025-10-19T17:38:44.119Z"}	\N	\N
1252	1293	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
1253	1294	directus_fields	112	{"id":112,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","sort":2,"group":null}	\N	\N
1254	1295	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","sort":3,"group":null}	\N	\N
1255	1296	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":4,"group":null}	\N	\N
1256	1297	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
1257	1298	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
1258	1299	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":7,"group":null}	\N	\N
1259	1300	directus_fields	118	{"id":118,"collection":"work_experiences","field":"start_date","special":null,"interface":"datetime","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"start_date","sort":8,"group":null}	\N	\N
1260	1301	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":9,"group":null}	\N	\N
1261	1302	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":10,"group":null}	\N	\N
1262	1303	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":11,"group":null}	\N	\N
1263	1304	directus_fields	114	{"id":114,"collection":"work_experiences","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_created","sort":12,"group":null}	\N	\N
1264	1305	directus_fields	115	{"id":115,"collection":"work_experiences","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_updated","sort":13,"group":null}	\N	\N
1265	1306	directus_fields	111	{"id":111,"collection":"work_experiences","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sort","sort":14,"group":null}	\N	\N
1266	1307	directus_fields	119	{"id":119,"collection":"work_experiences","field":"end_date","special":null,"interface":"datetime","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"end_date","sort":15,"group":null}	\N	\N
1267	1308	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
1268	1309	directus_fields	112	{"id":112,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","sort":2,"group":null}	\N	\N
1269	1310	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","sort":3,"group":null}	\N	\N
1270	1311	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":4,"group":null}	\N	\N
1271	1312	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
1272	1313	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
1273	1314	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":7,"group":null}	\N	\N
1274	1315	directus_fields	118	{"id":118,"collection":"work_experiences","field":"start_date","special":null,"interface":"datetime","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"start_date","sort":8,"group":null}	\N	\N
1275	1316	directus_fields	119	{"id":119,"collection":"work_experiences","field":"end_date","special":null,"interface":"datetime","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"end_date","sort":9,"group":null}	\N	\N
1276	1317	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":10,"group":null}	\N	\N
1277	1318	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":11,"group":null}	\N	\N
1278	1319	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":12,"group":null}	\N	\N
1279	1320	directus_fields	114	{"id":114,"collection":"work_experiences","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_created","sort":13,"group":null}	\N	\N
1280	1321	directus_fields	115	{"id":115,"collection":"work_experiences","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_updated","sort":14,"group":null}	\N	\N
1281	1322	directus_fields	111	{"id":111,"collection":"work_experiences","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sort","sort":15,"group":null}	\N	\N
1282	1323	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
1283	1324	directus_fields	112	{"id":112,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","sort":2,"group":null}	\N	\N
1284	1325	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","sort":3,"group":null}	\N	\N
1285	1326	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":4,"group":null}	\N	\N
1286	1327	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
1287	1328	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
1288	1329	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":7,"group":null}	\N	\N
1289	1330	directus_fields	118	{"id":118,"collection":"work_experiences","field":"start_date","special":null,"interface":"datetime","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"start_date","sort":8,"group":null}	\N	\N
1290	1331	directus_fields	119	{"id":119,"collection":"work_experiences","field":"end_date","special":null,"interface":"datetime","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"end_date","sort":9,"group":null}	\N	\N
1291	1332	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":10,"group":null}	\N	\N
1292	1333	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":11,"group":null}	\N	\N
1293	1334	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":12,"group":null}	\N	\N
1294	1335	directus_fields	114	{"id":114,"collection":"work_experiences","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_created","sort":13,"group":null}	\N	\N
1295	1336	directus_fields	115	{"id":115,"collection":"work_experiences","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_updated","sort":14,"group":null}	\N	\N
1296	1337	directus_fields	111	{"id":111,"collection":"work_experiences","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sort","sort":15,"group":null}	\N	\N
1297	1338	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
1298	1339	directus_fields	112	{"id":112,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","sort":2,"group":null}	\N	\N
1299	1340	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","sort":3,"group":null}	\N	\N
1300	1341	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":4,"group":null}	\N	\N
1301	1342	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
1302	1343	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
1303	1344	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":7,"group":null}	\N	\N
1304	1345	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":8,"group":null}	\N	\N
1305	1346	directus_fields	118	{"id":118,"collection":"work_experiences","field":"start_date","special":null,"interface":"datetime","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"start_date","sort":9,"group":null}	\N	\N
1306	1347	directus_fields	119	{"id":119,"collection":"work_experiences","field":"end_date","special":null,"interface":"datetime","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"end_date","sort":10,"group":null}	\N	\N
1307	1348	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":11,"group":null}	\N	\N
1308	1349	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":12,"group":null}	\N	\N
1309	1350	directus_fields	114	{"id":114,"collection":"work_experiences","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_created","sort":13,"group":null}	\N	\N
1310	1351	directus_fields	115	{"id":115,"collection":"work_experiences","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_updated","sort":14,"group":null}	\N	\N
1311	1352	directus_fields	111	{"id":111,"collection":"work_experiences","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sort","sort":15,"group":null}	\N	\N
1312	1353	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
1313	1354	directus_fields	112	{"id":112,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","sort":2,"group":null}	\N	\N
1314	1355	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","sort":3,"group":null}	\N	\N
1315	1356	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":4,"group":null}	\N	\N
1316	1357	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
1317	1358	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
1318	1359	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":7,"group":null}	\N	\N
1319	1360	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":8,"group":null}	\N	\N
1320	1361	directus_fields	118	{"id":118,"collection":"work_experiences","field":"start_date","special":null,"interface":"datetime","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"start_date","sort":9,"group":null}	\N	\N
1321	1362	directus_fields	119	{"id":119,"collection":"work_experiences","field":"end_date","special":null,"interface":"datetime","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"end_date","sort":10,"group":null}	\N	\N
1322	1363	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":11,"group":null}	\N	\N
1323	1364	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":12,"group":null}	\N	\N
1324	1365	directus_fields	114	{"id":114,"collection":"work_experiences","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_created","sort":13,"group":null}	\N	\N
1325	1366	directus_fields	115	{"id":115,"collection":"work_experiences","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_updated","sort":14,"group":null}	\N	\N
1326	1367	directus_fields	111	{"id":111,"collection":"work_experiences","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sort","sort":15,"group":null}	\N	\N
1327	1368	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":"What position you held within the company / organization.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","note":"What position you held within the company / organization."}	\N	\N
1328	1369	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":"Name of the company / organization that was your employer during this time.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","note":"Name of the company / organization that was your employer during this time."}	\N	\N
1329	1370	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":"Describe what kind of company / organization this was.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","note":"Describe what kind of company / organization this was."}	\N	\N
1330	1371	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":"The location of the company / organization or where you did your work.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","hidden":false,"note":"The location of the company / organization or where you did your work."}	\N	\N
1331	1373	directus_fields	120	{"sort":16,"interface":"input","special":null,"collection":"work_experiences","field":"website"}	{"sort":16,"interface":"input","special":null,"collection":"work_experiences","field":"website"}	\N	\N
1332	1374	directus_fields	120	{"id":120,"collection":"work_experiences","field":"website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"website","width":"half"}	\N	\N
1333	1375	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
1334	1376	directus_fields	112	{"id":112,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","sort":2,"group":null}	\N	\N
1335	1377	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","sort":3,"group":null}	\N	\N
1336	1378	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":"Name of the company / organization that was your employer during this time.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":4,"group":null}	\N	\N
1337	1379	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":"The location of the company / organization or where you did your work.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
1338	1380	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":"Describe what kind of company / organization this was.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
1339	1381	directus_fields	120	{"id":120,"collection":"work_experiences","field":"website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"website","sort":7,"group":null}	\N	\N
1340	1382	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":"What position you held within the company / organization.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":8,"group":null}	\N	\N
1341	1383	directus_fields	118	{"id":118,"collection":"work_experiences","field":"start_date","special":null,"interface":"datetime","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"start_date","sort":9,"group":null}	\N	\N
1342	1384	directus_fields	119	{"id":119,"collection":"work_experiences","field":"end_date","special":null,"interface":"datetime","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"end_date","sort":10,"group":null}	\N	\N
1343	1385	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":11,"group":null}	\N	\N
1344	1386	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":12,"group":null}	\N	\N
1345	1387	directus_fields	114	{"id":114,"collection":"work_experiences","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_created","sort":13,"group":null}	\N	\N
1346	1388	directus_fields	115	{"id":115,"collection":"work_experiences","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_updated","sort":14,"group":null}	\N	\N
1347	1389	directus_fields	111	{"id":111,"collection":"work_experiences","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sort","sort":15,"group":null}	\N	\N
1348	1390	directus_fields	120	{"id":120,"collection":"work_experiences","field":"website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":"Website of the company / organization you worked for.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"website","note":"Website of the company / organization you worked for."}	\N	\N
1349	1391	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	{"name":"Tender-it","location":"Amsterdam","description":"Tender platform","position":"Lead Developer","summary":"Was cool","id":"f044625e-b180-4603-b03a-42a5a397403a","logo":"d6beca5c-5fc3-4f31-aa57-fc1a8209a97c","status":"published","sort":2,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":null,"date_updated":"2025-10-19T17:45:05.042Z","start_date":"2014-03-09","end_date":"2017-06-22","website":null}	{"start_date":"2014-03-09","end_date":"2017-06-22","date_updated":"2025-10-19T17:45:05.042Z"}	\N	\N
1350	1392	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	{"name":"Chipta","location":"Amsterdam","description":"Ticketing company","position":"Lead Developer","summary":"Led teams of 3-5 developers at innovative ticketing platform for over 7 years, scaling the platform from concept to processing thousands of orders per minute. Optimized platform performance by 30-60%, implemented comprehensive testing suites, and orchestrated CI/CD systems. Built React Native mobile apps that contributed to a 40% revenue increase, modernized frontend interfaces with React, increasing user engagement by 30%. And integrated critical payment systems processing tens of millions in transactions.","id":"a37c89e0-2b6d-44e1-911a-c1399611562a","logo":"8127127c-d1cf-480e-87ea-5cbfbfc12e36","status":"published","sort":1,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":null,"date_updated":"2025-10-19T17:45:59.160Z","start_date":"2017-09-10","end_date":"2024-09-20","website":null}	{"start_date":"2017-09-10","end_date":"2024-09-20","date_updated":"2025-10-19T17:45:59.160Z"}	\N	\N
1351	1393	directus_fields	118	{"id":118,"collection":"work_experiences","field":"start_date","special":null,"interface":"datetime","options":{},"display":"datetime","display_options":{"format":"short"},"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"start_date","display":"datetime","display_options":{"format":"short"}}	\N	\N
1417	1460	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
1352	1394	directus_fields	119	{"id":119,"collection":"work_experiences","field":"end_date","special":null,"interface":"datetime","options":null,"display":"datetime","display_options":{"format":"short"},"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"end_date","display":"datetime","display_options":{"format":"short"}}	\N	\N
1353	1395	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	{"name":"Chipta","location":"Amsterdam","description":"Ticketing company","position":"Lead Developer","summary":"Led teams of 3-5 developers at innovative ticketing platform for over 7 years, scaling the platform from concept to processing thousands of orders per minute. Optimized platform performance by 30-60%, implemented comprehensive testing suites, and orchestrated CI/CD systems. Built React Native mobile apps that contributed to a 40% revenue increase, modernized frontend interfaces with React, increasing user engagement by 30%. And integrated critical payment systems processing tens of millions in transactions.","id":"a37c89e0-2b6d-44e1-911a-c1399611562a","logo":"8127127c-d1cf-480e-87ea-5cbfbfc12e36","status":"published","sort":1,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":null,"date_updated":"2025-10-19T17:50:04.194Z","start_date":"2017-09-10","end_date":"2024-09-20","website":"https://chipta.com/"}	{"website":"https://chipta.com/","date_updated":"2025-10-19T17:50:04.194Z"}	\N	\N
1354	1396	directus_fields	121	{"sort":1,"hidden":true,"readonly":true,"interface":"input","special":["uuid"],"field":"id","collection":"work_experience_achievements"}	{"sort":1,"hidden":true,"readonly":true,"interface":"input","special":["uuid"],"field":"id","collection":"work_experience_achievements"}	\N	\N
1355	1397	directus_fields	122	{"sort":2,"width":"full","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"interface":"select-dropdown","display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"field":"status","collection":"work_experience_achievements"}	{"sort":2,"width":"full","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"interface":"select-dropdown","display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"field":"status","collection":"work_experience_achievements"}	\N	\N
1356	1398	directus_fields	123	{"sort":3,"interface":"input","hidden":true,"field":"sort","collection":"work_experience_achievements"}	{"sort":3,"interface":"input","hidden":true,"field":"sort","collection":"work_experience_achievements"}	\N	\N
1357	1399	directus_fields	124	{"sort":4,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"work_experience_achievements"}	{"sort":4,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"work_experience_achievements"}	\N	\N
1358	1400	directus_fields	125	{"sort":5,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"work_experience_achievements"}	{"sort":5,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"work_experience_achievements"}	\N	\N
1359	1401	directus_collections	work_experience_achievements	{"sort_field":"sort","archive_field":"status","archive_value":"archived","unarchive_value":"draft","singleton":false,"collection":"work_experience_achievements"}	{"sort_field":"sort","archive_field":"status","archive_value":"archived","unarchive_value":"draft","singleton":false,"collection":"work_experience_achievements"}	\N	\N
1360	1402	directus_fields	126	{"sort":6,"interface":"input","special":null,"collection":"work_experience_achievements","field":"title"}	{"sort":6,"interface":"input","special":null,"collection":"work_experience_achievements","field":"title"}	\N	\N
1361	1403	directus_fields	127	{"sort":7,"interface":"input","special":null,"collection":"work_experience_achievements","field":"description"}	{"sort":7,"interface":"input","special":null,"collection":"work_experience_achievements","field":"description"}	\N	\N
1362	1404	directus_fields	128	{"sort":8,"special":["m2o"],"collection":"work_experience_achievements","field":"work_experience"}	{"sort":8,"special":["m2o"],"collection":"work_experience_achievements","field":"work_experience"}	\N	\N
1363	1405	directus_fields	129	{"sort":16,"special":["o2m"],"interface":"list-o2m","collection":"work_experiences","field":"achievements"}	{"sort":16,"special":["o2m"],"interface":"list-o2m","collection":"work_experiences","field":"achievements"}	\N	\N
1364	1406	directus_fields	121	{"id":121,"collection":"work_experience_achievements","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"id","sort":1,"group":null}	\N	\N
1378	1420	directus_fields	124	{"id":124,"collection":"work_experience_achievements","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"date_created","sort":5,"group":null}	\N	\N
1365	1407	directus_fields	122	{"id":122,"collection":"work_experience_achievements","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"status","sort":2,"group":null}	\N	\N
1366	1408	directus_fields	123	{"id":123,"collection":"work_experience_achievements","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":3,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"sort","sort":3,"group":null}	\N	\N
1367	1409	directus_fields	124	{"id":124,"collection":"work_experience_achievements","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"date_created","sort":4,"group":null}	\N	\N
1368	1410	directus_fields	125	{"id":125,"collection":"work_experience_achievements","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"date_updated","sort":5,"group":null}	\N	\N
1369	1411	directus_fields	128	{"id":128,"collection":"work_experience_achievements","field":"work_experience","special":["m2o"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"work_experience","sort":6,"group":null}	\N	\N
1370	1412	directus_fields	126	{"id":126,"collection":"work_experience_achievements","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"title","sort":7,"group":null}	\N	\N
1371	1413	directus_fields	127	{"id":127,"collection":"work_experience_achievements","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"description","sort":8,"group":null}	\N	\N
1372	1414	directus_fields	128	{"id":128,"collection":"work_experience_achievements","field":"work_experience","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"work_experience","interface":"select-dropdown-m2o"}	\N	\N
1373	1415	work_experience_achievements	8e32e85b-f8d8-4fcf-af76-cb8f18ad91d9	{"work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","title":"Team Leadership","description":"Optimized development team (3-5 devs) output with 25%, by leading agile methods and strict code review processes","status":"published"}	{"work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","title":"Team Leadership","description":"Optimized development team (3-5 devs) output with 25%, by leading agile methods and strict code review processes","status":"published"}	\N	\N
1374	1416	directus_fields	121	{"id":121,"collection":"work_experience_achievements","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"id","sort":1,"group":null}	\N	\N
1375	1417	directus_fields	128	{"id":128,"collection":"work_experience_achievements","field":"work_experience","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"work_experience","sort":2,"group":null}	\N	\N
1376	1418	directus_fields	122	{"id":122,"collection":"work_experience_achievements","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":3,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"status","sort":3,"group":null}	\N	\N
1377	1419	directus_fields	123	{"id":123,"collection":"work_experience_achievements","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"sort","sort":4,"group":null}	\N	\N
1379	1421	directus_fields	125	{"id":125,"collection":"work_experience_achievements","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"date_updated","sort":6,"group":null}	\N	\N
1380	1422	directus_fields	126	{"id":126,"collection":"work_experience_achievements","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"title","sort":7,"group":null}	\N	\N
1381	1423	directus_fields	127	{"id":127,"collection":"work_experience_achievements","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"description","sort":8,"group":null}	\N	\N
1382	1424	directus_fields	128	{"id":128,"collection":"work_experience_achievements","field":"work_experience","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"work_experience","width":"half"}	\N	\N
1383	1425	directus_fields	122	{"id":122,"collection":"work_experience_achievements","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"status","width":"half"}	\N	\N
1384	1426	directus_collections	work_experience_achievements	{"collection":"work_experience_achievements","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"work_experiences","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"work_experiences"}	\N	\N
1385	1427	directus_collections	profiles	{"collection":"profiles","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":null}	\N	\N
1386	1428	directus_collections	users	{"collection":"users","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":null}	\N	\N
1387	1429	directus_collections	work_projects	{"collection":"work_projects","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":null}	\N	\N
1388	1430	directus_collections	work_experience_achievements	{"collection":"work_experience_achievements","icon":null,"note":null,"display_template":"{{title}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"work_experiences","collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{title}}"}	\N	\N
1389	1431	directus_collections	work_experience_achievements	{"collection":"work_experience_achievements","icon":null,"note":null,"display_template":"{{description}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"work_experiences","collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{description}}"}	\N	\N
1390	1432	directus_fields	130	{"sort":9,"interface":"select-icon","special":null,"collection":"work_experience_achievements","field":"icon"}	{"sort":9,"interface":"select-icon","special":null,"collection":"work_experience_achievements","field":"icon"}	\N	\N
1391	1433	directus_fields	130	{"id":130,"collection":"work_experience_achievements","field":"icon","special":null,"interface":"select-icon","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"icon","width":"half"}	\N	\N
1392	1434	directus_fields	126	{"id":126,"collection":"work_experience_achievements","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"title","width":"half"}	\N	\N
1393	1435	directus_fields	121	{"id":121,"collection":"work_experience_achievements","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"id","sort":1,"group":null}	\N	\N
1394	1436	directus_fields	128	{"id":128,"collection":"work_experience_achievements","field":"work_experience","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"work_experience","sort":2,"group":null}	\N	\N
1395	1437	directus_fields	122	{"id":122,"collection":"work_experience_achievements","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"status","sort":3,"group":null}	\N	\N
1396	1438	directus_fields	123	{"id":123,"collection":"work_experience_achievements","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"sort","sort":4,"group":null}	\N	\N
1397	1439	directus_fields	124	{"id":124,"collection":"work_experience_achievements","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"date_created","sort":5,"group":null}	\N	\N
1398	1440	directus_fields	125	{"id":125,"collection":"work_experience_achievements","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"date_updated","sort":6,"group":null}	\N	\N
1399	1441	directus_fields	126	{"id":126,"collection":"work_experience_achievements","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"title","sort":7,"group":null}	\N	\N
1400	1442	directus_fields	130	{"id":130,"collection":"work_experience_achievements","field":"icon","special":null,"interface":"select-icon","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"icon","sort":8,"group":null}	\N	\N
1401	1443	directus_fields	127	{"id":127,"collection":"work_experience_achievements","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"description","sort":9,"group":null}	\N	\N
1403	1446	directus_fields	131	{"id":131,"collection":"work_experience_achievements","field":"fa_icon","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":"Font Awesome icon name","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"fa_icon","width":"half"}	\N	\N
1404	1447	directus_fields	121	{"id":121,"collection":"work_experience_achievements","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"id","sort":1,"group":null}	\N	\N
1405	1448	directus_fields	128	{"id":128,"collection":"work_experience_achievements","field":"work_experience","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"work_experience","sort":2,"group":null}	\N	\N
1406	1449	directus_fields	122	{"id":122,"collection":"work_experience_achievements","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"status","sort":3,"group":null}	\N	\N
1407	1450	directus_fields	123	{"id":123,"collection":"work_experience_achievements","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"sort","sort":4,"group":null}	\N	\N
1408	1451	directus_fields	124	{"id":124,"collection":"work_experience_achievements","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"date_created","sort":5,"group":null}	\N	\N
1409	1452	directus_fields	125	{"id":125,"collection":"work_experience_achievements","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"date_updated","sort":6,"group":null}	\N	\N
1410	1453	directus_fields	126	{"id":126,"collection":"work_experience_achievements","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"title","sort":7,"group":null}	\N	\N
1411	1454	directus_fields	131	{"id":131,"collection":"work_experience_achievements","field":"fa_icon","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":"Font Awesome icon name","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"fa_icon","sort":8,"group":null}	\N	\N
1412	1455	directus_fields	127	{"id":127,"collection":"work_experience_achievements","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"description","sort":9,"group":null}	\N	\N
1413	1456	work_experience_achievements	8e32e85b-f8d8-4fcf-af76-cb8f18ad91d9	{"id":"8e32e85b-f8d8-4fcf-af76-cb8f18ad91d9","status":"published","sort":null,"date_created":"2025-10-19T17:55:53.073Z","date_updated":"2025-10-19T18:04:44.151Z","title":"Team Leadership","description":"Optimized development team (3-5 devs) output with 25%, by leading agile methods and strict code review processes","work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","fa_icon":"users"}	{"fa_icon":"users","date_updated":"2025-10-19T18:04:44.151Z"}	\N	\N
1414	1457	directus_fields	128	{"id":128,"collection":"work_experience_achievements","field":"work_experience","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":"related-values","display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"work_experience","display":"related-values"}	\N	\N
1415	1458	directus_fields	128	{"id":128,"collection":"work_experience_achievements","field":"work_experience","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":"related-values","display_options":{"template":"{{description}}"},"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"work_experience","interface":"select-dropdown-m2o","display":"related-values","display_options":{"template":"{{description}}"}}	\N	\N
1416	1459	directus_fields	128	{"id":128,"collection":"work_experience_achievements","field":"work_experience","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":"related-values","display_options":{"template":"{{name}}"},"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experience_achievements","field":"work_experience","display_options":{"template":"{{name}}"}}	\N	\N
1418	1461	directus_fields	112	{"id":112,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","sort":2,"group":null}	\N	\N
1419	1462	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","sort":3,"group":null}	\N	\N
1420	1463	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":"Name of the company / organization that was your employer during this time.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":4,"group":null}	\N	\N
1421	1464	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":"The location of the company / organization or where you did your work.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
1422	1465	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":"Describe what kind of company / organization this was.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
1423	1466	directus_fields	120	{"id":120,"collection":"work_experiences","field":"website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":"Website of the company / organization you worked for.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"website","sort":7,"group":null}	\N	\N
1424	1467	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":"What position you held within the company / organization.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":8,"group":null}	\N	\N
1425	1468	directus_fields	118	{"id":118,"collection":"work_experiences","field":"start_date","special":null,"interface":"datetime","options":{},"display":"datetime","display_options":{"format":"short"},"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"start_date","sort":9,"group":null}	\N	\N
1426	1469	directus_fields	119	{"id":119,"collection":"work_experiences","field":"end_date","special":null,"interface":"datetime","options":null,"display":"datetime","display_options":{"format":"short"},"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"end_date","sort":10,"group":null}	\N	\N
1427	1470	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":11,"group":null}	\N	\N
1428	1471	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":12,"group":null}	\N	\N
1429	1472	directus_fields	129	{"id":129,"collection":"work_experiences","field":"achievements","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"achievements","sort":13,"group":null}	\N	\N
1430	1473	directus_fields	114	{"id":114,"collection":"work_experiences","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_created","sort":14,"group":null}	\N	\N
1431	1474	directus_fields	115	{"id":115,"collection":"work_experiences","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":15,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_updated","sort":15,"group":null}	\N	\N
1432	1475	directus_fields	111	{"id":111,"collection":"work_experiences","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":16,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sort","sort":16,"group":null}	\N	\N
1433	1476	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
1434	1477	directus_fields	112	{"id":112,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","sort":2,"group":null}	\N	\N
1435	1478	directus_fields	110	{"id":110,"collection":"work_experiences","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}],"showAsDot":true},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"status","sort":3,"group":null}	\N	\N
1436	1479	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":"Name of the company / organization that was your employer during this time.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":4,"group":null}	\N	\N
1437	1480	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":"The location of the company / organization or where you did your work.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
1438	1481	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":"Describe what kind of company / organization this was.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
1439	1482	directus_fields	120	{"id":120,"collection":"work_experiences","field":"website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":"Website of the company / organization you worked for.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"website","sort":7,"group":null}	\N	\N
1440	1483	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":"What position you held within the company / organization.","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":8,"group":null}	\N	\N
1441	1484	directus_fields	118	{"id":118,"collection":"work_experiences","field":"start_date","special":null,"interface":"datetime","options":{},"display":"datetime","display_options":{"format":"short"},"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"start_date","sort":9,"group":null}	\N	\N
1442	1485	directus_fields	119	{"id":119,"collection":"work_experiences","field":"end_date","special":null,"interface":"datetime","options":null,"display":"datetime","display_options":{"format":"short"},"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"end_date","sort":10,"group":null}	\N	\N
1443	1486	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":11,"group":null}	\N	\N
1444	1487	directus_fields	129	{"id":129,"collection":"work_experiences","field":"achievements","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"achievements","sort":12,"group":null}	\N	\N
1445	1488	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{"crop":false},"display":"image","display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":13,"group":null}	\N	\N
1446	1489	directus_fields	114	{"id":114,"collection":"work_experiences","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_created","sort":14,"group":null}	\N	\N
1447	1490	directus_fields	115	{"id":115,"collection":"work_experiences","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":15,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"date_updated","sort":15,"group":null}	\N	\N
1448	1491	directus_fields	111	{"id":111,"collection":"work_experiences","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":16,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sort","sort":16,"group":null}	\N	\N
1449	1492	directus_fields	129	{"id":129,"collection":"work_experiences","field":"achievements","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"achievements","options":{"enableSelect":false}}	\N	\N
1450	1493	work_experience_achievements	1a595ecc-42aa-4d7a-a51f-084d69aa63d5	{"title":"Platform Scalability","fa_icon":"chart-line","description":"Enabled processing thousands of orders per minute, by optimizing SQL queries & Python/Django processes with 30-60%","work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a"}	{"title":"Platform Scalability","fa_icon":"chart-line","description":"Enabled processing thousands of orders per minute, by optimizing SQL queries & Python/Django processes with 30-60%","work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a"}	1451	\N
1452	1495	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-19T18:10:23.880Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","subtitle":"Building scalable web applications for remote teams","core_stack":"Python • Node.js • CI/CD • DevOps","linkedin_profile":"https://www.linkedin.com/in/rik-wanders-software","github_profile":"https://github.com/gitaarik","stackoverflow_profile":"https://stackoverflow.com/users/1248175/gitaarik","headline":"Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI","profile_picture":"e12c8ec6-2cbe-4672-98e9-a33d6ed5869a","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"highlights":["00483bae-b8ef-46bb-8230-0f84c989f971","85956023-2be3-4fa9-9643-fc677ffd97cb","bf60fa32-c241-4a49-9edf-d0a21c3a4b3d","82700d7e-0a60-43af-82a7-1ca8a4fcb43f","912a4cfd-44d1-4b88-bd32-0a67ce05e1bc","311f493d-c89f-4a35-86fc-9605e93f639d","e30e3468-9f74-4bdb-9f33-abcef8eb6f7b"],"soft_skills":["9f0d1372-15fe-48c5-9c5f-e80e1b82f2a3","7e34478e-9073-43f5-b54b-0e1a774a0cd3","9db2e160-3d6f-43c3-9dbd-acc209f4e4fe","a74f913e-037c-4548-a8d7-d6b96ebaf22f","89c42056-807c-41e6-9e1f-9d7fa08f1b2b","1cc282e5-4323-41a8-a527-c5db37a92da6","b3049619-b765-429d-9700-4522df069f1b","68c01e2b-5d94-4c58-adbf-ba74ffe6f8b7","d28caf31-29e1-4334-8108-c7b6ee0197e4"],"tech_skills":[1,4,5,6,7,8,9,10,3,18,20,22,2,11,12,14,13,24],"dev_methodologies":["6eff8fef-bded-49f0-b58a-711aea500221","84a7411e-3601-44d3-abc7-251348ece546","01d355bd-7b80-4806-a9c3-c5277a945996","856ee579-71ba-434b-b9e2-7355b8cd8e13","fd9086a3-071a-458c-9e50-accbf3bff907","44f7c501-4fef-47b8-8f4f-8a98fe155ed2","4831ab97-9ffa-4518-a701-844fe0a3e5d2","9beb25c0-e7f2-4699-88d5-8619ac65f060","94c1e7c6-f687-4a45-b870-1c922baacd2d","af4c406b-bf9e-4f65-b196-5ff37c57eba9","c9622a84-fb17-4bfe-87c4-cac33d30ef5c","fc191739-71ff-444f-a64f-c4ff739ceadf","a80c302e-c184-4e50-8b7d-c4e4bee261c8"],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"]}	{"date_updated":"2025-10-19T18:10:23.880Z"}	\N	\N
1451	1494	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	{"name":"Chipta","location":"Amsterdam","description":"Ticketing company","position":"Lead Developer","summary":"Led teams of 3-5 developers at innovative ticketing platform for over 7 years, scaling the platform from concept to processing thousands of orders per minute. Optimized platform performance by 30-60%, implemented comprehensive testing suites, and orchestrated CI/CD systems. Built React Native mobile apps that contributed to a 40% revenue increase, modernized frontend interfaces with React, increasing user engagement by 30%. And integrated critical payment systems processing tens of millions in transactions.","id":"a37c89e0-2b6d-44e1-911a-c1399611562a","logo":"8127127c-d1cf-480e-87ea-5cbfbfc12e36","status":"published","sort":1,"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":null,"date_updated":"2025-10-19T18:10:23.884Z","start_date":"2017-09-10","end_date":"2024-09-20","website":"https://chipta.com/","achievements":["8e32e85b-f8d8-4fcf-af76-cb8f18ad91d9","1a595ecc-42aa-4d7a-a51f-084d69aa63d5"]}	{"date_updated":"2025-10-19T18:10:23.884Z"}	1452	\N
1453	1496	work_experience_achievements	1a595ecc-42aa-4d7a-a51f-084d69aa63d5	{"id":"1a595ecc-42aa-4d7a-a51f-084d69aa63d5","status":"published","sort":null,"date_created":"2025-10-19T18:10:23.885Z","date_updated":"2025-10-19T18:10:33.243Z","title":"Platform Scalability","description":"Enabled processing thousands of orders per minute, by optimizing SQL queries & Python/Django processes with 30-60%","work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","fa_icon":"chart-line"}	{"status":"published","date_updated":"2025-10-19T18:10:33.243Z"}	\N	\N
1454	1497	directus_fields	102	{"id":102,"collection":"dev_methodologies","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"id","sort":1,"group":null}	\N	\N
1455	1498	directus_fields	108	{"id":108,"collection":"dev_methodologies","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"profile","sort":2,"group":null}	\N	\N
1456	1499	directus_fields	103	{"id":103,"collection":"dev_methodologies","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"status","sort":3,"group":null}	\N	\N
1457	1500	directus_fields	107	{"id":107,"collection":"dev_methodologies","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"name","sort":4,"group":null}	\N	\N
1458	1501	directus_fields	104	{"id":104,"collection":"dev_methodologies","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":5,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"sort","sort":5,"group":null}	\N	\N
1459	1502	directus_fields	106	{"id":106,"collection":"dev_methodologies","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"date_updated","sort":6,"group":null}	\N	\N
1460	1503	directus_fields	105	{"id":105,"collection":"dev_methodologies","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"date_created","sort":7,"group":null}	\N	\N
1461	1504	directus_fields	108	{"id":108,"collection":"dev_methodologies","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":{"template":"{{name}}"},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"profile","options":{"template":"{{name}}"}}	\N	\N
1462	1505	directus_fields	108	{"id":108,"collection":"dev_methodologies","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":{"template":null},"display":"related-values","display_options":{"template":"{{name}}"},"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"dev_methodologies","field":"profile","options":{"template":null},"display":"related-values","display_options":{"template":"{{name}}"}}	\N	\N
1463	1506	tech_skills	20	{"id":20,"status":"published","sort":12,"date_created":"2025-10-17T17:07:50.873Z","date_updated":"2025-10-19T18:14:57.198Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","name":"SQLite","category":"0bcc8c53-eb96-4d3b-8bd5-81faf33000a5","years_experience":"5","level":"proficient","tech_type":3}	{"status":"published","date_updated":"2025-10-19T18:14:57.198Z"}	\N	\N
1464	1507	directus_fields	38	{"id":38,"collection":"languages","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":"related-values","display_options":{"template":"{{name}}"},"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"languages","field":"profile","display":"related-values","display_options":{"template":"{{name}}"}}	\N	\N
1465	1508	directus_fields	56	{"id":56,"collection":"highlights","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"status","width":"half"}	\N	\N
1466	1509	directus_fields	55	{"id":55,"collection":"highlights","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"id","sort":1,"group":null}	\N	\N
1467	1510	directus_fields	56	{"id":56,"collection":"highlights","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"status","sort":2,"group":null}	\N	\N
1468	1511	directus_fields	60	{"id":60,"collection":"highlights","field":"profile","special":["m2o"],"interface":null,"options":null,"display":"related-values","display_options":{"template":"{{name}}"},"readonly":false,"hidden":false,"sort":3,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"profile","sort":3,"group":null}	\N	\N
1469	1512	directus_fields	57	{"id":57,"collection":"highlights","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"sort","sort":4,"group":null}	\N	\N
1470	1513	directus_fields	58	{"id":58,"collection":"highlights","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"date_created","sort":5,"group":null}	\N	\N
1471	1514	directus_fields	59	{"id":59,"collection":"highlights","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"date_updated","sort":6,"group":null}	\N	\N
1472	1515	directus_fields	62	{"id":62,"collection":"highlights","field":"text","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"text","sort":7,"group":null}	\N	\N
1473	1516	directus_fields	60	{"id":60,"collection":"highlights","field":"profile","special":["m2o"],"interface":null,"options":null,"display":"related-values","display_options":{"template":"{{name}}"},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"profile","width":"half"}	\N	\N
1474	1517	directus_fields	60	{"id":60,"collection":"highlights","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":"related-values","display_options":{"template":"{{name}}"},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"profile","interface":"select-dropdown-m2o"}	\N	\N
1475	1518	directus_fields	55	{"id":55,"collection":"highlights","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"id","sort":1,"group":null}	\N	\N
1476	1519	directus_fields	56	{"id":56,"collection":"highlights","field":"status","special":null,"interface":"select-dropdown","options":{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]},"display":"labels","display_options":{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]},"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"status","sort":2,"group":null}	\N	\N
1477	1520	directus_fields	60	{"id":60,"collection":"highlights","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":"related-values","display_options":{"template":"{{name}}"},"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"profile","sort":3,"group":null}	\N	\N
1478	1521	directus_fields	62	{"id":62,"collection":"highlights","field":"text","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"text","sort":4,"group":null}	\N	\N
1479	1522	directus_fields	57	{"id":57,"collection":"highlights","field":"sort","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":5,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"sort","sort":5,"group":null}	\N	\N
1480	1523	directus_fields	58	{"id":58,"collection":"highlights","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"date_created","sort":6,"group":null}	\N	\N
1481	1524	directus_fields	59	{"id":59,"collection":"highlights","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"date_updated","sort":7,"group":null}	\N	\N
1482	1525	directus_fields	132	{"sort":8,"interface":"input","special":null,"collection":"highlights","field":"fa_icon"}	{"sort":8,"interface":"input","special":null,"collection":"highlights","field":"fa_icon"}	\N	\N
1483	1526	directus_fields	132	{"id":132,"collection":"highlights","field":"fa_icon","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":"Font Awesome icon name","conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"highlights","field":"fa_icon","note":"Font Awesome icon name"}	\N	\N
1484	1527	highlights	00483bae-b8ef-46bb-8230-0f84c989f971	{"id":"00483bae-b8ef-46bb-8230-0f84c989f971","status":"published","sort":null,"date_created":"2025-10-17T14:38:05.591Z","date_updated":"2025-10-19T18:19:12.522Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","text":"18+ years of full stack development experience","fa_icon":"gem"}	{"fa_icon":"gem","date_updated":"2025-10-19T18:19:12.522Z"}	\N	\N
1485	1528	highlights	bf60fa32-c241-4a49-9edf-d0a21c3a4b3d	{"id":"bf60fa32-c241-4a49-9edf-d0a21c3a4b3d","status":"published","sort":null,"date_created":"2025-10-17T14:38:05.596Z","date_updated":"2025-10-19T18:19:19.643Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","text":"Team leadership and project management experience","fa_icon":"code"}	{"fa_icon":"code","date_updated":"2025-10-19T18:19:19.643Z"}	\N	\N
1486	1529	highlights	912a4cfd-44d1-4b88-bd32-0a67ce05e1bc	{"id":"912a4cfd-44d1-4b88-bd32-0a67ce05e1bc","status":"published","sort":null,"date_created":"2025-10-17T14:38:05.600Z","date_updated":"2025-10-19T18:19:28.603Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","text":"Skilled in developing scalable solutions for high-traffic applications","fa_icon":"users"}	{"fa_icon":"users","date_updated":"2025-10-19T18:19:28.603Z"}	\N	\N
1487	1530	highlights	82700d7e-0a60-43af-82a7-1ca8a4fcb43f	{"id":"82700d7e-0a60-43af-82a7-1ca8a4fcb43f","status":"published","sort":null,"date_created":"2025-10-17T14:38:05.598Z","date_updated":"2025-10-19T18:19:48.120Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","text":"Additional experience in DevOps & CI/CD","fa_icon":"server"}	{"fa_icon":"server","date_updated":"2025-10-19T18:19:48.120Z"}	\N	\N
1488	1531	highlights	85956023-2be3-4fa9-9643-fc677ffd97cb	{"id":"85956023-2be3-4fa9-9643-fc677ffd97cb","status":"published","sort":2,"date_created":"2025-10-17T14:38:05.594Z","date_updated":"2025-10-19T18:20:08.168Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","text":"Expertise in modern Python, JavaScript & Node.js ecosystems","fa_icon":"code"}	{"fa_icon":"code","date_updated":"2025-10-19T18:20:08.168Z"}	\N	\N
1489	1532	highlights	bf60fa32-c241-4a49-9edf-d0a21c3a4b3d	{"id":"bf60fa32-c241-4a49-9edf-d0a21c3a4b3d","status":"published","sort":3,"date_created":"2025-10-17T14:38:05.596Z","date_updated":"2025-10-19T18:20:40.131Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","text":"Team leadership and project management experience","fa_icon":"users"}	{"fa_icon":"users","date_updated":"2025-10-19T18:20:40.131Z"}	\N	\N
1490	1533	highlights	912a4cfd-44d1-4b88-bd32-0a67ce05e1bc	{"id":"912a4cfd-44d1-4b88-bd32-0a67ce05e1bc","status":"published","sort":5,"date_created":"2025-10-17T14:38:05.600Z","date_updated":"2025-10-19T18:20:53.612Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","text":"Skilled in developing scalable solutions for high-traffic applications","fa_icon":"rocket"}	{"fa_icon":"rocket","date_updated":"2025-10-19T18:20:53.612Z"}	\N	\N
1491	1534	highlights	311f493d-c89f-4a35-86fc-9605e93f639d	{"id":"311f493d-c89f-4a35-86fc-9605e93f639d","status":"published","sort":6,"date_created":"2025-10-17T14:38:05.602Z","date_updated":"2025-10-19T18:21:00.713Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","text":"5+ years remote work and distributed team collaboration experience","fa_icon":"home"}	{"fa_icon":"home","date_updated":"2025-10-19T18:21:00.713Z"}	\N	\N
1492	1535	highlights	e30e3468-9f74-4bdb-9f33-abcef8eb6f7b	{"id":"e30e3468-9f74-4bdb-9f33-abcef8eb6f7b","status":"published","sort":7,"date_created":"2025-10-17T14:38:05.603Z","date_updated":"2025-10-19T18:21:05.815Z","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","text":"AI-accelerated development skills with security best practices","fa_icon":"robot"}	{"fa_icon":"robot","date_updated":"2025-10-19T18:21:05.815Z"}	\N	\N
1493	1536	directus_fields	133	{"sort":10,"interface":"tags","special":["cast-json"],"options":{"whitespace":"-","capitalization":"lowercase","alphabetize":true},"collection":"work_experience_achievements","field":"tags"}	{"sort":10,"interface":"tags","special":["cast-json"],"options":{"whitespace":"-","capitalization":"lowercase","alphabetize":true},"collection":"work_experience_achievements","field":"tags"}	\N	\N
1494	1537	work_experience_achievements	1a595ecc-42aa-4d7a-a51f-084d69aa63d5	{"id":"1a595ecc-42aa-4d7a-a51f-084d69aa63d5","status":"published","sort":null,"date_created":"2025-10-19T18:10:23.885Z","date_updated":"2025-10-19T18:27:43.927Z","title":"Platform Scalability","description":"Enabled processing thousands of orders per minute, by optimizing SQL queries & Python/Django processes with 30-60%","work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","fa_icon":"chart-line","tags":["fullstack-django","fullstack-python","fullstack-react","fullstack-svelte"]}	{"tags":["fullstack-django","fullstack-python","fullstack-react","fullstack-svelte"],"date_updated":"2025-10-19T18:27:43.927Z"}	\N	\N
1495	1538	work_experience_achievements	d5bad162-74be-4a66-8c77-86b6251b2650	{"description":"Increased user engagement by +30%, by modernizing frontend UX using React, responsive design & web components","title":"Frontend Modernization","tags":["fullstack-react","fullstack-svelte"],"work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","status":"published","fa_icon":"globe"}	{"description":"Increased user engagement by +30%, by modernizing frontend UX using React, responsive design & web components","title":"Frontend Modernization","tags":["fullstack-react","fullstack-svelte"],"work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","status":"published","fa_icon":"globe"}	\N	\N
1496	1539	work_experience_achievements	da618368-554c-4e9b-a86e-ae43cad7ef0e	{"description":"Contributed to scalability & 40% revenue growth by leading ticket scan app development with React Native & WebSockets","fa_icon":"mobile","title":"Mobile App Development"}	{"description":"Contributed to scalability & 40% revenue growth by leading ticket scan app development with React Native & WebSockets","fa_icon":"mobile","title":"Mobile App Development"}	\N	\N
1497	1540	work_experience_achievements	da618368-554c-4e9b-a86e-ae43cad7ef0e	{"id":"da618368-554c-4e9b-a86e-ae43cad7ef0e","status":"published","sort":null,"date_created":"2025-10-19T18:33:56.478Z","date_updated":"2025-10-19T18:34:07.104Z","title":"Mobile App Development","description":"Contributed to scalability & 40% revenue growth by leading ticket scan app development with React Native & WebSockets","work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","fa_icon":"mobile","tags":null}	{"status":"published","work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","date_updated":"2025-10-19T18:34:07.104Z"}	\N	\N
1498	1541	work_experience_achievements	da618368-554c-4e9b-a86e-ae43cad7ef0e	{"id":"da618368-554c-4e9b-a86e-ae43cad7ef0e","status":"published","sort":null,"date_created":"2025-10-19T18:33:56.478Z","date_updated":"2025-10-19T18:38:08.179Z","title":"Mobile App Development","description":"Contributed to scalability & 40% revenue growth by leading ticket scan app development with React Native & WebSockets","work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","fa_icon":"mobile","tags":["fullstack-react","fullstack-svelte"]}	{"tags":["fullstack-react","fullstack-svelte"],"date_updated":"2025-10-19T18:38:08.179Z"}	\N	\N
1499	1542	work_experience_achievements	5a835ff9-e397-4b01-8cba-ac927bd4a7f0	{"status":"published","work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","title":"System Reliability"}	{"status":"published","work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","title":"System Reliability"}	\N	\N
1500	1543	work_experience_achievements	5a835ff9-e397-4b01-8cba-ac927bd4a7f0	{"id":"5a835ff9-e397-4b01-8cba-ac927bd4a7f0","status":"published","sort":null,"date_created":"2025-10-19T18:40:34.507Z","date_updated":"2025-10-19T18:41:12.224Z","title":"System Reliability","description":"Decreased regression with 90%, by establishing TDD with quality testing suite using Django & Selenium (+80% coverage)","work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","fa_icon":"shield-alt","tags":["fullstack-django","fullstack-python","fullstack-react","fullstack-svelte"]}	{"description":"Decreased regression with 90%, by establishing TDD with quality testing suite using Django & Selenium (+80% coverage)","fa_icon":"shield-alt","tags":["fullstack-django","fullstack-python","fullstack-react","fullstack-svelte"],"date_updated":"2025-10-19T18:41:12.224Z"}	\N	\N
1501	1544	work_experience_achievements	5a835ff9-e397-4b01-8cba-ac927bd4a7f0	{"id":"5a835ff9-e397-4b01-8cba-ac927bd4a7f0","status":"published","sort":null,"date_created":"2025-10-19T18:40:34.507Z","date_updated":"2025-10-19T18:41:43.940Z","title":"Test Driven Development","description":"Decreased regression with 90%, by establishing TDD with quality testing suite using Django & Selenium (+80% coverage)","work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","fa_icon":"shield-alt","tags":["fullstack-django","fullstack-python","fullstack-react","fullstack-svelte"]}	{"title":"Test Driven Development","date_updated":"2025-10-19T18:41:43.940Z"}	\N	\N
1502	1545	work_experience_achievements	1cc82d6b-b1cb-4ede-b822-fa38aef450b8	{"work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","status":"published","description":"Streamlined onboarding, by coordinating development environment setup of 4 Docker microservices in Docker Compose","title":"Docker Compose Setup","tags":["fullstack-python","fullstack-react","fullstack-svelte"]}	{"work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","status":"published","description":"Streamlined onboarding, by coordinating development environment setup of 4 Docker microservices in Docker Compose","title":"Docker Compose Setup","tags":["fullstack-python","fullstack-react","fullstack-svelte"]}	\N	\N
1503	1546	work_experience_achievements	64c7245f-4f93-4e78-9f12-5a1d4748044e	{"status":"published","work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","description":"Maintained backward compatibility with legacy PHP system & database, by customizing Django codebase","title":"Backwards Compatibility","tags":["fullstack-django","fullstack-python"]}	{"status":"published","work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","description":"Maintained backward compatibility with legacy PHP system & database, by customizing Django codebase","title":"Backwards Compatibility","tags":["fullstack-django","fullstack-python"]}	\N	\N
1504	1547	work_experience_achievements	2a4f664b-0ba2-490f-8606-7c06268d9f5e	{"work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","status":"published","description":"Allowed users to validate authenticity of 2nd hand tickets, by implementing TicketSwap REST APIs using DRF","title":"REST API implementations","tags":["fullstack-django"]}	{"work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","status":"published","description":"Allowed users to validate authenticity of 2nd hand tickets, by implementing TicketSwap REST APIs using DRF","title":"REST API implementations","tags":["fullstack-django"]}	\N	\N
1505	1548	work_experience_achievements	0aa6ac47-e106-4614-a626-ef94f80ced3e	{"work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","status":"published","description":"Reduced deploy time -80% & enabled regular releases, by orchestrating CI/CD systems on Linode using Ansible & Python","title":"CI/CD Systems","tags":["fullstack-python","fullstack-react","fullstack-svelte"]}	{"work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","status":"published","description":"Reduced deploy time -80% & enabled regular releases, by orchestrating CI/CD systems on Linode using Ansible & Python","title":"CI/CD Systems","tags":["fullstack-python","fullstack-react","fullstack-svelte"]}	\N	\N
1506	1549	work_experience_achievements	dbbfe692-24b5-42ee-be27-bf901d1bb5c9	{"description":"Enabled clients to organize automatically managed online events with Zoom, by integrating Zoom with OAuth in Django","title":"OAuth Zoom Integration","tags":["fullstack-django","fullstack-python"]}	{"description":"Enabled clients to organize automatically managed online events with Zoom, by integrating Zoom with OAuth in Django","title":"OAuth Zoom Integration","tags":["fullstack-django","fullstack-python"]}	\N	\N
1507	1550	work_experience_achievements	dbbfe692-24b5-42ee-be27-bf901d1bb5c9	{"id":"dbbfe692-24b5-42ee-be27-bf901d1bb5c9","status":"published","sort":null,"date_created":"2025-10-19T18:49:52.949Z","date_updated":"2025-10-19T18:50:01.072Z","title":"OAuth Zoom Integration","description":"Enabled clients to organize automatically managed online events with Zoom, by integrating Zoom with OAuth in Django","work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","fa_icon":null,"tags":["fullstack-django","fullstack-python"]}	{"status":"published","work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","date_updated":"2025-10-19T18:50:01.072Z"}	\N	\N
1508	1551	work_experience_achievements	b48c5e14-e385-4ee6-8965-32ce56bbfaa2	{"work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","status":"published","description":"Processed tens of millions in payment transactions, by building payment service integrations (Mollie, Pay.nl, Paypal)","tags":["fullstack-django"],"title":"Payment Integrations"}	{"work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","status":"published","description":"Processed tens of millions in payment transactions, by building payment service integrations (Mollie, Pay.nl, Paypal)","tags":["fullstack-django"],"title":"Payment Integrations"}	\N	\N
1509	1552	work_experience_achievements	298270af-97ca-461f-8497-b7f24c9a56bf	{"work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","status":"published","description":"Facilitated market expansion to eurozone, by implementing Django i18n features (language, country & timezone)","title":"Internationalization","fa_icon":"globe","tags":["fullstack-django"]}	{"work_experience":"a37c89e0-2b6d-44e1-911a-c1399611562a","status":"published","description":"Facilitated market expansion to eurozone, by implementing Django i18n features (language, country & timezone)","title":"Internationalization","fa_icon":"globe","tags":["fullstack-django"]}	\N	\N
\.


--
-- Data for Name: directus_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_roles (id, name, icon, description, parent) FROM stdin;
17756a67-2cbc-42b5-bb7c-906f79444fb3	Administrator	verified	$t:admin_description	\N
\.


--
-- Data for Name: directus_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_sessions (token, "user", expires, ip, user_agent, share, origin, next_token) FROM stdin;
jyEi42Iib3ayUhuKtRg8crSw0qNgHJgwHBGyXgh2IXu6VhJFRchsBiOMADOe89TD	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-22 11:36:02.247+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	\N	http://localhost:8055	\N
y-WO4WkHlhiznOiATKO-RjKK9Z3HEIlKHRYr0_u4sFB0eeLv84Ny2T4aqWxQ3eCM	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-22 16:20:39.984+00	172.18.0.5	node	\N	\N	\N
pVX2TAe16YVkkcVw9TWxFZh-iyhGwVjppd9O13Ta1Qa1TKHbszuDvPeMz6S5szXg	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-22 16:20:44.345+00	172.18.0.5	node	\N	\N	\N
jpJiV5kskoW5LlYVhxbzagfug_ZbrJ8irKY3a3RneaGmmQoHb9R-91GCFCG35EeL	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-22 16:20:49.72+00	172.18.0.5	node	\N	\N	\N
kA-S7XRDdk9qfWnTlPvsSX9dImd6TfBgEH0sve42Wkv76kWjg7QSDcBlLtdEzCW4	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-22 16:20:54.471+00	172.18.0.5	node	\N	\N	\N
kh42EQlknOAg1mgK2LdARxcW3pzcBUD-VB7HqL8iJawgHPuyyxOTALOU9snCsUra	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-22 16:21:15.524+00	172.18.0.5	node	\N	\N	\N
NYWuxTb_-k1RbMjrV7UHdCDRg82yDOpx1-IQ5gZP-vt7zmyc526B58aFbj2HDdnq	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-22 16:29:05.39+00	172.18.0.5	node	\N	\N	\N
sD5CivuR9vaZrQ8rpTMJGh2UVCHSVpp11Gb3DaYSM8fxjj1L_7KiF7cJ3lkTjLsl	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-19 18:51:07.709+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	\N	http://localhost:8055	ViRXFiuPoBoVRb5tYNR2Gzwjg0ZqCyLOsZsfV2RfWa7_S0plwPyczMIYzYKE-DBm
ViRXFiuPoBoVRb5tYNR2Gzwjg0ZqCyLOsZsfV2RfWa7_S0plwPyczMIYzYKE-DBm	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-20 18:50:57.709+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	\N	http://localhost:8055	\N
\.


--
-- Data for Name: directus_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_settings (id, project_name, project_url, project_color, project_logo, public_foreground, public_background, public_note, auth_login_attempts, auth_password_policy, storage_asset_transform, storage_asset_presets, custom_css, storage_default_folder, basemaps, mapbox_key, module_bar, project_descriptor, default_language, custom_aspect_ratios, public_favicon, default_appearance, default_theme_light, theme_light_overrides, default_theme_dark, theme_dark_overrides, report_error_url, report_bug_url, report_feature_url, public_registration, public_registration_verify_email, public_registration_role, public_registration_email_filter, visual_editor_urls, accepted_terms, project_id, mcp_enabled, mcp_allow_deletes, mcp_prompts_collection, mcp_system_prompt_enabled, mcp_system_prompt) FROM stdin;
1	Smart Job Seeker	\N	#6644FF	\N	\N	\N	\N	25	\N	all	\N	\N	\N	\N	\N	\N	\N	en-US	\N	\N	auto	\N	\N	\N	\N	\N	\N	\N	f	t	\N	\N	\N	t	0199e7a6-9d13-72dc-af68-381958575f19	f	f	\N	t	\N
\.


--
-- Data for Name: directus_shares; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_shares (id, name, collection, item, role, password, user_created, date_created, date_start, date_end, times_used, max_uses) FROM stdin;
\.


--
-- Data for Name: directus_translations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_translations (id, language, key, value) FROM stdin;
477e76f0-e099-49ab-a993-d55f72cf2931	en-US	published	Published
c530a32f-84cb-4ab9-8a61-7a12a5bcb7e6	en-US	draft	Draft
39d9db6d-c7a4-4298-b997-cc4ce6d427b3	en-US	archived	Archived
\.


--
-- Data for Name: directus_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_users (id, first_name, last_name, email, password, location, title, description, tags, avatar, language, tfa_secret, status, role, token, last_access, last_page, provider, external_identifier, auth_data, email_notifications, appearance, theme_dark, theme_light, theme_light_overrides, theme_dark_overrides, text_direction) FROM stdin;
157238bb-6930-4f26-be9c-8b31a9e11ab8	Admin	User	rik@rikwanders.tech	$argon2id$v=19$m=65536,t=3,p=4$MF3ELPmT2vdFmjd2LhqYZA$HmKet+cTxhqHbyL5VQcR2+TrMbCYSiz7REFnd6c6FXY	\N	\N	\N	\N	\N	\N	\N	active	17756a67-2cbc-42b5-bb7c-906f79444fb3	\N	2025-10-19 18:50:57.713+00	/content/profiles/0eeb942b-e35a-44e8-a37d-52b9cdb24309	default	\N	\N	t	\N	\N	\N	\N	\N	auto
\.


--
-- Data for Name: directus_versions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_versions (id, key, name, collection, item, hash, date_created, date_updated, user_created, user_updated, delta) FROM stdin;
\.


--
-- Data for Name: directus_webhooks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_webhooks (id, name, method, url, status, data, actions, collections, headers, was_active_before_deprecation, migrated_flow) FROM stdin;
\.


--
-- Data for Name: highlights; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.highlights (id, status, sort, date_created, date_updated, profile, text, fa_icon) FROM stdin;
00483bae-b8ef-46bb-8230-0f84c989f971	published	1	2025-10-17 14:38:05.591+00	2025-10-19 18:19:12.522+00	0eeb942b-e35a-44e8-a37d-52b9cdb24309	18+ years of full stack development experience	gem
85956023-2be3-4fa9-9643-fc677ffd97cb	published	2	2025-10-17 14:38:05.594+00	2025-10-19 18:20:08.168+00	0eeb942b-e35a-44e8-a37d-52b9cdb24309	Expertise in modern Python, JavaScript & Node.js ecosystems	code
82700d7e-0a60-43af-82a7-1ca8a4fcb43f	published	4	2025-10-17 14:38:05.598+00	2025-10-19 18:19:48.12+00	0eeb942b-e35a-44e8-a37d-52b9cdb24309	Additional experience in DevOps & CI/CD	server
bf60fa32-c241-4a49-9edf-d0a21c3a4b3d	published	3	2025-10-17 14:38:05.596+00	2025-10-19 18:20:40.131+00	0eeb942b-e35a-44e8-a37d-52b9cdb24309	Team leadership and project management experience	users
912a4cfd-44d1-4b88-bd32-0a67ce05e1bc	published	5	2025-10-17 14:38:05.6+00	2025-10-19 18:20:53.612+00	0eeb942b-e35a-44e8-a37d-52b9cdb24309	Skilled in developing scalable solutions for high-traffic applications	rocket
311f493d-c89f-4a35-86fc-9605e93f639d	published	6	2025-10-17 14:38:05.602+00	2025-10-19 18:21:00.713+00	0eeb942b-e35a-44e8-a37d-52b9cdb24309	5+ years remote work and distributed team collaboration experience	home
e30e3468-9f74-4bdb-9f33-abcef8eb6f7b	published	7	2025-10-17 14:38:05.603+00	2025-10-19 18:21:05.815+00	0eeb942b-e35a-44e8-a37d-52b9cdb24309	AI-accelerated development skills with security best practices	robot
\.


--
-- Data for Name: languages; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.languages (id, status, date_created, date_updated, name, language_code, proficiency, profile) FROM stdin;
b636a780-6a9f-4342-adfa-eed183447a17	published	2025-10-17 12:03:30.884+00	\N	Dutch	nl	native	0eeb942b-e35a-44e8-a37d-52b9cdb24309
7024cec2-289e-44e5-a4e8-721805a151a0	published	2025-10-17 12:03:30.887+00	\N	English	en	fluent	0eeb942b-e35a-44e8-a37d-52b9cdb24309
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profiles (id, date_created, date_updated, name, title, location, phone_number, email_address, personal_website, subtitle, core_stack, linkedin_profile, github_profile, stackoverflow_profile, headline, profile_picture) FROM stdin;
0eeb942b-e35a-44e8-a37d-52b9cdb24309	2025-10-15 16:51:41.394+00	2025-10-19 18:10:23.88+00	Rik Wanders	Senior Full Stack Developer	Ronda, Spain	+31649118511	rik@rikwanders.tech	https://www.rikwanders.tech/	Building scalable web applications for remote teams	Python • Node.js • CI/CD • DevOps	https://www.linkedin.com/in/rik-wanders-software	https://github.com/gitaarik	https://stackoverflow.com/users/1248175/gitaarik	Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI	e12c8ec6-2cbe-4672-98e9-a33d6ed5869a
\.


--
-- Data for Name: resume_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resume_tokens (token, name, description, "resumeType", "expiresAt", "viewCount", "maxViews", "isActive", "createdBy", "createdAt", "updatedAt", id) FROM stdin;
\.


--
-- Data for Name: soft_skills; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.soft_skills (id, status, sort, date_created, date_updated, name, profile) FROM stdin;
9f0d1372-15fe-48c5-9c5f-e80e1b82f2a3	published	\N	2025-10-19 16:10:00.783+00	\N	Responsible	0eeb942b-e35a-44e8-a37d-52b9cdb24309
7e34478e-9073-43f5-b54b-0e1a774a0cd3	published	\N	2025-10-19 16:12:44.698+00	\N	Independent	0eeb942b-e35a-44e8-a37d-52b9cdb24309
9db2e160-3d6f-43c3-9dbd-acc209f4e4fe	published	\N	2025-10-19 16:12:44.701+00	\N	Disciplined	0eeb942b-e35a-44e8-a37d-52b9cdb24309
a74f913e-037c-4548-a8d7-d6b96ebaf22f	published	\N	2025-10-19 16:12:44.703+00	\N	Organized	0eeb942b-e35a-44e8-a37d-52b9cdb24309
89c42056-807c-41e6-9e1f-9d7fa08f1b2b	published	\N	2025-10-19 16:12:44.705+00	\N	Proactive	0eeb942b-e35a-44e8-a37d-52b9cdb24309
1cc282e5-4323-41a8-a527-c5db37a92da6	published	\N	2025-10-19 16:12:44.707+00	\N	Creative	0eeb942b-e35a-44e8-a37d-52b9cdb24309
b3049619-b765-429d-9700-4522df069f1b	published	\N	2025-10-19 16:12:44.708+00	\N	Problem solving	0eeb942b-e35a-44e8-a37d-52b9cdb24309
68c01e2b-5d94-4c58-adbf-ba74ffe6f8b7	published	\N	2025-10-19 16:12:44.71+00	\N	Result-oriented	0eeb942b-e35a-44e8-a37d-52b9cdb24309
d28caf31-29e1-4334-8108-c7b6ee0197e4	published	\N	2025-10-19 16:12:44.711+00	\N	Determined	0eeb942b-e35a-44e8-a37d-52b9cdb24309
\.


--
-- Data for Name: tech_skill_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tech_skill_categories (id, status, sort, date_created, date_updated, name) FROM stdin;
78c235f4-2456-40e6-939d-19c855a30aa1	published	1	2025-10-17 15:11:24.359+00	2025-10-17 15:29:21.475+00	Frontend
0bcc8c53-eb96-4d3b-8bd5-81faf33000a5	published	4	2025-10-17 15:12:51.928+00	2025-10-17 15:29:24.926+00	Databases
e6875da0-e556-45f0-be1e-e469fdaed3a7	published	2	2025-10-17 15:11:13.878+00	2025-10-17 15:29:31.195+00	Backend
a2c07ea5-050e-4ad0-adad-7bfd7908e4ad	published	3	2025-10-17 17:00:54.583+00	\N	Mobile
6d549daa-2775-4af9-85c9-c3a50ef155c0	published	\N	2025-10-17 17:12:02.589+00	\N	Development Tools
\.


--
-- Data for Name: tech_skill_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tech_skill_types (id, status, sort, date_created, date_updated, name) FROM stdin;
1	published	1	2025-10-17 16:00:04.591+00	2025-10-17 16:39:20.546+00	Programming Language
2	published	2	2025-10-17 16:13:13.81+00	2025-10-17 16:40:10.86+00	Framework / Library
13	published	3	2025-10-17 16:47:36.872+00	\N	APIs & Integration Technologies
3	published	5	2025-10-17 16:13:56.351+00	2025-10-17 16:16:07.212+00	Relational Database
7	published	8	2025-10-17 16:18:19.612+00	\N	Code editor / IDE
5	published	6	2025-10-17 16:16:57.042+00	2025-10-17 16:39:12.457+00	NoSQL Database
4	published	4	2025-10-17 16:14:17.04+00	2025-10-17 16:39:17.912+00	Development Tool
9	published	10	2025-10-17 16:31:49.716+00	2025-10-17 16:40:33.895+00	CI/CD / Automation Tool
8	published	9	2025-10-17 16:19:03.302+00	2025-10-17 16:40:43.682+00	Container / Orchestration Tool
6	published	7	2025-10-17 16:17:48.008+00	2025-10-17 16:40:54.131+00	Version Control / Collaboration Tool
10	published	11	2025-10-17 16:34:46.403+00	\N	Infrastructure as Code
11	published	12	2025-10-17 16:35:54.991+00	2025-10-17 16:40:22.606+00	Cloud Platform / Service
12	published	13	2025-10-17 16:36:38.701+00	2025-10-17 16:41:04.775+00	Networking / Load Balancing
\.


--
-- Data for Name: tech_skills; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tech_skills (id, status, sort, date_created, date_updated, profile, name, category, years_experience, level, tech_type) FROM stdin;
23	published	15	2025-10-17 17:09:52.916+00	\N	\N	MongoDB	0bcc8c53-eb96-4d3b-8bd5-81faf33000a5	2	proficient	5
2	published	16	2025-10-17 16:02:34.588+00	\N	0eeb942b-e35a-44e8-a37d-52b9cdb24309	JavaScript	78c235f4-2456-40e6-939d-19c855a30aa1	18	expert	1
11	published	17	2025-10-17 16:55:49.756+00	\N	0eeb942b-e35a-44e8-a37d-52b9cdb24309	Node.js	78c235f4-2456-40e6-939d-19c855a30aa1	12	expert	1
12	published	18	2025-10-17 16:56:44.833+00	\N	0eeb942b-e35a-44e8-a37d-52b9cdb24309	TypeScript	78c235f4-2456-40e6-939d-19c855a30aa1	2	proficient	1
14	published	19	2025-10-17 17:01:46.443+00	\N	0eeb942b-e35a-44e8-a37d-52b9cdb24309	React Native	a2c07ea5-050e-4ad0-adad-7bfd7908e4ad	3	proficient	2
1	published	1	2025-10-17 15:11:59.895+00	2025-10-17 16:00:38.293+00	0eeb942b-e35a-44e8-a37d-52b9cdb24309	Python	e6875da0-e556-45f0-be1e-e469fdaed3a7	12	expert	1
6	published	4	2025-10-17 16:42:47.554+00	\N	0eeb942b-e35a-44e8-a37d-52b9cdb24309	Flask	e6875da0-e556-45f0-be1e-e469fdaed3a7	4	proficient	2
7	published	5	2025-10-17 16:43:46.247+00	\N	0eeb942b-e35a-44e8-a37d-52b9cdb24309	FastAPI	e6875da0-e556-45f0-be1e-e469fdaed3a7	1	proficient	2
8	published	6	2025-10-17 16:45:28.783+00	\N	0eeb942b-e35a-44e8-a37d-52b9cdb24309	RESTful APIs	e6875da0-e556-45f0-be1e-e469fdaed3a7	12	expert	\N
9	published	7	2025-10-17 16:49:12.448+00	\N	0eeb942b-e35a-44e8-a37d-52b9cdb24309	LLM integrations	e6875da0-e556-45f0-be1e-e469fdaed3a7	1	proficient	13
4	published	2	2025-10-17 16:38:48.185+00	\N	0eeb942b-e35a-44e8-a37d-52b9cdb24309	Django	e6875da0-e556-45f0-be1e-e469fdaed3a7	12	expert	2
5	published	3	2025-10-17 16:42:03.762+00	\N	0eeb942b-e35a-44e8-a37d-52b9cdb24309	Django REST Framework (DRF)	e6875da0-e556-45f0-be1e-e469fdaed3a7	12	expert	2
15	published	21	2025-10-17 17:04:22.335+00	\N	\N	Svelte	78c235f4-2456-40e6-939d-19c855a30aa1	2	proficient	2
18	published	10	2025-10-17 17:06:28.288+00	\N	0eeb942b-e35a-44e8-a37d-52b9cdb24309	MySQL	0bcc8c53-eb96-4d3b-8bd5-81faf33000a5	10	expert	3
3	published	9	2025-10-17 16:03:18.66+00	2025-10-17 16:37:50.808+00	0eeb942b-e35a-44e8-a37d-52b9cdb24309	PostgreSQL	0bcc8c53-eb96-4d3b-8bd5-81faf33000a5	4	expert	3
10	published	8	2025-10-17 16:53:10.394+00	\N	0eeb942b-e35a-44e8-a37d-52b9cdb24309	pytest	e6875da0-e556-45f0-be1e-e469fdaed3a7	12	proficient	2
13	published	20	2025-10-17 16:57:04.639+00	\N	0eeb942b-e35a-44e8-a37d-52b9cdb24309	React	78c235f4-2456-40e6-939d-19c855a30aa1	12	expert	2
19	published	11	2025-10-17 17:07:14.543+00	\N	\N	MariaDB	0bcc8c53-eb96-4d3b-8bd5-81faf33000a5	12	expert	3
16	published	22	2025-10-17 17:04:43.06+00	\N	\N	Tailwind CSS	78c235f4-2456-40e6-939d-19c855a30aa1	2	proficient	2
17	published	23	2025-10-17 17:04:59.917+00	\N	\N	Jest	78c235f4-2456-40e6-939d-19c855a30aa1	2	proficient	2
24	published	\N	2025-10-17 17:12:49.093+00	\N	0eeb942b-e35a-44e8-a37d-52b9cdb24309	Git	6d549daa-2775-4af9-85c9-c3a50ef155c0	12	expert	6
20	published	12	2025-10-17 17:07:50.873+00	2025-10-19 18:14:57.198+00	0eeb942b-e35a-44e8-a37d-52b9cdb24309	SQLite	0bcc8c53-eb96-4d3b-8bd5-81faf33000a5	5	proficient	3
21	published	13	2025-10-17 17:08:46.459+00	\N	\N	SQL optimization	0bcc8c53-eb96-4d3b-8bd5-81faf33000a5	12	proficient	3
22	published	14	2025-10-17 17:09:24.629+00	\N	0eeb942b-e35a-44e8-a37d-52b9cdb24309	Elasticsearch	0bcc8c53-eb96-4d3b-8bd5-81faf33000a5	3	proficient	5
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (email, password, "firstName", "lastName", "isEmailVerified", "emailVerifyToken", "passwordResetToken", "passwordResetExpiry", "createdAt", "updatedAt", role, id) FROM stdin;
\.


--
-- Data for Name: work_experience_achievements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_experience_achievements (id, status, sort, date_created, date_updated, title, description, work_experience, fa_icon, tags) FROM stdin;
da618368-554c-4e9b-a86e-ae43cad7ef0e	published	4	2025-10-19 18:33:56.478+00	2025-10-19 18:38:08.179+00	Mobile App Development	Contributed to scalability & 40% revenue growth by leading ticket scan app development with React Native & WebSockets	a37c89e0-2b6d-44e1-911a-c1399611562a	mobile	["fullstack-react","fullstack-svelte"]
5a835ff9-e397-4b01-8cba-ac927bd4a7f0	published	5	2025-10-19 18:40:34.507+00	2025-10-19 18:41:43.94+00	Test Driven Development	Decreased regression with 90%, by establishing TDD with quality testing suite using Django & Selenium (+80% coverage)	a37c89e0-2b6d-44e1-911a-c1399611562a	shield-alt	["fullstack-django","fullstack-python","fullstack-react","fullstack-svelte"]
b48c5e14-e385-4ee6-8965-32ce56bbfaa2	published	11	2025-10-19 18:51:40.478+00	\N	Payment Integrations	Processed tens of millions in payment transactions, by building payment service integrations (Mollie, Pay.nl, Paypal)	a37c89e0-2b6d-44e1-911a-c1399611562a	\N	["fullstack-django"]
2a4f664b-0ba2-490f-8606-7c06268d9f5e	published	10	2025-10-19 18:45:13.313+00	\N	REST API implementations	Allowed users to validate authenticity of 2nd hand tickets, by implementing TicketSwap REST APIs using DRF	a37c89e0-2b6d-44e1-911a-c1399611562a	\N	["fullstack-django"]
298270af-97ca-461f-8497-b7f24c9a56bf	published	\N	2025-10-19 18:52:26.342+00	\N	Internationalization	Facilitated market expansion to eurozone, by implementing Django i18n features (language, country & timezone)	a37c89e0-2b6d-44e1-911a-c1399611562a	globe	["fullstack-django"]
8e32e85b-f8d8-4fcf-af76-cb8f18ad91d9	published	1	2025-10-19 17:55:53.073+00	2025-10-19 18:04:44.151+00	Team Leadership	Optimized development team (3-5 devs) output with 25%, by leading agile methods and strict code review processes	a37c89e0-2b6d-44e1-911a-c1399611562a	users	\N
0aa6ac47-e106-4614-a626-ef94f80ced3e	published	6	2025-10-19 18:47:02.991+00	\N	CI/CD Systems	Reduced deploy time -80% & enabled regular releases, by orchestrating CI/CD systems on Linode using Ansible & Python	a37c89e0-2b6d-44e1-911a-c1399611562a	\N	["fullstack-python","fullstack-react","fullstack-svelte"]
1cc82d6b-b1cb-4ede-b822-fa38aef450b8	published	7	2025-10-19 18:43:09.217+00	\N	Docker Compose Setup	Streamlined onboarding, by coordinating development environment setup of 4 Docker microservices in Docker Compose	a37c89e0-2b6d-44e1-911a-c1399611562a	\N	["fullstack-python","fullstack-react","fullstack-svelte"]
1a595ecc-42aa-4d7a-a51f-084d69aa63d5	published	2	2025-10-19 18:10:23.885+00	2025-10-19 18:27:43.927+00	Platform Scalability	Enabled processing thousands of orders per minute, by optimizing SQL queries & Python/Django processes with 30-60%	a37c89e0-2b6d-44e1-911a-c1399611562a	chart-line	["fullstack-django","fullstack-python","fullstack-react","fullstack-svelte"]
dbbfe692-24b5-42ee-be27-bf901d1bb5c9	published	9	2025-10-19 18:49:52.949+00	2025-10-19 18:50:01.072+00	OAuth Zoom Integration	Enabled clients to organize automatically managed online events with Zoom, by integrating Zoom with OAuth in Django	a37c89e0-2b6d-44e1-911a-c1399611562a	\N	["fullstack-django","fullstack-python"]
d5bad162-74be-4a66-8c77-86b6251b2650	published	3	2025-10-19 18:30:45.827+00	\N	Frontend Modernization	Increased user engagement by +30%, by modernizing frontend UX using React, responsive design & web components	a37c89e0-2b6d-44e1-911a-c1399611562a	globe	["fullstack-react","fullstack-svelte"]
64c7245f-4f93-4e78-9f12-5a1d4748044e	published	8	2025-10-19 18:44:23.218+00	\N	Backwards Compatibility	Maintained backward compatibility with legacy PHP system & database, by customizing Django codebase	a37c89e0-2b6d-44e1-911a-c1399611562a	\N	["fullstack-django","fullstack-python"]
\.


--
-- Data for Name: work_experiences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_experiences (name, location, description, "position", summary, id, logo, status, sort, profile, date_created, date_updated, start_date, end_date, website) FROM stdin;
Tender-it	Amsterdam	Tender platform	Lead Developer	Was cool	f044625e-b180-4603-b03a-42a5a397403a	d6beca5c-5fc3-4f31-aa57-fc1a8209a97c	published	2	0eeb942b-e35a-44e8-a37d-52b9cdb24309	\N	2025-10-19 17:45:05.042+00	2014-03-09	2017-06-22	\N
Chipta	Amsterdam	Ticketing company	Lead Developer	Led teams of 3-5 developers at innovative ticketing platform for over 7 years, scaling the platform from concept to processing thousands of orders per minute. Optimized platform performance by 30-60%, implemented comprehensive testing suites, and orchestrated CI/CD systems. Built React Native mobile apps that contributed to a 40% revenue increase, modernized frontend interfaces with React, increasing user engagement by 30%. And integrated critical payment systems processing tens of millions in transactions.	a37c89e0-2b6d-44e1-911a-c1399611562a	8127127c-d1cf-480e-87ea-5cbfbfc12e36	published	1	0eeb942b-e35a-44e8-a37d-52b9cdb24309	\N	2025-10-19 18:10:23.884+00	2017-09-10	2024-09-20	https://chipta.com/
\.


--
-- Data for Name: work_highlight_tags; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_highlight_tags ("highlightId", "tagName", "createdAt", id) FROM stdin;
\.


--
-- Data for Name: work_highlights; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_highlights ("workExperienceId", title, description, "iconName", "sortOrder", "createdAt", "updatedAt", id) FROM stdin;
\.


--
-- Data for Name: work_projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_projects ("workExperienceId", name, "startDate", "endDate", summary, description, outcome, "sortOrder", "createdAt", "updatedAt", id) FROM stdin;
\.


--
-- Data for Name: work_technologies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_technologies ("workExperienceId", "technologyName", "sortOrder", "createdAt", id) FROM stdin;
\.


--
-- Name: directus_activity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_activity_id_seq', 1552, true);


--
-- Name: directus_fields_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_fields_id_seq', 133, true);


--
-- Name: directus_notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_notifications_id_seq', 1, false);


--
-- Name: directus_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_permissions_id_seq', 1, false);


--
-- Name: directus_presets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_presets_id_seq', 12, true);


--
-- Name: directus_relations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_relations_id_seq', 15, true);


--
-- Name: directus_revisions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_revisions_id_seq', 1509, true);


--
-- Name: directus_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_settings_id_seq', 1, true);


--
-- Name: directus_webhooks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_webhooks_id_seq', 1, false);


--
-- Name: tech_skill_types_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tech_skill_types_id_seq', 13, true);


--
-- Name: tech_skills_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tech_skills_id_seq', 24, true);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: ai_refinements ai_refinements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_refinements
    ADD CONSTRAINT ai_refinements_pkey PRIMARY KEY (id);


--
-- Name: ai_responses ai_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_responses
    ADD CONSTRAINT ai_responses_pkey PRIMARY KEY (id);


--
-- Name: dev_methodologies dev_methodologies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dev_methodologies
    ADD CONSTRAINT dev_methodologies_pkey PRIMARY KEY (id);


--
-- Name: directus_access directus_access_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_access
    ADD CONSTRAINT directus_access_pkey PRIMARY KEY (id);


--
-- Name: directus_activity directus_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_activity
    ADD CONSTRAINT directus_activity_pkey PRIMARY KEY (id);


--
-- Name: directus_collections directus_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_collections
    ADD CONSTRAINT directus_collections_pkey PRIMARY KEY (collection);


--
-- Name: directus_comments directus_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_comments
    ADD CONSTRAINT directus_comments_pkey PRIMARY KEY (id);


--
-- Name: directus_dashboards directus_dashboards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_dashboards
    ADD CONSTRAINT directus_dashboards_pkey PRIMARY KEY (id);


--
-- Name: directus_extensions directus_extensions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_extensions
    ADD CONSTRAINT directus_extensions_pkey PRIMARY KEY (id);


--
-- Name: directus_fields directus_fields_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_fields
    ADD CONSTRAINT directus_fields_pkey PRIMARY KEY (id);


--
-- Name: directus_files directus_files_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_files
    ADD CONSTRAINT directus_files_pkey PRIMARY KEY (id);


--
-- Name: directus_flows directus_flows_operation_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_flows
    ADD CONSTRAINT directus_flows_operation_unique UNIQUE (operation);


--
-- Name: directus_flows directus_flows_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_flows
    ADD CONSTRAINT directus_flows_pkey PRIMARY KEY (id);


--
-- Name: directus_folders directus_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_folders
    ADD CONSTRAINT directus_folders_pkey PRIMARY KEY (id);


--
-- Name: directus_migrations directus_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_migrations
    ADD CONSTRAINT directus_migrations_pkey PRIMARY KEY (version);


--
-- Name: directus_notifications directus_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_notifications
    ADD CONSTRAINT directus_notifications_pkey PRIMARY KEY (id);


--
-- Name: directus_operations directus_operations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_pkey PRIMARY KEY (id);


--
-- Name: directus_operations directus_operations_reject_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_reject_unique UNIQUE (reject);


--
-- Name: directus_operations directus_operations_resolve_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_resolve_unique UNIQUE (resolve);


--
-- Name: directus_panels directus_panels_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_panels
    ADD CONSTRAINT directus_panels_pkey PRIMARY KEY (id);


--
-- Name: directus_permissions directus_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_permissions
    ADD CONSTRAINT directus_permissions_pkey PRIMARY KEY (id);


--
-- Name: directus_policies directus_policies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_policies
    ADD CONSTRAINT directus_policies_pkey PRIMARY KEY (id);


--
-- Name: directus_presets directus_presets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_presets
    ADD CONSTRAINT directus_presets_pkey PRIMARY KEY (id);


--
-- Name: directus_relations directus_relations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_relations
    ADD CONSTRAINT directus_relations_pkey PRIMARY KEY (id);


--
-- Name: directus_revisions directus_revisions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_revisions
    ADD CONSTRAINT directus_revisions_pkey PRIMARY KEY (id);


--
-- Name: directus_roles directus_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_roles
    ADD CONSTRAINT directus_roles_pkey PRIMARY KEY (id);


--
-- Name: directus_sessions directus_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_sessions
    ADD CONSTRAINT directus_sessions_pkey PRIMARY KEY (token);


--
-- Name: directus_settings directus_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_pkey PRIMARY KEY (id);


--
-- Name: directus_shares directus_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_shares
    ADD CONSTRAINT directus_shares_pkey PRIMARY KEY (id);


--
-- Name: directus_translations directus_translations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_translations
    ADD CONSTRAINT directus_translations_pkey PRIMARY KEY (id);


--
-- Name: directus_users directus_users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_users
    ADD CONSTRAINT directus_users_email_unique UNIQUE (email);


--
-- Name: directus_users directus_users_external_identifier_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_users
    ADD CONSTRAINT directus_users_external_identifier_unique UNIQUE (external_identifier);


--
-- Name: directus_users directus_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_users
    ADD CONSTRAINT directus_users_pkey PRIMARY KEY (id);


--
-- Name: directus_users directus_users_token_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_users
    ADD CONSTRAINT directus_users_token_unique UNIQUE (token);


--
-- Name: directus_versions directus_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_versions
    ADD CONSTRAINT directus_versions_pkey PRIMARY KEY (id);


--
-- Name: directus_webhooks directus_webhooks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_webhooks
    ADD CONSTRAINT directus_webhooks_pkey PRIMARY KEY (id);


--
-- Name: highlights highlights_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.highlights
    ADD CONSTRAINT highlights_pkey PRIMARY KEY (id);


--
-- Name: languages languages_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.languages
    ADD CONSTRAINT languages_pkey PRIMARY KEY (id);


--
-- Name: profiles profile_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profile_pkey PRIMARY KEY (id);


--
-- Name: resume_tokens resume_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resume_tokens
    ADD CONSTRAINT resume_tokens_pkey PRIMARY KEY (id);


--
-- Name: soft_skills soft_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.soft_skills
    ADD CONSTRAINT soft_skills_pkey PRIMARY KEY (id);


--
-- Name: tech_skill_categories tech_skill_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tech_skill_categories
    ADD CONSTRAINT tech_skill_categories_pkey PRIMARY KEY (id);


--
-- Name: tech_skill_types tech_skill_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tech_skill_types
    ADD CONSTRAINT tech_skill_types_pkey PRIMARY KEY (id);


--
-- Name: tech_skills tech_skills_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tech_skills
    ADD CONSTRAINT tech_skills_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: work_experience_achievements work_experience_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_experience_achievements
    ADD CONSTRAINT work_experience_achievements_pkey PRIMARY KEY (id);


--
-- Name: work_experiences work_experiences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_experiences
    ADD CONSTRAINT work_experiences_pkey PRIMARY KEY (id);


--
-- Name: work_highlight_tags work_highlight_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_highlight_tags
    ADD CONSTRAINT work_highlight_tags_pkey PRIMARY KEY (id);


--
-- Name: work_highlights work_highlights_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_highlights
    ADD CONSTRAINT work_highlights_pkey PRIMARY KEY (id);


--
-- Name: work_projects work_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_projects
    ADD CONSTRAINT work_projects_pkey PRIMARY KEY (id);


--
-- Name: work_technologies work_technologies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_technologies
    ADD CONSTRAINT work_technologies_pkey PRIMARY KEY (id);


--
-- Name: resume_tokens_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX resume_tokens_token_key ON public.resume_tokens USING btree (token);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: ai_refinements ai_refinements_responseId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_refinements
    ADD CONSTRAINT "ai_refinements_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES public.ai_responses(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ai_responses ai_responses_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ai_responses
    ADD CONSTRAINT "ai_responses_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: dev_methodologies dev_methodologies_profile_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.dev_methodologies
    ADD CONSTRAINT dev_methodologies_profile_foreign FOREIGN KEY (profile) REFERENCES public.profiles(id);


--
-- Name: directus_access directus_access_policy_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_access
    ADD CONSTRAINT directus_access_policy_foreign FOREIGN KEY (policy) REFERENCES public.directus_policies(id) ON DELETE CASCADE;


--
-- Name: directus_access directus_access_role_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_access
    ADD CONSTRAINT directus_access_role_foreign FOREIGN KEY (role) REFERENCES public.directus_roles(id) ON DELETE CASCADE;


--
-- Name: directus_access directus_access_user_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_access
    ADD CONSTRAINT directus_access_user_foreign FOREIGN KEY ("user") REFERENCES public.directus_users(id) ON DELETE CASCADE;


--
-- Name: directus_collections directus_collections_group_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_collections
    ADD CONSTRAINT directus_collections_group_foreign FOREIGN KEY ("group") REFERENCES public.directus_collections(collection);


--
-- Name: directus_comments directus_comments_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_comments
    ADD CONSTRAINT directus_comments_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_comments directus_comments_user_updated_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_comments
    ADD CONSTRAINT directus_comments_user_updated_foreign FOREIGN KEY (user_updated) REFERENCES public.directus_users(id);


--
-- Name: directus_dashboards directus_dashboards_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_dashboards
    ADD CONSTRAINT directus_dashboards_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_files directus_files_folder_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_files
    ADD CONSTRAINT directus_files_folder_foreign FOREIGN KEY (folder) REFERENCES public.directus_folders(id) ON DELETE SET NULL;


--
-- Name: directus_files directus_files_modified_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_files
    ADD CONSTRAINT directus_files_modified_by_foreign FOREIGN KEY (modified_by) REFERENCES public.directus_users(id);


--
-- Name: directus_files directus_files_uploaded_by_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_files
    ADD CONSTRAINT directus_files_uploaded_by_foreign FOREIGN KEY (uploaded_by) REFERENCES public.directus_users(id);


--
-- Name: directus_flows directus_flows_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_flows
    ADD CONSTRAINT directus_flows_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_folders directus_folders_parent_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_folders
    ADD CONSTRAINT directus_folders_parent_foreign FOREIGN KEY (parent) REFERENCES public.directus_folders(id);


--
-- Name: directus_notifications directus_notifications_recipient_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_notifications
    ADD CONSTRAINT directus_notifications_recipient_foreign FOREIGN KEY (recipient) REFERENCES public.directus_users(id) ON DELETE CASCADE;


--
-- Name: directus_notifications directus_notifications_sender_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_notifications
    ADD CONSTRAINT directus_notifications_sender_foreign FOREIGN KEY (sender) REFERENCES public.directus_users(id);


--
-- Name: directus_operations directus_operations_flow_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_flow_foreign FOREIGN KEY (flow) REFERENCES public.directus_flows(id) ON DELETE CASCADE;


--
-- Name: directus_operations directus_operations_reject_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_reject_foreign FOREIGN KEY (reject) REFERENCES public.directus_operations(id);


--
-- Name: directus_operations directus_operations_resolve_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_resolve_foreign FOREIGN KEY (resolve) REFERENCES public.directus_operations(id);


--
-- Name: directus_operations directus_operations_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_operations
    ADD CONSTRAINT directus_operations_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_panels directus_panels_dashboard_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_panels
    ADD CONSTRAINT directus_panels_dashboard_foreign FOREIGN KEY (dashboard) REFERENCES public.directus_dashboards(id) ON DELETE CASCADE;


--
-- Name: directus_panels directus_panels_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_panels
    ADD CONSTRAINT directus_panels_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_permissions directus_permissions_policy_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_permissions
    ADD CONSTRAINT directus_permissions_policy_foreign FOREIGN KEY (policy) REFERENCES public.directus_policies(id) ON DELETE CASCADE;


--
-- Name: directus_presets directus_presets_role_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_presets
    ADD CONSTRAINT directus_presets_role_foreign FOREIGN KEY (role) REFERENCES public.directus_roles(id) ON DELETE CASCADE;


--
-- Name: directus_presets directus_presets_user_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_presets
    ADD CONSTRAINT directus_presets_user_foreign FOREIGN KEY ("user") REFERENCES public.directus_users(id) ON DELETE CASCADE;


--
-- Name: directus_revisions directus_revisions_activity_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_revisions
    ADD CONSTRAINT directus_revisions_activity_foreign FOREIGN KEY (activity) REFERENCES public.directus_activity(id) ON DELETE CASCADE;


--
-- Name: directus_revisions directus_revisions_parent_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_revisions
    ADD CONSTRAINT directus_revisions_parent_foreign FOREIGN KEY (parent) REFERENCES public.directus_revisions(id);


--
-- Name: directus_revisions directus_revisions_version_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_revisions
    ADD CONSTRAINT directus_revisions_version_foreign FOREIGN KEY (version) REFERENCES public.directus_versions(id) ON DELETE CASCADE;


--
-- Name: directus_roles directus_roles_parent_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_roles
    ADD CONSTRAINT directus_roles_parent_foreign FOREIGN KEY (parent) REFERENCES public.directus_roles(id);


--
-- Name: directus_sessions directus_sessions_share_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_sessions
    ADD CONSTRAINT directus_sessions_share_foreign FOREIGN KEY (share) REFERENCES public.directus_shares(id) ON DELETE CASCADE;


--
-- Name: directus_sessions directus_sessions_user_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_sessions
    ADD CONSTRAINT directus_sessions_user_foreign FOREIGN KEY ("user") REFERENCES public.directus_users(id) ON DELETE CASCADE;


--
-- Name: directus_settings directus_settings_project_logo_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_project_logo_foreign FOREIGN KEY (project_logo) REFERENCES public.directus_files(id);


--
-- Name: directus_settings directus_settings_public_background_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_public_background_foreign FOREIGN KEY (public_background) REFERENCES public.directus_files(id);


--
-- Name: directus_settings directus_settings_public_favicon_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_public_favicon_foreign FOREIGN KEY (public_favicon) REFERENCES public.directus_files(id);


--
-- Name: directus_settings directus_settings_public_foreground_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_public_foreground_foreign FOREIGN KEY (public_foreground) REFERENCES public.directus_files(id);


--
-- Name: directus_settings directus_settings_public_registration_role_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_public_registration_role_foreign FOREIGN KEY (public_registration_role) REFERENCES public.directus_roles(id) ON DELETE SET NULL;


--
-- Name: directus_settings directus_settings_storage_default_folder_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_settings
    ADD CONSTRAINT directus_settings_storage_default_folder_foreign FOREIGN KEY (storage_default_folder) REFERENCES public.directus_folders(id) ON DELETE SET NULL;


--
-- Name: directus_shares directus_shares_collection_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_shares
    ADD CONSTRAINT directus_shares_collection_foreign FOREIGN KEY (collection) REFERENCES public.directus_collections(collection) ON DELETE CASCADE;


--
-- Name: directus_shares directus_shares_role_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_shares
    ADD CONSTRAINT directus_shares_role_foreign FOREIGN KEY (role) REFERENCES public.directus_roles(id) ON DELETE CASCADE;


--
-- Name: directus_shares directus_shares_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_shares
    ADD CONSTRAINT directus_shares_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_users directus_users_role_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_users
    ADD CONSTRAINT directus_users_role_foreign FOREIGN KEY (role) REFERENCES public.directus_roles(id) ON DELETE SET NULL;


--
-- Name: directus_versions directus_versions_collection_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_versions
    ADD CONSTRAINT directus_versions_collection_foreign FOREIGN KEY (collection) REFERENCES public.directus_collections(collection) ON DELETE CASCADE;


--
-- Name: directus_versions directus_versions_user_created_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_versions
    ADD CONSTRAINT directus_versions_user_created_foreign FOREIGN KEY (user_created) REFERENCES public.directus_users(id) ON DELETE SET NULL;


--
-- Name: directus_versions directus_versions_user_updated_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_versions
    ADD CONSTRAINT directus_versions_user_updated_foreign FOREIGN KEY (user_updated) REFERENCES public.directus_users(id);


--
-- Name: directus_webhooks directus_webhooks_migrated_flow_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.directus_webhooks
    ADD CONSTRAINT directus_webhooks_migrated_flow_foreign FOREIGN KEY (migrated_flow) REFERENCES public.directus_flows(id) ON DELETE SET NULL;


--
-- Name: highlights highlights_profile_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.highlights
    ADD CONSTRAINT highlights_profile_foreign FOREIGN KEY (profile) REFERENCES public.profiles(id);


--
-- Name: languages languages_profile_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.languages
    ADD CONSTRAINT languages_profile_foreign FOREIGN KEY (profile) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_profile_picture_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_profile_picture_foreign FOREIGN KEY (profile_picture) REFERENCES public.directus_files(id) ON DELETE SET NULL;


--
-- Name: resume_tokens resume_tokens_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resume_tokens
    ADD CONSTRAINT "resume_tokens_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: soft_skills soft_skills_profile_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.soft_skills
    ADD CONSTRAINT soft_skills_profile_foreign FOREIGN KEY (profile) REFERENCES public.profiles(id);


--
-- Name: tech_skills tech_skills_category_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tech_skills
    ADD CONSTRAINT tech_skills_category_foreign FOREIGN KEY (category) REFERENCES public.tech_skill_categories(id);


--
-- Name: tech_skills tech_skills_profile_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tech_skills
    ADD CONSTRAINT tech_skills_profile_foreign FOREIGN KEY (profile) REFERENCES public.profiles(id);


--
-- Name: tech_skills tech_skills_tech_type_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tech_skills
    ADD CONSTRAINT tech_skills_tech_type_foreign FOREIGN KEY (tech_type) REFERENCES public.tech_skill_types(id);


--
-- Name: work_experience_achievements work_experience_achievements_work_experience_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_experience_achievements
    ADD CONSTRAINT work_experience_achievements_work_experience_foreign FOREIGN KEY (work_experience) REFERENCES public.work_experiences(id);


--
-- Name: work_experiences work_experiences_logo_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_experiences
    ADD CONSTRAINT work_experiences_logo_foreign FOREIGN KEY (logo) REFERENCES public.directus_files(id) ON DELETE SET NULL;


--
-- Name: work_experiences work_experiences_profile_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_experiences
    ADD CONSTRAINT work_experiences_profile_foreign FOREIGN KEY (profile) REFERENCES public.profiles(id);


--
-- Name: work_highlight_tags work_highlight_tags_highlightId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_highlight_tags
    ADD CONSTRAINT "work_highlight_tags_highlightId_fkey" FOREIGN KEY ("highlightId") REFERENCES public.work_highlights(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_highlights work_highlights_workExperienceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_highlights
    ADD CONSTRAINT "work_highlights_workExperienceId_fkey" FOREIGN KEY ("workExperienceId") REFERENCES public.work_experiences(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_projects work_projects_workExperienceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_projects
    ADD CONSTRAINT "work_projects_workExperienceId_fkey" FOREIGN KEY ("workExperienceId") REFERENCES public.work_experiences(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_technologies work_technologies_workExperienceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_technologies
    ADD CONSTRAINT "work_technologies_workExperienceId_fkey" FOREIGN KEY ("workExperienceId") REFERENCES public.work_experiences(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict hcDVvM0YFNhPBL3v3jmXpTzZOHlaAnCuCnxIkZOTGRhmoBBXhdgSUdbFJk5k7Cg

