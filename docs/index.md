---
title: UiGraph SDK
description: Learn about the UiGraph SDK.
slug: /sdk
---

# UiGraph SDK

Use the UiGraph SDK to parse SQL, convert Mermaid diagrams, and build React Flow data for your diagrams.

## Install

```bash
npm install @uigraph/sdk
```

Peer dependencies you may already have: `@xyflow/react`, `zod`, `quill`.

## Import

```ts
import { convertMermaidToReactFlow, SqlToAstParser } from '@uigraph/sdk'
```

## Entry Points

Choose the entry point that matches your runtime.

```ts
import { convertMermaidToReactFlow } from '@uigraph/sdk/browser'
import { convertMermaidToReactFlow as convertHeadless } from '@uigraph/sdk/headless'
```

## Icon Packs

SDK icon lists for cloud and animated nodes:

```ts
import { awsIcons } from '@uigraph/sdk/aws-icons'
import { azureIcons } from '@uigraph/sdk/azure-icons'
import { animatedNodes } from '@uigraph/sdk/animated-nodes'
```

## Guides

- [Mermaid SDK Guide](/sdk/mermaid)
- [SQL SDK Guide](/sdk/sql)
