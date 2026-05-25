import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        background: '#0d1117',
        borderRadius: 7,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 5,
      }}
    >
      {/* Shackle */}
      <div
        style={{
          width: 13,
          height: 9,
          border: '2.5px solid #4ade80',
          borderBottom: 'none',
          borderRadius: '8px 8px 0 0',
          marginBottom: -1,
        }}
      />
      {/* Body */}
      <div
        style={{
          width: 19,
          height: 12,
          background: '#4ade80',
          borderRadius: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: '#0d1117',
          }}
        />
      </div>
    </div>,
    { ...size }
  )
}
