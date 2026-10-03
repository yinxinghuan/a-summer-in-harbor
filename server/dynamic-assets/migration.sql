BEGIN;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='5s';
DO $$ BEGIN IF current_database() <> 'harbor_game' OR current_user <> 'harbor_migrator' THEN RAISE EXCEPTION 'wrong migration scope'; END IF; END $$;
CREATE TABLE kit_harbor.harbor_asset_packages (
 package_hash TEXT PRIMARY KEY CHECK(package_hash ~ '^[a-f0-9]{64}$'),
 room_hash TEXT NOT NULL CHECK(room_hash ~ '^[a-f0-9]{64}$'),
 template_hash TEXT NOT NULL CHECK(template_hash ~ '^[a-f0-9]{64}$'),
 profile_hash TEXT NOT NULL CHECK(profile_hash ~ '^[a-f0-9]{64}$'),
 template_id TEXT NOT NULL, template_version INTEGER NOT NULL CHECK(template_version>0),
 body JSONB NOT NULL CHECK(jsonb_typeof(body)='object'),
 byte_count BIGINT NOT NULL CHECK(byte_count BETWEEN 1 AND 20971520),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE kit_harbor.harbor_asset_grants (
 world TEXT NOT NULL CHECK(world='e78df027-7ef4-4d49-82eb-ea91f03d9fb3'),
 owner TEXT NOT NULL CHECK(owner ~ '^[a-f0-9]{64}$'),session TEXT NOT NULL,
 room TEXT NOT NULL CHECK(room IN ('home','cafe','garden')),consumer_id TEXT NOT NULL UNIQUE,
 package_hash TEXT NOT NULL REFERENCES kit_harbor.harbor_asset_packages(package_hash),
 "grant" JSONB NOT NULL CHECK(jsonb_typeof("grant")='object'),grant_hash TEXT NOT NULL CHECK(grant_hash ~ '^[a-f0-9]{64}$'),
 lease_revision BIGINT NOT NULL DEFAULT 1 CHECK(lease_revision>0),
 expires_at TIMESTAMPTZ NOT NULL,revoked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(world,owner,session,room),FOREIGN KEY(world,session) REFERENCES kit_harbor.async_journeys(world,id)
);
REVOKE ALL ON kit_harbor.harbor_asset_packages,kit_harbor.harbor_asset_grants FROM PUBLIC,harbor_runtime;
GRANT SELECT,INSERT ON kit_harbor.harbor_asset_packages TO harbor_runtime;
GRANT SELECT,INSERT,UPDATE ON kit_harbor.harbor_asset_grants TO harbor_runtime;
COMMIT;
