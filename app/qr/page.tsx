import QRCode from "qrcode"
import Image from "next/image"

export const dynamic = "force-dynamic"

export default async function QrPrintPage() {
  const answer = "UNLOCK"
  const dataUrl = await QRCode.toDataURL(answer, {
    errorCorrectionLevel: "H",
    width: 400,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  })

  return (
    <html lang="ko">
      <head>
        <title>QR 코드 - 8번 문제</title>
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { background: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
          .card { text-align: center; padding: 40px; border: 2px solid #000; border-radius: 12px; display: inline-block; }
          h1 { font-size: 20px; font-weight: bold; margin-bottom: 8px; }
          p { font-size: 14px; color: #555; margin-bottom: 24px; }
          img { display: block; margin: 0 auto 24px; }
          .hint { font-size: 13px; color: #888; margin-top: 16px; }
          @media print {
            body { background: #fff; }
            .no-print { display: none !important; }
          }
        `}</style>
      </head>
      <body>
        <div className="card">
          <h1>🔍 QR 코드를 스캔하세요!</h1>
          <p>주변에 숨겨진 암호가 들어 있습니다</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt="QR Code" width={300} height={300} />
          <div className="hint">탈출 방탈출 · 문제 8번</div>
          <div style={{ marginTop: 24 }} className="no-print">
            <a
              href={dataUrl}
              download="qr-unlock.png"
              style={{
                display: "inline-block",
                padding: "10px 24px",
                background: "#000",
                color: "#fff",
                borderRadius: 8,
                textDecoration: "none",
                fontSize: 14,
                marginRight: 12,
              }}
            >
              PNG 다운로드
            </a>
            <button
              onClick={() => window.print()}
              style={{
                padding: "10px 24px",
                background: "#fff",
                color: "#000",
                border: "2px solid #000",
                borderRadius: 8,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              인쇄하기
            </button>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: "" }} />
      </body>
    </html>
  )
}
