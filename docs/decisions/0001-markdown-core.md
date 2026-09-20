# ADR 0001: One Markdown scratchpad per explicit scope

Status: accepted for the 0.1.0 experiment. Date: 2026-09-20.

FOAM must evolve a small working set across hosts without partial memory updates.
Use one `memory.md` in a dedicated directory, with scope and revision frontmatter
and free-form Markdown activity sections. Replace the whole file atomically under
an exclusive directory lock. This chooses the single-file alternative in the study.

An operation reads the whole file, makes at most one interpreter call, validates
its proposed replacement and context, checks the revision, and renames a temporary
file. Failures preserve existing memory. A content hash also detects manual edits.
A crashed process can leave a lock; recovery is deliberately manual after verifying
that no writer is alive. Local filesystems only; distributed synchronization is deferred.

Preparation can change memory. Inspection is read-only instrumentation. Hosts report
actual supplied context as a later observation. Repeated encounters are distinct.
Rewinding a host does not rewind Markdown: use revision checks and a separate scope
snapshot for branches. The model receives untrusted observations as data.
