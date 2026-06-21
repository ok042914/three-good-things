import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dirname, '../public')

// 5角形の星パスを生成（cx/cy: 中心, R: 外半径, r: 内半径）
function starPath(cx, cy, R, r) {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI / 5) - Math.PI / 2
    const radius = i % 2 === 0 ? R : r
    pts.push(`${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
}

// チェックマークパスを生成（cx/cy: 中心, s: サイズ）
function checkPath(cx, cy, s) {
  const x1 = (cx - s * 0.52).toFixed(1)
  const y1 = cy.toFixed(1)
  const x2 = (cx - s * 0.06).toFixed(1)
  const y2 = (cy + s * 0.46).toFixed(1)
  const x3 = (cx + s * 0.54).toFixed(1)
  const y3 = (cy - s * 0.46).toFixed(1)
  return `M${x1},${y1} L${x2},${y2} L${x3},${y3}`
}

function buildSvg(withBackground) {
  const bg = withBackground
    ? `<rect width="512" height="512" rx="112" ry="112" fill="#A8D5BA"/>`
    : ''

  return `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  ${bg}

  <!-- ノート（影） -->
  <rect x="132" y="97" width="252" height="328" rx="18" fill="rgba(0,0,0,0.07)"/>

  <!-- ノート本体 -->
  <rect x="128" y="92" width="252" height="328" rx="18" fill="#FFFDF7"/>

  <!-- 左側の綴じ部分 -->
  <rect x="128" y="92" width="46" height="328" rx="18" fill="#EDE9DF"/>
  <rect x="150" y="92" width="24" height="328" fill="#EDE9DF"/>

  <!-- 綴じ穴（背景色と同じで穴に見える） -->
  <circle cx="160" cy="138" r="9" fill="${withBackground ? '#A8D5BA' : '#C8E8D5'}"/>
  <circle cx="160" cy="184" r="9" fill="${withBackground ? '#A8D5BA' : '#C8E8D5'}"/>
  <circle cx="160" cy="230" r="9" fill="${withBackground ? '#A8D5BA' : '#C8E8D5'}"/>
  <circle cx="160" cy="276" r="9" fill="${withBackground ? '#A8D5BA' : '#C8E8D5'}"/>
  <circle cx="160" cy="322" r="9" fill="${withBackground ? '#A8D5BA' : '#C8E8D5'}"/>
  <circle cx="160" cy="368" r="9" fill="${withBackground ? '#A8D5BA' : '#C8E8D5'}"/>

  <!-- 星 3つ（中央が大きい） -->
  <path d="${starPath(197, 176, 21, 8.5)}" fill="#F6C453"/>
  <path d="${starPath(256, 160, 30, 12)}" fill="#F6C453"/>
  <path d="${starPath(315, 176, 21, 8.5)}" fill="#F6C453"/>

  <!-- 罫線1 + チェック -->
  <path d="${checkPath(193, 250, 22)}" stroke="#6BBF8E" stroke-width="5.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="220" y1="250" x2="366" y2="250" stroke="#D8D4CA" stroke-width="5" stroke-linecap="round"/>

  <!-- 罫線2 + チェック -->
  <path d="${checkPath(193, 308, 22)}" stroke="#6BBF8E" stroke-width="5.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="220" y1="308" x2="366" y2="308" stroke="#D8D4CA" stroke-width="5" stroke-linecap="round"/>

  <!-- 罫線3 + チェック -->
  <path d="${checkPath(193, 366, 22)}" stroke="#6BBF8E" stroke-width="5.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="220" y1="366" x2="366" y2="366" stroke="#D8D4CA" stroke-width="5" stroke-linecap="round"/>
</svg>`
}

// ICO形式のバッファを生成（PNG埋め込み）
function createIcoBuffer(pngBuffer) {
  const dataOffset = 6 + 16  // header(6) + 1 dirEntry(16)

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)  // Reserved
  header.writeUInt16LE(1, 2)  // Type: ICO
  header.writeUInt16LE(1, 4)  // Image count

  const dir = Buffer.alloc(16)
  dir.writeUInt8(32, 0)                    // Width
  dir.writeUInt8(32, 1)                    // Height
  dir.writeUInt8(0, 2)                     // Color count
  dir.writeUInt8(0, 3)                     // Reserved
  dir.writeUInt16LE(1, 4)                  // Planes
  dir.writeUInt16LE(32, 6)                 // Bit depth
  dir.writeUInt32LE(pngBuffer.length, 8)   // Data size
  dir.writeUInt32LE(dataOffset, 12)        // Data offset

  return Buffer.concat([header, dir, pngBuffer])
}

async function main() {
  const svgWithBg  = Buffer.from(buildSvg(true))
  const svgNoBg    = Buffer.from(buildSvg(false))

  const targets = [
    { file: 'apple-touch-icon.png',          size: 180,  svg: svgWithBg },
    { file: 'icon-192.png',                  size: 192,  svg: svgWithBg },
    { file: 'icon-512.png',                  size: 512,  svg: svgWithBg },
    { file: 'icon-1024.png',                 size: 1024, svg: svgWithBg },
    { file: 'icon-192-transparent.png',      size: 192,  svg: svgNoBg   },
    { file: 'icon-512-transparent.png',      size: 512,  svg: svgNoBg   },
  ]

  for (const { file, size, svg } of targets) {
    await sharp(svg, { density: 300 })
      .resize(size, size)
      .png()
      .toFile(`${publicDir}/${file}`)
    console.log(`✓ ${file} (${size}x${size})`)
  }

  // favicon.ico（32x32のPNGをICO形式に包む）
  const faviconPng = await sharp(svgWithBg, { density: 300 })
    .resize(32, 32)
    .png()
    .toBuffer()
  writeFileSync(`${publicDir}/favicon.ico`, createIcoBuffer(faviconPng))
  console.log('✓ favicon.ico (32x32)')

  console.log('\n全アイコン生成完了')
}

main().catch(err => { console.error(err); process.exit(1) })
