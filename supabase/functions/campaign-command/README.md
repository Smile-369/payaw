# campaign-command

This Edge Function is the server-side command boundary for Player View. It authenticates the caller, asks the database RPC to validate room membership, capability, revision, idempotency, payload size, and rate limits, then applies the permitted change to that player's safe projection.

It never reads or returns `campaign_authority.campaign_document`. The service-role key is supplied by Supabase at runtime and must never be copied into a browser environment variable.
