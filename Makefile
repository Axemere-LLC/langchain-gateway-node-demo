.DEFAULT_GOAL := help
FILE ?= examples/sample-vulnerable.ts

.PHONY: help install build test lint review clean

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	npm install

build: ## Compile TypeScript to dist/
	npm run build

test: ## Run unit tests
	npm test

lint: ## Run ESLint + TypeScript type check
	npm run lint

review: build ## Run the code review pipeline on FILE (default: examples/sample-vulnerable.ts)
	@mkdir -p output
	node --env-file=.env dist/index.js $(FILE) --json

report: ## Re-render HTML from the latest run's JSON result (no LLM calls)
	@latest=$$(ls -t output/*/report.json 2>/dev/null | head -1); \
	if [ -z "$$latest" ]; then echo "No output/*/report.json found — run 'make review' first"; exit 1; fi; \
	out=$${latest%.json}.html; \
	node -e "import('./dist/report/html.js').then(m => { const fs = require('fs'); const r = JSON.parse(fs.readFileSync('$$latest','utf8')); fs.writeFileSync('$$out', m.renderReport(r)); console.log('Report regenerated: ' + '$$out'); })"

clean: ## Remove build artifacts
	rm -rf dist/ output/
