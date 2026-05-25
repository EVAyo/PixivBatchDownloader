const fs = require('fs')
const path = require('path')

const iconDir = path.resolve(__dirname, 'src', 'static', 'icons')
const outputPath = path.resolve(
  __dirname,
  'src',
  'static',
  'lib',
  'icon-sprite.js'
)

function getSvgFiles() {
  return fs
    .readdirSync(iconDir)
    .filter((fileName) => fileName.endsWith('.svg'))
    .sort((a, b) => a.localeCompare(b))
}

function removeFillAttr(svgBody) {
  return svgBody.replace(/\sfill=(['"])(?:\\.|(?!\1).)*\1/g, '')
}

function getSymbol(fileName) {
  const filePath = path.join(iconDir, fileName)
  const content = fs.readFileSync(filePath, 'utf8')
  const viewBoxMatch = content.match(/<svg\b[^>]*\bviewBox=(['"])(.*?)\1/i)

  if (!viewBoxMatch) {
    throw new Error(`Missing viewBox in ${fileName}`)
  }

  const bodyMatch = content.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/i)

  if (!bodyMatch) {
    throw new Error(`Invalid svg content in ${fileName}`)
  }

  const symbolId = path.basename(fileName, '.svg')
  const body = removeFillAttr(bodyMatch[1]).trim()

  return `<symbol id="${symbolId}" viewBox="${viewBoxMatch[2]}">${body}</symbol>`
}

function generateSprite(symbols) {
  return `const sprite = \`<svg xmlns="http://www.w3.org/2000/svg">${symbols.join(
    ''
  )}</svg>\`

;(function () {
  function inject() {
    if (document.getElementById('ppd-icon-sprite')) {
      return
    }

    const wrap = document.createElement('div')
    wrap.innerHTML = sprite

    const svg = wrap.firstElementChild
    if (!svg) {
      return
    }

    svg.id = 'ppd-icon-sprite'
    svg.setAttribute('aria-hidden', 'true')
    svg.style.position = 'absolute'
    svg.style.width = '0'
    svg.style.height = '0'
    svg.style.overflow = 'hidden'

    if (document.body.firstChild) {
      document.body.insertBefore(svg, document.body.firstChild)
      return
    }

    document.body.appendChild(svg)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject, { once: true })
    return
  }

  inject()
})()
`
}

function build() {
  const symbols = getSvgFiles().map(getSymbol)
  const sprite = generateSprite(symbols)
  fs.writeFileSync(outputPath, sprite, 'utf8')
  console.log(`Generated icon sprite with ${symbols.length} icons`)
}

build()
