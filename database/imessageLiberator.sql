CREATE USER liberator WITH ENCRYPTED PASSWORD 'imessage';
CREATE DATABASE liberator OWNER liberator;

\connect liberator

CREATE TABLE contact (
  id SERIAL PRIMARY KEY,
  imessage_id VARCHAR NOT NULL UNIQUE,
  full_name VARCHAR DEFAULT NULL
);
ALTER TABLE contact OWNER TO liberator;
CREATE INDEX ON contact (imessage_id);

CREATE TABLE contact_handle (
  contact_id INT NOT NULL REFERENCES contact (id),
  handle VARCHAR DEFAULT NULL,
  CONSTRAINT contact_id_handle_constraint UNIQUE (contact_id, handle)
);
ALTER TABLE contact_handle OWNER TO liberator;
CREATE INDEX ON contact_handle (handle);

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
