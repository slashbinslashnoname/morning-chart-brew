#!/usr/bin/env node

const puppeteer = require("puppeteer");
const path = require("path");
const { execSync } = require("child_process");
const fs = require("fs");

// Load config: CLI arg path > ./config.json
const configPath = path.resolve(process.argv[2] || path.join(__dirname, "config.json"));
if (!fs.existsSync(configPath)) {
  console.error(`Config not found: ${configPath}`);
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const { symbols, timeframes, chart, capture, pdf, output } = config;

function buildChartHTML(symbol, interval) {
  return `<!DOCTYPE html>
<html><head>
<style>
  * { margin: 0; padding: 0; }
  body { background: #fff; overflow: hidden; }
  #tv_chart { width: 100vw; height: 100vh; }
</style>
</head><body>
<div id="tv_chart"></div>
<script src="https://s3.tradingview.com/tv.js"></script>
<script>
new TradingView.widget({
  container_id: "tv_chart",
  autosize: true,
  symbol: "${symbol}",
  interval: "${interval}",
  timezone: "${chart.timezone}",
  theme: "${chart.theme}",
  style: "${chart.style}",
  locale: "${chart.locale}",
  toolbar_bg: "#f1f3f6",
  enable_publishing: false,
  hide_side_toolbar: true,
  hide_top_toolbar: false,
  withdateranges: true,
  allow_symbol_change: false,
  save_image: false,
  studies: ${JSON.stringify(chart.studies)},
  show_popup_button: false,
});
</script>
</body></html>`;
}

async function captureChart(browser, symbol, interval) {
  const page = await browser.newPage();
  await page.setViewport({
    width: capture.viewportWidth,
    height: capture.viewportHeight,
    deviceScaleFactor: capture.deviceScaleFactor,
  });

  const html = buildChartHTML(symbol, interval);
  await page.setContent(html, { waitUntil: "networkidle0", timeout: capture.pageLoadTimeoutMs });
  await page.waitForSelector("iframe", { timeout: capture.iframeTimeoutMs });
  await new Promise((r) => setTimeout(r, capture.chartLoadWaitMs));

  const iframe = await page.$("iframe");
  const screenshotBuffer = await iframe.screenshot({ encoding: "base64" });

  await page.close();
  return screenshotBuffer;
}

function buildComposeHTML(screenshots, labels) {
  const topLabel = labels[0];
  const bottomLabels = labels.slice(1);

  const bottomCharts = bottomLabels
    .map(
      (l) => `<div class="bottom-chart">
      <img src="data:image/png;base64,${screenshots[l]}">
    </div>`
    )
    .join("\n    ");

  return `<!DOCTYPE html>
<html><head><style>
  @page { size: ${pdf.format} ${pdf.landscape ? "landscape" : "portrait"}; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${pdf.landscape ? "297mm" : "210mm"}; height: ${pdf.landscape ? "210mm" : "297mm"}; overflow: hidden; background: #fff; font-family: Arial, sans-serif; }
  .container { width: 100%; height: 100%; display: flex; flex-direction: column; padding: ${pdf.paddingMm}mm; gap: ${pdf.gapMm}mm; }
  .top { flex: ${pdf.topChartFlex}; width: 100%; overflow: hidden; border: 1px solid #ddd; border-radius: 2px; }
  .top img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .bottom { flex: ${pdf.bottomChartFlex}; display: flex; gap: ${pdf.gapMm}mm; width: 100%; }
  .bottom-chart { flex: 1; overflow: hidden; border: 1px solid #ddd; border-radius: 2px; }
  .bottom-chart img { width: 100%; height: 100%; object-fit: fill; display: block; }
</style></head><body>
<div class="container">
  <div class="top">
    <img src="data:image/png;base64,${screenshots[topLabel]}">
  </div>
  <div class="bottom">
    ${bottomCharts}
  </div>
</div>
</body></html>`;
}

async function captureAndPrint() {
  const outDir = path.resolve(output.directory);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
  });

  const pdfFiles = [];
  const labels = timeframes.map((t) => t.label);

  for (const { symbol, name } of symbols) {
    console.log(`Capturing ${name}...`);

    const screenshots = {};
    for (const { interval, label } of timeframes) {
      console.log(`  ${label}...`);
      screenshots[label] = await captureChart(browser, symbol, interval);
    }

    const composePage = await browser.newPage();
    await composePage.setViewport({
      width: pdf.landscape ? 1122 : 794,
      height: pdf.landscape ? 794 : 1122,
      deviceScaleFactor: capture.deviceScaleFactor,
    });
    await composePage.setContent(buildComposeHTML(screenshots, labels), { waitUntil: "load" });
    await new Promise((r) => setTimeout(r, 1000));

    const pdfPath = path.join(outDir, `${name}.pdf`);
    await composePage.pdf({
      path: pdfPath,
      landscape: pdf.landscape,
      format: pdf.format,
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });

    await composePage.close();
    console.log(`  -> Saved ${pdfPath}`);
    pdfFiles.push(pdfPath);
  }

  await browser.close();

  if (!output.print) {
    console.log(`\nPDFs saved in ${outDir}`);
    return;
  }

  try {
    const defaultPrinter = execSync("lpstat -d 2>/dev/null").toString().trim();
    if (defaultPrinter && !defaultPrinter.includes("no system")) {
      for (const pdfFile of pdfFiles) {
        console.log(`Printing ${path.basename(pdfFile)}...`);
        execSync(`lp -o landscape -o fit-to-page "${pdfFile}"`);
      }
      console.log("All charts sent to printer!");
    } else {
      console.log(`\nNo default printer. PDFs saved in ${outDir}`);
    }
  } catch {
    console.log(`\nPDFs saved in ${outDir}`);
  }
}

captureAndPrint().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
