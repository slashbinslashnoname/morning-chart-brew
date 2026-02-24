# tv-print

Capture TradingView charts across multiple timeframes and compose them into clean, printable PDF reports — fully automated.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![Puppeteer](https://img.shields.io/badge/Puppeteer-24-40B5A4?logo=puppeteer&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue)

---

## How it works

1. Launches a headless browser via Puppeteer
2. Loads the TradingView widget for each symbol and timeframe
3. Screenshots each chart at high resolution (2x scale)
4. Composes them into a single-page layout — one large chart on top, smaller timeframes below
5. Exports to A4 PDF and optionally sends to your system printer

```
┌──────────────────────────────────────┐
│                                      │
│             4H Chart                 │
│              (55%)                   │
│                                      │
├──────────────────┬───────────────────┤
│                  │                   │
│    1D Chart      │     1W Chart      │
│     (45%)        │      (45%)        │
│                  │                   │
└──────────────────┴───────────────────┘
```

## Quick start

```bash
npm install
npm start
```

PDFs are saved to `./output/` by default.

## Configuration

Edit `config.json` to customize everything:

```jsonc
{
  // Trading pairs to capture
  "symbols": [
    { "symbol": "BITSTAMP:BTCUSD", "name": "BTCUSD" },
    { "symbol": "BITSTAMP:ETHUSD", "name": "ETHUSD" }
  ],

  // Timeframes — first one gets the top (large) spot
  "timeframes": [
    { "interval": "240", "label": "4H" },
    { "interval": "D",   "label": "1D" },
    { "interval": "W",   "label": "1W" }
  ],

  // TradingView widget settings
  "chart": {
    "timezone": "Europe/Paris",
    "theme": "light",
    "locale": "fr",
    "style": "1",
    "studies": ["BB@tv-basicstudies"]
  },

  // Screenshot quality
  "capture": {
    "viewportWidth": 1600,
    "viewportHeight": 900,
    "deviceScaleFactor": 2,
    "chartLoadWaitMs": 8000
  },

  // PDF layout
  "pdf": {
    "format": "A4",
    "landscape": true,
    "topChartFlex": 55,
    "bottomChartFlex": 45,
    "paddingMm": 3,
    "gapMm": 2
  },

  // Output
  "output": {
    "directory": "./output",
    "print": true
  }
}
```

You can also pass a custom config path:

```bash
node print-charts.js /path/to/my-config.json
```

## CLI usage

Install globally to use as a command:

```bash
npm link
tv-print
tv-print /path/to/config.json
```

## Printing

When `output.print` is `true`, the tool automatically sends PDFs to your default system printer using `lp`. If no printer is found, PDFs are simply saved to disk.

To disable auto-printing:

```json
{ "output": { "print": false } }
```

## Crontab

To run tv-print on a schedule, add an entry to your crontab:

```bash
crontab -e
```

Example — generate and print charts every day at 8:00 AM:

```cron
0 8 * * * cd ~/Projects/tradingview-print-cron && /usr/bin/node print-charts.js >> /tmp/tv-print.log 2>&1
```

Common schedules:

| Schedule | Cron expression |
|---|---|
| Every day at 8 AM | `0 8 * * *` |
| Weekdays at 8 AM | `0 8 * * 1-5` |
| Every 6 hours | `0 */6 * * *` |
| Every Monday at 9 AM | `0 9 * * 1` |

**Tips:**

- Use absolute paths for both `node` and the project directory — cron doesn't load your shell profile
- Find your Node path with `which node`
- Redirect output to a log file (`>> /tmp/tv-print.log 2>&1`) to debug issues
- Verify your crontab is saved with `crontab -l`
