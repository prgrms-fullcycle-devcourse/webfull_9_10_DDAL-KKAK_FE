export type RateMode = 'fixed' | 'realtime'

export type ExpenseType = 'shared' | 'private'

export type CurrencyCode = 'JPY' | 'USD' | 'EUR' | 'KRW'

export type PaymentMethod = 'cash' | 'card'

export type Journey = {
  id: string
  name: string
  country: string
  currency: CurrencyCode
  rate: number // 현지통화 -> KRW 환산 비율 (예: 1 JPY = 9.0 KRW)
  rateMode: RateMode
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  participants: string[]
  /** 1/n·개인지출 집계 시 "나"로 쓸 이름(participants 중 하나). 없으면 participants[0] */
  selfParticipant?: string
  status: 'active' | 'planned' | 'ended'
}

export type Expense = {
  id: string
  journeyId: string
  store: string
  amountLocal: number
  /** 공동 지출일 때만: n명이 똑같이 나눔(기본: 여정 동행자 수) */
  splitAmong?: number
  /** 공동 지출일 때만: 같이 나눌 사람 목록(있으면 이 목록으로만 1/n) */
  splitWith?: string[]
  method?: PaymentMethod
  category: string
  time: string // HH:mm
  date: string // YYYY-MM-DD
  type: ExpenseType
  payer: string
  emoji: string
  memo?: string
}

export type OcrDraft = {
  store: string
  amountLocal: number
  currency: CurrencyCode
  time: string
  category: string
  type: ExpenseType
  /** 공동일 때 n명 1/n (기본: 동행자 수) */
  splitAmong?: number
  /** 공동일 때: 같이 나눌 사람 목록 */
  splitWith?: string[]
  method?: PaymentMethod
  payer: string
  emoji: string
  memo: string
}

// (지갑/자산 기능은 “현지 지출 올인” 범위에서 제외)

