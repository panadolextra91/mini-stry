/**
 * Phase 1 has no handlers for Audit.
 * Audit logging wires in Phase 3+ when policy lifecycle events emit.
 * The convex/auditLogs table schema is defined in convex/schema.ts.
 * Per D-16 eventType is an open string and event constants are owned by originating modules.
 */
export {};
