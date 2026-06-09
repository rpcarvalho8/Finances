'use client';

import { useState, useEffect } from 'react';

export default function CondoFlowPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    // Placeholder for fetching condo data
    setLoading(true);
    // Simulate fetch
    setTimeout(() => {
      setData({
        quotas: [
          { apartment: '101', owner: 'Rui', amount: 120, paid: true },
          { apartment: '102', owner: 'Ana', amount: 120, paid: false },
          { apartment: '103', owner: 'João', amount: 120, paid: true },
        ],
        reserveFund: 5400,
        expenses: [
          { description: 'Elevador maintenance', amount: 300, date: '2026-05-10' },
          { description: 'Jardim', amount: 150, date: '2026-05-15' },
        ],
      });
      setLoading(false);
    }, 800);
  }, []);

  if (loading) return <div className="p-6">Carregando dados do condomínio...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">CondoFlow – Gestão de Condomínio</h1>

      <div className="grid gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Fundo de Reserva</h2>
          <p className="text-2xl font-bold text-gray-900">{data?.reserveFund?.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) ?? '0'}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Quotas Mensais</h2>
          <div className="space-y-3">
            {data?.quotas?.map((q: any) => (
              <div key={q.apartment} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                <span>Apartamento {q.apartment} – {q.owner}</span>
                <span className={`${q.paid ? 'text-green-600' : 'text-red-600'} font-medium`}>
                  {q.paid ? 'Pago' : 'Pendente'} – {q.amount?.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                </span>
              </div>
            )) ?? <p className="text-gray-500">Sem dados</p>}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Despesas Recentes</h2>
          <div className="space-y-2">
            {data?.expenses?.map((exp: any) => (
              <div key={exp.description} className="text-sm text-gray-600">
                <strong>{exp.description}</strong> – {exp.amount?.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })} ({exp.date})
              </div>
            )) ?? <p className="text-gray-500">Sem despesas</p>}
          </div>
        </div>
      </div>
    </div>
  );
}