import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#3b82f6',
        }}
      >
        传
      </div>
    ),
    {
      width: 32,
      height: 32,
      headers: {
        'Content-Type': 'image/png',
      },
    }
  )
}
