---
date: 2026-01-19
---

# How we work

## Rhythm

- Monday 10:00 CET: planning, thirty minutes, whole team. Each person names the one thing
  they will finish this week.
- Thursday 16:00 CET: demo. Anything shipped since last Thursday gets shown, however small.
- Fridays are meeting-free.
- Two on-sites a year, one in spring in Lisbon and one in autumn in Rotterdam.

## Decisions

Anything that changes what a customer sees, what we charge, or what we store gets a written
proposal in the `decisions/` folder before it happens. One page, three sections: what we are
changing, why, and what we considered instead. Ines or Teun signs off; the note records who.

## Support

Yara triages every ticket the same business day. Anything that looks like a fleet-wide outage
pages the on-call engineer (rotation: Teun, Mara, Julien, one week each). A city is told
within an hour if its data is late.

## Tools

Code on GitHub, chat on Slack, tickets in Linear, contracts and invoices in Noor's shared
drive. The dashboard runs on Hetzner; the ingestion service and the time-series store run on
Fly.io in Amsterdam.
