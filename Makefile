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
	node dist/index.js $(FILE) --out output/report.html --json
	@echo ""
	@echo "Report: output/report.html"

report: ## Re-render HTML from last JSON result (no LLM calls)
	@if [ ! -f output/report.json ]; then echo "No output/report.json found — run 'make review' first"; exit 1; fi
	node -e "import('./dist/report/html.js').then(m => { const fs = require('fs'); const r = JSON.parse(fs.readFileSync('output/report.json','utf8')); fs.writeFileSync('output/report.html', m.renderReport(r)); console.log('Report regenerated: output/report.html'); })"

clean: ## Remove build artifacts
	rm -rf dist/ output/
