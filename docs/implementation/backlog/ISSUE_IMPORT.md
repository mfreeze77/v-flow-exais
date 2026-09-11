# Issue tracker payloads

`issue-payloads.jsonl` contains one JSON object per ticket with title, body and labels. Dependencies remain explicit in the issue body and backlog JSON. These are export records, not created GitHub/Linear issues. Create matching labels or strip labels before using a platform API; translate dependency IDs to actual issue numbers after creation. Do not assume an external tracker accepts the backlog schema directly. No credentials, repository destination, duplicate-creation command or automatic publishing script is included.
