-- BE-E10 / US-00: denylist server-side de refresh tokens revocados (logout,
-- rotacion y deteccion de reuso). Se limpian filas expiradas de forma perezosa
-- en cada refresh. Reutilizar un jti revocado revoca toda la familia del usuario.
CREATE TABLE "revoked_refresh_tokens" (
    "jti" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revoked_refresh_tokens_pkey" PRIMARY KEY ("jti")
);

CREATE INDEX "revoked_refresh_tokens_expires_at_idx" ON "revoked_refresh_tokens"("expires_at");

ALTER TABLE "revoked_refresh_tokens" ADD CONSTRAINT "revoked_refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;