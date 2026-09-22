---
date: 2026-02-24
---

# The telemetry box

The box is the only hardware we ship. Revision C is what every fleet runs today.

## Revision C

- Nordic nRF9160 modem, LTE-M with NB-IoT fallback.
- u-blox MAX-M10S GNSS. Fix within 30 seconds cold, 2 seconds warm.
- 2,000 mAh lithium cell charged by the bike's hub dynamo. Lasts nine days parked without
  a ride.
- IP67 enclosure, bolted under the rear rack. Injection-moulded by Prodeka in Porto.
- Reports every 30 seconds while moving, every 10 minutes when parked, immediately on a
  lock or unlock event, and immediately when the accelerometer sees a shock over 4 g.

## Cost

A revision C box costs 41 EUR in batches of 500, delivered. Sam is negotiating a 2,000 box
order for the Ghent expansion, targeting 36 EUR.

## Known problems

- Cold weather: below minus ten the cell reports low voltage early and the box enters power
  save, dropping the parked interval to once an hour. Sherbrooke sees this every January.
- The Prodeka enclosure's gasket needs replacing after about eighteen months outdoors. Yara
  keeps a spare kit per city.

## Revision D

Planned for the autumn. Adds a second accelerometer axis calibration at boot, a slightly
larger cell, and a gasket design that can be swapped without unbolting the box. Sam has two
hand-built units on her desk in Montreal.
