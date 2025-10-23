\restrict BiODpaHrDd0w8DziuF6y2ivicxutySnjDcZzcIOP5I5vw0Ei7dr4YeMDgoDkWjb

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
-- Name: users; Type: TABLE; Schema: public; Owner: prisma_migration
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


ALTER TABLE public.users OWNER TO prisma_migration;

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: prisma_migration
--

COPY public.users (email, password, "firstName", "lastName", "isEmailVerified", "emailVerifyToken", "passwordResetToken", "passwordResetExpiry", "createdAt", "updatedAt", role, id) FROM stdin;
rik@rikwanders.tech     $2b$12$gEbih1fZC8V.aQuvhgOoz.Q5MmKtLGTxShdlGN8a1KdKz9kFm13Fm    Rik     Wanders f       \N      \N      \N      2025-09-06 13:30:37.813 2025-10-19 19:37:40.912  SUPER_ADMIN     1db24a12-8b1d-4075-9679-e817bd479864
\.


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: prisma_migration
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: prisma_migration
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- PostgreSQL database dump complete
--

\unrestrict BiODpaHrDd0w8DziuF6y2ivicxutySnjDcZzcIOP5I5vw0Ei7dr4YeMDgoDkWjb
