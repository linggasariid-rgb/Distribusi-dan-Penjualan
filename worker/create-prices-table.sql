-- Create product_prices table
CREATE TABLE IF NOT EXISTS public.product_prices (
    product_name TEXT PRIMARY KEY,
    price_mst INTEGER NOT NULL DEFAULT 0,
    price_stk INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;

-- Create policy for public read (worker reads it)
CREATE POLICY "Allow anonymous read access on product_prices"
    ON public.product_prices
    FOR SELECT
    TO anon
    USING (true);

-- Create policy for public insert/update (worker updates it)
CREATE POLICY "Allow anonymous insert access on product_prices"
    ON public.product_prices
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Allow anonymous update access on product_prices"
    ON public.product_prices
    FOR UPDATE
    TO anon
    USING (true);

-- Insert default products
INSERT INTO public.product_prices (product_name, price_mst, price_stk) VALUES
('SPS TSI', 0, 0),
('SKM TSI', 0, 0),
('SM', 0, 0),
('SP19 TSI', 0, 0),
('SPF', 0, 0),
('SMM', 0, 0),
('ST', 0, 0),
('SSJ', 0, 0),
('STM', 0, 0),
('SKMF', 0, 0),
('SK', 0, 0),
('SNN ORG', 0, 0),
('SNN Mind', 0, 0),
('SNN Menthol', 0, 0),
('SPW', 0, 0),
('SP', 0, 0),
('KMK', 0, 0),
('KOOR', 0, 0),
('SSE', 0, 0)
ON CONFLICT (product_name) DO NOTHING;
