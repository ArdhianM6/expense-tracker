import useCountUp from '../hooks/useCountUp';

function AnimatedAmount({ value }) {
  const animated = useCountUp(value);

  return (
    <>
      {new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
      }).format(animated)}
    </>
  );
}

function SummaryCard({ summary }) {
  return (
    <div className="summary-cards">
      <div className="card income">
        <p>Total Pemasukan</p>
        <h3><AnimatedAmount value={summary.income} /></h3>
      </div>
      <div className="card expense">
        <p>Total Pengeluaran</p>
        <h3><AnimatedAmount value={summary.expense} /></h3>
      </div>
      <div className={`card balance ${summary.balance >= 0 ? 'positive' : 'negative'}`}>
        <p>Saldo</p>
        <h3><AnimatedAmount value={summary.balance} /></h3>
      </div>
    </div>
  );
}

export default SummaryCard;