import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#b74b4b', '#4b7bb7', '#4bb774', '#b7974b', '#974bb7', '#4bb7b7'];

function Chart({ transactions }) {
  const expenses = transactions.filter((t) => t.type === 'expense');

  const dataMap = {};
  expenses.forEach((t) => {
    dataMap[t.category] = (dataMap[t.category] || 0) + parseFloat(t.amount);
  });

  const data = Object.entries(dataMap).map(([name, value]) => ({ name, value }));

  if (data.length === 0) {
    return <p className="no-chart">Belum ada data pengeluaran untuk ditampilkan.</p>;
  }

  return (
    <div className="chart-wrap">
      <h3>📊 Pengeluaran per Kategori</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={100}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) =>
              new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)
            }
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default Chart;