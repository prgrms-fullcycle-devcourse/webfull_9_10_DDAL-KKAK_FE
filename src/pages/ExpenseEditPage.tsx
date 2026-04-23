import { useNavigate, useParams } from 'react-router-dom';
import { ExpenseForm } from '@/features/expenses/ExpenseForm';

export function ExpenseEditPage() {
  const nav = useNavigate();
  const { journeyId, expenseId } = useParams<{
    journeyId: string;
    expenseId: string;
  }>();
  if (!journeyId || !expenseId) return null;

  return (
    <ExpenseForm
      mode="edit"
      journeyId={journeyId}
      expenseId={expenseId}
      onSaved={() => nav(`/journeys/${journeyId}`)}
      onCanceled={() => nav(`/journeys/${journeyId}`)}
    />
  );
}
