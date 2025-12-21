import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Plus, User, DollarSign, Key, CheckCircle, XCircle, Copy, QrCode } from 'lucide-react';

const Streams = () => {
    const { user } = useAuth();
    const { services, users, payments, formatCurrency, addLog, logs } = useData();

    // Identify current user (Handle potential string/number ID mismatch)
    const currentUser = users.find(u => String(u.id) === String(user?.id)) || user;

    // State
    const [expandedServiceId, setExpandedServiceId] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [showCredentials, setShowCredentials] = useState(null); // serviceId

    // Filter services user is member of
    const myServices = services.filter(s => {
        // Debug check to ensure we catch membership regardless of id type
        const isMember = s.members?.some(m => String(typeof m === 'object' ? m.id : m) === String(currentUser?.id));

        if (s.accessType === 'individual') {
            return isMember;
        }
        return isMember;
    });

    // Helper to get member details
    const getMemberDetails = (memberId) => users.find(u => String(u.id) === String(memberId));

    // Mock Next Payment (Real logic would check 'payments' array)
    const getNextPayment = (service, memberId) => {
        const today = new Date();
        const currentYear = today.getFullYear();

        // Find closest pending payment
        const pendingPayments = payments
            .filter(p =>
                p.serviceId === service.id &&
                p.userId === memberId &&
                p.status === 'pending'
            )
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Use the first pending payment, but safeguard against far-future dates (e.g., 2026 placeholders)
        // unless we are actually close to that date.
        const nextPayment = pendingPayments.find(p => {
            const paymentYear = parseInt(p.date.split('-')[0]);
            return paymentYear <= currentYear + 1; // Only show if within next year
        });

        if (nextPayment) {
            const [y, m, d] = nextPayment.date.split('-');
            return `${d}/${m}/${y}`;
        }

        // Fallback: 1st of next month
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        return nextMonth.toLocaleDateString('pt-BR');
    };

    const toggleExpand = (id) => {
        setExpandedServiceId(expandedServiceId === id ? null : id);
        setShowCredentials(null);
    };

    const handleServiceClick = (service) => {
        const hasService = myServices.find(s => s.id === service.id);
        if (hasService) {
            // Already a member, request cancellation
            if (window.confirm(`Deseja solicitar o cancelamento de ${service.name}? O administrador será notificado.`)) {
                // Check for duplicate cancellation request
                const hasPendingCancel = logs.some(l => {
                    const isCancel = l.action === 'SOLICITACAO_CANCELAMENTO';
                    const isForUser = l.details.includes(currentUser.name);
                    const isForService = l.details.includes(service.name);

                    if (!isCancel || !isForUser || !isForService) return false;

                    // Check if resolved
                    const isResolved = logs.some(res =>
                        res.action === 'RESOLUCAO_SOLICITACAO' &&
                        new Date(res.timestamp) > new Date(l.timestamp) &&
                        res.details.includes(currentUser.name) &&
                        res.details.includes(service.name)
                    );

                    return !isResolved;
                });

                if (hasPendingCancel) {
                    alert('Você já possui uma solicitação de cancelamento pendente para este serviço.');
                    return;
                }

                addLog({
                    type: 'WARNING',
                    action: 'SOLICITACAO_CANCELAMENTO',
                    details: `Usuário ${currentUser.name} solicitou cancelamento de ${service.name}`,
                    user: currentUser
                });
                alert('Solicitação enviada com sucesso!');
            }
        } else {
            // Request to join
            if (window.confirm(`Deseja solicitar participação em ${service.name}? Você entrará na lista de espera.`)) {
                // Check if already has pending request
                const hasPending = logs.some(l => {
                    // Look for JOIN request
                    const isJoin = l.action === 'SOLICITACAO_ADESAO';
                    // Robust check: ensure it's FOR THIS USER and THIS SERVICE
                    const isForUser = l.details.includes(currentUser.name); // Simple string check as kept in Admin
                    const isForService = l.details.includes(service.name);

                    if (!isJoin || !isForUser || !isForService) return false;

                    // Check if it has been RESOLVED by a later log
                    const isResolved = logs.some(res =>
                        res.action === 'RESOLUCAO_SOLICITACAO' &&
                        new Date(res.timestamp) > new Date(l.timestamp) &&
                        res.details.includes(currentUser.name) &&
                        res.details.includes(service.name)
                    );

                    return !isResolved;
                });

                if (hasPending) {
                    alert('Você já está na lista de espera para este serviço! Aguarde a aprovação do administrador.');
                    return;
                }

                addLog({
                    type: 'INFO',
                    action: 'SOLICITACAO_ADESAO',
                    details: `Usuário ${currentUser.name} solicitou adesão a ${service.name}`,
                    user: currentUser
                });
                alert('Solicitação enviada! Você será avisado quando houver vaga.');
            }
        }
    };

    return (
        <div className="p-6 md:p-12 space-y-8 pb-24 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Meus Streams</h1>
                    <p className="text-gray-400">Gerencie suas assinaturas e credenciais</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="w-full md:w-auto bg-gray-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all shadow-lg shadow-gray-200"
                >
                    <Plus size={20} /> <span>Adicionar Serviço</span>
                </button>
            </div>

            <div className="space-y-4">
                {myServices.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-3xl border border-gray-100 border-dashed">
                        <p className="text-gray-400 font-medium">Você ainda não participa de nenhum serviço.</p>
                        <button onClick={() => setIsAddModalOpen(true)} className="text-indigo-600 font-bold mt-2 hover:underline">Começar agora</button>
                    </div>
                ) : (
                    myServices.map(service => (
                        <div key={service.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                            {/* Card Header */}
                            <div
                                onClick={() => toggleExpand(service.id)}
                                className="p-4 md:p-6 flex flex-col md:flex-row items-center gap-4 md:gap-6 cursor-pointer select-none text-center md:text-left"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-gray-50 p-2 border border-gray-100 flex items-center justify-center shrink-0">
                                    <img src={service.logo} className="w-full h-full object-contain" />
                                </div>
                                <div className="flex-1 w-full">
                                    <h3 className="text-xl font-bold text-gray-900">{service.name}</h3>
                                    <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4 mt-1 text-sm text-gray-500 font-medium justify-center md:justify-start">
                                        <span className="flex items-center gap-1"><User size={14} /> {service.members?.length || 0} Membros</span>
                                        <span className="hidden md:inline">•</span>
                                        <span className="flex items-center gap-1"><DollarSign size={14} /> {formatCurrency(service.price)}</span>
                                    </div>
                                </div>
                                <button className="w-full md:w-auto bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-colors">
                                    {expandedServiceId === service.id ? 'Fechar' : 'Detalhes'}
                                </button>
                            </div>

                            {/* Expanded Details */}
                            {expandedServiceId === service.id && (
                                <div className="border-t border-gray-100 bg-gray-50/50 p-6 animate-slide-up">
                                    {/* Pix Payment Section REMOVED as per request */}

                                    {/* Credentials Section (Only for Shared) */}
                                    {service.accessType === 'shared' && service.login && (
                                        <div className="mb-8">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="font-bold text-gray-700 flex items-center gap-2">
                                                    <Key size={18} className="text-indigo-500" /> Credenciais de Acesso
                                                </h4>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setShowCredentials(showCredentials === service.id ? null : service.id); }}
                                                    className="text-xs font-bold text-gray-400 hover:text-indigo-600 uppercase tracking-wide"
                                                >
                                                    {showCredentials === service.id ? 'Ocultar' : 'Ver Senha'}
                                                </button>
                                            </div>
                                            <div className="bg-white p-4 rounded-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4 relative overflow-hidden">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] uppercase font-bold text-gray-400 mb-1">Login</span>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="font-mono text-gray-700 font-bold select-all break-all whitespace-pre-wrap text-sm">{service.login || 'Não informado'}</span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(service.login); }}
                                                            className="text-gray-400 hover:text-indigo-500 p-1"
                                                            title="Copiar Login"
                                                        >
                                                            <Copy size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] uppercase font-bold text-gray-400 mb-1">Senha</span>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className={`font-mono font-bold select-all break-all whitespace-pre-wrap text-sm ${showCredentials === service.id ? 'text-gray-700' : 'text-gray-200 bg-gray-200 rounded blur-[2px]'}`}>
                                                            {service.password || '••••••'}
                                                        </span>
                                                        {showCredentials === service.id && (
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(service.password); }}
                                                                className="text-gray-400 hover:text-indigo-500 p-1"
                                                                title="Copiar Senha"
                                                            >
                                                                <Copy size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {!showCredentials && <div className="absolute inset-0 flex items-center justify-center bg-white/10 backdrop-blur-[2px] cursor-pointer" onClick={() => setShowCredentials(service.id)}>
                                                    <span className="bg-gray-900/80 text-white px-3 py-1 rounded-lg text-xs font-bold">Clique para ver</span>
                                                </div>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Members Section */}
                                    <div>
                                        <h4 className="font-bold text-gray-700 flex items-center gap-2 mb-4">
                                            <User size={18} className="text-indigo-500" /> Membros do Grupo
                                        </h4>
                                        <div className="space-y-2">
                                            {service.members?.map(member => {
                                                const u = getMemberDetails(member.id);
                                                if (!u) return null;
                                                return (
                                                    <div key={member.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                                                                <img src={u.avatar} className="w-full h-full object-cover" />
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-gray-900 block text-sm">{u.name}</span>
                                                                <span className="text-xs text-gray-400">{u.role === 'admin' ? 'Administrador' : 'Membro'}</span>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Próximo Pagamento</span>
                                                            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                                                {getNextPayment(service, member.id)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 md:p-8 max-w-4xl w-full shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold text-gray-900">Serviços Disponíveis</h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <XCircle size={24} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                            {services.map(service => {
                                const hasService = myServices.some(s => s.id === service.id);
                                return (
                                    <div
                                        key={service.id}
                                        onClick={() => handleServiceClick(service)}
                                        className={`
                                            relative cursor-pointer group rounded-3xl p-6 border transition-all
                                            ${hasService
                                                ? 'bg-white border-gray-100 hover:border-indigo-200 hover:shadow-lg'
                                                : 'bg-gray-50 border-gray-200 grayscale hover:grayscale-0 hover:bg-white hover:border-indigo-300 hover:scale-105'
                                            }
                                        `}
                                    >
                                        {hasService && (
                                            <div className="absolute top-4 right-4 text-emerald-500">
                                                <CheckCircle size={20} fill="currentColor" className="text-white" />
                                            </div>
                                        )}
                                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl p-2 bg-white shadow-sm flex items-center justify-center">
                                            <img src={service.logo} className="w-full h-full object-contain" />
                                        </div>
                                        <div className="text-center">
                                            <h3 className="font-bold text-gray-900 mb-1">{service.name}</h3>
                                            <p className="text-xs text-gray-500 font-bold">{formatCurrency(service.price)}</p>
                                        </div>
                                        <div className="mt-4 text-center">
                                            <span className={`text-[10px] font-bold uppercase tracking-wide px-3 py-1 rounded-full ${hasService ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-200 text-gray-500'}`}>
                                                {hasService ? 'Assinado' : 'Disponível'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Streams;
