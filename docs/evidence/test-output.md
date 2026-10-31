# npm test output

Run on 2026-10-31 08:44 UTC, branch part2-data.

```
 RUN  v2.1.9 C:/Repos/WebForge/webforge_Repo
 ✓ src/lib/schedule.test.ts > Riyadh time helpers > uses Riyadh date, not UTC, just after midnight
 ✓ src/lib/schedule.test.ts > Riyadh time helpers > builds a 7-day window starting today
 ✓ src/lib/schedule.test.ts > Riyadh time helpers > formats slot keys and start moments
 ✓ src/lib/schedule.test.ts > getOpenStartTimes > empty day: every start that fits (06–18 for 1 h, 06–17 for 2 h)
 ✓ src/lib/schedule.test.ts > getOpenStartTimes > conflict: 10:00 taken blocks a 2 h trip at 09:00 and 10:00
 ✓ src/lib/schedule.test.ts > getOpenStartTimes > non-conflict: 10:00 taken still allows a 2 h trip at 08:00 and 11:00
 ✓ src/lib/schedule.test.ts > getOpenStartTimes > a Slot taken for one Site is taken for every Site (1 h trip at 10:00 refused)
 ✓ src/lib/schedule.test.ts > getOpenStartTimes > excludes start times that have already passed today
 ✓ src/lib/schedule.test.ts > getOpenStartTimes > a start time exactly now is not offered
 ✓ src/lib/schedule.test.ts > getOpenStartTimes > reschedule: the Booking's own hours count as free
 ✓ src/lib/schedule.test.ts > getOpenStartTimes > nothing outside the Booking Window or for a bad Trip Length
 Test Files  1 passed (1)
      Tests  11 passed (11)
   Start at  11:44:24
   Duration  498ms (transform 43ms, setup 0ms, collect 79ms, tests 8ms, environment 0ms, prepare 127ms)
```
