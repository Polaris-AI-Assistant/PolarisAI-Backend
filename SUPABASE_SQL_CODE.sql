-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.gmail_message_embeddings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  message_id text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  embedding USER-DEFINED NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT gmail_message_embeddings_pkey PRIMARY KEY (id),
  CONSTRAINT gmail_message_embeddings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT gmail_message_embeddings_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.gmail_messages(id)
);
CREATE TABLE public.gmail_messages (
  id text NOT NULL,
  thread_id text,
  user_id uuid,
  user_email text,
  snippet text,
  subject text,
  sender text,
  recipients text,
  body text,
  date timestamp with time zone,
  labels ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT gmail_messages_pkey PRIMARY KEY (id),
  CONSTRAINT gmail_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.gmail_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  email text NOT NULL UNIQUE,
  access_token text,
  refresh_token text,
  expiry_date bigint,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT gmail_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT gmail_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.google_calendar_event_embeddings (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  event_id text NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  embedding USER-DEFINED,
  CONSTRAINT google_calendar_event_embeddings_pkey PRIMARY KEY (id),
  CONSTRAINT google_calendar_event_embeddings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.google_calendar_events (
  id text NOT NULL,
  user_id uuid NOT NULL,
  user_email text,
  calendar_id text,
  title text,
  description text,
  location text,
  organizer text,
  attendees text,
  status text,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  created_time timestamp with time zone,
  updated_time timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT google_calendar_events_pkey PRIMARY KEY (user_id, id),
  CONSTRAINT google_calendar_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.google_calendar_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  email text NOT NULL UNIQUE,
  access_token text,
  refresh_token text,
  expiry_date bigint,
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT google_calendar_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT google_calendar_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);