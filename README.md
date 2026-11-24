# News Image — 24 November 2026

[![make.fun · news-image-20261124](https://make.fun/badge/news-image-20261124.svg)](https://make.fun/bounty/news-image-20261124?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124)
[![rank](https://make.fun/badge/news-image-20261124/herlienn/news-image-entry-24nov/rank.svg)](https://make.fun/bounty/news-image-20261124/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124)
[![reward](https://make.fun/badge/news-image-20261124/herlienn/news-image-entry-24nov/reward.svg)](https://make.fun/bounty/news-image-20261124?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261124)

One image that sums up the world's news of Tuesday, 24 November 2026: 43 stories
from 6 continents, drawn in code by a Node 22 program (standard library only)
that writes `/output/entry.png`.

Bounty: https://make.fun/bounty/news-image-20261124

Built for the make.fun bounty "Sum up 24 November's world news in one image".
My referral link: https://make.fun/r/4a84jcbk

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

The program draws the newspaper image deterministically (fixed seed, no
network, no clock) and writes `entry.png` (1024x1024, under 1 MiB). Two runs
produce byte-identical output.
