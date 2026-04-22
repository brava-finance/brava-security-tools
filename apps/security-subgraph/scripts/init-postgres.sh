#!/usr/bin/env bash
# Executed by the official postgres image on first boot (files in
# /docker-entrypoint-initdb.d/ only run when PGDATA is empty). Creates a
# separate database per chain so each graph-node instance is fully isolated.
set -euo pipefail

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
  CREATE DATABASE graph_arbitrum WITH OWNER $POSTGRES_USER ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;
  CREATE DATABASE graph_base     WITH OWNER $POSTGRES_USER ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;
  CREATE DATABASE graph_mainnet  WITH OWNER $POSTGRES_USER ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0;
EOSQL
