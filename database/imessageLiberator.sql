CREATE USER liberator WITH ENCRYPTED PASSWORD 'imessage';
CREATE DATABASE liberator OWNER liberator;

\connect liberator

CREATE TABLE contact (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR DEFAULT NULL,
  handle VARCHAR DEFAULT NULL
);
ALTER TABLE contact OWNER TO liberator;

CREATE TABLE message_group (
  id SERIAL PRIMARY KEY,
  name VARCHAR DEFAULT NULL
);
ALTER TABLE message_group OWNER TO liberator;

CREATE TABLE group_member (
  id SERIAL PRIMARY KEY,
  contact_id INT NOT NULL REFERENCES contact (id),
  group_id INT NOT NULL REFERENCES message_group (id)
);
ALTER TABLE group_member OWNER TO liberator;

CREATE TABLE message (
  id SERIAL PRIMARY KEY,
  group_member_id INT NOT NULL REFERENCES group_member (id),
  body VARCHAR DEFAULT NULL,
  attachment VARCHAR DEFAULT NULL,
  message_received TIMESTAMP DEFAULT NULL
);
ALTER TABLE message OWNER TO liberator;
