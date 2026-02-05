#!/bin/bash

pnpm run build &&
	pnpm tsc &&
	pnpm test &&
	pnpm publish --no-git-checks
