import { ImagePlus, RefreshCcw, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { OcrDraft } from '@/features/ocr/types';
import { nowLocalIso } from '@/lib/datetime';
import { fileToDataUrl } from '@/lib/image';

export function ScanPage() {
  const nav = useNavigate();
  const { journeyId } = useParams();
  const [isScanning, setIsScanning] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePick = async (file: File) => {
    if (!journeyId) return;
    setIsScanning(true);
    const imageDataUrl = await fileToDataUrl(file);
    await new Promise((r) => setTimeout(r, 700));

    const draft: OcrDraft = {
      storeName: '패밀리마트 나카스점',
      amountLocal: 1250,
      currency: 'JPY',
      paidAt: nowLocalIso(),
      category: '식비',
      splitMode: 'shared',
      method: 'card',
      payer: '나',
      emoji: '🍱',
      comment: '',
    };
    setIsScanning(false);
    nav(`/journeys/${journeyId}/ocr-preview`, { state: { draft, imageDataUrl } });
  };

  return (
    <div className="fixed inset-0 z-50 mx-auto flex h-dvh w-full max-w-md flex-col bg-slate-900">
      <div className="flex items-center justify-between p-6 pt-12 text-white">
        <button type="button" onClick={() => nav(-1)} aria-label="닫기">
          <X className="size-6" />
        </button>
        <span className="font-black tracking-tight">영수증 딸깍 스캔</span>
        <div className="w-6" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-10">
        <div className="relative flex w-full aspect-[3/4] items-center justify-center overflow-hidden rounded-[40px] border-2 border-white/30">
          {isScanning ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-600/30">
              <div className="absolute top-0 h-1 w-full animate-[scan_1.5s_infinite] bg-white" />
              <div className="flex flex-col items-center text-white">
                <RefreshCcw className="mb-4 size-10 animate-spin" />
                <p className="text-xl font-black">AI 추출 중...</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col items-center p-12">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            disabled={isScanning}
            onClick={() => cameraInputRef.current?.click()}
            className="flex size-20 items-center justify-center rounded-full border-4 border-white/30 p-1 disabled:opacity-50"
            aria-label="촬영하기"
          >
            <div className="size-full rounded-full bg-white" />
          </button>

          <button
            type="button"
            disabled={isScanning}
            onClick={() => fileInputRef.current?.click()}
            className="grid size-14 place-items-center rounded-2xl border border-white/20 bg-white/10 text-white disabled:opacity-50"
            aria-label="파일 첨부"
          >
            <ImagePlus className="size-6" />
          </button>
        </div>
        <p className="text-xs font-bold text-white/40">촬영하거나, 사진/파일을 첨부해 주세요</p>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          void handlePick(f);
          e.target.value = '';
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          void handlePick(f);
          e.target.value = '';
        }}
      />

      <style>{`
        @keyframes scan {
          0% { top: 0; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
}
