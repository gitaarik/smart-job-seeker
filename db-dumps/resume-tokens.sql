--
-- PostgreSQL database dump
--

\restrict SgVaTJZ0R5JYfx4lnMlbqVYp2ZbYumY6p0nGw01BztUEIcBrBFQdfQvV1tgRUWW

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: resume_tokens; Type: TABLE; Schema: public; Owner: prisma_migration
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


ALTER TABLE public.resume_tokens OWNER TO prisma_migration;

--
-- Data for Name: resume_tokens; Type: TABLE DATA; Schema: public; Owner: prisma_migration
--

COPY public.resume_tokens (token, name, description, "resumeType", "expiresAt", "viewCount", "maxViews", "isActive", "createdBy", "createdAt", "updatedAt", id) FROM stdin;
c60x17sipu	Mees Robert	\N	fullstack-django	2025-11-08 00:00:00	1	\N	t	1db24a12-8b1d-4075-9679-e817bd479864	2025-09-08 14:07:15.948	2025-09-08 14:07:24.576	a700da58-f1f8-48d3-8dd6-4489eb226ffc
6MIFQz82Ww	AuditOne	\N	fullstack-react	2026-01-06 12:00:00	0	\N	t	1db24a12-8b1d-4075-9679-e817bd479864	2025-10-20 14:05:00	2025-10-20 12:06:14.976	9cb37dad-ed8d-46a8-977d-471fbaa4169d
a7369b3c-c68e-48b1-a309-3f7c514328be	Lumenalta	\N	fullstack-react	2025-12-17 00:00:00	0	\N	t	1db24a12-8b1d-4075-9679-e817bd479864	2025-09-06 13:32:13.274	2025-10-14 13:39:45.202	ac11dea4-6701-47c1-99e0-dde0da72f476
RtB7Wxcuuw	Test	\N	fullstack-react	\N	7	\N	t	1db24a12-8b1d-4075-9679-e817bd479864	2025-10-20 12:00:00	2025-10-22 15:47:49.804	5778ed53-2901-4898-8649-ad2d94065136
\.


--
-- Name: resume_tokens resume_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: prisma_migration
--

ALTER TABLE ONLY public.resume_tokens
    ADD CONSTRAINT resume_tokens_pkey PRIMARY KEY (id);


--
-- Name: resume_tokens resume_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: prisma_migration
--

ALTER TABLE ONLY public.resume_tokens
    ADD CONSTRAINT resume_tokens_token_unique UNIQUE (token);


--
-- Name: resume_tokens_token_key; Type: INDEX; Schema: public; Owner: prisma_migration
--

CREATE UNIQUE INDEX resume_tokens_token_key ON public.resume_tokens USING btree (token);


--
-- Name: resume_tokens resume_tokens_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: prisma_migration
--

ALTER TABLE ONLY public.resume_tokens
    ADD CONSTRAINT "resume_tokens_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict SgVaTJZ0R5JYfx4lnMlbqVYp2ZbYumY6p0nGw01BztUEIcBrBFQdfQvV1tgRUWW

