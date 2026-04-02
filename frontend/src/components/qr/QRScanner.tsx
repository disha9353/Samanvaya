import { useTranslation } from 'react-i18next';
import { useEffect, useId, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export default function QRScanner({ onDecoded, onError }: { onDecoded: (text: string) => void; onError?: (err: string) => void }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement | null>(null)
  const qrInstanceRef = useRef<Html5Qrcode | null>(null)
  const reactId = useId()
  const lastErrAtRef = useRef<number>(0)

  // Html5Qrcode needs a DOM element id.
  const elementId = `qr-${reactId.replace(/:/g, '')}`

  useEffect(() => {
    if (!elementId) return
    const qr = new Html5Qrcode(elementId)
    qrInstanceRef.current = qr

    qr.start(
      { facingMode: 'environment' },
      // Slightly larger box improves detection for dense QR (JWT token).
      { qrbox: { width: 280, height: 280 }, fps: 12 },
      (decodedText: string) => {
        try {
          qr.stop()
        } catch {
          // ignore
        }
        onDecoded(decodedText)
      },
      (err: string) => {
        // html5-qrcode reports frequent "NotFoundException" while scanning frames.
        // That is expected and shouldn't surface as a UI error.
        const msg = String(err || '')
        if (msg.includes('NotFoundException') || msg.includes('No MultiFormat Readers')) return

        // Throttle other errors so we don't spam state updates.
        const now = Date.now()
        if (now - lastErrAtRef.current < 1500) return
        lastErrAtRef.current = now
        onError?.(msg)
      }
    )

    return () => {
      try {
        qrInstanceRef.current?.stop()
      } catch {
        // ignore
      }
    }
  }, [elementId, onDecoded, onError])

  return (
    <div>
      <div ref={ref} className="rounded-2xl border border-white/10 bg-black/30 p-3">
        <div className="text-xs text-white/60 mb-2">{t('auto.scanning_qr', `Scanning QR…`)}</div>
        <div id={elementId} />
      </div>
    </div>
  )
}

