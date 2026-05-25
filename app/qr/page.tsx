"use client"

import { useEffect, useState } from "react"

export default function QrPrintPage() {
  const [dataUrl, setDataUrl] = useState<string>("")

  useEffect(() => {
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL("UNLOCK", {
        errorCorrectionLevel: "H",
        width: 400,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      }).then(setDataUrl)
    })
  }, [])

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="text-center border-2 border-black rounded-2xl p-10 inline-block">
        <h1 className="text-2xl font-bold mb-2">🔍 QR 코드를 스캔하세요!</h1>
        <p className="text-gray-500 text-sm mb-6">주변에 숨겨진 암호가 들어 있습니다</p>

        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt="QR Code" width={300} height={300} className="mx-auto mb-6" />
        ) : (
          <div className="w-[300px] h-[300px] mx-auto mb-6 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
            생성 중...
          </div>
        )}

        <p className="text-gray-400 text-xs mb-6">방탈출 워크샵 · 문제 8번</p>

        <div className="flex gap-3 justify-center print:hidden">
          {dataUrl && (
            <a
              href={dataUrl}
              download="qr-unlock.png"
              className="px-6 py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              PNG 다운로드
            </a>
          )}
          <button
            onClick={() => window.print()}
            className="px-6 py-2.5 border-2 border-black text-black rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            인쇄하기
          </button>
        </div>
      </div>
    </div>
  )
}
