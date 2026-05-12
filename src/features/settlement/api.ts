import { apiFetch } from '@/lib/api';

/** 송금 한 건 — 누가 누구에게 얼마(KRW) 보낼지 */
export type SettlementRemittance = {
  sender: { id: string; name: string };
  receiver: { id: string; name: string };
  /** 한화 기준. 서버가 환산까지 끝낸 결과. */
  amount: number;
};

/** 참가자 1명의 정산 요약 */
export type SettlementParticipant = {
  participantId: string;
  name: string;
  /** 본인이 직접 결제한 총액 (KRW) */
  totalPaidKrw: number;
  /** 본인이 부담해야 하는 총액 (KRW) — 분담 결과 */
  totalShareKrw: number;
  /** 최종 손익. 양수=받을 돈, 음수=보낼 돈 */
  netAmount: number;
};

export type SettlementData = {
  tripId: string;
  /** 여행 전체 총 소비액 (KRW) */
  totalAmountKrw: number;
  remittances: SettlementRemittance[];
  settlementSummary: SettlementParticipant[];
};

export type SettlementSummaryData = {
  tripId: string;
  tripTitle: string;
  summary: {
    /** 내가 소비한 외화 총액(현지 통화) */
    totalSpentOriginal: number;
    currencyCode: string;
    /** 내가 소비한 금액의 한화 환산 총액 */
    totalSpentKrw: number;
    /** 최종 정산 예정액 (+ 받을 돈, - 줄 돈) */
    netAmountKrw: number;
  };
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function pickNum(r: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  }
  return fallback;
}

function pickStr(r: Record<string, unknown>, keys: string[], fallback = ''): string {
  for (const k of keys) {
    const v = r[k];
    if (typeof v === 'string' && v.length) return v;
  }
  return fallback;
}

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  return [];
}

/** 중첩 sender/receiver 또는 id-only + snake_case 금액 필드까지 흡수 */
function normalizeParticipantRow(raw: unknown): SettlementParticipant | null {
  if (!isRecord(raw)) return null;
  const id = pickStr(raw, ['participantId', 'participant_id', 'id']);
  const name = pickStr(raw, [
    'name',
    'displayName',
    'display_name',
    'participantName',
    'participant_name',
  ]);
  if (!id && !name) return null;
  return {
    participantId: id || name,
    name: name || id,
    totalPaidKrw: pickNum(raw, ['totalPaidKrw', 'total_paid_krw', 'totalPaid', 'total_paid']),
    totalShareKrw: pickNum(raw, ['totalShareKrw', 'total_share_krw', 'totalShare', 'total_share']),
    netAmount: pickNum(raw, ['netAmount', 'net_amount', 'net']),
  };
}

function personFromNested(
  raw: unknown,
  idToName: Map<string, string>,
): { id: string; name: string } {
  if (isRecord(raw)) {
    const id = pickStr(raw, ['id', 'participantId', 'participant_id']);
    const name = pickStr(raw, ['name', 'displayName', 'display_name']);
    if (id || name) {
      const resolvedName = name || idToName.get(id) || id;
      const resolvedId = id || resolvedName;
      return { id: resolvedId, name: resolvedName };
    }
  }
  return { id: '', name: '' };
}

function normalizeRemittanceRow(
  raw: unknown,
  idToName: Map<string, string>,
): SettlementRemittance | null {
  if (!isRecord(raw)) return null;

  const amount = pickNum(raw, [
    'amount',
    'amountKrw',
    'amount_krw',
    'krwAmount',
    'krw_amount',
    'value',
  ]);

  let sender = personFromNested(raw.sender, idToName);
  let receiver = personFromNested(raw.receiver, idToName);

  const senderId = pickStr(raw, [
    'senderId',
    'sender_id',
    'fromParticipantId',
    'from_participant_id',
    'fromId',
    'from_id',
  ]);
  const receiverId = pickStr(raw, [
    'receiverId',
    'receiver_id',
    'toParticipantId',
    'to_participant_id',
    'toId',
    'to_id',
  ]);

  if (!sender.id && !sender.name && senderId) {
    sender = { id: senderId, name: idToName.get(senderId) || senderId };
  }
  if (!receiver.id && !receiver.name && receiverId) {
    receiver = { id: receiverId, name: idToName.get(receiverId) || receiverId };
  }

  if (!sender.name || !receiver.name) return null;

  return {
    sender: { id: sender.id || sender.name, name: sender.name },
    receiver: { id: receiver.id || receiver.name, name: receiver.name },
    amount: Math.round(amount),
  };
}

