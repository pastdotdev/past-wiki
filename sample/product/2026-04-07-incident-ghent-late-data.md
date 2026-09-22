---
date: 2026-04-07
---

# Incident: Ghent data three hours late, 6 April 2026

## What happened

From 02:10 to 05:25 CEST on 6 April the Ghent fleet's telemetry was accepted by the ingestion
service but not written to the time-series store. The dashboard showed every Ghent bike at
its 02:10 position. No alerts were lost; they were delayed by up to three hours. Ghent's
operations desk noticed at 05:40 and emailed Yara. We told them at 06:20, which is outside
the one-hour promise, because the on-call page did not fire.

## Why

The nightly rebalancing job, moved to Hetzner with everything else in March, now runs on the
same machine as the store. On 6 April it loaded the full Ghent history to retrain and pushed
the machine into swap. Writes queued; the ingestion service kept acknowledging packets from
its own buffer, so its health check stayed green and nobody was paged.

## What we changed

- The rebalancing job trains on the last 90 days only and runs on the dashboard machine.
- The ingestion service's health check now fails when its write buffer is older than five
  minutes. Mara shipped this on 7 April.
- Ghent got a credit for April. Ines called their head of mobility the same morning.

## Owner

Mara ran the incident. Priya owns the job change. Closed 7 April 2026.
