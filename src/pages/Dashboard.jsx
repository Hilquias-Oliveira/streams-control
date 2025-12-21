import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
    TrendingUp,
    TrendingDown,
    Calendar,
    Filter,
    Search,
    Download,
    Eye,
    EyeOff,
    AlertCircle,
    CheckCircle2,
    Clock,
    XCircle,
    ChevronDown,
    ChevronUp,
    Wallet,
    QrCode,
    Copy,
    ExternalLink,
    MoreHorizontal
} from 'lucide-react';
import PixQRCode from '../components/common/PixQRCode';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, LabelList } from 'recharts';

// Helper function to format currency
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
};

const Dashboard = () => {
    const { user: currentUser } = useAuth();
    const {
        services,
        payments,
        users,
        togglePaymentStatus: toggleStatusContext,
        loading: dataLoading,
        getPaymentStatus
    } = useData();

    // -- STATE --
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
    const [selectedService, setSelectedService] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedUser, setSelectedUser] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
    const [activeTab, setActiveTab] = useState('details');

    // UI State
    const [showSummaries, setShowSummaries] = useState(true);
    const [showFilters, setShowFilters] = useState(false);

    // Modal State
    const [selectedPaymentInfo, setSelectedPaymentInfo] = useState(null);

    // Pay All Modal State
    const [isPayAllModalOpen, setIsPayAllModalOpen] = useState(false);
    const [payAllGroups, setPayAllGroups] = useState([]);

    const canFilterUsers = currentUser?.role === 'admin';

    // Sorted Users for Filter
    const sortedUsers = useMemo(() => {
        return [...users].sort((a, b) => a.name.localeCompare(b.name));
    }, [users]);


    // -- DATA PREPARATION --

    // 1. Combine payments with service details
    const basePayments = useMemo(() => {
        if (!payments || !services) return [];
        return payments.map(p => {
            const service = services.find(s => s.id === p.serviceId);
            return {
                ...p,
                serviceName: service?.name || 'Unknown Service',
                serviceType: service?.type || 'subscription',
                servicePrice: service?.price || 0,
                serviceLogo: service?.logo,
                pixKey: service?.pixKey,
                pixKeyType: service?.pixKeyType,
                merchantName: service?.merchantName
            };
        });
    }, [payments, services]);

    // 2. Filtering
    const filteredPayments = useMemo(() => {
        if (!currentUser) return [];
        return basePayments.filter(p => {
            if (!p.date) return false;
            const [y, m] = p.date.split('-');

            if (selectedYear !== 'all' && y !== selectedYear) return false;
            if (selectedMonth !== 'all' && m !== selectedMonth) return false;
            if (selectedService !== 'all' && p.serviceId !== selectedService) return false;
            if (selectedStatus !== 'all' && p.status !== selectedStatus) return false;
            if (canFilterUsers && selectedUser !== 'all' && String(p.userId) !== String(selectedUser)) return false;

            // Default: show only user's payments unless admin
            if (!canFilterUsers && String(p.userId) !== String(currentUser.id)) return false;

            return true;
        });
    }, [basePayments, selectedYear, selectedMonth, selectedService, selectedUser, canFilterUsers, currentUser]);

    // 3. Sorting
    const sortedPayments = useMemo(() => {
        let sorted = [...filteredPayments];
        if (sortConfig.key) {
            sorted.sort((a, b) => {
                let valA = a[sortConfig.key];
                let valB = b[sortConfig.key];

                // Special handling for date
                if (sortConfig.key === 'date') {
                    // Dates are strings YYYY-MM-DD
                    // String comparison works, but new Date ensures correctness
                    valA = new Date(valA).getTime();
                    valB = new Date(valB).getTime();
                } else if (sortConfig.key === 'amount') {
                    valA = Number(valA);
                    valB = Number(valB);
                } else if (sortConfig.key === 'userName') {
                    const userA = users.find(u => String(u.id) === String(a.userId));
                    const userB = users.find(u => String(u.id) === String(b.userId));
                    valA = userA ? userA.name.toLowerCase() : '';
                    valB = userB ? userB.name.toLowerCase() : '';
                } else if (typeof valA === 'string') {
                    valA = valA.toLowerCase();
                    valB = valB.toLowerCase();
                }

                if (valA < valB) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (valA > valB) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sorted;
    }, [filteredPayments, sortConfig, users]);

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };


    // -- CALCULATIONS --
    const totalSpent = useMemo(() => {
        return filteredPayments
            .filter(p => p.status === 'paid')
            .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    }, [filteredPayments]);

    const totalPending = useMemo(() => {
        return filteredPayments
            .filter(p => p.status === 'pending')
            .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    }, [filteredPayments]);

    const totalPayable = useMemo(() => {
        return filteredPayments
            .filter(p => p.status === 'pending' && getPaymentStatus(p).canPay)
            .reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    }, [filteredPayments, getPaymentStatus]);

    // -- HANDLERS --

    const handleGenerateReport = () => {
        const csvContent = "data:text/csv;charset=utf-8,"
            + "Data,Serviço,Valor,Status\n"
            + filteredPayments.map(p => `${p.date},${p.serviceName},${p.amount},${p.status}`).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `extrato_streams_${selectedMonth}_${selectedYear}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const togglePaymentStatus = async (payment) => {
        const { id: paymentId, status: currentStatus } = payment;
        const { canPay, label } = getPaymentStatus(payment);

        // Bloquear pagamento antecipado (Status "A FATURAR")
        if (currentStatus === 'pending' && !canPay) {
            alert(`Este pagamento está identificado como "${label}" e não pode ser pago agora.`);
            return;
        }

        if (currentStatus === 'pending') {
            const confirm = window.confirm("Você confirma que realizou este pagamento? O status mudará para 'Em Análise'.");
            if (!confirm) return;
        }

        try {
            await toggleStatusContext(paymentId, currentUser);
        } catch (error) {
            console.error("Error updating payment:", error);
            alert("Erro ao atualizar pagamento");
        }
    };

    // --- PAY ALL LOGIC ---
    const handleOpenPayAll = () => {
        const pending = filteredPayments.filter(p => p.status === 'pending' && getPaymentStatus(p).canPay);
        if (pending.length === 0) return;

        // Group by Pix Key (and type) to allow batching if multiple services share the same key
        const groups = {};

        pending.forEach(p => {
            if (!p.pixKey) {
                // If no pix key, we can't generate a QR code, but maybe we still want to show it?
                // For now, let's group "No Pix" together or separate.
                // Let's exclude payments without Pix Key from the QR generation but maybe list them?
                // Or better, treat 'Unknown' as a key to warn user.
                return;
            }

            const key = `${p.pixKey}-${p.pixKeyType}`;
            if (!groups[key]) {
                groups[key] = {
                    pixKey: p.pixKey,
                    pixKeyType: p.pixKeyType,
                    merchantName: p.merchantName, // Default to first found
                    amount: 0,
                    items: [],
                    serviceNames: new Set()
                };
            }
            groups[key].amount += parseFloat(p.amount);
            groups[key].items.push(p);
            groups[key].serviceNames.add(p.serviceName);
        });

        const groupArray = Object.values(groups).map(g => ({
            ...g,
            merchantName: g.serviceNames.size > 1 ? 'Múltiplos Serviços' : (g.merchantName || Array.from(g.serviceNames)[0]),
            txId: `LOTE_${selectedMonth}_${new Date().getFullYear()}` // Batch ID
        }));

        setPayAllGroups(groupArray);
        setIsPayAllModalOpen(true);
    };


    // -- RENDER --

    if (dataLoading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Painel Financeiro</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Visão geral de seus gastos e assinaturas
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`inline-flex items-center px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <Filter className="w-4 h-4 mr-2" />
                        Filtros
                    </button>
                    <button
                        onClick={handleGenerateReport}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Exportar
                    </button>
                </div>
            </div>

            {/* Filters Section */}
            {showFilters && (
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm animate-fade-in-down">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="flex-1 min-w-[120px]">
                            <label className="block text-xs font-bold text-gray-400 mb-1 ml-1">Ano</label>
                            <div className="relative">
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                    className="w-full appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-3 pr-8 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer hover:border-gray-300"
                                >
                                    <option value="all">Todos</option>
                                    {/* Dynamic Years from Payments */}
                                    {(() => {
                                        const derivedYears = [...new Set(payments.map(p => p.date ? p.date.split('-')[0] : ''))].filter(Boolean).sort();
                                        const currentY = new Date().getFullYear().toString();
                                        if (!derivedYears.includes(currentY)) derivedYears.push(currentY);
                                        return derivedYears.sort().map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ));
                                    })()}
                                </select>
                                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Mês</label>
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="block w-full rounded-lg border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="all">Todos</option>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m.toString().padStart(2, '0')}>
                                        {new Date(0, m - 1).toLocaleString('pt-BR', { month: 'long' })}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Serviço</label>
                            <select
                                value={selectedService}
                                onChange={(e) => setSelectedService(e.target.value)}
                                className="block w-full rounded-lg border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="all">Todos</option>
                                {services && services.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        {canFilterUsers && (
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">Usuário</label>
                                <select
                                    value={selectedUser}
                                    onChange={(e) => setSelectedUser(e.target.value)}
                                    className="block w-full rounded-lg border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="all">Todos</option>
                                    {sortedUsers.map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div >
            )}

            {/* TABS HEADER */}
            <div className="group p-1 bg-gray-100/80 rounded-xl inline-flex gap-1 border border-gray-200/50 mb-6">
                <button
                    onClick={() => setActiveTab('details')}
                    className={`
                        px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2
                        ${activeTab === 'details'
                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}
                    `}
                >
                    <MoreHorizontal className="w-4 h-4" />
                    Detalhamento
                </button>
                <button
                    onClick={() => setActiveTab('charts')}
                    className={`
                        px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 flex items-center gap-2
                        ${activeTab === 'charts'
                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}
                    `}
                >
                    <TrendingUp className="w-4 h-4" />
                    Gráficos
                </button>
            </div>

            {/* TAB CONTENT: DETAILS */}
            {
                activeTab === 'details' && (
                    <>

                        {/* Summaries Cards */}
                        {showSummaries && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <TrendingUp className="w-16 h-16 text-emerald-600" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-500">Total Pago</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(totalSpent)}</p>
                                    <div className="mt-4 flex items-center text-xs text-emerald-600 font-medium">
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        {filteredPayments.filter(p => p.status === 'paid').length} faturas pagas
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <Clock className="w-16 h-16 text-amber-600" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-500">Pendente</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(totalPending)}</p>
                                    <div className="mt-4 flex items-center text-xs text-amber-600 font-medium">
                                        <AlertCircle className="w-3 h-3 mr-1" />
                                        {filteredPayments.filter(p => p.status === 'pending').length} faturas em aberto
                                    </div>
                                </div>

                                <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <TrendingDown className="w-16 h-16 text-indigo-600" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-500">Previsto (Mês)</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-2">
                                        {formatCurrency(totalSpent + totalPending)}
                                    </p>
                                    <div className="mt-4 flex items-center text-xs text-indigo-600 font-medium">
                                        <Calendar className="w-3 h-3 mr-1" />
                                        Total consolidado
                                    </div>
                                </div>
                            </div>
                        )}


                        {showSummaries && (
                            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm overflow-hidden animate-fade-in hidden">
                                <h3 className="text-lg font-bold text-gray-800 mb-6">Evolução de Gastos (Confirmados)</h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={(() => {
                                                // Aggregate paid payments by month for the selected year
                                                const months = Array.from({ length: 12 }, (_, i) => ({
                                                    name: new Date(0, i).toLocaleString('pt-BR', { month: 'short' }),
                                                    total: 0,
                                                    originalIndex: i + 1
                                                }));

                                                filteredPayments.forEach(p => {
                                                    if (p.status === 'paid' && p.date) {
                                                        const parts = p.date.split('-');
                                                        if (parts.length >= 2) {
                                                            const m = parseInt(parts[1]) - 1;
                                                            if (m >= 0 && m < 12) {
                                                                months[m].total += Number(p.amount);
                                                            }
                                                        }
                                                    }
                                                });

                                                return months;
                                            })()}
                                            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                            <XAxis
                                                dataKey="name"
                                                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                                                axisLine={false}
                                                tickLine={false}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 12, fill: '#9CA3AF' }}
                                                axisLine={false}
                                                tickLine={false}
                                                tickFormatter={(val) => `R$${val}`}
                                            />
                                            <Tooltip
                                                cursor={{ fill: '#EEF2FF' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            />
                                            <Bar
                                                dataKey="total"
                                                fill="#4F46E5"
                                                radius={[4, 4, 0, 0]}
                                                barSize={32}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* View Toggles & Actions */}
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => setShowSummaries(!showSummaries)}
                                className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
                            >
                                {showSummaries ? (
                                    <><EyeOff className="w-3 h-3 mr-1" /> Ocultar Resumo</>
                                ) : (
                                    <><Eye className="w-3 h-3 mr-1" /> Mostrar Resumo</>
                                )}
                            </button>

                            {/* Pay All Button */}
                            {totalPayable > 0 && (
                                <button
                                    onClick={handleOpenPayAll}
                                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 animate-pulse-gentle"
                                >
                                    <Wallet className="w-4 h-4 mr-2" />
                                    Pagar Faturas ({formatCurrency(totalPayable)})
                                </button>
                            )}
                        </div>

                        {/* Payments List */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th
                                                scope="col"
                                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                                onClick={() => handleSort('serviceName')}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Serviço
                                                    {sortConfig.key === 'serviceName' && (
                                                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                                onClick={() => handleSort('userName')}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Responsável
                                                    {sortConfig.key === 'userName' && (
                                                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                                onClick={() => handleSort('date')}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Vencimento
                                                    {sortConfig.key === 'date' && (
                                                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                                onClick={() => handleSort('amount')}
                                            >
                                                <div className="flex items-center gap-1">
                                                    Valor
                                                    {sortConfig.key === 'amount' && (
                                                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                                    )}
                                                </div>
                                            </th>
                                            <th
                                                scope="col"
                                                className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                                                onClick={() => handleSort('status')}
                                            >
                                                <div className="flex items-center justify-center gap-1">
                                                    Status
                                                    {sortConfig.key === 'status' && (
                                                        sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                                                    )}
                                                </div>
                                            </th>
                                            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Ações
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {sortedPayments.length > 0 ? (
                                            sortedPayments.map((payment) => {
                                                const user = users.find(u => String(u.id) === String(payment.userId)) || { name: 'Desconhecido' };
                                                return (
                                                    <tr key={payment.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="flex items-center">
                                                                {payment.serviceLogo ? (
                                                                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-white border border-gray-100 p-1 flex items-center justify-center">
                                                                        <img src={payment.serviceLogo} className="max-w-full max-h-full object-contain" alt={payment.serviceName} />
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                                                        {payment.serviceName.substring(0, 2).toUpperCase()}
                                                                    </div>
                                                                )}
                                                                <div className="ml-4">
                                                                    <div className="text-sm font-medium text-gray-900">{payment.serviceName}</div>
                                                                    <div className="text-xs text-gray-500 capitalize">{payment.serviceType}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="text-sm text-gray-900 font-bold">
                                                                {user.name}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="text-sm text-gray-900">
                                                                {new Date(payment.date).toLocaleDateString('pt-BR')}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap">
                                                            <div className="text-sm font-medium text-gray-900">
                                                                {formatCurrency(payment.amount)}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                                            {(() => {
                                                                const { label, color } = getPaymentStatus(payment);
                                                                return (
                                                                    <span
                                                                        onClick={() => togglePaymentStatus(payment)}
                                                                        className={`px-2 py-1 inline-flex text-xs leading-5 font-bold rounded-full cursor-pointer select-none transition-all ${color} hover:opacity-80`}
                                                                    >
                                                                        {label}
                                                                    </span>
                                                                );
                                                            })()}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                            <button
                                                                onClick={() => setSelectedPaymentInfo(payment)}
                                                                className="text-indigo-600 hover:text-indigo-900 p-2 hover:bg-indigo-50 rounded-full transition-colors"
                                                                title="Ver Detalhes"
                                                            >
                                                                <MoreHorizontal className="w-5 h-5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                                    <Search className="mx-auto h-12 w-12 text-gray-300 mb-3" />
                                                    <p>Nenhum pagamento encontrado para os filtros selecionados.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </>
                )
            }

            {/* TAB CONTENT: CHARTS */}
            {
                activeTab === 'charts' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">

                        {/* 1. Monthly Cost History */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-2">
                            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-indigo-600" />
                                Custo Mensal (Evolução)
                            </h3>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        data={(() => {
                                            let months = Array.from({ length: 12 }, (_, i) => ({
                                                name: new Date(0, i).toLocaleString('pt-BR', { month: 'short' }).toUpperCase(),
                                                total: 0,
                                                monthIndex: (i + 1).toString().padStart(2, '0')
                                            }));

                                            // If a specific month is selected, filter the chart data to only that month or centering it?
                                            // User request: "mesmo quando só um mes está filtrado e coloca a barra no canto, ela devia ficar centrallizada"
                                            // So we should return only the relevant data point if filtered.
                                            if (selectedMonth !== 'all') {
                                                months = months.filter(m => m.monthIndex === selectedMonth);
                                            }

                                            filteredPayments.forEach(p => {
                                                if (p.date) { // Removed strict 'paid' check to allow 'pending' viz if filtered
                                                    const parts = p.date.split('-');
                                                    if (parts.length >= 2) {
                                                        const mIndex = parts[1];
                                                        const monthData = months.find(m => m.monthIndex === mIndex);
                                                        if (monthData) {
                                                            monthData.total += Number(p.amount);
                                                        }
                                                    }
                                                }
                                            });
                                            return months;
                                        })()}
                                        margin={{ top: 20, right: 0, left: 0, bottom: 0 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6B7280', fontWeight: 600 }} axisLine={false} tickLine={false} interval={0} />
                                        <YAxis tick={{ fontSize: 10, fill: '#6B7280' }} axisLine={false} tickLine={false} tickFormatter={(val) => `R$${Math.floor(val)}`} />
                                        <Tooltip
                                            cursor={{ fill: '#F3F4F6' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value) => formatCurrency(value)}
                                        />
                                        <Bar
                                            dataKey="total"
                                            fill="#1e1b4b"
                                            radius={[4, 4, 0, 0]}
                                            onClick={(data) => {
                                                if (data && data.monthIndex) {
                                                    setSelectedMonth(current => current === data.monthIndex ? 'all' : data.monthIndex);
                                                }
                                            }}
                                            cursor="pointer"
                                            label={{ position: 'top', fill: '#4B5563', fontSize: 10, formatter: (val) => val > 0 ? `R$${Math.floor(val)}` : '' }}
                                        />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 2. Distribution by Service */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <Wallet className="w-5 h-5 text-indigo-600" />
                                Distribuição por Stream
                            </h3>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart
                                        layout="vertical"
                                        data={(() => {
                                            const serviceTotals = {};
                                            const serviceIds = {}; // Map to store service IDs
                                            let total = 0;
                                            filteredPayments.forEach(p => {
                                                // Removed strict 'paid' check
                                                serviceTotals[p.serviceName] = (serviceTotals[p.serviceName] || 0) + Number(p.amount);
                                                serviceIds[p.serviceName] = p.serviceId;
                                                total += Number(p.amount);
                                            });
                                            return Object.entries(serviceTotals)
                                                .map(([name, value]) => ({
                                                    name,
                                                    value,
                                                    serviceId: serviceIds[name],
                                                    label: `${formatCurrency(value)} (${total > 0 ? ((value / total) * 100).toFixed(0) + '%' : '0%'})`
                                                }))
                                                .sort((a, b) => b.value - a.value)
                                                .slice(0, 8); // Top 8
                                        })()}

                                        margin={{ left: 20, right: 100 }}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E5E7EB" />
                                        <XAxis type="number" hide />
                                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: '#4B5563', fontWeight: 600 }} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{ fill: '#F3F4F6' }} formatter={(value) => formatCurrency(value)} />
                                        <Bar
                                            dataKey="value"
                                            fill="#4338ca"
                                            radius={[0, 4, 4, 0]}
                                            barSize={24}
                                            onClick={(data) => {
                                                if (data && data.serviceId) {
                                                    setSelectedService(current => current === data.serviceId ? 'all' : data.serviceId);
                                                }
                                            }}
                                            cursor="pointer"
                                        >
                                            <LabelList dataKey="label" position="right" fill="#4B5563" fontSize={11} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* 3. Status Overview */}
                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                Status Geral
                            </h3>
                            <div className="h-80 w-full flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[
                                                { name: 'Pago', value: filteredPayments.filter(p => p.status === 'paid').length, fill: '#10b981', statusType: 'paid' },
                                                { name: 'Pendente', value: filteredPayments.filter(p => p.status === 'pending').length, fill: '#d1d5db', statusType: 'pending' }
                                            ]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                            onClick={(data) => {
                                                const status = data.statusType || data.payload?.statusType;
                                                if (status) {
                                                    setSelectedStatus(current => current === status ? 'all' : status);
                                                }
                                            }}
                                            cursor="pointer"
                                        >
                                            <Cell key="cell-0" fill={selectedStatus === 'paid' ? '#047857' : '#10b981'} />
                                            <Cell key="cell-1" fill={selectedStatus === 'pending' ? '#9ca3af' : '#d1d5db'} />
                                        </Pie>
                                        <Tooltip />
                                        <Legend
                                            verticalAlign="bottom"
                                            height={36}
                                            onClick={(data) => {
                                                const status = data.statusType || data.payload?.statusType;
                                                if (status) {
                                                    setSelectedStatus(current => current === status ? 'all' : status);
                                                }
                                            }}
                                            cursor="pointer"
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* PAYMENT INFO MODAL */}
            {
                selectedPaymentInfo && (() => {
                    const service = services.find(s => s.id === selectedPaymentInfo.serviceId);
                    const isShared = service?.accessType === 'shared';
                    const hasCredentials = isShared && service?.login;
                    const hasPix = service?.pixKey;

                    return (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in flex flex-col max-h-[85vh]">
                                <div className="p-6 overflow-y-auto">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900">Detalhes do Pagamento</h3>
                                            <p className="text-sm text-gray-500">ID: {selectedPaymentInfo.id.slice(0, 8)}</p>
                                        </div>
                                        <button
                                            onClick={() => setSelectedPaymentInfo(null)}
                                            className="text-gray-400 hover:text-gray-600 transition-colors"
                                        >
                                            <XCircle className="w-6 h-6" />
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        {/* Primary Info */}
                                        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Serviço</span>
                                                <span className="font-medium text-gray-900">{selectedPaymentInfo.serviceName}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Valor</span>
                                                <span className="font-medium text-gray-900">{formatCurrency(selectedPaymentInfo.amount)}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Vencimento</span>
                                                <span className="font-medium text-gray-900">{new Date(selectedPaymentInfo.date).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex justify-between text-sm items-center">
                                                <span className="text-gray-500">Status</span>
                                                {(() => {
                                                    const { label, color } = getPaymentStatus(selectedPaymentInfo);
                                                    return (
                                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${color}`}>
                                                            {label}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {/* Pix QRCode Section */}
                                        {selectedPaymentInfo.status === 'pending' && hasPix && (
                                            (() => {
                                                const { canPay, label } = getPaymentStatus(selectedPaymentInfo);
                                                if (!canPay) {
                                                    return (
                                                        <div className="border border-yellow-100 rounded-xl p-4 bg-yellow-50 text-yellow-700 text-sm text-center">
                                                            <div className="font-bold mb-1">Pagamento indisponível</div>
                                                            <p>O QR Code para pagamento só estará disponível 5 dias antes do vencimento.</p>
                                                            <div className="mt-2 text-xs font-mono uppercase tracking-widest opacity-70">{label}</div>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm">
                                                        <div className="flex items-center gap-2 mb-3 text-indigo-600 font-medium">
                                                            <QrCode className="w-5 h-5" />
                                                            <span>Pagamento via Pix</span>
                                                        </div>
                                                        <PixQRCode
                                                            pixKey={service.pixKey}
                                                            pixKeyType={service.pixKeyType}
                                                            merchantName={service.merchantName}
                                                            merchantCity="Recife"
                                                            amount={selectedPaymentInfo.amount}
                                                            txId={`PG_${selectedPaymentInfo.id}_${new Date().toISOString().slice(0, 7).replace('-', '')}`}
                                                        />
                                                    </div>
                                                );
                                            })()
                                        )}

                                        {/* Credentials Section REMOVED as per request */}
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-gray-100 flex gap-3">
                                        <button
                                            onClick={() => togglePaymentStatus(selectedPaymentInfo.id, selectedPaymentInfo.status)}
                                            disabled={selectedPaymentInfo.status !== 'paid' && !getPaymentStatus(selectedPaymentInfo).canPay}
                                            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${selectedPaymentInfo.status === 'paid'
                                                ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                                                : (!getPaymentStatus(selectedPaymentInfo).canPay
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-green-50 text-green-700 hover:bg-green-100')
                                                }`}
                                        >
                                            Marcar como {selectedPaymentInfo.status === 'paid' ? 'Pendente' : 'Pago'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })()
            }

            {/* PAY ALL MODAL */}
            {
                isPayAllModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
                            {/* Header */}
                            <div className="p-6 border-b border-gray-100 bg-gray-50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                                            <Wallet className="w-5 h-5 text-indigo-600" />
                                            Pagamento em Lote
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Pague seus serviços pendentes agrupados por chave Pix
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setIsPayAllModalOpen(false)}
                                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        <XCircle className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-6 overflow-y-auto space-y-8">
                                {payAllGroups.length > 0 ? (
                                    payAllGroups.map((group, idx) => (
                                        <div key={idx} className="bg-white border-2 border-indigo-50 rounded-xl p-5 shadow-sm relative overflow-hidden">
                                            {payAllGroups.length > 1 && (
                                                <div className="absolute top-0 left-0 bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1 rounded-br-lg">
                                                    Grupo {idx + 1}
                                                </div>
                                            )}

                                            <div className="mb-4 mt-2">
                                                <div className="flex justify-between items-end mb-2">
                                                    <span className="text-sm text-gray-500 font-medium">Beneficiário</span>
                                                    <span className="text-base font-bold text-gray-900">{group.merchantName}</span>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <span className="text-sm text-gray-500 font-medium">Total a pagar</span>
                                                    <span className="text-2xl font-bold text-indigo-600">{formatCurrency(group.amount)}</span>
                                                </div>
                                            </div>

                                            <div className="bg-gray-50 rounded-lg p-2 mb-4">
                                                <details className="group">
                                                    <summary className="flex justify-between items-center cursor-pointer text-xs uppercase font-bold text-gray-500 hover:text-indigo-600 transition-colors py-1">
                                                        <span>Ver itens inclusos ({group.items.length})</span>
                                                        <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
                                                    </summary>
                                                    <div className="mt-3 space-y-2 border-t border-gray-200 pt-2">
                                                        {group.items.map(item => (
                                                            <div key={item.id} className="flex justify-between text-sm text-gray-700">
                                                                <span>{item.serviceName}</span>
                                                                <span className="font-mono">{formatCurrency(item.amount)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            </div>

                                            <div className="mt-4">
                                                <PixQRCode
                                                    pixKey={group.pixKey}
                                                    pixKeyType={group.pixKeyType}
                                                    merchantName={group.merchantName}
                                                    merchantCity="Recife"
                                                    amount={group.amount}
                                                    txId={group.txId}
                                                />
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-8 text-gray-500">
                                        Não há pagamentos pendentes com chave Pix configurada para agrupar.
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-4 border-t border-gray-100 bg-gray-50 text-center text-xs text-gray-400">
                                Após o pagamento, marque as faturas individualmente como pagas.
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Dashboard;
