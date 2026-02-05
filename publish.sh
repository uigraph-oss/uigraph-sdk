#!/bin/bash

pnpm run build && pnpm tsc && pnpm lint && pnpm test && pnpm publish