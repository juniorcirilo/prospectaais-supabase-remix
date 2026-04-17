
-- Create storage bucket for message media
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-media', 'message-media', true);

-- Allow anyone to upload files to message-media bucket
CREATE POLICY "Anyone can upload message media"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'message-media');

-- Allow anyone to view message media
CREATE POLICY "Anyone can view message media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'message-media');

-- Allow anyone to delete their message media
CREATE POLICY "Anyone can delete message media"
ON storage.objects
FOR DELETE
USING (bucket_id = 'message-media');

-- Allow anyone to update message media
CREATE POLICY "Anyone can update message media"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'message-media');
