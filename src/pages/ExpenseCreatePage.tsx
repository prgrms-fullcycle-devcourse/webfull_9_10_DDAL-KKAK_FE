import { useNavigate, useParams } from 'react-router-dom';
import { ExpenseForm } from '@/features/expenses/ExpenseForm';

export function ExpenseCreatePage() {
  const nav = useNavigate();
  const { journeyId } = useParams<{ journeyId: string }>();
  if (!journeyId) return null;

  return (
    <ExpenseForm
      mode="create"
      journeyId={journeyId}
      onSaved={() => nav(`/journeys/${journeyId}`)}
      onCanceled={() => nav(`/journeys/${journeyId}`)}
    />
  );
}
