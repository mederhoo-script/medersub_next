-- Backfill: create a zero-balance wallet for every profile that does not yet
-- have a wallet row.  This is an idempotent no-op if all wallets already exist.
-- Telegram users created before the application-level wallet-creation fix was
-- deployed will have their wallets provisioned here so they can fund and
-- purchase without being rejected with "User wallet not found."

INSERT INTO wallets (user_id, balance)
SELECT id, 0
FROM profiles p
WHERE NOT EXISTS (SELECT 1 FROM wallets w WHERE w.user_id = p.id);
