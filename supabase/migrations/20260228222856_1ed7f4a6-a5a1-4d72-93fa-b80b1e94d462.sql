
-- Add variation_indices to track which spintax option was chosen per block
-- e.g. [2, 0, 1] means block 0 picked option 2, block 1 picked option 0, etc.
ALTER TABLE public.broadcast_recipients
ADD COLUMN variation_indices integer[] DEFAULT '{}';
