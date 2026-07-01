import {
  BarChart as ReBarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, ResponsiveContainer, CartesianGrid
} from 'recharts';

const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','Mei','Jun',
  'Jul','Ags','Sep','Okt','Nov','Des'
];

function BarChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="no-chart">Belum ada data tren.</p>;
  }

  const format = (value) =>
    new Intl.NumberFormat('id-ID', {
      notation: 'compact',
      compactDisplay: 'short',
      currency: 'IDR',
      style: 'currency',
      minimumFractionDigits: 0,
    }).format(value);

  const chartData = data.map((d) => ({
    name: `${MONTH_NAMES[d.month - 1]} ${String(d.year).slice(2)}`,
    Pemasukan: parseFloat(d.income),
    Pengeluaran: parseFloat(d.expense),
  }));

  return (
    <div className="chart-wrap">
      <h3>📈 Tren 6 Bulan Terakhir</h3>
      <ResponsiveContainer width="100%" height={240}>
        <ReBarChart data={chartData} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
          <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 11 }} />
          <YAxis tickFormatter={format} tick={{ fill: '#888', fontSize: 10 }} width={70} />
          <Tooltip
            formatter={(value) => format(value)}
            contentStyle={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 }}
            labelStyle={{ color: '#fff' }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: '#aaa' }} />
          <Bar dataKey="Pemasukan" fill="#4bb774" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Pengeluaran" fill="#b74b4b" radius={[4, 4, 0, 0]} />
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BarChart;