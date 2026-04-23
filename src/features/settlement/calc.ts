import type { Expense, Journey } from '../../types/types';

/** 가계부에서 "나"로 쓸 이름 (participants·selfParticipant 기준) */
export function ledgerSelfName(journey: Journey): string {
  const s = journey.selfParticipant?.trim();
  if (s) return s;
  const first = journey.participants[0]?.trim();
  if (first) return first;
  return '나';
}

function sharedSplitN(journey: Journey, expense: Expense): number {
  const sw = expense.splitWith?.filter((p) => journey.participants.includes(p)) ?? [];
  if (sw.length >= 1) return sw.length;
  const n = expense.splitAmong;
  if (typeof n === 'number' && n >= 1) return Math.floor(n);
  return Math.max(journey.participants.length, 1);
}

function sharedSplitPeople(journey: Journey, expense: Expense): string[] {
  const sw = expense.splitWith?.filter((p) => journey.participants.includes(p)) ?? [];
  return sw.length ? sw : journey.participants.length ? journey.participants : ['나'];
}

/** 이 지출에서 내가 부담하는 현지 금액 */
export function expenseMyShareLocal(journey: Journey, expense: Expense): number {
  if (expense.type === 'private') {
    return expense.payer.trim() === ledgerSelfName(journey) ? expense.amountLocal : 0;
  }
  const me = ledgerSelfName(journey);
  const people = sharedSplitPeople(journey, expense);
  if (!people.includes(me)) return 0;
  return expense.amountLocal / Math.max(sharedSplitN(journey, expense), 1);
}

export function sumMySpendLocal(journey: Journey, expenses: Expense[]) {
  return expenses.reduce((acc, e) => acc + expenseMyShareLocal(journey, e), 0);
}

export function sumMySpendKRW(journey: Journey, expenses: Expense[]) {
  return sumMySpendLocal(journey, expenses) * journey.rate;
}

export function sumTotalKRW(journey: Journey, expenses: Expense[]) {
  return expenses.reduce((acc, e) => acc + e.amountLocal * journey.rate, 0);
}

export function sumTotalLocal(expenses: Expense[]) {
  return expenses.reduce((acc, e) => acc + e.amountLocal, 0);
}

export function calcSharedSettlement(journey: Journey, expenses: Expense[]) {
  const shared = expenses.filter((e) => e.type === 'shared');
  const totalLocal = shared.reduce((acc, e) => acc + e.amountLocal, 0);
  const n = Math.max(journey.participants.length, 1);
  const perPersonLocal = totalLocal / n;
  const perPersonKRW = perPersonLocal * journey.rate;
  return { totalLocal, perPersonLocal, perPersonKRW };
}

export type SettlementNet = { person: string; netLocal: number };
export type SettlementTransfer = { from: string; to: string; amountLocal: number };

/** 참가자별 net(+) 받음 / (-) 냄, 그리고 최소 송금 경로 */
export function calcSettlement(journey: Journey, expenses: Expense[]) {
  const people = journey.participants.length ? journey.participants : ['나'];
  const paid: Record<string, number> = Object.fromEntries(people.map((p) => [p, 0]));
  const owed: Record<string, number> = Object.fromEntries(people.map((p) => [p, 0]));

  for (const e of expenses) {
    const payer = people.includes(e.payer) ? e.payer : people[0];
    paid[payer] += e.amountLocal;

    if (e.type === 'private') {
      owed[payer] += e.amountLocal;
      continue;
    }

    const splitPeople = sharedSplitPeople(journey, e);
    const n = Math.max(sharedSplitN(journey, e), 1);
    const each = e.amountLocal / n;
    for (const p of splitPeople) owed[p] += each;
  }

  const nets: SettlementNet[] = people.map((p) => ({
    person: p,
    netLocal: paid[p] - owed[p],
  }));

  const creditors = nets
    .filter((x) => x.netLocal > 1e-9)
    .map((x) => ({ ...x }))
    .sort((a, b) => b.netLocal - a.netLocal);
  const debtors = nets
    .filter((x) => x.netLocal < -1e-9)
    .map((x) => ({ person: x.person, netLocal: -x.netLocal }))
    .sort((a, b) => b.netLocal - a.netLocal);

  const transfers: SettlementTransfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amt = Math.min(d.netLocal, c.netLocal);
    transfers.push({ from: d.person, to: c.person, amountLocal: amt });
    d.netLocal -= amt;
    c.netLocal -= amt;
    if (d.netLocal <= 1e-9) i++;
    if (c.netLocal <= 1e-9) j++;
  }

  return { nets, transfers };
}
