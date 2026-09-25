# 0003: Host-owned inference with explicit backend precedence

Status: accepted for the 0.3 implementation, 2026-09-25.

A working agent should not require a second model service just to interpret memory.
Pi supplies its current model registry; LangGraph applications supply a model or
model-only callback. FOAM remains responsible for its bounded evidence, response
validation, timeout and atomic memory update. Host credentials stay with the host.

Selection is explicit adapter, configured project backend, then host fallback.
Keeping this order prevents an upgrade from silently sending a previously local
scratchpad to a remote session provider. Failure never changes the selected backend.

Pi invokes the provider registry directly without tools or agent turns. LangGraph
calls are tagged so applications can exclude them from visible model streams; tags
alone cannot guarantee privacy in arbitrary application callbacks. SDK retries and
provider-specific token options remain the LangGraph caller's responsibility.

This changes integration, not the recollection policy, storage format or authorization
boundary. Sharing a host model adds calls and latency and does not establish reliable
recall. Provider doubles prove routing/isolation; local live probes give bounded
behavioral evidence. Neither establishes every provider's OAuth or output behavior.
