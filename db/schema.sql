
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  amount NUMERIC NOT NULL,
  currency VARCHAR(10) NOT NULL,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY,
  aggregate_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now()
);
CREATE TABLE payment_ack (
  payment_id UUID NOT NULL,
  consumer VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  PRIMARY KEY (payment_id, consumer)
);
CREATE TABLE processed_events (
  event_id UUID NOT NULL,
  consumer VARCHAR(50) NOT NULL,
  processed_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (event_id, consumer)
);
