-- Supabase Keep-Alive Migration
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)
-- This creates a simple function that can be called via the REST API

CREATE OR REPLACE FUNCTION public.keep_alive()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
RETURN jsonb_build_object(
        'status', 'alive',
        'timestamp', now(),
        'message', 'Database is active'
       );
END;
$$;

-- Grant execute permission to anon role (allows calling via REST API with anon key)
GRANT EXECUTE ON FUNCTION public.keep_alive() TO anon;

-- Optional: Also grant to authenticated role
GRANT EXECUTE ON FUNCTION public.keep_alive() TO authenticated;
