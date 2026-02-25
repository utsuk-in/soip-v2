-- Create application user and database
CREATE USER soip_admin WITH PASSWORD 'soip_secure_password';
CREATE DATABASE soip_db OWNER soip_admin;

-- Connect to the new database and set up extensions
\c soip_db
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE soip_db TO soip_admin;
GRANT ALL PRIVILEGES ON SCHEMA public TO soip_admin;
