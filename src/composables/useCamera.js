/**
 * Camera capture + image compression composable.
 * Uses <input type="file" capture="environment"> for cross-platform
 * camera access (iOS Safari + Android Chrome).
 */
export function useCamera() {

  /**
   * Opens native camera (or file picker fallback).
   * Returns { file, dataUrl } or null if user cancelled.
   */
  function capturePhoto() {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.capture = 'environment'
      input.style.display = 'none'

      input.addEventListener('change', async () => {
        const file = input.files?.[0]
        document.body.removeChild(input)
        if (!file) return resolve(null)

        const { blob, dataUrl } = await compressImage(file)
        resolve({ blob, dataUrl, originalName: file.name })
      })

      input.addEventListener('cancel', () => {
        document.body.removeChild(input)
        resolve(null)
      })

      document.body.appendChild(input)
      input.click()
    })
  }

  /**
   * Compress image to max 1200px and JPEG 0.8 quality.
   * Also strips EXIF/GPS data (canvas redraw does this).
   * ~4MB phone photo → ~150KB output.
   */
  function compressImage(file, maxSize = 1200, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(url)

        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error('Compression failed'))
            const dataUrl = canvas.toDataURL('image/jpeg', quality)
            resolve({ blob, dataUrl })
          },
          'image/jpeg',
          quality
        )
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load image'))
      }

      img.src = url
    })
  }

  return { capturePhoto, compressImage }
}
