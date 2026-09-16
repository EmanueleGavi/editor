import { jsPDF } from 'jspdf'
import 'svg2pdf.js'
import { downloadBlob } from './files'

/** Parse an SVG string into a detached element plus its pixel size. */
function parseSvg(svgString: string): { element: SVGSVGElement; width: number; height: number } {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml')
  const element = doc.documentElement as unknown as SVGSVGElement
  let width = parseFloat(element.getAttribute('width') ?? '0')
  let height = parseFloat(element.getAttribute('height') ?? '0')
  if (!width || !height) {
    const viewBox = element.getAttribute('viewBox')?.split(/\s+/).map(Number)
    if (viewBox) {
      width = viewBox[2]
      height = viewBox[3]
    }
  }
  return { element, width: width || 800, height: height || 600 }
}

export function exportSvg(svgString: string, baseName: string): void {
  downloadBlob(new Blob([svgString], { type: 'image/svg+xml' }), `${baseName}.svg`)
}

export async function exportPng(svgString: string, baseName: string, scale = 2): Promise<void> {
  const { width, height } = parseSvg(svgString)
  const image = new Image()
  const svgUrl = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml' }))
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Failed to rasterize SVG'))
      image.src = svgUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(width * scale)
    canvas.height = Math.ceil(height * scale)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), 'image/png'),
    )
    downloadBlob(blob, `${baseName}.png`)
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

export async function exportPdf(svgString: string, baseName: string): Promise<void> {
  const { element, width, height } = parseSvg(svgString)
  const margin = 20
  const orientation = width >= height ? 'landscape' : 'portrait'
  const doc = new jsPDF({ orientation, unit: 'pt', format: [width + margin * 2, height + margin * 2] })
  await doc.svg(element, { x: margin, y: margin, width, height })
  doc.save(`${baseName}.pdf`)
}
