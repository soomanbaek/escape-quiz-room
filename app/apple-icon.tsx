import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        background: '#0d1117',
        borderRadius: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 28,
      }}
    >
      {/* Shackle */}
      <div
        style={{
          width: 72,
          height: 52,
          border: '14px solid #4ade80',
          borderBottom: 'none',
          borderRadius: '44px 44px 0 0',
          marginBottom: -4,
        }}
      />
      {/* Body */}
      <div
        style={{
          width: 108,
          height: 70,
          background: '#4ade80',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#0d1117',
          }}
        />
      </div>
    </div>,
    { ...size }
  )
}
