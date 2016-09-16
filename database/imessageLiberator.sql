CREATE USER liberator WITH ENCRYPTED PASSWORD 'imessage';
CREATE DATABASE liberator OWNER liberator;

\connect liberator

CREATE TABLE contact (
  imessage_id VARCHAR PRIMARY KEY,
  full_name VARCHAR DEFAULT NULL,
);
ALTER TABLE contact OWNER TO liberator;

CREATE TABLE contact_handle (
  contact_imessage_id VARCHAR NOT NULL REFERENCES contact (imessage_id),
  handle VARCHAR DEFAULT NULL
);
ALTER TABLE contact_handle OWNER TO liberator;

CREATE TABLE message_channel (
  id SERIAL PRIMARY KEY,
  name VARCHAR DEFAULT NULL
);
ALTER TABLE message_channel OWNER TO liberator;
INSERT INTO message_channel (name) VALUES (
  'slack'
);

CREATE TABLE contact_mapping (
  id SERIAL PRIMARY KEY,
  message_channel_id INT NOT NULL REFERENCES message_channel (id),
  contact_id INT NOT NULL REFERENCES contact (id),
  channel_key VARCHAR DEFAULT NULL,
  channel_name VARCHAR DEFAULT NULL
);
ALTER TABLE contact_mapping OWNER TO liberator;
