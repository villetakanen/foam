# 0002: Project configuration, explicit evidence and conservative local recovery

Status: accepted for the 0.2 implementation, 2026-09-23.

FOAM needs one host-owned scope binding across Pi, LangGraph and embedded clients,
and interrupted operations must be inspectable without guessing whether a commit
happened. Keep Markdown authoritative and keep diagnostics separate.

Use versioned `foam.config.json` at the explicitly supplied project root, with an
ignored runtime root, named scope directories and optional preserved scope labels.
An injected adapter takes precedence over the configured backend. Project mode does
not read legacy backend/directory environment variables; Pi requires explicit legacy
mode for those. No executable modules are loaded from configuration.

Extend encounters with bounded ordered role-labelled evidence and correlation.
Expose a host audit sink and optional bounded local ring; no mandatory history store.
Diagnostics are observational and cannot roll back or falsely fail a successful commit.

Retain exclusive directory acquisition, now with writer ownership. Serialize all
writer-lock lifecycle changes under a separate, short-lived directory gate. The gate
prevents competing recovery attempts from removing a newly acquired writer's lock.
A vanished local PID permits explicit recovery only while this gate is held. A live
reused PID causes refusal, not mistaken ownership. This trades occasional conservative
offline repair for portable Node-only coordination without native locking dependencies.

A crash while holding the gate requires an operator to stop all clients, inspect the
snapshot and remove the stale gate. We do not recursively recover the recovery lock,
use an age threshold, or treat atomic rename of an unchecked pathname as compare-and-swap.
The documented scope is cooperating processes on a trusted local filesystem.
Subprocess tests cover both sides of commit and loss of result delivery. Recovery reports
ambiguity and never silently retries. Automatic task deduplication would change memory
semantics and belongs to the host, not this mechanism.
