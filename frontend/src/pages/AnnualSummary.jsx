import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LineChart,
  Line, ReferenceLine,
} from 'recharts';
import api from '../api/axios';

const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','Mei','Jun',
  'Jul','Ags','Sep','Okt','Nov','Des',
];

function AnnualSummary({ onBack }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chartType, setChartType] = useState('bar');

  const format = (num) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
    }).format(num);

  const formatCompact = (num) =>
    new Intl.NumberFormat('id-ID', {
      notation: 'compact', compactDisplay: 'short',
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
    }).format(num);

  const fetchAnnual = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/transactions/annual?year=${year}`);
      setData(res.data);
    } catch {
      console.error('Gagal fetch data tahunan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAnnual(); }, [year]);

  const chartData = data?.monthly.map((m) => ({
    name: MONTH_NAMES[m.month - 1],
    Pemasukan: m.income,
    Pengeluaran: m.expense,
    Saldo: m.balance,
  })) || [];

  const tooltipStyle = {
    contentStyle: { background: '#1a1a1a', border: '1px solid #333', borderRadius: 8 },
    labelStyle: { color: '#fff' },
  };

  return (
    <div className="annual-page">
      <div className="annual-header">
        <button className="btn-back" onClick={onBack}>← Kembali</button>
        <h2>📅 Ringkasan Tahunan</h2>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="annual-year-select"
        >
          {[2023, 2024, 2025, 2026].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="no-data">Memuat data tahunan...</p>
      ) : data ? (
        <>
          {/* Kartu total tahunan */}
          <div className="annual-summary-cards">
            <div className="card income">
              <p>Total Pemasukan {year}</p>
              <h3>{format(data.totalIncome)}</h3>
            </div>
            <div className="card expense">
              <p>Total Pengeluaran {year}</p>
              <h3>{format(data.totalExpense)}</h3>
            </div>
            <div className={`card balance ${data.totalBalance >= 0 ? 'positive' : 'negative'}`}>
              <p>Saldo Akhir {year}</p>
              <h3>{format(data.totalBalance)}</h3>
            </div>
          </div>

          {/* Toggle chart type */}
          <div className="chart-toggle">
            <button
              className={chartType === 'bar' ? 'active' : ''}
              onClick={() => setChartType('bar')}
            >📊 Bar Chart</button>
            <button
              className={chartType === 'line' ? 'active' : ''}
              onClick={() => setChartType('line')}
            >📈 Line Chart</button>
          </div>

          {/* Grafik */}
          <div className="annual-chart-wrap">
            <h3>
              {chartType === 'bar'
                ? 'Pemasukan vs Pengeluaran per Bulan'
                : 'Tren Saldo per Bulan'}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              {chartType === 'bar' ? (
                <BarChart data={chartData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 11 }} />
                  <YAxis tickFormatter={formatCompact} tick={{ fill: '#888', fontSize: 10 }} width={75} />
                  <Tooltip formatter={format} {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#aaa' }} />
                  <Bar dataKey="Pemasukan" fill="#4bb774" radius={[4,4,0,0]} />
                  <Bar dataKey="Pengeluaran" fill="#b74b4b" radius={[4,4,0,0]} />
                </BarChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                  <XAxis dataKey="name" tick={{ fill: '#888', fontSize: 11 }} />
                  <YAxis tickFormatter={formatCompact} tick={{ fill: '#888', fontSize: 10 }} width={75} />
                  <Tooltip formatter={format} {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#aaa' }} />
                  <ReferenceLine y={0} stroke="#444" strokeDasharray="4 4" />
                  <Line
                    type="monotone"
                    dataKey="Saldo"
                    stroke="#4b7bb7"
                    strokeWidth={2.5}
                    dot={{ fill: '#4b7bb7', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Tabel detail per bulan */}
          <div className="annual-table-wrap">
            <h3>📋 Detail per Bulan</h3>
            <div className="annual-table">
              <div className="annual-table-head">
                <span>Bulan</span>
                <span>Pemasukan</span>
                <span>Pengeluaran</span>
                <span>Saldo</span>
              </div>
              {data.monthly.map((m) => {
                const hasData = m.income > 0 || m.expense > 0;
                return (
                  <div
                    key={m.month}
                    className={`annual-table-row ${!hasData ? 'empty-month' : ''}`}
                  >
                    <span className="annual-month-name">
                      {MONTH_NAMES[m.month - 1]}
                    </span>
                    <span className="income-text">
                      {hasData ? format(m.income) : '-'}
                    </span>
                    <span className="expense-text">
                      {hasData ? format(m.expense) : '-'}
                    </span>
                    <span className={m.balance >= 0 ? 'income-text' : 'expense-text'}>
                      {hasData ? format(m.balance) : '-'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default AnnualSummary;