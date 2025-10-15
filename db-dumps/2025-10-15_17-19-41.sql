--
-- PostgreSQL database dump
--

\restrict NErH2wyOw80G7f17ayV9rsu36kyMqSoMwZaO75YkXLDs1U25wMnzzQkylNS8ofB

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
-- Name: profile; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.profile (
    id uuid NOT NULL,
    date_created timestamp with time zone,
    date_updated timestamp with time zone,
    name character varying(255),
    title character varying(255),
    location character varying(255),
    languages character varying(255),
    phone_number character varying(255),
    email_address character varying(255),
    personal_website character varying(255),
    linkedin_url character varying(255)
);


ALTER TABLE public.profile OWNER TO postgres;

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
    profile uuid NOT NULL
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
1	login	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 11:36:02.256+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_users	157238bb-6930-4f26-be9c-8b31a9e11ab8	http://localhost:8055
2	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 11:37:08.622+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_settings	1	http://localhost:8055
3	login	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 14:45:01.98+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_users	157238bb-6930-4f26-be9c-8b31a9e11ab8	http://localhost:8055
4	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 14:46:17.276+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
5	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 14:46:25.881+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
6	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 14:46:27.503+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
7	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 14:46:38.366+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
8	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 14:46:45.625+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
9	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 14:47:13.748+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	http://localhost:8055
10	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 14:55:14.381+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	http://localhost:8055
11	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 14:55:21.485+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	http://localhost:8055
12	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:22.898+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
13	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:22.91+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
14	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:22.915+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
15	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:22.921+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
16	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:22.927+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
17	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:22.931+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
18	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:22.936+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
19	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:22.941+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
20	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:22.946+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
21	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:22.95+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
22	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:22.954+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
23	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:22.959+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
24	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:22.963+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
25	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:22.967+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	14	http://localhost:8055
26	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:25.97+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
27	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:38.509+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
28	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:52.935+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
29	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:52.944+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
30	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:52.949+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
31	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:52.955+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
32	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:52.961+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
33	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:52.965+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
34	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:52.97+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
35	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:52.976+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
36	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:52.98+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
37	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:52.985+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
38	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:52.991+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
39	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:52.995+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
40	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:53+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
41	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:53.005+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	14	http://localhost:8055
42	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:56.074+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
43	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:13:58.411+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
44	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:05.087+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
45	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:10.54+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
46	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:16.8+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
47	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:21.778+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
48	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:36.773+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
49	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:36.778+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
50	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:36.782+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
51	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:36.788+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
52	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:36.794+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
53	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:36.798+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
54	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:36.803+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
55	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:36.807+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
56	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:36.812+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
57	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:36.815+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
58	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:36.82+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
59	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:36.824+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
60	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:36.828+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
61	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:36.833+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	14	http://localhost:8055
62	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:40.913+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
63	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:40.917+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
64	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:40.924+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
65	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:40.929+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
66	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:40.933+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
67	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:40.938+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
68	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:40.944+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
69	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:40.948+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
70	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:40.952+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
71	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:40.956+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
72	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:40.96+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
73	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:40.964+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
74	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:40.968+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
75	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:40.973+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	14	http://localhost:8055
76	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:47.129+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
77	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:47.134+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
78	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:47.141+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
79	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:47.145+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
80	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:47.149+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
81	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:47.154+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
82	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:47.16+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
83	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:47.165+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
84	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:47.17+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
85	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:47.175+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
86	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:47.179+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
87	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:47.184+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
88	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:47.189+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
89	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:47.195+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	14	http://localhost:8055
90	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:49.789+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
91	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:49.838+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
92	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:49.847+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
93	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:49.855+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
94	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:49.862+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
95	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:49.866+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
96	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:49.871+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
97	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:49.874+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
98	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:49.88+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
99	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:49.883+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
100	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:49.887+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
101	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:49.891+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
102	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:49.895+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	14	http://localhost:8055
103	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:49.898+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
104	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:55.196+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
105	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:55.245+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
106	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:55.254+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
107	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:55.26+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
108	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:55.264+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
109	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:55.268+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
110	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:55.272+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
111	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:55.277+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
112	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:55.281+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
113	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:55.286+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
114	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:55.291+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
115	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:55.296+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
116	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:55.299+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	14	http://localhost:8055
117	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:14:55.304+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
118	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:07.88+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
119	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:11.714+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
120	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:17.441+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
121	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:21.642+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
122	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:29.013+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
123	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:29.059+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
124	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:29.064+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
125	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:29.071+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
126	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:29.077+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
127	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:29.082+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
128	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:29.086+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
129	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:29.092+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
130	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:29.098+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
131	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:29.105+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
132	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:29.111+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
133	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:29.117+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
134	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:29.122+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	14	http://localhost:8055
135	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:29.128+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
136	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:37.914+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
137	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:37.962+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
138	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:37.966+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
139	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:37.972+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
140	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:37.976+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
141	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:37.981+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
142	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:37.985+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	14	http://localhost:8055
143	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:37.99+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
144	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:37.997+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
145	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:38.001+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
146	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:38.006+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
147	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:38.01+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
148	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:38.014+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
149	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:15:38.018+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
150	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:16:04.963+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
151	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:16:07.137+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
152	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:16:23.379+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
153	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:16:32.789+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
154	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:16:42.459+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
155	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:23:32.179+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
156	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:24:08.191+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
157	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:24:10.558+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	http://localhost:8055
158	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:24:58.931+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	http://localhost:8055
159	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:27:33.881+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
160	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:29:14.49+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	14	http://localhost:8055
161	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:29:55.827+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
162	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:02.831+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
163	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:02.837+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
164	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:02.841+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
165	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:02.849+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
166	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:02.854+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
167	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:02.862+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
168	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:02.868+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
169	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:02.873+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
170	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:02.88+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
171	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:02.884+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
172	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:02.887+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
173	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:02.891+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
174	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:02.898+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
175	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:02.904+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
176	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:09.201+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
177	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:09.205+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
178	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:09.212+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
179	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:09.217+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
180	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:09.222+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
181	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:09.227+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
182	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:09.233+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
183	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:09.237+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
184	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:09.241+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
185	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:09.247+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
186	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:09.252+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
187	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:09.256+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
188	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:09.265+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
189	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:09.27+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
190	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:11.416+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
191	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:11.461+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
192	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:11.464+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
193	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:11.468+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
194	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:11.473+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
195	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:11.479+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
196	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:11.483+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
197	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:11.487+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
198	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:11.493+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
199	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:11.501+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
200	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:11.506+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
201	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:11.511+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
202	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:11.516+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
203	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:11.521+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
204	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:14.219+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
205	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:14.269+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
206	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:14.279+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
207	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:14.285+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
208	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:14.288+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
209	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:14.292+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
210	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:14.299+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
211	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:14.302+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
212	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:14.305+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
213	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:14.312+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
214	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:14.317+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
215	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:14.321+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
216	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:14.325+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
217	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:14.331+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
218	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:16.417+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
219	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:16.421+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
220	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:16.425+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
221	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:16.43+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
222	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:16.435+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
223	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:16.439+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
224	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:16.443+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
225	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:16.447+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
226	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:16.451+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
227	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:16.455+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
228	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:16.46+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
229	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:16.464+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
230	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:16.468+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
231	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:16.472+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
232	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:49.077+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
233	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:49.082+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
234	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:49.088+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
235	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:49.092+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
236	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:49.097+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
237	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:49.102+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
238	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:49.105+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
239	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:49.109+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
240	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:49.114+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
241	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:49.119+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
242	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:49.122+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
243	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:49.128+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
244	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:49.131+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
245	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:30:49.137+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
246	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:31:28.782+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_files	8127127c-d1cf-480e-87ea-5cbfbfc12e36	http://localhost:8055
247	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:31:31.42+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	http://localhost:8055
248	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:31:52.441+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_files	d6beca5c-5fc3-4f31-aa57-fc1a8209a97c	http://localhost:8055
249	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:31:53.628+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	http://localhost:8055
250	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 15:36:18.76+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	16	http://localhost:8055
251	login	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:20:39.989+00	172.18.0.5	node	directus_users	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N
252	login	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:20:44.39+00	172.18.0.5	node	directus_users	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N
253	login	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:20:49.723+00	172.18.0.5	node	directus_users	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N
254	login	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:20:54.475+00	172.18.0.5	node	directus_users	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N
255	login	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:21:10.34+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_users	157238bb-6930-4f26-be9c-8b31a9e11ab8	http://localhost:8055
256	login	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:21:15.528+00	172.18.0.5	node	directus_users	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N
257	login	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:29:05.396+00	172.18.0.5	node	directus_users	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N
258	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:30:07.824+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	16	http://localhost:8055
259	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:30:20.056+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
260	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:49:59.324+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
261	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:49:59.33+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
262	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:49:59.334+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
263	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:49:59.337+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profile	http://localhost:8055
264	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:50:48.977+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
265	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:51:10.499+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
266	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:51:13.648+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
267	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:51:15.587+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
268	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:51:22.329+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
269	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:51:22.332+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profile	http://localhost:8055
270	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:51:22.338+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
271	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:51:24.179+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profile	http://localhost:8055
272	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:51:24.187+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
273	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:51:24.193+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	users	http://localhost:8055
274	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:51:41.395+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profile	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
275	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:53:39.537+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	22	http://localhost:8055
276	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:53:39.633+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
277	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:56:14.213+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profile	c08a1061-4520-40b9-8bcc-d7e54c59811b	http://localhost:8055
278	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:56:20.158+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profile	c08a1061-4520-40b9-8bcc-d7e54c59811b	http://localhost:8055
279	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:56:34.931+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	655604b5-39ff-4c7c-916f-52f1b5ffe6f1	http://localhost:8055
280	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 16:59:59.789+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	22	http://localhost:8055
281	delete	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:16.927+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	655604b5-39ff-4c7c-916f-52f1b5ffe6f1	http://localhost:8055
282	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:21.566+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
283	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:21.572+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
284	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:21.576+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	22	http://localhost:8055
285	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:21.585+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
286	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:21.59+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
287	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:21.595+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
288	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:21.6+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
289	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:21.603+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
290	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:21.606+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
291	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:21.614+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
292	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:21.618+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
293	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:21.621+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
294	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:21.625+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
295	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:21.632+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
296	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:21.636+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
297	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:27.486+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	2	http://localhost:8055
298	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:27.49+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	22	http://localhost:8055
299	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:27.494+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	11	http://localhost:8055
300	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:27.501+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	1	http://localhost:8055
301	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:27.505+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	3	http://localhost:8055
302	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:27.509+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	4	http://localhost:8055
303	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:27.515+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	6	http://localhost:8055
304	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:27.519+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	15	http://localhost:8055
305	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:27.522+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	7	http://localhost:8055
306	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:27.528+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	8	http://localhost:8055
307	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:27.532+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	5	http://localhost:8055
308	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:27.536+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	9	http://localhost:8055
309	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:27.54+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	12	http://localhost:8055
310	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:27.546+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	13	http://localhost:8055
311	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:27.552+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	10	http://localhost:8055
312	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:38.438+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	http://localhost:8055
313	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:00:44.191+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	http://localhost:8055
314	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:01:36.319+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	profile	http://localhost:8055
315	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:02:27.905+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
316	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:02:57.329+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profile	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
317	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:03:41.926+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
318	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:03:58.184+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
319	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:10:33.765+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	25	http://localhost:8055
320	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:10:37.964+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	25	http://localhost:8055
321	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:10:51.556+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
322	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:10:54.307+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
323	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:06.595+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
324	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:09.725+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
325	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:11.944+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
326	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:11.95+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
327	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:11.955+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
328	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:11.96+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
329	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:11.965+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
330	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:11.972+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
331	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:11.976+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
332	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:11.98+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
333	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:11.984+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	25	http://localhost:8055
334	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:11.988+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
335	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:13.422+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
336	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:13.425+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
337	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:13.43+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
338	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:13.436+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
339	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:13.439+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
340	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:13.444+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
341	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:13.45+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
342	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:13.455+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
343	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:13.459+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
344	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:11:13.464+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	25	http://localhost:8055
345	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:12:01.784+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
346	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:12:04.219+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
347	create	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:12:20.83+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	29	http://localhost:8055
348	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:12:23.503+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	29	http://localhost:8055
349	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:15:22.031+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	profile	0eeb942b-e35a-44e8-a37d-52b9cdb24309	http://localhost:8055
350	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:15:57.723+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
351	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:16:21.07+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
352	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:16:32.593+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	17	http://localhost:8055
353	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:16:32.6+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	18	http://localhost:8055
354	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:16:32.608+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	19	http://localhost:8055
355	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:16:32.614+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	20	http://localhost:8055
356	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:16:32.621+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	21	http://localhost:8055
357	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:16:32.627+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	27	http://localhost:8055
358	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:16:32.637+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	26	http://localhost:8055
359	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:16:32.643+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	24	http://localhost:8055
360	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:16:32.649+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	25	http://localhost:8055
361	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:16:32.656+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	28	http://localhost:8055
362	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:16:32.66+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	29	http://localhost:8055
363	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:16:32.667+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
364	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:18:02.436+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_fields	23	http://localhost:8055
365	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:19:09.626+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
366	update	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:19:20.461+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	directus_collections	work_experiences	http://localhost:8055
\.


