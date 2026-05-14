import type { Expense } from '@/features/expenses/types';
import type { Journey } from '@/features/journeys/types';

/** 가계부에서 "나"로 쓸 이름 */
export function ledgerSelfName(journey: Journey): string {
  const s = journey.selfParticipant?.trim();
  if (s) return s;
  const first = journey.participants[0]?.trim();
  if (first) return first;
  return '나';
}

export function splitNamesForExpense(expense: Expense): string[] {
  if (expense.splitWithParticipants && expense.splitWithParticipants.length > 0) {
    return expense.splitWithParticipants.map((p) => p.name);
  }
  return expense.splitWith;
}

function sharedSplitPeople(journey: Journey, expense: Expense): string[] {
  const sw = splitNamesForExpense(expense).filter((p) => journey.participants.includes(p));
  return sw.length ? sw : journey.participants.length ? journey.participants : ['나'];
}

function sharedSplitN(journey: Journey, expense: Expense): number {
  return Math.max(sharedSplitPeople(journey, expense).length, 1);
}

/** 이 지출에서 내가 부담하는 현지 금액 */
export function expenseMyShareLocal(journey: Journey, expense: Expense): number {
  const me = ledgerSelfName(journey);
  if (expense.splitMode === 'personal') {
    return expense.payer.trim() === me ? expense.amountLocal : 0;
  }
  const people = sharedSplitPeople(journey, expense);
  if (!people.includes(me)) return 0;
  return expense.amountLocal / sharedSplitN(journey, expense);
}

export function sumMySpendLocal(journey: Journey, expenses: Expense[]) {
  return expenses.reduce((acc, e) => acc + expenseMyShareLocal(journey, e), 0);
}
export function sumMySpendKRW(journey: Journey, expenses: Expense[]) {
  return expenses.reduce((acc, e) => {
    const myShareLocal = expenseMyShareLocal(journey, e);
    if (myShareLocal === 0) return acc;
    // FIXED·REALTIME 모두 journey.rate 사용.
    // FIXED: 사용자가 설정한 고정환율 / REALTIME: 호출 시점에 live rate가 주입된 값
    return acc + Math.round(myShareLocal * journey.rate);
  }, 0);
}
export function sumTotalKRW(journey: Journey, expenses: Expense[]) {
  return expenses.reduce((acc, e) => {
    return acc + Math.round(e.amountLocal * journey.rate);
  }, 0);
}
export function sumTotalLocal(expenses: Expense[]) {
  return expenses.reduce((acc, e) => acc + e.amountLocal, 0);
}

export function calcSharedSettlement(journey: Journey, expenses: Expense[]) {
  const shared = expenses.filter((e) => e.splitMode === 'shared');
  const totalLocal = shared.reduce((acc, e) => acc + e.amountLocal, 0);
  const n = Math.max(journey.participants.length, 1);
  const perPersonLocal = totalLocal / n;
  const perPersonKRW = perPersonLocal * journey.rate;
  return { totalLocal, perPersonLocal, perPersonKRW };
}

export type SettlementNet = { person: string; netLocal: number };
export type SettlementTransfer = { from: string; to: string; amountLocal: number };

export function calcSettlement(journey: Journey, expenses: Expense[]) {
  const people = journey.participants.length ? journey.participants : ['나'];
  const paid: Record<string, number> = Object.fromEntries(people.map((p) => [p, 0]));
  const owed: Record<string, number> = Object.fromEntries(people.map((p) => [p, 0]));

  for (const e of expenses) {
    const payer = people.includes(e.payer) ? e.payer : people[0];
    paid[payer] += e.amountLocal;

    if (e.splitMode === 'personal') {
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
