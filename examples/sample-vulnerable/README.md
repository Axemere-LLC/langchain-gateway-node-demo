# Example Report — sample-vulnerable.ts

This is a pre-generated code review report for [`examples/sample-vulnerable.ts`](../sample-vulnerable.ts), an intentionally flawed TypeScript file used to demonstrate the pipeline.

**[View the live report →](https://axemere-llc.github.io/langchain-gateway-node-demo/examples/sample-vulnerable/report.html)**

## Run details

| Field | Value |
|-------|-------|
| Run ID | `a4ac8aa1` |
| Source file | `examples/sample-vulnerable.ts` |
| Findings | 14 (3 critical, 3 high, 5 medium, 3 low) |
| Cost | $0.01566 |
| Elapsed | 37.9s |

The run ID links directly to the gateway Records page filtered to this run:
[console.axemere.ai/records?label_key=run_id&label_value=a4ac8aa1](https://console.axemere.ai/records?label_key=run_id&label_value=a4ac8aa1)

## Regenerating

To run the pipeline yourself and produce a fresh report:

```bash
make install
cp .env.example .env
# Edit .env: set AXEMERE_GATEWAY_TOKEN and AXEMERE_PROJECT_ID
make review
open output/report.html
```
