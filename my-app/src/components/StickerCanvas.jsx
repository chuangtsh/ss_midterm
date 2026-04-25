import { useEffect, useRef, useState } from 'react'

const colors = ['#111827', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6']
const brushSizes = [2, 4, 8, 12]

const StickerCanvas = ({ open, onClose, onSend }) => {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [color, setColor] = useState(colors[0])
  const [size, setSize] = useState(4)

  useEffect(() => {
    if (!open || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [open])

  if (!open) return null

  const getPos = (event) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const point = event.touches?.[0] || event
    return {
      x: point.clientX - rect.left,
      y: point.clientY - rect.top,
    }
  }

  const start = (event) => {
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(event)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    ctx.strokeStyle = color
    ctx.lineWidth = size
    ctx.lineCap = 'round'
    setDrawing(true)
  }

  const move = (event) => {
    if (!drawing) return
    const ctx = canvasRef.current.getContext('2d')
    const pos = getPos(event)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const end = () => setDrawing(false)

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const send = () => {
    const dataUrl = canvasRef.current.toDataURL('image/png')
    onSend(dataUrl)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card canvas-card" onClick={(event) => event.stopPropagation()}>
        <h3>Draw Sticker</h3>
        <div className="row-wrap">
          {colors.map((shade) => (
            <button
              key={shade}
              type="button"
              className="color-dot"
              style={{ backgroundColor: shade }}
              onClick={() => setColor(shade)}
            />
          ))}
          {brushSizes.map((next) => (
            <button key={next} type="button" className="pill" onClick={() => setSize(next)}>
              {next}px
            </button>
          ))}
        </div>

        <canvas
          ref={canvasRef}
          width={360}
          height={240}
          className="sticker-canvas"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />

        <div className="row-end">
          <button type="button" className="btn btn-ghost" onClick={clear}>
            Clear
          </button>
          <button type="button" className="btn" onClick={send}>
            Send sticker
          </button>
        </div>
      </div>
    </div>
  )
}

export default StickerCanvas