--
-- Data for Name: directus_collections; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_collections (collection, icon, note, display_template, hidden, singleton, translations, archive_field, archive_app_filter, archive_value, unarchive_value, sort_field, accountability, color, item_duplication_fields, sort, "group", collapse, preview_url, versioning) FROM stdin;
users	\N	\N	\N	t	f	\N	\N	t	\N	\N	\N	all	\N	\N	3	\N	open	\N	f
profile	\N	\N	{{name}}	f	f	\N	\N	t	\N	\N	\N	all	\N	\N	1	\N	open	\N	f
work_experiences	\N	\N	{{name}} ({{startDate}})	f	f	\N	\N	t	\N	\N	sortOrder	all	\N	\N	2	\N	open	\N	f
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
17	profile	id	uuid	input	\N	\N	\N	t	t	1	full	\N	\N	\N	f	\N	\N	\N
18	profile	date_created	date-created	datetime	\N	datetime	{"relative":true}	t	t	2	half	\N	\N	\N	f	\N	\N	\N
19	profile	date_updated	date-updated	datetime	\N	datetime	{"relative":true}	t	t	3	half	\N	\N	\N	f	\N	\N	\N
20	profile	name	\N	input	\N	\N	\N	f	f	4	half	\N	\N	\N	t	\N	\N	\N
2	work_experiences	id	uuid	\N	\N	\N	\N	t	f	1	full	\N	\N	\N	f	\N	\N	\N
22	work_experiences	profile	m2o	select-dropdown-m2o	\N	related-values	\N	f	f	2	full	\N	\N	\N	f	\N	\N	\N
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
21	profile	title	\N	input	\N	\N	\N	f	f	5	half	\N	\N	\N	t	\N	\N	\N
27	profile	email_address	\N	input	\N	\N	\N	f	f	6	half	\N	\N	\N	f	\N	\N	\N
26	profile	phone_number	\N	input	\N	\N	\N	f	f	7	half	\N	\N	\N	f	\N	\N	\N
24	profile	location	\N	input	\N	\N	\N	f	f	8	half	\N	\N	\N	f	\N	\N	\N
25	profile	languages	\N	input	\N	\N	\N	f	f	9	half	\N	\N	\N	f	\N	\N	\N
28	profile	personal_website	\N	input	\N	\N	\N	f	f	10	half	\N	\N	\N	f	\N	\N	\N
29	profile	linkedin_url	\N	input	\N	\N	\N	f	f	11	half	\N	\N	\N	f	\N	\N	\N
23	profile	work_experiences	o2m	list-o2m	{"enableSelect":false}	\N	\N	f	f	12	full	\N	\N	\N	f	\N	\N	\N
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
1	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	work_experiences	\N	\N	{"tabular":{"fields":["id","isActive","name","location","description","startDate"],"page":1}}	{"tabular":{"widths":{"id":117.60000610351562,"isActive":105.4000244140625,"name":149.79998779296875,"location":152.79998779296875,"description":191.39990234375,"startDate":124.5999755859375}}}	\N	\N	bookmark	\N
3	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	profile	\N	\N	{"tabular":{"page":1,"fields":["name","title"]}}	{"tabular":{"widths":{"name":160,"title":242.79998779296875}}}	\N	\N	bookmark	\N
2	\N	157238bb-6930-4f26-be9c-8b31a9e11ab8	\N	users	\N	\N	{"tabular":{"page":1}}	\N	\N	\N	bookmark	\N
\.