/**
 * 백엔드가 camelCase / snake_case / 키 이름만 다른 payload를 줄 때
 * ReportPage·홈 요약이 기대하는 SettlementData로 맞춤.
 */
export function normalizeSettlementPayload(raw: unknown, tripId: string): SettlementData {
  if (!isRecord(raw)) {
    return {
      tripId,
      totalAmountKrw: 0,
      remittances: [],
      settlementSummary: [],
    };
  }

  const summaryRows = asArray(
    raw.settlementSummary ?? raw.settlement_summary ?? raw.participants ?? raw.member_settlements,
  );
  const settlementSummary = summaryRows
    .map(normalizeParticipantRow)
    .filter((p): p is SettlementParticipant => p !== null);

  const idToName = new Map<string, string>();
  for (const p of settlementSummary) {
    idToName.set(p.participantId, p.name);
    idToName.set(p.name, p.name);
  }

  const remittanceRows = asArray(
    raw.remittances ??
      raw.transfers ??
      raw.transferList ??
      raw.optimal_transfers ??
      raw.settlement_transfers,
  );
  const remittances = remittanceRows
    .map((row) => normalizeRemittanceRow(row, idToName))
    .filter((r): r is SettlementRemittance => r !== null);

  const totalAmountKrw = pickNum(raw, [
    'totalAmountKrw',
    'total_amount_krw',
    'totalExpenseKrw',
    'total_expense_krw',
    'totalKrw',
    'total_krw',
  ]);

  const resolvedTripId = pickStr(raw, ['tripId', 'trip_id', 'id']) || tripId;

  return {
    tripId: resolvedTripId,
    totalAmountKrw: totalAmountKrw || 0,
    remittances,
    settlementSummary,
  };
}

function normalizeSummaryPayload(raw: unknown, tripId: string): SettlementSummaryData {
  if (!isRecord(raw)) {
    return {
      tripId,
      tripTitle: '',
      summary: {
        totalSpentOriginal: 0,
        currencyCode: 'KRW',
        totalSpentKrw: 0,
        netAmountKrw: 0,
      },
    };
  }

  const inner = isRecord(raw.summary) ? raw.summary : raw;

  return {
    tripId: pickStr(raw, ['tripId', 'trip_id']) || tripId,
    tripTitle: pickStr(raw, ['tripTitle', 'trip_title', 'title', 'name']),
    summary: {
      totalSpentOriginal: pickNum(inner as Record<string, unknown>, [
        'totalSpentOriginal',
        'total_spent_original',
        'spentOriginal',
        'spent_original',
      ]),
      currencyCode:
        pickStr(inner as Record<string, unknown>, ['currencyCode', 'currency_code', 'currency']) ||
        'KRW',
      totalSpentKrw: pickNum(inner as Record<string, unknown>, [
        'totalSpentKrw',
        'total_spent_krw',
        'totalSpent',
        'total_spent',
      ]),
      netAmountKrw: pickNum(inner as Record<string, unknown>, [
        'netAmountKrw',
        'net_amount_krw',
        'netAmount',
        'net_amount',
        'net',
      ]),
    },
  };
}

/**
 * 최종 정산 결과 조회.
 * 경로: GET /trips/{tripId}/settlement
 *
 * apiFetch가 백엔드 envelope({ success, status, data })을 자동으로 unwrap해서
 * data만 반환하므로 별도 처리 불필요.
 */
export async function fetchSettlement(tripId: string): Promise<SettlementData> {
  const raw = await apiFetch<unknown>(`/trips/${tripId}/settlement`);
  return normalizeSettlementPayload(raw, tripId);
}

/**
 * 나의 정산 요약 조회 (메인 카드/대시보드용)
 * 경로: GET /trips/{tripId}/settlement/summary
 */
export async function fetchSettlementSummary(tripId: string): Promise<SettlementSummaryData> {
  const raw = await apiFetch<unknown>(`/trips/${tripId}/settlement/summary`);
  return normalizeSummaryPayload(raw, tripId);
}
