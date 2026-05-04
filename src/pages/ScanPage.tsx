import { ImagePlus, RefreshCcw, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ToastPortal } from '@/components/ui/Toast';
import { useToast } from '@/components/ui/useToast';
import { useAuth } from '@/features/auth/useAuth';
import { buildOcrDraftFromParsed, countryToReceiptLocale } from '@/features/ocr/buildDraftFromOcr';
import {
  createReceiptOcrJob,
  pollReceiptOcrJob,
  validateReceiptFile,
} from '@/features/ocr/ocrApi';
import { useJourneyQuery } from '@/features/journeys/queries';
import { fileToDataUrl } from '@/lib/image';

export function ScanPage() {
  const nav = useNavigate();
  const { journeyId } = useParams();
  const { user } = useAuth();
  const { data: journey } = useJourneyQuery(journeyId);
  const { showToast, toasts } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handlePick = async (file: File) => {
    if (!journeyId || !journey) {
      showToast('여정 정보를 불러오는 중이에요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    const uid = user?.id?.trim();
    if (!uid) {
      showToast('로그인이 필요해요.');
      return;
    }

    const invalid = validateReceiptFile(file);
    if (invalid) {
      showToast(invalid);
      return;
    }

    setIsScanning(true);
    const imageDataUrl = await fileToDataUrl(file);

    try {
      const receiptLocale = countryToReceiptLocale(journey.country);
      const { receiptId } = await createReceiptOcrJob({
        file,
        tripId: journeyId,
        userId: uid,
        currencyHint: journey.currency,
        receiptLocale,
      });

      const job = await pollReceiptOcrJob(receiptId, uid, {
        intervalMs: 1500,
        maxAttempts: 45,
      });

      if (job.status === 'FAILED' || job.status === 'EXPIRED') {
        const msg = job.failure?.detail ?? 'OCR 처리에 실패했어요.';
        showToast(msg);
        setIsScanning(false);
        return;
      }

      if (job.status !== 'SUCCESS' || !job.result) {
        showToast('OCR 결과를 받지 못했어요.');
        setIsScanning(false);
        return;
      }

      const draft = buildOcrDraftFromParsed(journey, job.result);
      nav(`/journeys/${journeyId}/ocr-preview`, { state: { draft, imageDataUrl } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'OCR 요청 중 오류가 났어요.';
      showToast(msg);
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 mx-auto flex h-dvh w-full max-w-md flex-col bg-slate-900">
      <ToastPortal toasts={toasts} />
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
                <p className="mt-3 max-w-[240px] text-center text-[11px] font-bold text-white/70">
                  첫 분석은 서버에서 언어 데이터를 준비하느라 10~30초 걸릴 수 있어요.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col items-center p-12">
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            disabled={isScanning || !journey}
            onClick={() => cameraInputRef.current?.click()}
            className="flex size-20 items-center justify-center rounded-full border-4 border-white/30 p-1 disabled:opacity-50"
            aria-label="촬영하기"
          >
            <div className="size-full rounded-full bg-white" />
          </button>

          <button
            type="button"
            disabled={isScanning || !journey}
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
