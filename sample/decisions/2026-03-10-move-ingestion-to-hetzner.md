---
date: 2026-03-10
---

# Decision: move the ingestion service to Hetzner

## What changes

The ingestion service and the time-series store leave Fly.io and join the dashboard on
Hetzner, in the Falkenstein data centre. Teun runs the migration over the weekend of 21 to
22 March, city by city, with Ghent last. Fly.io is shut down on 31 March.

## Why

Egress. Every telemetry packet is small but there are 1.4 million of them an hour across the
four fleets, and the Fly.io bill crossed 900 EUR a month in February, almost all of it
bandwidth between the ingestion service and the store. On one Hetzner network the same
traffic is free, and the two dedicated machines cost 160 EUR a month together.

## Considered instead

- Staying on Fly.io and batching packets: cuts the bill by half at best, and delays theft
  alerts by up to a minute, which Yara said Ghent would notice.
- AWS in Frankfurt: more expensive than Fly.io once egress is counted.

Signed off by Teun, 10 March 2026.
