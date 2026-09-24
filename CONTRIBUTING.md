# Contributing

Use Node 22 or newer, `npm ci`, then `npm run check`. Run `npm run demo` and
`npm run demo:graph` for synthetic examples. No credentials are needed for those checks.

Describe the problem, expected behaviour and verification in each pull request.
Use Conventional Commits. Update the living spec alongside contract changes; record
significant architectural choices in `docs/decisions/`. Keep fixtures fictional.

Start product, policy and evaluation changes from [the vision](VISION.md) and its
session-reset and cross-channel examples. Explain how a change helps contextual
awareness, including useful partial recollection or a focused question. Separate
intended behavior from demonstrated behavior and mechanical checks. Record unresolved
design choices rather than treating a complete summary as the default requirement.

Our practices library is [ASDLC.io](https://asdlc.io/practices/):
[minimal AGENTS.md](https://asdlc.io/practices/agents-md-specification/),
[living specs](https://asdlc.io/practices/living-specs/), and
[architecture decisions](https://asdlc.io/practices/adr-authoring/).
We apply these proportionately to a small experimental library.

Report vulnerabilities privately through the repository's GitHub security advisory
feature when enabled; otherwise contact the maintainer before posting sensitive details.
