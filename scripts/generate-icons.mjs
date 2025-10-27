import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import iconGen from 'icon-gen';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SRC_SVG = path.join(ROOT_DIR, 'docs/graphics/icon.svg');
const OUT = path.join(ROOT_DIR, 'app/resources/icons');
const TMP = path.join(OUT, '__tmp_png');

const LINUX_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

async function clean() {
  await fs.rm(OUT, { recursive: true, force: true });
}

async function ensureDirs() {
  const baseDirs = [OUT, path.join(OUT, 'linux'), path.join(OUT, 'mac'), path.join(OUT, 'win'), TMP];
  await Promise.all(baseDirs.map((dir) => fs.mkdir(dir, { recursive: true })));
}

async function renderPngsFromSvg() {
  try {
    await fs.access(SRC_SVG);
  } catch (error) {
    throw new Error(`Missing source SVG at ${SRC_SVG}`);
  }

  const svgBuffer = await fs.readFile(SRC_SVG);
  const linuxDir = path.join(OUT, 'linux');

  const renderJobs = LINUX_SIZES.map(async (size) => {
    const outputPath = path.join(linuxDir, `icon_${size}x${size}.png`);
    await sharp(svgBuffer).resize(size, size).png().toFile(outputPath);
  });

  const masterPngPath = path.join(TMP, 'icon_1024x1024.png');
  renderJobs.push(sharp(svgBuffer).resize(1024, 1024).png().toFile(masterPngPath));

  await Promise.all(renderJobs);
  return masterPngPath;
}

async function buildIcnsAndIco(masterPngPath) {
  const macDest = path.join(OUT, 'mac');
  const winDest = path.join(OUT, 'win');

  await iconGen(masterPngPath, macDest, {
    report: false,
    icns: {
      name: 'icon',
      sizes: [16, 32, 64, 128, 256, 512, 1024],
    },
  });

  await iconGen(masterPngPath, winDest, {
    report: false,
    ico: {
      name: 'icon',
      sizes: [16, 24, 32, 48, 64, 128, 256],
    },
  });
}

async function writeReadme() {
  const readmePath = path.join(OUT, 'README.md');
  const contents = `# Generated app icons\n\nThese assets are generated via \`pnpm icons\` and excluded from version control.\n`;
  await fs.writeFile(readmePath, contents, 'utf8');
}

async function main() {
  try {
    await clean();
    await ensureDirs();
    const masterPngPath = await renderPngsFromSvg();
    await buildIcnsAndIco(masterPngPath);
    await writeReadme();
    await fs.rm(TMP, { recursive: true, force: true });
    console.log('✅ Icons generated in resources/icons');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Icon generation failed: ${message}`);
    process.exit(1);
  }
}

main();
