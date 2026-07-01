import { useState } from 'react';

const STEPS = [
  {
    icon: '👋',
    title: 'Selamat datang!',
    desc: 'Expense Tracker membantu kamu mencatat pemasukan & pengeluaran dengan mudah, kapan saja dan di mana saja.',
  },
  {
    icon: '➕',
    title: 'Catat transaksi',
    desc: 'Tambahkan transaksi harian lewat form di dashboard. Pilih kategori, masukkan jumlah, dan keterangan opsional.',
  },
  {
    icon: '🎯',
    title: 'Set budget limit',
    desc: 'Tentukan batas pengeluaran per kategori. Kamu akan mendapat peringatan otomatis saat mendekati atau melebihi limit.',
  },
  {
    icon: '📊',
    title: 'Pantau laporan',
    desc: 'Lihat grafik pengeluaran per kategori, tren 6 bulan, dan ringkasan tahunan untuk memahami pola keuanganmu.',
  },
  {
    icon: '🚀',
    title: 'Siap digunakan!',
    desc: 'Semua fitur sudah siap. Yuk mulai catat keuanganmu sekarang dan raih kebebasan finansial!',
  },
];

function Onboarding({ onFinish }) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-box">
        {/* Progress dots */}
        <div className="onboarding-dots">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`onboarding-dot ${i === step ? 'active' : i < step ? 'done' : ''}`}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        {/* Content */}
        <div className="onboarding-icon">{current.icon}</div>
        <h2 className="onboarding-title">{current.title}</h2>
        <p className="onboarding-desc">{current.desc}</p>

        {/* Actions */}
        <div className="onboarding-actions">
          {step > 0 && (
            <button className="onboarding-btn-back" onClick={() => setStep(step - 1)}>
              ← Kembali
            </button>
          )}
          <button
            className="onboarding-btn-next"
            onClick={() => (isLast ? onFinish() : setStep(step + 1))}
          >
            {isLast ? '🚀 Mulai Sekarang' : 'Lanjut →'}
          </button>
        </div>

        {/* Skip */}
        {!isLast && (
          <button className="onboarding-skip" onClick={onFinish}>
            Lewati
          </button>
        )}
      </div>
    </div>
  );
}

export default Onboarding;