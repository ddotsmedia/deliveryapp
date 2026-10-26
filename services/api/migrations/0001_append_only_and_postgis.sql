-- Append-only guards: corrections are new rows, never updates or deletes.
CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER order_events_append_only
  BEFORE UPDATE OR DELETE ON order_events
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

CREATE TRIGGER ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
