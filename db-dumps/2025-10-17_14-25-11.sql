--
-- PostgreSQL database dump
--

\restrict bNyHQhChh3frqcJayRpGIRL0gwFnIKQ2sPk6btO1jGTzoCDZIPt4CufG0PxKikJ

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
-- Name: headlines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.headlines (
    id integer NOT NULL,
    sort integer,
    date_created timestamp with time zone,
    date_updated timestamp with time zone,
    text character varying(255) DEFAULT NULL::character varying NOT NULL,
    profile uuid
);


ALTER TABLE public.headlines OWNER TO postgres;

--
-- Name: headlines_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.headlines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.headlines_id_seq OWNER TO postgres;

--
-- Name: headlines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.headlines_id_seq OWNED BY public.headlines.id;


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
    stackoverflow_profile character varying(255)
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
-- Name: work_experiences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.work_experiences (
    name text NOT NULL,
    location text NOT NULL,
    description text NOT NULL,
    "position" text NOT NULL,
    url text,
    "startDate" text NOT NULL,
    "endDate" text,
    summary text NOT NULL,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    logo uuid,
    profiles uuid NOT NULL
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
-- Name: headlines id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.headlines ALTER COLUMN id SET DEFAULT nextval('public.headlines_id_seq'::regclass);


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
460	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 12:47:02.105+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	headlines	1	http://localhost:8055
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
\.


--
-- Data for Name: directus_collections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_collections (collection, icon, note, display_template, hidden, singleton, translations, archive_field, archive_app_filter, archive_value, unarchive_value, sort_field, accountability, color, item_duplication_fields, sort, "group", collapse, preview_url, versioning) FROM stdin;
languages	\N	\N	{{name}}	f	f	\N	status	t	archived	draft	\N	all	\N	\N	1	profiles	open	\N	f
profiles	\N	\N	{{name}}	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	1	\N	open	\N	f
users	\N	\N	\N	t	f	\N	\N	t	\N	\N	\N	all	\N	\N	2	\N	open	\N	f
work_experiences	\N	\N	{{name}} ({{startDate}}-{{endDate}})	f	f	\N	\N	t	\N	\N	sortOrder	all	\N	\N	3	profiles	open	\N	f
headlines	\N	\N	{{text}}	f	f	\N	\N	t	\N	\N	sort	all	\N	\N	2	profiles	open	\N	f
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
2	work_experiences	id	uuid	\N	\N	\N	\N	t	f	1	full	\N	\N	\N	f	\N	\N	\N
22	work_experiences	profiles	m2o	select-dropdown-m2o	\N	related-values	\N	f	f	2	full	\N	\N	\N	f	\N	\N	\N
11	work_experiences	isActive	\N	\N	\N	\N	\N	f	f	3	full	\N	\N	\N	f	\N	\N	\N
1	work_experiences	name	\N	input	\N	\N	\N	f	f	4	half	\N	\N	\N	f	\N	\N	\N
3	work_experiences	location	\N	input	\N	\N	\N	f	f	5	half	\N	\N	\N	f	\N	\N	\N
4	work_experiences	description	\N	input	\N	\N	\N	f	f	6	half	\N	\N	\N	f	\N	\N	\N
6	work_experiences	url	\N	input	\N	\N	\N	f	f	7	half	\N	\N	\N	f	\N	\N	\N
15	work_experiences	logo	file	file-image	{}	\N	\N	f	f	8	full	\N	\N	\N	f	\N	\N	\N
7	work_experiences	startDate	\N	input	\N	\N	\N	f	f	9	half	\N	\N	\N	f	\N	\N	\N
8	work_experiences	endDate	\N	input	\N	\N	\N	f	f	10	half	\N	\N	\N	f	\N	\N	\N
5	work_experiences	position	\N	input	\N	\N	\N	f	f	11	full	\N	\N	\N	f	\N	\N	\N
9	work_experiences	summary	\N	\N	\N	\N	\N	f	f	12	full	\N	\N	\N	f	\N	\N	\N
12	work_experiences	createdAt	date-created	\N	\N	\N	\N	t	f	13	half	\N	\N	\N	f	\N	\N	\N
13	work_experiences	updatedAt	date-updated,date-created	\N	\N	\N	\N	t	f	14	half	\N	\N	\N	f	\N	\N	\N
10	work_experiences	sortOrder	\N	\N	\N	\N	\N	f	f	15	full	\N	\N	\N	f	\N	\N	\N
30	languages	id	uuid	input	\N	\N	\N	t	t	1	full	\N	\N	\N	f	\N	\N	\N
31	languages	status	\N	select-dropdown	{"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)"}]}	labels	{"showAsDot":true,"choices":[{"text":"$t:published","value":"published","color":"var(--theme--primary)","foreground":"var(--theme--primary)","background":"var(--theme--primary-background)"},{"text":"$t:draft","value":"draft","color":"var(--theme--foreground)","foreground":"var(--theme--foreground)","background":"var(--theme--background-normal)"},{"text":"$t:archived","value":"archived","color":"var(--theme--warning)","foreground":"var(--theme--warning)","background":"var(--theme--warning-background)"}]}	f	f	2	full	\N	\N	\N	f	\N	\N	\N
32	languages	date_created	date-created	datetime	\N	datetime	{"relative":true}	t	t	3	half	\N	\N	\N	f	\N	\N	\N
33	languages	date_updated	date-updated	datetime	\N	datetime	{"relative":true}	t	t	4	half	\N	\N	\N	f	\N	\N	\N
34	languages	name	\N	input	\N	\N	\N	f	f	5	half	\N	\N	\N	f	\N	\N	\N
35	languages	language_code	\N	input	\N	\N	\N	f	f	6	half	\N	2-letter ISO 639 language code	\N	f	\N	\N	\N
36	languages	proficiency	\N	select-radio	{"choices":[{"text":"Native","value":"native"},{"text":"Fluent","value":"fluent"},{"text":"Proficient","value":"proficient"},{"text":"Conversational","value":"conversational"},{"text":"Basic","value":"basic"}]}	\N	\N	f	f	7	full	\N	\N	\N	f	\N	\N	\N
38	languages	profile	m2o	\N	\N	\N	\N	f	f	8	full	\N	\N	\N	f	\N	\N	\N
26	profiles	phone_number	\N	input	\N	\N	\N	f	f	9	half	\N	\N	\N	f	\N	\N	\N
24	profiles	location	\N	input	\N	\N	\N	f	f	10	half	\N	Where you are currently based.	\N	f	\N	\N	\N
17	profiles	id	uuid	input	\N	\N	\N	t	t	1	full	\N	\N	\N	f	\N	\N	\N
18	profiles	date_created	date-created	datetime	\N	datetime	{"relative":true}	t	t	2	half	\N	\N	\N	f	\N	\N	\N
19	profiles	date_updated	date-updated	datetime	\N	datetime	{"relative":true}	t	t	3	half	\N	\N	\N	f	\N	\N	\N
20	profiles	name	\N	input	\N	\N	\N	f	f	4	full	\N	\N	\N	t	\N	\N	\N
21	profiles	title	\N	input	\N	\N	\N	f	f	5	full	\N	Your job title, a phrase describing your profession.	\N	t	\N	\N	\N
40	headlines	id	\N	input	\N	\N	\N	t	t	1	full	\N	\N	\N	f	\N	\N	\N
41	headlines	sort	\N	input	\N	\N	\N	f	t	2	full	\N	\N	\N	f	\N	\N	\N
42	headlines	date_created	date-created	datetime	\N	datetime	{"relative":true}	t	t	3	half	\N	\N	\N	f	\N	\N	\N
43	headlines	date_updated	date-updated	datetime	\N	datetime	{"relative":true}	t	t	4	half	\N	\N	\N	f	\N	\N	\N
45	headlines	text	\N	input	\N	\N	\N	f	f	6	full	\N	\N	\N	f	\N	\N	\N
46	headlines	profile	m2o	\N	\N	\N	\N	f	f	7	full	\N	\N	\N	f	\N	\N	\N
39	profiles	languages	o2m	list-o2m	{"enableSelect":false}	\N	\N	f	f	15	full	\N	\N	\N	f	\N	\N	\N
47	profiles	headlines	o2m	list-o2m	{"enableSelect":false,"template":null}	\N	\N	f	f	16	full	\N	\N	\N	f	\N	\N	\N
23	profiles	work_experiences	o2m	list-o2m	{"enableSelect":false}	\N	\N	f	f	17	full	\N	\N	\N	f	\N	\N	\N
52	profiles	stackoverflow_profile	\N	input	\N	\N	\N	f	f	14	full	\N	\N	\N	f	\N	\N	\N
49	profiles	core_stack	\N	input	\N	\N	\N	f	f	6	full	\N	Short list of your core technology stack that you are most familiar with.	\N	f	\N	\N	\N
48	profiles	subtitle	\N	input	\N	\N	\N	f	f	7	full	\N	A short sentence complementing your work title, giving more insight to your expertise.	\N	f	\N	\N	\N
50	profiles	linkedin_profile	\N	input	\N	\N	\N	f	f	12	full	\N	\N	\N	f	\N	\N	\N
51	profiles	github_profile	\N	input	\N	\N	\N	f	f	13	full	\N	\N	\N	f	\N	\N	\N
27	profiles	email_address	\N	input	\N	\N	\N	f	f	8	half	\N	\N	\N	f	\N	\N	\N
28	profiles	personal_website	\N	input	\N	\N	\N	f	f	11	full	\N	\N	\N	f	\N	\N	\N
\.


