export async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('파일을 읽을 수 없어요.'))
    reader.readAsDataURL(file)
  })
}

export async function rotateDataUrl(
  dataUrl: string,
  deg: number,
): Promise<string> {
  const img = new Image()
  img.decoding = 'async'
  img.src = dataUrl

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('이미지를 불러올 수 없어요.'))
  })

  const rad = (deg * Math.PI) / 180
  const sin = Math.abs(Math.sin(rad))
  const cos = Math.abs(Math.cos(rad))
  const w = img.naturalWidth
  const h = img.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * cos + h * sin)
  canvas.height = Math.round(w * sin + h * cos)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 초기화할 수 없어요.')

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(rad)
  ctx.drawImage(img, -w / 2, -h / 2)

  return canvas.toDataURL('image/jpeg', 0.92)
}

