const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const { optimize } = require('../../tmp/underwater-svg-optimizer/node_modules/svgo/dist/svgo-node.cjs');

async function main() {
  const reportPath = path.join(__dirname, 'reduced-report.json');
  const reports = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  const masterBytes = (await fs.stat(path.join(__dirname, 'underwater-background.svg'))).size;
  for (const report of reports) {
    const file = path.join(__dirname, report.file);
    const source = await fs.readFile(file, 'utf8');
    const before = await sharp(Buffer.from(source)).resize(768, 512).removeAlpha().raw().toBuffer();
    const { data } = optimize(source, {path: file, multipass: true, floatPrecision: 1});
    if (!data.includes('viewBox=') || /<image\b|<script\b|href=|data:image/.test(data)) {
      throw new Error('Unexpected SVG structure');
    }
    await fs.writeFile(file, data);
    const after = await sharp(Buffer.from(data)).resize(768, 512).removeAlpha().raw().toBuffer();
    let error = 0;
    for (let i = 0; i < before.length; i++) error += Math.abs(before[i] - after[i]);
    await sharp(Buffer.from(data)).resize(1068, 712).png().toFile(file.replace('.svg', '-preview.png'));
    report.before_optimization_bytes = report.bytes;
    report.bytes = Buffer.byteLength(data);
    report.paths = (data.match(/<path\b/g) || []).length;
    report.reduction_percent = +(100 * (1 - report.bytes / masterBytes)).toFixed(2);
    report.optimizer = 'SVGO 4.1.0';
    report.rendered = true;
    report.optimization_mean_absolute_channel_error = +(error / before.length).toFixed(3);
    console.log(JSON.stringify(report));
  }
  await fs.writeFile(reportPath, JSON.stringify(reports, null, 2) + '\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