--
-- Data for Name: directus_relations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_relations (id, many_collection, many_field, one_collection, one_field, one_collection_field, one_allowed_collections, junction_field, sort_field, one_deselect_action) FROM stdin;
1	work_experiences	logo	directus_files	\N	\N	\N	\N	\N	nullify
2	work_experiences	profile	profile	work_experiences	\N	\N	\N	\N	nullify
\.


--
-- Data for Name: directus_revisions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_revisions (id, activity, collection, item, data, delta, parent, version) FROM stdin;
1	2	directus_settings	1	{"id":1,"project_name":"Directus","project_url":null,"project_color":"#6644FF","project_logo":null,"public_foreground":null,"public_background":null,"public_note":null,"auth_login_attempts":25,"auth_password_policy":null,"storage_asset_transform":"all","storage_asset_presets":null,"custom_css":null,"storage_default_folder":null,"basemaps":null,"mapbox_key":null,"module_bar":null,"project_descriptor":null,"default_language":"en-US","custom_aspect_ratios":null,"public_favicon":null,"default_appearance":"auto","default_theme_light":null,"theme_light_overrides":null,"default_theme_dark":null,"theme_dark_overrides":null,"report_error_url":null,"report_bug_url":null,"report_feature_url":null,"public_registration":false,"public_registration_verify_email":true,"public_registration_role":null,"public_registration_email_filter":null,"visual_editor_urls":null,"accepted_terms":true,"project_id":"0199e7a6-9d13-72dc-af68-381958575f19","mcp_enabled":false,"mcp_allow_deletes":false,"mcp_prompts_collection":null,"mcp_system_prompt_enabled":true,"mcp_system_prompt":null}	{"accepted_terms":true}	\N	\N
2	4	directus_collections	users	{"collection":"users"}	{"collection":"users"}	\N	\N
3	5	directus_collections	work_experiences	{"collection":"work_experiences"}	{"collection":"work_experiences"}	\N	\N
4	6	directus_fields	1	{"special":null,"collection":"work_experiences","field":"name"}	{"special":null,"collection":"work_experiences","field":"name"}	\N	\N
5	7	directus_fields	2	{"special":["uuid"],"collection":"work_experiences","field":"id"}	{"special":["uuid"],"collection":"work_experiences","field":"id"}	\N	\N
6	8	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":null,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","readonly":true}	\N	\N
7	9	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	{"name":"wajo dannn","location":"wajo","description":"wajo","position":"wajo","url":"wajo","startDate":"wajowajo","endDate":"wajo","summary":"wajo","createdAt":"2025-10-22T12:00:00","updatedAt":"2025-10-15T12:00:00"}	{"name":"wajo dannn","location":"wajo","description":"wajo","position":"wajo","url":"wajo","startDate":"wajowajo","endDate":"wajo","summary":"wajo","createdAt":"2025-10-22T12:00:00","updatedAt":"2025-10-15T12:00:00"}	\N	\N
8	10	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	{"name":"wajo22 dannn222","location":"wajo hola jatzer","description":"wajo","position":"wajo","url":"wajo","startDate":"wajowajo","endDate":"wajo","summary":"wajo","sortOrder":0,"isActive":true,"createdAt":"2025-10-22T12:00:00","updatedAt":"2025-10-15T12:00:00","id":"f044625e-b180-4603-b03a-42a5a397403a","logo":null}	{"name":"wajo22 dannn222","location":"wajo hola jatzer"}	\N	\N
9	11	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	{"name":"wajo22 dannn222","location":"wajo hola jatzer","description":"wajozzz","position":"wajo","url":"wajo","startDate":"wajowajo","endDate":"wajo","summary":"wajo","sortOrder":0,"isActive":true,"createdAt":"2025-10-22T12:00:00","updatedAt":"2025-10-15T12:00:00","id":"f044625e-b180-4603-b03a-42a5a397403a","logo":null}	{"description":"wajozzz"}	\N	\N
10	12	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
11	13	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":2,"group":null}	\N	\N
12	14	directus_fields	3	{"sort":3,"group":null,"collection":"work_experiences","field":"location"}	{"sort":3,"group":null,"collection":"work_experiences","field":"location"}	\N	\N
13	15	directus_fields	4	{"sort":4,"group":null,"collection":"work_experiences","field":"description"}	{"sort":4,"group":null,"collection":"work_experiences","field":"description"}	\N	\N
14	16	directus_fields	5	{"sort":5,"group":null,"collection":"work_experiences","field":"position"}	{"sort":5,"group":null,"collection":"work_experiences","field":"position"}	\N	\N
15	17	directus_fields	6	{"sort":6,"group":null,"collection":"work_experiences","field":"url"}	{"sort":6,"group":null,"collection":"work_experiences","field":"url"}	\N	\N
16	18	directus_fields	7	{"sort":7,"group":null,"collection":"work_experiences","field":"startDate"}	{"sort":7,"group":null,"collection":"work_experiences","field":"startDate"}	\N	\N
17	19	directus_fields	8	{"sort":8,"group":null,"collection":"work_experiences","field":"endDate"}	{"sort":8,"group":null,"collection":"work_experiences","field":"endDate"}	\N	\N
18	20	directus_fields	9	{"sort":9,"group":null,"collection":"work_experiences","field":"summary"}	{"sort":9,"group":null,"collection":"work_experiences","field":"summary"}	\N	\N
19	21	directus_fields	10	{"sort":10,"group":null,"collection":"work_experiences","field":"sortOrder"}	{"sort":10,"group":null,"collection":"work_experiences","field":"sortOrder"}	\N	\N
20	22	directus_fields	11	{"sort":11,"group":null,"collection":"work_experiences","field":"isActive"}	{"sort":11,"group":null,"collection":"work_experiences","field":"isActive"}	\N	\N
21	23	directus_fields	12	{"sort":12,"group":null,"collection":"work_experiences","field":"createdAt"}	{"sort":12,"group":null,"collection":"work_experiences","field":"createdAt"}	\N	\N
22	24	directus_fields	13	{"sort":13,"group":null,"collection":"work_experiences","field":"updatedAt"}	{"sort":13,"group":null,"collection":"work_experiences","field":"updatedAt"}	\N	\N
23	25	directus_fields	14	{"sort":14,"group":null,"collection":"work_experiences","field":"logo"}	{"sort":14,"group":null,"collection":"work_experiences","field":"logo"}	\N	\N
24	26	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","width":"half"}	\N	\N
25	27	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","width":"half"}	\N	\N
26	28	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
27	29	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":2,"group":null}	\N	\N
28	30	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":3,"group":null}	\N	\N
29	31	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":4,"group":null}	\N	\N
30	32	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":5,"group":null}	\N	\N
31	33	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":6,"group":null}	\N	\N
32	34	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":7,"group":null}	\N	\N
33	35	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":8,"group":null}	\N	\N
34	36	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":9,"group":null}	\N	\N
35	37	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":10,"group":null}	\N	\N
36	38	directus_fields	11	{"id":11,"collection":"work_experiences","field":"isActive","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"isActive","sort":11,"group":null}	\N	\N
37	39	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":12,"group":null}	\N	\N
38	40	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":13,"group":null}	\N	\N
39	41	directus_fields	14	{"id":14,"collection":"work_experiences","field":"logo","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":14,"group":null}	\N	\N
40	42	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","width":"half"}	\N	\N
41	43	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","width":"half"}	\N	\N
42	44	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","interface":"input"}	\N	\N
43	45	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","interface":"input"}	\N	\N
44	46	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","interface":"input"}	\N	\N
45	47	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","interface":"input"}	\N	\N
46	48	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
47	49	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":2,"group":null}	\N	\N
48	50	directus_fields	11	{"id":11,"collection":"work_experiences","field":"isActive","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"isActive","sort":3,"group":null}	\N	\N
49	51	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":4,"group":null}	\N	\N
50	52	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":5,"group":null}	\N	\N
51	53	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":6,"group":null}	\N	\N
52	54	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":7,"group":null}	\N	\N
53	55	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":8,"group":null}	\N	\N
54	56	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":9,"group":null}	\N	\N
55	57	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":10,"group":null}	\N	\N
56	58	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":11,"group":null}	\N	\N
57	59	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":12,"group":null}	\N	\N
58	60	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":13,"group":null}	\N	\N
59	61	directus_fields	14	{"id":14,"collection":"work_experiences","field":"logo","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":14,"group":null}	\N	\N
60	62	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
61	63	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":2,"group":null}	\N	\N
62	64	directus_fields	11	{"id":11,"collection":"work_experiences","field":"isActive","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"isActive","sort":3,"group":null}	\N	\N
63	65	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":4,"group":null}	\N	\N
64	66	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
65	67	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
66	68	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":7,"group":null}	\N	\N
67	69	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":8,"group":null}	\N	\N
68	70	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":9,"group":null}	\N	\N
69	71	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":10,"group":null}	\N	\N
70	72	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":11,"group":null}	\N	\N
71	73	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":12,"group":null}	\N	\N
72	74	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":13,"group":null}	\N	\N
73	75	directus_fields	14	{"id":14,"collection":"work_experiences","field":"logo","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":14,"group":null}	\N	\N
74	76	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
75	77	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":2,"group":null}	\N	\N
76	78	directus_fields	11	{"id":11,"collection":"work_experiences","field":"isActive","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"isActive","sort":3,"group":null}	\N	\N
77	79	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":4,"group":null}	\N	\N
78	80	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":5,"group":null}	\N	\N
79	81	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":6,"group":null}	\N	\N
80	82	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":7,"group":null}	\N	\N
81	83	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":8,"group":null}	\N	\N
82	84	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":9,"group":null}	\N	\N
83	85	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":10,"group":null}	\N	\N
84	86	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":11,"group":null}	\N	\N
85	87	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":12,"group":null}	\N	\N
86	88	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":13,"group":null}	\N	\N
87	89	directus_fields	14	{"id":14,"collection":"work_experiences","field":"logo","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":14,"group":null}	\N	\N
88	90	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
89	91	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":2,"group":null}	\N	\N
90	92	directus_fields	11	{"id":11,"collection":"work_experiences","field":"isActive","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"isActive","sort":3,"group":null}	\N	\N
91	93	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":4,"group":null}	\N	\N
92	94	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":5,"group":null}	\N	\N
93	95	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":6,"group":null}	\N	\N
94	96	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":7,"group":null}	\N	\N
95	97	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":8,"group":null}	\N	\N
96	98	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":9,"group":null}	\N	\N
97	99	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":10,"group":null}	\N	\N
98	100	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":11,"group":null}	\N	\N
99	101	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":12,"group":null}	\N	\N
100	102	directus_fields	14	{"id":14,"collection":"work_experiences","field":"logo","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":13,"group":null}	\N	\N
101	103	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":14,"group":null}	\N	\N
102	104	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
103	105	directus_fields	11	{"id":11,"collection":"work_experiences","field":"isActive","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"isActive","sort":2,"group":null}	\N	\N
104	106	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":3,"group":null}	\N	\N
105	107	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":4,"group":null}	\N	\N
106	108	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":5,"group":null}	\N	\N
107	109	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":6,"group":null}	\N	\N
108	110	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":7,"group":null}	\N	\N
109	111	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":8,"group":null}	\N	\N
110	112	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":9,"group":null}	\N	\N
111	113	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":10,"group":null}	\N	\N
112	114	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":11,"group":null}	\N	\N
113	115	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":12,"group":null}	\N	\N
114	116	directus_fields	14	{"id":14,"collection":"work_experiences","field":"logo","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":13,"group":null}	\N	\N
115	117	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":14,"group":null}	\N	\N
116	118	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","interface":"input"}	\N	\N
117	119	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","width":"half"}	\N	\N
118	120	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","interface":"input"}	\N	\N
119	121	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","width":"half"}	\N	\N
120	122	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
121	123	directus_fields	11	{"id":11,"collection":"work_experiences","field":"isActive","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"isActive","sort":2,"group":null}	\N	\N
122	124	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":3,"group":null}	\N	\N
123	125	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":4,"group":null}	\N	\N
124	126	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":5,"group":null}	\N	\N
125	127	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":6,"group":null}	\N	\N
126	128	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":7,"group":null}	\N	\N
127	129	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":8,"group":null}	\N	\N
128	130	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":9,"group":null}	\N	\N
129	131	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":10,"group":null}	\N	\N
130	132	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":11,"group":null}	\N	\N
131	133	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":12,"group":null}	\N	\N
132	134	directus_fields	14	{"id":14,"collection":"work_experiences","field":"logo","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":13,"group":null}	\N	\N
133	135	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":14,"group":null}	\N	\N
134	136	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
135	137	directus_fields	11	{"id":11,"collection":"work_experiences","field":"isActive","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"isActive","sort":2,"group":null}	\N	\N
136	138	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":3,"group":null}	\N	\N
137	139	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":4,"group":null}	\N	\N
138	140	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":5,"group":null}	\N	\N
139	141	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":6,"group":null}	\N	\N
140	142	directus_fields	14	{"id":14,"collection":"work_experiences","field":"logo","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":7,"group":null}	\N	\N
141	143	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":8,"group":null}	\N	\N
142	144	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":9,"group":null}	\N	\N
143	145	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":10,"group":null}	\N	\N
144	146	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":11,"group":null}	\N	\N
145	147	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":12,"group":null}	\N	\N
146	148	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":13,"group":null}	\N	\N
147	149	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":14,"group":null}	\N	\N
148	150	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","width":"half"}	\N	\N
149	151	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","width":"half"}	\N	\N
150	152	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","readonly":true}	\N	\N
151	153	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":["date-updated"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","special":["date-updated"],"readonly":true}	\N	\N
152	154	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":["date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","special":["date-created"]}	\N	\N
153	155	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","interface":"input"}	\N	\N
154	156	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":["date-updated","date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","special":["date-updated","date-created"]}	\N	\N
155	157	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	{"name":"Chipta","location":"Amsterdam","description":"Ticketing company","url":"https://chipta.com/en/","position":"Lead Developer","summary":"Was fun","startDate":"2017","endDate":"2024"}	{"name":"Chipta","location":"Amsterdam","description":"Ticketing company","url":"https://chipta.com/en/","position":"Lead Developer","summary":"Was fun","startDate":"2017","endDate":"2024"}	\N	\N
156	158	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	{"name":"Tender-it","location":"Amsterdam","description":"Tender platform","position":"Lead Developer","url":null,"startDate":"2014","endDate":"2017","summary":"Was cool","sortOrder":0,"isActive":true,"createdAt":"2025-10-22T12:00:00","updatedAt":"2025-10-15T15:24:58","id":"f044625e-b180-4603-b03a-42a5a397403a","logo":null}	{"name":"Tender-it","location":"Amsterdam","description":"Tender platform","position":"Lead Developer","url":null,"startDate":"2014","endDate":"2017","summary":"Was cool","updatedAt":"2025-10-15T15:24:58"}	\N	\N
157	159	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":null,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort_field":"sortOrder"}	\N	\N
158	161	directus_fields	15	{"sort":15,"interface":"file-image","special":["file"],"options":{},"collection":"work_experiences","field":"logo"}	{"sort":15,"interface":"file-image","special":["file"],"options":{},"collection":"work_experiences","field":"logo"}	\N	\N
159	162	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
160	163	directus_fields	11	{"id":11,"collection":"work_experiences","field":"isActive","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"isActive","sort":2,"group":null}	\N	\N
161	164	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":3,"group":null}	\N	\N
162	165	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":4,"group":null}	\N	\N
163	166	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":5,"group":null}	\N	\N
164	167	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":6,"group":null}	\N	\N
165	168	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":7,"group":null}	\N	\N
166	169	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":8,"group":null}	\N	\N
167	170	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":9,"group":null}	\N	\N
168	171	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":10,"group":null}	\N	\N
169	172	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":11,"group":null}	\N	\N
170	173	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":["date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":12,"group":null}	\N	\N
171	174	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":["date-updated","date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":13,"group":null}	\N	\N
172	175	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":14,"group":null}	\N	\N
173	176	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
174	177	directus_fields	11	{"id":11,"collection":"work_experiences","field":"isActive","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"isActive","sort":2,"group":null}	\N	\N
175	178	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":3,"group":null}	\N	\N
176	179	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":4,"group":null}	\N	\N
177	180	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":5,"group":null}	\N	\N
178	181	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":6,"group":null}	\N	\N
179	182	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":7,"group":null}	\N	\N
180	183	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":8,"group":null}	\N	\N
181	184	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":9,"group":null}	\N	\N
182	185	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":10,"group":null}	\N	\N
183	186	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":11,"group":null}	\N	\N
184	187	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":["date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":12,"group":null}	\N	\N
185	188	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":["date-updated","date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":13,"group":null}	\N	\N
186	189	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":14,"group":null}	\N	\N
187	190	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
188	191	directus_fields	11	{"id":11,"collection":"work_experiences","field":"isActive","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"isActive","sort":2,"group":null}	\N	\N
189	192	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":3,"group":null}	\N	\N
190	193	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":4,"group":null}	\N	\N
191	194	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":5,"group":null}	\N	\N
192	195	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":6,"group":null}	\N	\N
193	196	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":7,"group":null}	\N	\N
194	197	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":["date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":8,"group":null}	\N	\N
195	198	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":9,"group":null}	\N	\N
196	199	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":10,"group":null}	\N	\N
197	200	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":11,"group":null}	\N	\N
198	201	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":12,"group":null}	\N	\N
199	202	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":["date-updated","date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":13,"group":null}	\N	\N
200	203	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":14,"group":null}	\N	\N
201	204	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
202	205	directus_fields	11	{"id":11,"collection":"work_experiences","field":"isActive","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"isActive","sort":2,"group":null}	\N	\N
203	206	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":3,"group":null}	\N	\N
204	207	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":4,"group":null}	\N	\N
205	208	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":5,"group":null}	\N	\N
206	209	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":6,"group":null}	\N	\N
207	210	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":7,"group":null}	\N	\N
208	211	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":8,"group":null}	\N	\N
209	212	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":9,"group":null}	\N	\N
210	213	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":10,"group":null}	\N	\N
211	214	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":["date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":11,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":11,"group":null}	\N	\N
212	215	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":12,"group":null}	\N	\N
213	216	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":["date-updated","date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":13,"group":null}	\N	\N
214	217	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":14,"group":null}	\N	\N
215	218	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
216	219	directus_fields	11	{"id":11,"collection":"work_experiences","field":"isActive","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"isActive","sort":2,"group":null}	\N	\N
217	220	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":3,"group":null}	\N	\N
218	221	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":4,"group":null}	\N	\N
219	222	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":5,"group":null}	\N	\N
220	223	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":6,"group":null}	\N	\N
221	224	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":7,"group":null}	\N	\N
222	225	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":8,"group":null}	\N	\N
223	226	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":9,"group":null}	\N	\N
224	227	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":10,"group":null}	\N	\N
225	228	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":11,"group":null}	\N	\N
226	229	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":["date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":12,"group":null}	\N	\N
227	230	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":["date-updated","date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":13,"group":null}	\N	\N
228	231	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":14,"group":null}	\N	\N
229	232	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
230	233	directus_fields	11	{"id":11,"collection":"work_experiences","field":"isActive","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"isActive","sort":2,"group":null}	\N	\N
231	234	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":3,"group":null}	\N	\N
232	235	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":4,"group":null}	\N	\N
233	236	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":5,"group":null}	\N	\N
234	237	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":6,"group":null}	\N	\N
235	238	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":7,"group":null}	\N	\N
236	239	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":8,"group":null}	\N	\N
237	240	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":9,"group":null}	\N	\N
238	241	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":10,"group":null}	\N	\N
239	242	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":11,"group":null}	\N	\N
240	243	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":["date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":12,"group":null}	\N	\N
241	244	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":["date-updated","date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":13,"group":null}	\N	\N
242	245	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":14,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":14,"group":null}	\N	\N
243	246	directus_files	8127127c-d1cf-480e-87ea-5cbfbfc12e36	{"title":"Chipta Logo","filename_download":"chipta-logo.png","type":"image/png","storage":"local"}	{"title":"Chipta Logo","filename_download":"chipta-logo.png","type":"image/png","storage":"local"}	\N	\N
244	247	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	{"name":"Chipta","location":"Amsterdam","description":"Ticketing company","position":"Lead Developer","url":"https://chipta.com/en/","startDate":"2017","endDate":"2024","summary":"Was fun","sortOrder":1,"isActive":true,"createdAt":"2025-10-15T15:24:10","updatedAt":"2025-10-15T15:31:31","id":"a37c89e0-2b6d-44e1-911a-c1399611562a","logo":"8127127c-d1cf-480e-87ea-5cbfbfc12e36"}	{"logo":"8127127c-d1cf-480e-87ea-5cbfbfc12e36","updatedAt":"2025-10-15T15:31:31"}	\N	\N
245	248	directus_files	d6beca5c-5fc3-4f31-aa57-fc1a8209a97c	{"title":"Tender It Logo","filename_download":"tender-it-logo.png","type":"image/png","storage":"local"}	{"title":"Tender It Logo","filename_download":"tender-it-logo.png","type":"image/png","storage":"local"}	\N	\N
246	249	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	{"name":"Tender-it","location":"Amsterdam","description":"Tender platform","position":"Lead Developer","url":null,"startDate":"2014","endDate":"2017","summary":"Was cool","sortOrder":2,"isActive":true,"createdAt":"2025-10-22T12:00:00","updatedAt":"2025-10-15T15:31:53","id":"f044625e-b180-4603-b03a-42a5a397403a","logo":"d6beca5c-5fc3-4f31-aa57-fc1a8209a97c"}	{"logo":"d6beca5c-5fc3-4f31-aa57-fc1a8209a97c","updatedAt":"2025-10-15T15:31:53"}	\N	\N
247	250	directus_fields	16	{"special":null,"collection":"users","field":"password"}	{"special":null,"collection":"users","field":"password"}	\N	\N
248	258	directus_fields	16	{"id":16,"collection":"users","field":"password","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":true,"sort":null,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"users","field":"password","hidden":true}	\N	\N
249	259	directus_collections	users	{"collection":"users","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":null,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"hidden":true}	\N	\N
250	260	directus_fields	17	{"sort":1,"hidden":true,"readonly":true,"interface":"input","special":["uuid"],"field":"id","collection":"profile"}	{"sort":1,"hidden":true,"readonly":true,"interface":"input","special":["uuid"],"field":"id","collection":"profile"}	\N	\N
251	261	directus_fields	18	{"sort":2,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"profile"}	{"sort":2,"special":["date-created"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_created","collection":"profile"}	\N	\N
252	262	directus_fields	19	{"sort":3,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"profile"}	{"sort":3,"special":["date-updated"],"interface":"datetime","readonly":true,"hidden":true,"width":"half","display":"datetime","display_options":{"relative":true},"field":"date_updated","collection":"profile"}	\N	\N
253	263	directus_collections	profile	{"singleton":false,"collection":"profile"}	{"singleton":false,"collection":"profile"}	\N	\N
254	264	directus_fields	20	{"sort":4,"interface":"input","special":null,"required":true,"collection":"profile","field":"name"}	{"sort":4,"interface":"input","special":null,"required":true,"collection":"profile","field":"name"}	\N	\N
255	265	directus_fields	21	{"sort":5,"interface":"input","special":null,"required":true,"collection":"profile","field":"title"}	{"sort":5,"interface":"input","special":null,"required":true,"collection":"profile","field":"title"}	\N	\N
256	266	directus_fields	20	{"id":20,"collection":"profile","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"name","width":"half"}	\N	\N
257	267	directus_fields	21	{"id":21,"collection":"profile","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"title","width":"half"}	\N	\N
258	268	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":"users","collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":"users"}	\N	\N
259	269	directus_collections	profile	{"collection":"profile","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":null}	\N	\N
260	270	directus_collections	users	{"collection":"users","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":null}	\N	\N
261	271	directus_collections	profile	{"collection":"profile","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":1,"group":null}	\N	\N
262	272	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":null,"hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":2,"group":null}	\N	\N
263	273	directus_collections	users	{"collection":"users","icon":null,"note":null,"display_template":null,"hidden":true,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":3,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"sort":3,"group":null}	\N	\N
264	274	profile	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"name":"Rik Wanders","title":"Lead Developer"}	{"name":"Rik Wanders","title":"Lead Developer"}	\N	\N
265	275	directus_fields	22	{"sort":15,"special":["m2o"],"collection":"work_experiences","field":"profile"}	{"sort":15,"special":["m2o"],"collection":"work_experiences","field":"profile"}	\N	\N
266	276	directus_fields	23	{"sort":6,"special":["o2m"],"interface":"list-o2m","collection":"profile","field":"work_experiences"}	{"sort":6,"special":["o2m"],"interface":"list-o2m","collection":"profile","field":"work_experiences"}	\N	\N
267	277	profile	c08a1061-4520-40b9-8bcc-d7e54c59811b	{"name":"test","title":"jo"}	{"name":"test","title":"jo"}	\N	\N
268	279	work_experiences	655604b5-39ff-4c7c-916f-52f1b5ffe6f1	{"name":"test","location":"test","description":"tes","url":"test","startDate":"test","endDate":"test","position":"test","summary":"testest"}	{"name":"test","location":"test","description":"tes","url":"test","startDate":"test","endDate":"test","position":"test","summary":"testest"}	\N	\N
269	280	directus_fields	22	{"id":22,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":"related-values","display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","interface":"select-dropdown-m2o","display":"related-values"}	\N	\N
270	282	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
271	283	directus_fields	11	{"id":11,"collection":"work_experiences","field":"isActive","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"isActive","sort":2,"group":null}	\N	\N
272	284	directus_fields	22	{"id":22,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":"related-values","display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","sort":3,"group":null}	\N	\N
273	285	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":4,"group":null}	\N	\N
274	286	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
275	287	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
276	288	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":7,"group":null}	\N	\N
277	289	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":8,"group":null}	\N	\N
278	290	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":9,"group":null}	\N	\N
279	291	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":10,"group":null}	\N	\N
280	292	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":11,"group":null}	\N	\N
281	293	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":12,"group":null}	\N	\N
282	294	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":["date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":13,"group":null}	\N	\N
283	295	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":["date-updated","date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":14,"group":null}	\N	\N
284	296	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":15,"group":null}	\N	\N
285	297	directus_fields	2	{"id":2,"collection":"work_experiences","field":"id","special":["uuid"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"id","sort":1,"group":null}	\N	\N
286	298	directus_fields	22	{"id":22,"collection":"work_experiences","field":"profile","special":["m2o"],"interface":"select-dropdown-m2o","options":null,"display":"related-values","display_options":null,"readonly":false,"hidden":false,"sort":2,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"profile","sort":2,"group":null}	\N	\N
287	299	directus_fields	11	{"id":11,"collection":"work_experiences","field":"isActive","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":3,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"isActive","sort":3,"group":null}	\N	\N
288	300	directus_fields	1	{"id":1,"collection":"work_experiences","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"name","sort":4,"group":null}	\N	\N
289	301	directus_fields	3	{"id":3,"collection":"work_experiences","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"location","sort":5,"group":null}	\N	\N
290	302	directus_fields	4	{"id":4,"collection":"work_experiences","field":"description","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"description","sort":6,"group":null}	\N	\N
291	303	directus_fields	6	{"id":6,"collection":"work_experiences","field":"url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"url","sort":7,"group":null}	\N	\N
292	304	directus_fields	15	{"id":15,"collection":"work_experiences","field":"logo","special":["file"],"interface":"file-image","options":{},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"logo","sort":8,"group":null}	\N	\N
293	305	directus_fields	7	{"id":7,"collection":"work_experiences","field":"startDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"startDate","sort":9,"group":null}	\N	\N
294	306	directus_fields	8	{"id":8,"collection":"work_experiences","field":"endDate","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"endDate","sort":10,"group":null}	\N	\N
295	307	directus_fields	5	{"id":5,"collection":"work_experiences","field":"position","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"position","sort":11,"group":null}	\N	\N
296	308	directus_fields	9	{"id":9,"collection":"work_experiences","field":"summary","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"summary","sort":12,"group":null}	\N	\N
297	309	directus_fields	12	{"id":12,"collection":"work_experiences","field":"createdAt","special":["date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":13,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"createdAt","sort":13,"group":null}	\N	\N
298	310	directus_fields	13	{"id":13,"collection":"work_experiences","field":"updatedAt","special":["date-updated","date-created"],"interface":null,"options":null,"display":null,"display_options":null,"readonly":true,"hidden":false,"sort":14,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"updatedAt","sort":14,"group":null}	\N	\N
299	311	directus_fields	10	{"id":10,"collection":"work_experiences","field":"sortOrder","special":null,"interface":null,"options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":15,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"work_experiences","field":"sortOrder","sort":15,"group":null}	\N	\N
300	312	work_experiences	f044625e-b180-4603-b03a-42a5a397403a	{"name":"Tender-it","location":"Amsterdam","description":"Tender platform","position":"Lead Developer","url":null,"startDate":"2014","endDate":"2017","summary":"Was cool","sortOrder":2,"isActive":true,"createdAt":"2025-10-22T12:00:00","updatedAt":"2025-10-15T17:00:38","id":"f044625e-b180-4603-b03a-42a5a397403a","logo":"d6beca5c-5fc3-4f31-aa57-fc1a8209a97c","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","updatedAt":"2025-10-15T17:00:38"}	\N	\N
301	313	work_experiences	a37c89e0-2b6d-44e1-911a-c1399611562a	{"name":"Chipta","location":"Amsterdam","description":"Ticketing company","position":"Lead Developer","url":"https://chipta.com/en/","startDate":"2017","endDate":"2024","summary":"Was fun","sortOrder":1,"isActive":true,"createdAt":"2025-10-15T15:24:10","updatedAt":"2025-10-15T17:00:44","id":"a37c89e0-2b6d-44e1-911a-c1399611562a","logo":"8127127c-d1cf-480e-87ea-5cbfbfc12e36","profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309"}	{"profile":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","updatedAt":"2025-10-15T17:00:44"}	\N	\N
302	314	directus_collections	profile	{"collection":"profile","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":null,"accountability":"all","color":null,"item_duplication_fields":null,"sort":1,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}}"}	\N	\N
303	315	directus_fields	23	{"id":23,"collection":"profile","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":6,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"work_experiences","readonly":true,"hidden":true}	\N	\N
304	316	profile	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-15T17:02:57.328Z","name":"Rik Wanders","title":"Senior Full Stack Developer","work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"]}	{"title":"Senior Full Stack Developer","date_updated":"2025-10-15T17:02:57.328Z"}	\N	\N
305	317	directus_fields	24	{"sort":7,"interface":"input","special":null,"collection":"profile","field":"location"}	{"sort":7,"interface":"input","special":null,"collection":"profile","field":"location"}	\N	\N
306	318	directus_fields	24	{"id":24,"collection":"profile","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"location","width":"half"}	\N	\N
307	319	directus_fields	25	{"sort":8,"interface":"input","special":null,"collection":"profile","field":"languages"}	{"sort":8,"interface":"input","special":null,"collection":"profile","field":"languages"}	\N	\N
308	320	directus_fields	25	{"id":25,"collection":"profile","field":"languages","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"languages","width":"half"}	\N	\N
309	321	directus_fields	26	{"sort":9,"interface":"input","special":null,"collection":"profile","field":"phone_number"}	{"sort":9,"interface":"input","special":null,"collection":"profile","field":"phone_number"}	\N	\N
310	322	directus_fields	26	{"id":26,"collection":"profile","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"phone_number","width":"half"}	\N	\N
311	323	directus_fields	27	{"sort":10,"interface":"input","special":null,"collection":"profile","field":"email_address"}	{"sort":10,"interface":"input","special":null,"collection":"profile","field":"email_address"}	\N	\N
312	324	directus_fields	27	{"id":27,"collection":"profile","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"email_address","width":"half"}	\N	\N
313	325	directus_fields	17	{"id":17,"collection":"profile","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"id","sort":1,"group":null}	\N	\N
314	326	directus_fields	18	{"id":18,"collection":"profile","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"date_created","sort":2,"group":null}	\N	\N
315	327	directus_fields	19	{"id":19,"collection":"profile","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"date_updated","sort":3,"group":null}	\N	\N
316	328	directus_fields	20	{"id":20,"collection":"profile","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"name","sort":4,"group":null}	\N	\N
317	329	directus_fields	21	{"id":21,"collection":"profile","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"title","sort":5,"group":null}	\N	\N
318	330	directus_fields	23	{"id":23,"collection":"profile","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":6,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"work_experiences","sort":6,"group":null}	\N	\N
319	331	directus_fields	27	{"id":27,"collection":"profile","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"email_address","sort":7,"group":null}	\N	\N
320	332	directus_fields	24	{"id":24,"collection":"profile","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"location","sort":8,"group":null}	\N	\N
321	333	directus_fields	25	{"id":25,"collection":"profile","field":"languages","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"languages","sort":9,"group":null}	\N	\N
322	334	directus_fields	26	{"id":26,"collection":"profile","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"phone_number","sort":10,"group":null}	\N	\N
323	335	directus_fields	17	{"id":17,"collection":"profile","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"id","sort":1,"group":null}	\N	\N
324	336	directus_fields	18	{"id":18,"collection":"profile","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"date_created","sort":2,"group":null}	\N	\N
325	337	directus_fields	19	{"id":19,"collection":"profile","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"date_updated","sort":3,"group":null}	\N	\N
326	338	directus_fields	20	{"id":20,"collection":"profile","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"name","sort":4,"group":null}	\N	\N
327	339	directus_fields	21	{"id":21,"collection":"profile","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"title","sort":5,"group":null}	\N	\N
328	340	directus_fields	23	{"id":23,"collection":"profile","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":6,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"work_experiences","sort":6,"group":null}	\N	\N
329	341	directus_fields	27	{"id":27,"collection":"profile","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"email_address","sort":7,"group":null}	\N	\N
330	342	directus_fields	26	{"id":26,"collection":"profile","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"phone_number","sort":8,"group":null}	\N	\N
331	343	directus_fields	24	{"id":24,"collection":"profile","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"location","sort":9,"group":null}	\N	\N
332	344	directus_fields	25	{"id":25,"collection":"profile","field":"languages","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"languages","sort":10,"group":null}	\N	\N
333	345	directus_fields	28	{"sort":11,"interface":"input","special":null,"collection":"profile","field":"personal_website"}	{"sort":11,"interface":"input","special":null,"collection":"profile","field":"personal_website"}	\N	\N
334	346	directus_fields	28	{"id":28,"collection":"profile","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"personal_website","width":"half"}	\N	\N
335	347	directus_fields	29	{"sort":12,"interface":"input","special":null,"collection":"profile","field":"linkedin_url"}	{"sort":12,"interface":"input","special":null,"collection":"profile","field":"linkedin_url"}	\N	\N
336	348	directus_fields	29	{"id":29,"collection":"profile","field":"linkedin_url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"linkedin_url","width":"half"}	\N	\N
337	349	profile	0eeb942b-e35a-44e8-a37d-52b9cdb24309	{"id":"0eeb942b-e35a-44e8-a37d-52b9cdb24309","date_created":"2025-10-15T16:51:41.394Z","date_updated":"2025-10-15T17:15:22.030Z","name":"Rik Wanders","title":"Senior Full Stack Developer","location":"Ronda, Spain","languages":"English: Fluent, Dutch: Native","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","linkedin_url":"https://www.linkedin.com/in/rik-wanders-software/","work_experiences":["a37c89e0-2b6d-44e1-911a-c1399611562a","f044625e-b180-4603-b03a-42a5a397403a"]}	{"location":"Ronda, Spain","languages":"English: Fluent, Dutch: Native","phone_number":"+31649118511","email_address":"rik@rikwanders.tech","personal_website":"https://www.rikwanders.tech/","linkedin_url":"https://www.linkedin.com/in/rik-wanders-software/","date_updated":"2025-10-15T17:15:22.030Z"}	\N	\N
338	350	directus_fields	23	{"id":23,"collection":"profile","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"work_experiences","readonly":false,"hidden":false}	\N	\N
339	351	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}}","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}}"}	\N	\N
340	352	directus_fields	17	{"id":17,"collection":"profile","field":"id","special":["uuid"],"interface":"input","options":null,"display":null,"display_options":null,"readonly":true,"hidden":true,"sort":1,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"id","sort":1,"group":null}	\N	\N
341	353	directus_fields	18	{"id":18,"collection":"profile","field":"date_created","special":["date-created"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":2,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"date_created","sort":2,"group":null}	\N	\N
342	354	directus_fields	19	{"id":19,"collection":"profile","field":"date_updated","special":["date-updated"],"interface":"datetime","options":null,"display":"datetime","display_options":{"relative":true},"readonly":true,"hidden":true,"sort":3,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"date_updated","sort":3,"group":null}	\N	\N
343	355	directus_fields	20	{"id":20,"collection":"profile","field":"name","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":4,"width":"half","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"name","sort":4,"group":null}	\N	\N
344	356	directus_fields	21	{"id":21,"collection":"profile","field":"title","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":5,"width":"half","translations":null,"note":null,"conditions":null,"required":true,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"title","sort":5,"group":null}	\N	\N
345	357	directus_fields	27	{"id":27,"collection":"profile","field":"email_address","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":6,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"email_address","sort":6,"group":null}	\N	\N
346	358	directus_fields	26	{"id":26,"collection":"profile","field":"phone_number","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":7,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"phone_number","sort":7,"group":null}	\N	\N
347	359	directus_fields	24	{"id":24,"collection":"profile","field":"location","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":8,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"location","sort":8,"group":null}	\N	\N
348	360	directus_fields	25	{"id":25,"collection":"profile","field":"languages","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":9,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"languages","sort":9,"group":null}	\N	\N
349	361	directus_fields	28	{"id":28,"collection":"profile","field":"personal_website","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":10,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"personal_website","sort":10,"group":null}	\N	\N
350	362	directus_fields	29	{"id":29,"collection":"profile","field":"linkedin_url","special":null,"interface":"input","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":11,"width":"half","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"linkedin_url","sort":11,"group":null}	\N	\N
351	363	directus_fields	23	{"id":23,"collection":"profile","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":null,"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"work_experiences","sort":12,"group":null}	\N	\N
352	364	directus_fields	23	{"id":23,"collection":"profile","field":"work_experiences","special":["o2m"],"interface":"list-o2m","options":{"enableSelect":false},"display":null,"display_options":null,"readonly":false,"hidden":false,"sort":12,"width":"full","translations":null,"note":null,"conditions":null,"required":false,"group":null,"validation":null,"validation_message":null}	{"collection":"profile","field":"work_experiences","options":{"enableSelect":false}}	\N	\N
353	365	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}}({{startDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}}({{startDate}})"}	\N	\N
354	366	directus_collections	work_experiences	{"collection":"work_experiences","icon":null,"note":null,"display_template":"{{name}} ({{startDate}})","hidden":false,"singleton":false,"translations":null,"archive_field":null,"archive_app_filter":true,"archive_value":null,"unarchive_value":null,"sort_field":"sortOrder","accountability":"all","color":null,"item_duplication_fields":null,"sort":2,"group":null,"collapse":"open","preview_url":null,"versioning":false}	{"display_template":"{{name}} ({{startDate}})"}	\N	\N
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
qb8VV3dgD-2x0mUxqa-jqYUX8g4WmysE5aZFTAaX0fNWQ5Akvas5v3Ezw7Nr35fv	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-15 17:19:21.491+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	\N	http://localhost:8055	MxTIfrOKElfEEqqrgpgQpQNu9WuXkE8VRVSx1nlWKoGs96N1wP5S4UF4j-NSC8r3
MxTIfrOKElfEEqqrgpgQpQNu9WuXkE8VRVSx1nlWKoGs96N1wP5S4UF4j-NSC8r3	157238bb-6930-4f26-be9c-8b31a9e11ab8	2025-10-16 17:19:11.491+00	172.18.0.1	Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0	\N	http://localhost:8055	\N
\.


--
-- Data for Name: directus_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.directus_settings (id, project_name, project_url, project_color, project_logo, public_foreground, public_background, public_note, auth_login_attempts, auth_password_policy, storage_asset_transform, storage_asset_presets, custom_css, storage_default_folder, basemaps, mapbox_key, module_bar, project_descriptor, default_language, custom_aspect_ratios, public_favicon, default_appearance, default_theme_light, theme_light_overrides, default_theme_dark, theme_dark_overrides, report_error_url, report_bug_url, report_feature_url, public_registration, public_registration_verify_email, public_registration_role, public_registration_email_filter, visual_editor_urls, accepted_terms, project_id, mcp_enabled, mcp_allow_deletes, mcp_prompts_collection, mcp_system_prompt_enabled, mcp_system_prompt) FROM stdin;
1	Directus	\N	#6644FF	\N	\N	\N	\N	25	\N	all	\N	\N	\N	\N	\N	\N	\N	en-US	\N	\N	auto	\N	\N	\N	\N	\N	\N	\N	f	t	\N	\N	\N	t	0199e7a6-9d13-72dc-af68-381958575f19	f	f	\N	t	\N
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
157238bb-6930-4f26-be9c-8b31a9e11ab8	Admin	User	rik@rikwanders.tech	$argon2id$v=19$m=65536,t=3,p=4$MF3ELPmT2vdFmjd2LhqYZA$HmKet+cTxhqHbyL5VQcR2+TrMbCYSiz7REFnd6c6FXY	\N	\N	\N	\N	\N	\N	\N	active	17756a67-2cbc-42b5-bb7c-906f79444fb3	\N	2025-10-15 17:19:11.494+00	/settings/data-model	default	\N	\N	t	\N	\N	\N	\N	\N	auto
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
-- Data for Name: profile; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.profile (id, date_created, date_updated, name, title, location, languages, phone_number, email_address, personal_website, linkedin_url) FROM stdin;
0eeb942b-e35a-44e8-a37d-52b9cdb24309	2025-10-15 16:51:41.394+00	2025-10-15 17:15:22.03+00	Rik Wanders	Senior Full Stack Developer	Ronda, Spain	English: Fluent, Dutch: Native	+31649118511	rik@rikwanders.tech	https://www.rikwanders.tech/	https://www.linkedin.com/in/rik-wanders-software/
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

COPY public.work_experiences (name, location, description, "position", url, "startDate", "endDate", summary, "sortOrder", "isActive", "createdAt", "updatedAt", id, logo, profile) FROM stdin;
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

SELECT pg_catalog.setval('public.directus_activity_id_seq', 366, true);


--
-- Name: directus_fields_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_fields_id_seq', 29, true);


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

SELECT pg_catalog.setval('public.directus_presets_id_seq', 3, true);


--
-- Name: directus_relations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_relations_id_seq', 2, true);


--
-- Name: directus_revisions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_revisions_id_seq', 354, true);


--
-- Name: directus_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_settings_id_seq', 1, true);


--
-- Name: directus_webhooks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.directus_webhooks_id_seq', 1, false);


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
-- Name: profile profile_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.profile
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
    ADD CONSTRAINT work_experiences_profile_foreign FOREIGN KEY (profile) REFERENCES public.profile(id);


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

\unrestrict NErH2wyOw80G7f17ayV9rsu36kyMqSoMwZaO75YkXLDs1U25wMnzzQkylNS8ofB

