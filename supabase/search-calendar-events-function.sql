CREATE OR REPLACE FUNCTION search_calendar_events(
  query_embedding vector(3072),
  user_filter uuid,
  similarity_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10
)
RETURNS TABLE(
  id text,
  user_id uuid,
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
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    gce.id,
    gce.user_id,
    gce.user_email,
    gce.calendar_id,
    gce.title,
    gce.description,
    gce.location,
    gce.organizer,
    gce.attendees,
    gce.status,
    gce.start_time,
    gce.end_time,
    gce.created_time,
    gce.updated_time,
    (1 - (gcee.embedding <=> query_embedding)) as similarity
  FROM google_calendar_events gce
  JOIN google_calendar_event_embeddings gcee 
    ON gce.id = gcee.event_id AND gce.user_id = gcee.user_id
  WHERE gce.user_id = user_filter
    AND (1 - (gcee.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
