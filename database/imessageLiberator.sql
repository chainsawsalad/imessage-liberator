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
  disabled BOOLEAN DEFAULT FALSE,
  CONSTRAINT contact_id_handle_constraint UNIQUE (contact_id, handle)
);
ALTER TABLE contact_handle OWNER TO liberator;
CREATE INDEX ON contact_handle (handle);

CREATE TABLE message_channel (
  id INT PRIMARY KEY,
  name VARCHAR DEFAULT NULL
);
ALTER TABLE message_channel OWNER TO liberator;
INSERT INTO message_channel (id, name) VALUES (
  0, 'SLACK'
);

CREATE TABLE contact_channel_mapping (
  id SERIAL PRIMARY KEY,
  message_channel_id INT NOT NULL REFERENCES message_channel (id),
  contact_id INT NOT NULL REFERENCES contact (id),
  channel_key VARCHAR DEFAULT NULL,
  channel_name VARCHAR DEFAULT NULL,
  CONSTRAINT contact_id_message_channel_id_constraint UNIQUE (contact_id, message_channel_id)
);
ALTER TABLE contact_channel_mapping OWNER TO liberator;