--
-- Data for Name: directus_files; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_files (id, storage, filename_disk, filename_download, title, type, folder, uploaded_by, created_on, modified_by, modified_on, charset, filesize, width, height, duration, embed, description, location, tags, metadata, focal_point_x, focal_point_y, tus_id, tus_data, uploaded_on) FROM stdin;
8127127c-d1cf-480e-87ea-5cbfbfc12e36	local	8127127c-d1cf-480e-87ea-5cbfbfc12e36.png	chipta-logo.png	Chipta Logo	image/png	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:31:28.781+00	\N	2025-10-15 15:31:28.796+00	\N	18182	558	270	\N	\N	\N	\N	\N	{}	\N	\N	\N	\N	2025-10-15 15:31:28.795+00
d6beca5c-5fc3-4f31-aa57-fc1a8209a97c	local	d6beca5c-5fc3-4f31-aa57-fc1a8209a97c.png	tender-it-logo.png	Tender It Logo	image/png	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:31:52.439+00	\N	2025-10-15 15:31:52.448+00	\N	24609	558	270	\N	\N	\N	\N	\N	{}	\N	\N	\N	\N	2025-10-15 15:31:52.448+00
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
4	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	languages	\N	\N	{"tabular":{"page":1}}	\N	\N	\N	bookmark	\N
1	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	work_experiences	\N	\N	{"tabular":{"fields":["id","isActive","name","location","description","startDate"],"page":1}}	{"tabular":{"widths":{"id":117.60000610351562,"isActive":105.4000244140625,"name":149.79998779296875,"location":152.79998779296875,"description":191.39990234375,"startDate":124.5999755859375}}}	\N	\N	bookmark	\N
5	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	headlines	\N	\N	{"tabular":{"page":1}}	\N	\N	\N	bookmark	\N
3	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	profiles	\N	\N	{"tabular":{"page":1,"fields":["name","title"]}}	{"tabular":{"widths":{"name":160,"title":242.79998779296875}}}	\N	\N	bookmark	\N
\.


