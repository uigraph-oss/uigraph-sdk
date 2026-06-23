# @uigraph/sdk

[![npm version](https://img.shields.io/npm/v/@uigraph/sdk)](https://www.npmjs.com/package/@uigraph/sdk)
[![license](https://img.shields.io/badge/license-BUSL--1.1-blue)](LICENSE)

Official TypeScript SDK for [UiGraph](https://github.com/uigraph-oss). Parse SQL and NoSQL schemas, convert Mermaid diagrams, and produce [React Flow](https://reactflow.dev/) node and edge data for architecture and data-model diagrams.

## Features

- **Mermaid → React Flow** — flowcharts, sequence diagrams, and more
- **Context-aware conversion** — apply node, edge, and group overrides after parsing
- **SQL parsing** — MySQL, PostgreSQL, SQLite with dialect auto-detection
- **Schema → diagram** — convert SQL AST into diagram-ready structures
- **NoSQL schemas** — MongoDB, DynamoDB, and JSON schema support
- **Icon packs** — AWS, Azure, and animated node icon lists
- **Multiple runtimes** — full, browser, and headless entry points

## Install

```sh
npm install @uigraph/sdk
```

Peer dependencies (install if you do not already have them):

```sh
npm install @xyflow/react zod quill
```

## Quick start

Convert Mermaid source into React Flow data:

```ts
import { convertMermaidToReactFlow } from '@uigraph/sdk'

const mermaid = `flowchart TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Done]
  B -->|No| D[Retry]
`

const { nodes, edges } = await convertMermaidToReactFlow(mermaid)
```

Parse SQL and work with the schema AST:

```ts
import { SqlToAstParser } from '@uigraph/sdk'

const dialect = SqlToAstParser.detectDialect(sql)
const ast = new SqlToAstParser(dialect).parse(sql)
```

## Package entry points

| Import | Use when |
|--------|----------|
| `@uigraph/sdk` | Full SDK (Node.js or bundlers) |
| `@uigraph/sdk/browser` | Browser environments |
| `@uigraph/sdk/headless` | Server-side conversion without DOM APIs |
| `@uigraph/sdk/aws-icons` | AWS icon metadata |
| `@uigraph/sdk/azure-icons` | Azure icon metadata |
| `@uigraph/sdk/animated-nodes` | Animated node icon metadata |

```ts
import { convertMermaidToReactFlow } from '@uigraph/sdk/browser'
import { awsIcons } from '@uigraph/sdk/aws-icons'
```

## Documentation

- [Mermaid conversion guide](docs/mermaid.md)
- [SQL parsing guide](docs/sql.md)

## Development

Requires Node.js 20+ and [pnpm](https://pnpm.io/).

```sh
pnpm install
pnpm dev      # watch build, typecheck, and tests
pnpm test
pnpm lint
pnpm run build
```

### Publishing a release

1. Bump the version in `package.json` and merge to `main`.
2. Create a [GitHub Release](https://github.com/uigraph-oss/uigraph-sdk/releases) with tag `vX.Y.Z` matching that version.
3. CI publishes to [npm](https://www.npmjs.com/package/@uigraph/sdk).

The repo needs an `NPM_TOKEN` secret (npm Automation token) configured before the first publish.

## License

This project is licensed under the [Business Source License 1.1](LICENSE) (BUSL-1.1).

- **Source available today** — you can read, modify, and redistribute the code under the terms of the license.
- **Production use** — permitted for most use cases, including internal and product integration. You may not offer the SDK (or substantial portions of it) as a hosted or embedded competitive offering against UiGraph's commercial platform. See [LICENSE](LICENSE) for the full Additional Use Grant.
- **Future open source** — each version automatically converts to [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0) four years after it is first published under BUSL.

BUSL is not an OSI-approved open source license during the initial term. For questions about commercial licensing, open an issue or contact the maintainers.

## Related projects

- [uigraph-ui](https://github.com/uigraph-oss/uigraph-ui) — web application
- [uigraph-api](https://github.com/uigraph-oss/uigraph-api) — backend API
- [uigraph-graphql](https://github.com/uigraph-oss/uigraph-graphql) — GraphQL BFF
