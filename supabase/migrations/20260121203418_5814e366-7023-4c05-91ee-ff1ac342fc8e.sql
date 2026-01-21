-- Add active column to properties table for soft delete functionality
ALTER TABLE public.properties
ADD COLUMN active boolean NOT NULL DEFAULT true;