--
-- Data for Name: directus_relations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_relations (id, many_collection, many_field, one_collection, one_field, one_collection_field, one_allowed_collections, junction_field, sort_field, one_deselect_action) FROM stdin;
1	work_experiences	logo	directus_files	\N	\N	\N	\N	\N	nullify
2	work_experiences	profiles	profiles	work_experiences	\N	\N	\N	\N	nullify
3	languages	profile	profiles	languages	\N	\N	\N	\N	nullify
4	headlines	profile	profiles	headlines	\N	\N	\N	\N	nullify
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
439	454	directus_collections	languages	{"collection":"languages","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":"status","archive_app_filter":true,"archive_value":"archived","unarchive_value":"draft","sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"profiles"}	\N	\N
441	456	directus_collections	headlines	{"collection":"headlines","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":"profiles"}	\N	\N
443	458	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}}-{{endDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":"profiles"}	\N	\N
444	459	directus_collections	headlines	{"collection":"headlines","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sort","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":"profiles","collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}}"}	\N	\N
446	461	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T12:47:02.102Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","linkedin_url":"https://www.linkedin.com/in/rik-wanders-software/","work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"],"languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"headlines":[1]}	{"date_updated":"2025-10-17T12:47:02.102Z"}	\N	\N
445	460	headlines	1	{"name":"Full Stack Developer","text":"Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"name":"Full Stack Developer","text":"Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	446	\N
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
542	559	directus_fields	52	{"id":52,"collection":"profiles","field":"stackoverflow_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"stackoverflow_profile","sort":14,"group":null}	\N	\N
543	560	directus_fields	39	{"id":39,"collection":"profiles","field":"languages","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"languages","sort":15,"group":null}	\N	\N
544	561	directus_fields	47	{"id":47,"collection":"profiles","field":"headlines","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false,"template":null},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":16,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"headlines","sort":16,"group":null}	\N	\N
545	562	directus_fields	23	{"id":23,"collection":"profiles","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":17,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"work_experiences","sort":17,"group":null}	\N	\N
546	563	profiles	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-17T13:44:41.829Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","subtitle":"Building scalable web applications for remote teams","core_stack":"Python • Node.js • CI/CD • DevOps","linkedin_profile":"https://www.linkedin.com/in/rik-wanders-software","github_profile":"https://github.com/gitaarik","stackoverflow_profile":"https://stackoverflow.com/users/1248175/gitaarik","languages":["7024cec2-289e-44e5-a4e8-721805a151a0","b636a780-6a9f-4342-adfa-eed183447a17"],"headlines":[1],"work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"]}	{"stackoverflow_profile":"https://stackoverflow.com/users/1248175/gitaarik","date_updated":"2025-10-17T13:44:41.829Z"}	\N	\N
547	564	directus_fields	52	{"id":52,"collection":"profiles","field":"stackoverflow_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"stackoverflow_profile","width":"full"}	\N	\N
548	565	directus_fields	50	{"id":50,"collection":"profiles","field":"linkedin_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"linkedin_profile","width":"full"}	\N	\N
549	566	directus_fields	51	{"id":51,"collection":"profiles","field":"github_profile","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"github_profile","width":"full"}	\N	\N
550	567	directus_fields	28	{"id":28,"collection":"profiles","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profiles","field":"personal_website","width":"full"}	\N	\N
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
DWozichZ_vucuhsuFqVp8FVLoZozXZZURbF6wcWk8q9bpmDM6BXhdrT3dlSdPkIO	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-17 14:05:07.802+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	\N	http://localhost:8055	Yo0FRlvwjMsTxNv_1tRAWQv6Q-oHS9K-4mGNFJvCfFra7i6qpzluNN6RxvTUgSLI
Yo0FRlvwjMsTxNv_1tRAWQv6Q-oHS9K-4mGNFJvCfFra7i6qpzluNN6RxvTUgSLI	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-18 14:04:57.802+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	\N	http://localhost:8055	\N
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
\.


--
-- Data for Name: directus_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_users (id, first_name, last_name, email, password, location, title, description, tags, avatar, language, tfa_secret, status, role, token, last_access, last_page, provider, external_identifier, auth_data, email_notifications, appearance, theme_dark, theme_light, theme_light_overrides, theme_dark_overrides, text_direction) FROM stdin;
157238bb-6930-4f26-be9c-8b31a9e11ab8	Admin	User	rik@rikwanders.tech	$argon2id$v=19$m=65536,t=3,p=4$MF3ELPmT2vdFmjd2LhqYZA$HmKet+cTxhqHbyL5VQcR2+TrMbCYSiz7REFnd6c6FXY	\N	\N	\N	\N	\N	\N	\N	active	17756a67-2cbc-42b5-bb7c-906f79444fb3	\N	2025-10-17 14:04:57.805+00	/content/profiles/0eeb942b-e35a-44e8-a37d-52b9cdb24309	default	\N	\N	t	\N	\N	\N	\N	\N	auto
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
-- Data for Name: headlines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.headlines (id, sort, date_created, date_updated, text, profile) FROM stdin;
1	\N	2025-10-17 12:47:02.104+00	\N	Full Stack Developer 12+ years expertise in Python, Django, Node.js, React, CI/CD, DevOps, UX, AI	0eeb942b-e35a-44e8-a37d-52b9cdb24309
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

COPY public.profiles (id, date_created, date_updated, name, title, location, phone_number, email_address, personal_website, subtitle, core_stack, linkedin_profile, github_profile, stackoverflow_profile) FROM stdin;
0eeb942b-e35a-44e8-a37d-52b9cdb24309	2025-10-15 16:51:41.394+00	2025-10-17 13:44:41.829+00	Rik Wanders	Senior Full Stack Developer	Ronda, Spain	+31649118511	rik@rikwanders.tech	https://www.rikwanders.tech/	Building scalable web applications for remote teams	Python • Node.js • CI/CD • DevOps	https://www.linkedin.com/in/rik-wanders-software	https://github.com/gitaarik	https://stackoverflow.com/users/1248175/gitaarik
\.


--
-- Data for Name: resume_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.resume_tokens (token, name, description, "resumeType", "expiresAt", "viewCount", "maxViews", "isActive", "createdBy", "createdAt", "updatedAt", id) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (email, password, "firstName", "lastName", "isEmailVerified", "emailVerifyToken", "passwordResetToken", "passwordResetExpiry", "createdAt", "updatedAt", role, id) FROM stdin;
\.


--
-- Data for Name: work_experiences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.work_experiences (name, location, description, "position", url, "startDate", "endDate", summary, "sortOrder", "isActive", "createdAt", "updatedAt", id, logo, profiles) FROM stdin;
Tender-it	Amsterdam	Tender platform	Lead Developer	\N	2014	2017	Was cool	2	t	2025-10-22 12:00:00	2025-10-15 17:00:38.437	f044625e-b180-4603-b03a-42a5a397403a	d6beca5c-5fc3-4f31-aa57-fc1a8209a97c	0eeb942b-e35a-44e8-a37d-52b9cdb24309
Chipta	Amsterdam	Ticketing company	Lead Developer	https://chipta.com/en/	2017	2024	Was fun	1	t	2025-10-15 15:24:10.556	2025-10-15 17:00:44.19	a37c89e0-2b6d-44e1-911a-c1399611562a	8127127c-d1cf-480e-87ea-5cbfbfc12e36	0eeb942b-e35a-44e8-a37d-52b9cdb24309
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

SELECT pg_catalog.setval('public.directus_activity_id_seq', 567, true);


--
-- Name: directus_fields_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_fields_id_seq', 52, true);


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

SELECT pg_catalog.setval('public.directus_presets_id_seq', 5, true);


--
-- Name: directus_relations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_relations_id_seq', 4, true);


--
-- Name: directus_revisions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_revisions_id_seq', 550, true);


--
-- Name: directus_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_settings_id_seq', 1, true);


--
-- Name: directus_webhooks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_webhooks_id_seq', 1, false);


--
-- Name: headlines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.headlines_id_seq', 1, true);


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
-- Name: headlines headlines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.headlines
    ADD CONSTRAINT headlines_pkey PRIMARY KEY (id);


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
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


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
-- Name: headlines headlines_profile_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.headlines
    ADD CONSTRAINT headlines_profile_foreign FOREIGN KEY (profile) REFERENCES public.profiles(id);


--
-- Name: languages languages_profile_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.languages
    ADD CONSTRAINT languages_profile_foreign FOREIGN KEY (profile) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: resume_tokens resume_tokens_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resume_tokens
    ADD CONSTRAINT "resume_tokens_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: work_experiences work_experiences_logo_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_experiences
    ADD CONSTRAINT work_experiences_logo_foreign FOREIGN KEY (logo) REFERENCES public.directus_files(id) ON DELETE SET NULL;


--
-- Name: work_experiences work_experiences_profile_foreign; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.work_experiences
    ADD CONSTRAINT work_experiences_profile_foreign FOREIGN KEY (profiles) REFERENCES public.profiles(id);


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

\unrestrict bNyHQhChh3frqcJayRpGIRL0gwFnIKQ2sPk6btO1jGTzoCDZIPt4CufG0PxKikJ

