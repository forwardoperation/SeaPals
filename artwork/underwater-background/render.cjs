const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

async function main() {
  const svg = path.join(__dirname, 'underwater-background.svg');
  const preview = path.join(__dirname, 'underwater-background-preview.png');
  await sharp(svg).png().toFile(preview);
  const [reference, rendered] = await Promise.all([
    sharp(path.join(__dirname, 'water-cleaned.png')).removeAlpha().raw().toBuffer(),
    sharp(preview).removeAlpha().raw().toBuffer(),
  ]);
  if (reference.length !== rendered.length) throw new Error('Image dimensions differ');
  let absoluteError = 0;
  let squaredError = 0;
  for (let i = 0; i < reference.length; i++) {
    const delta = reference[i] - rendered[i];
    absoluteError += Math.abs(delta);
    squaredError += delta * delta;
  }
  const reportPath = path.join(__dirname, 'vector-report.json');
  const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  report.render_validation = {
    renderer: 'sharp / librsvg',
    width: 1536,
    height: 1024,
    mean_absolute_channel_error: +(absoluteError / reference.length).toFixed(3),
    peak_signal_to_noise_ratio_db: +(10 * Math.log10(255 ** 2 / (squaredError / reference.length))).toFixed(2),
  };
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.render_validation));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
