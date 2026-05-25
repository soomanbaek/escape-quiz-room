import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = '방탈출 게임 - Workshop'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    <div
      style={{
        background: '#0d1117',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Grid pattern */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(74,222,128,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(74,222,128,0.06) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(74,222,128,0.08) 0%, transparent 70%)',
        }}
      />

      {/* Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
          position: 'relative',
        }}
      >
        {/* Lock icon */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: 'rgba(74,222,128,0.12)',
            border: '2px solid rgba(74,222,128,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48,
            marginBottom: 32,
          }}
        >
          🔐
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            color: '#f0f6fc',
            letterSpacing: '-2px',
            lineHeight: 1,
            marginBottom: 16,
          }}
        >
          방탈출 게임
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 32,
            fontWeight: 600,
            color: '#4ade80',
            letterSpacing: '6px',
            marginBottom: 40,
          }}
        >
          ESCAPE ROOM
        </div>

        {/* Divider */}
        <div
          style={{
            width: 200,
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(74,222,128,0.5), transparent)',
            marginBottom: 40,
          }}
        />

        {/* Description */}
        <div
          style={{
            fontSize: 26,
            color: '#8b949e',
            letterSpacing: '1px',
          }}
        >
          팀별 문제를 풀고 가장 빨리 탈출하세요
        </div>
      </div>

      {/* Corner decoration */}
      <div
        style={{
          position: 'absolute',
          bottom: 40,
          right: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
        <div style={{ fontSize: 20, color: '#4ade80', letterSpacing: '2px', fontWeight: 600 }}>
          WORKSHOP
        </div>
      </div>
    </div>,
    { ...size }
  )
}
