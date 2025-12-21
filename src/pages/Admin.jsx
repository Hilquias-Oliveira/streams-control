

import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Check, CheckCircle, Trash2, Key, Plus, UserPlus, Edit, Shield, LayoutGrid, ScrollText, Copy, Bell, BellRing, ExternalLink, X, Clock } from 'lucide-react';
import ImagePicker from '../components/common/ImagePicker';

const StatusBadge = ({ payment, getStatus }) => {
    const status = getStatus(payment);
    return (
        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${status.color}`}>
            {status.label}
        </span>
    );
};

const Admin = () => {
    const { user: authUser } = useAuth();
    const {
        payments, approvePayment, deletePayment, addManualPayment,
        users, addUser, updateUser, deleteUser, getUser,
        services, addService, updateService, assignService,
        logs, formatCurrency, getPaymentStatus,
        processedRequests, markRequestAsProcessed, addLog, togglePaymentStatus, cleanupFuturePayments
    } = useData();

    // Identify current user with live data
    const currentUser = users.find(u => u.id === authUser?.id) || authUser;
    const isSupervisor = currentUser?.role === 'supervisor';

    // Tabs
    const [activeTab, setActiveTab] = useState('payments');

    // Filters State
    const [selectedYear, setSelectedYear] = useState('2025');
    const [selectedMonth, setSelectedMonth] = useState('01');
    const [selectedService, setSelectedService] = useState('all');
    const [selectedUser, setSelectedUser] = useState('all');
    // Sorting
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    // Derived Data for Services (Filtered for Supervisor)
    const visibleServices = useMemo(() => {
        if (isSupervisor) {
            return services.filter(s => currentUser?.supervisedServices?.includes(s.id));
        }
        return services;
    }, [services, isSupervisor, currentUser]);

    // Constants
    const YEARS = useMemo(() => {
        if (!payments || payments.length === 0) return [new Date().getFullYear().toString()];
        const uniqueYears = [...new Set(payments.map(p => p.date.split('-')[0]))].sort();
        // Ensure current year is always available even if no payments
        const currentYear = new Date().getFullYear().toString();
        if (!uniqueYears.includes(currentYear)) uniqueYears.push(currentYear);
        return uniqueYears.sort();
    }, [payments]);
    const MONTHS = [
        { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' }, { value: '03', label: 'Março' },
        { value: '04', label: 'Abril' }, { value: '05', label: 'Maio' }, { value: '06', label: 'Junho' },
        { value: '07', label: 'Julho' }, { value: '08', label: 'Agosto' }, { value: '09', label: 'Setembro' },
        { value: '10', label: 'Outubro' }, { value: '11', label: 'Novembro' }, { value: '12', label: 'Dezembro' }
    ];

    // MODAL STATES
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    // User Form State
    const [userData, setUserData] = useState({ id: null, name: '', username: '', phone: '', role: 'user', supervisedServices: [], avatar: '' });

    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [serviceForm, setServiceForm] = useState({
        name: '', price: '', logo: '', type: 'monthly', color: '#000000',
        accessType: 'individual', login: '', password: '', qrCode: '', members: [], billingType: 'rotation',
        pixKey: '', pixKeyType: 'random'
    });

    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assignData, setAssignData] = useState({ userId: '', serviceId: '' });

    // --- USERS FILTER & SORT ---
    const [userSearch, setUserSearch] = useState('');
    const [userServiceFilter, setUserServiceFilter] = useState('all');

    const visibleUsers = useMemo(() => {
        let result = users;

        // 1. Filter by Name
        if (userSearch) {
            const lower = userSearch.toLowerCase();
            result = result.filter(u => u.name.toLowerCase().includes(lower) || u.username.toLowerCase().includes(lower));
        }

        // 2. Filter by Service
        if (userServiceFilter !== 'all') {
            result = result.filter(u => {
                const s = services.find(srv => srv.id === userServiceFilter);
                return s?.members?.some(m => String(typeof m === 'object' ? m.id : m) === String(u.id));
            });
        }

        // 3. Sort (Admin > Supervisor > User, then Alphabetical)
        const rolePriority = { 'admin': 0, 'supervisor': 1, 'user': 2 };

        return result.sort((a, b) => {
            const roleDiff = (rolePriority[a.role] ?? 2) - (rolePriority[b.role] ?? 2);
            if (roleDiff !== 0) return roleDiff;
            return a.name.localeCompare(b.name);
        });
    }, [users, userSearch, userServiceFilter, services]);

    // --- FILTER LOGIC ---
    const filteredPayments = useMemo(() => {
        return payments.filter(p => {
            // Supervisor Restriction
            if (isSupervisor) {
                if (!currentUser?.supervisedServices?.includes(p.serviceId)) return false;
            }

            if (!p.date) return false;
            const [y, m] = p.date.split('-');
            if (selectedYear !== 'all' && y !== selectedYear) return false;
            if (selectedMonth !== 'all' && m !== selectedMonth) return false;
            if (selectedService !== 'all' && p.serviceId !== selectedService) return false;
            if (selectedUser !== 'all' && String(p.userId) !== String(selectedUser)) return false;
            return true;
        });

        // Apply Sorting
        return filtered.sort((a, b) => {
            if (!sortConfig.key) return 0;

            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            // Resolve values for special columns
            if (sortConfig.key === 'serviceName') {
                valA = services.find(s => s.id === a.serviceId)?.name || '';
                valB = services.find(s => s.id === b.serviceId)?.name || '';
            } else if (sortConfig.key === 'userName') {
                valA = getUser(a.userId)?.name || '';
                valB = getUser(b.userId)?.name || '';
            } else if (sortConfig.key === 'amount') {
                valA = Number(valA);
                valB = Number(valB);
            } else if (sortConfig.key === 'status') {
                // Sort by status label priority logic could go here, but simple string sort for now
                // or use getPaymentStatus logic? Let's use status string first.
                valA = a.status;
                valB = b.status;
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [payments, services, users, selectedYear, selectedMonth, selectedService, selectedUser, isSupervisor, currentUser, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };


    // Handlers
    const handleUserSubmit = (e) => {
        e.preventDefault();
        if (userData.id) {
            updateUser(userData.id, userData);
        } else {
            addUser(userData);
        }
        setUserData({ id: null, name: '', username: '', role: 'user', supervisedServices: [], avatar: '' });
        setIsUserModalOpen(false);
    };

    const removeUser = (id) => {
        if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
            deleteUser(id);
        }
    };

    const resetPassword = (id) => {
        const newPassword = window.prompt("Digite a nova senha para o usuário:");
        if (newPassword) {
            updateUser(id, { password: newPassword });
            alert("Senha alterada com sucesso!");
        }
    };

    const openEditUser = (user) => {
        // Fix for crash: Ensure supervisedServices is an array
        setUserData({ ...user, supervisedServices: user.supervisedServices || [] });
        setIsUserModalOpen(true);
    };

    const handleAssignService = (e) => {
        e.preventDefault();
        assignService(Number(assignData.userId), assignData.serviceId);
        setAssignData({ userId: '', serviceId: '' });
        setIsAssignModalOpen(false);
        setActiveTab('payments');
    };

    const [showEffectiveDate, setShowEffectiveDate] = useState(false);
    const [pendingServiceUpdate, setPendingServiceUpdate] = useState(null);
    const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0].substring(0, 7)); // YYYY-MM

    const handleServiceSubmit = (e) => {
        e.preventDefault();

        // Data Cleanup
        const finalForm = { ...serviceForm };
        if (finalForm.accessType === 'individual') {
            finalForm.login = '';
            finalForm.password = '';
        }

        if (editingService) {
            // Check changes that require regeneration
            const priceChanged = Number(editingService.price) !== Number(finalForm.price);
            const typeChanged = editingService.type !== finalForm.type;
            const accessTypeChanged = editingService.accessType !== finalForm.accessType;
            const billingTypeChanged = editingService.billingType !== finalForm.billingType;

            // Check members change (Order matters for individual!)
            const oldMembers = JSON.stringify(editingService.members || []);
            const newMembers = JSON.stringify(finalForm.members || []);
            const membersChanged = oldMembers !== newMembers;

            if (priceChanged || typeChanged || accessTypeChanged || billingTypeChanged || membersChanged) {
                setPendingServiceUpdate({ id: editingService.id, updates: finalForm });
                setShowEffectiveDate(true);
                return;
            }

            updateService(editingService.id, finalForm);
        } else {
            addService(finalForm);
        }

        closeServiceModal();
    };

    const confirmUpdate = () => {
        if (pendingServiceUpdate) {
            // Pass the YYYY-MM string directly to updateService
            // DataContext now handles the parsing securely to avoid timezone issues
            updateService(pendingServiceUpdate.id, pendingServiceUpdate.updates, effectiveDate);
            setShowEffectiveDate(false);
            setPendingServiceUpdate(null);
            closeServiceModal();
        }
    };

    const closeServiceModal = () => {
        setIsServiceModalOpen(false);
        setEditingService(null);
        setServiceForm({
            name: '', price: '', logo: '', type: 'monthly', color: '#000000',
            accessType: 'individual', login: '', password: '', qrCode: '', members: [], billingType: 'rotation',
            pixKey: '', pixKeyType: 'random'
        });
    };

    const openEditService = (service) => {
        setEditingService(service);
        setServiceForm({ ...service });
        setIsServiceModalOpen(true);
    };

    const toggleSupervisedService = (serviceId) => {
        setUserData(prev => {
            const current = prev.supervisedServices || [];
            if (current.includes(serviceId)) {
                return { ...prev, supervisedServices: current.filter(id => id !== serviceId) };
            } else {
                return { ...prev, supervisedServices: [...current, serviceId] };
            }
        });
    };

    // --- PIX MASK HELPER ---
    const handlePixKeyChange = (val) => {
        let v = val;
        if (serviceForm.pixKeyType === 'cpf') {
            v = v.replace(/\D/g, '');
            v = v.replace(/(\d{3})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})(\d)/, '$1.$2');
            v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
            v = v.substring(0, 14);
        } else if (serviceForm.pixKeyType === 'phone') {
            v = v.replace(/\D/g, '');
            v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
            v = v.replace(/(\d)(\d{4})$/, '$1-$2');
            v = v.substring(0, 15);
        }
        setServiceForm(prev => ({ ...prev, pixKey: v }));
    };

    // --- DRAG AND DROP STATE ---
    const [draggedMemberIndex, setDraggedMemberIndex] = useState(null);

    const onDragStart = (e, index) => {
        setDraggedMemberIndex(index);
        // Required for Firefox
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const onDrop = (e, dropIndex) => {
        e.preventDefault();
        if (draggedMemberIndex === null) return;

        const newMembers = [...(serviceForm.members || [])];
        const item = newMembers[draggedMemberIndex];

        // Remove item from old position
        newMembers.splice(draggedMemberIndex, 1);
        // Insert at new position
        newMembers.splice(dropIndex, 0, item);

        setServiceForm(prev => ({ ...prev, members: newMembers }));
        setDraggedMemberIndex(null);
    };

    // --- MANUAL PAYMENT STATE ---
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [paymentForm, setPaymentForm] = useState({
        serviceId: '',
        userId: '',
        amount: '',
        competence: '' // YYYY-MM
    });

    const openPaymentModal = () => {
        setPaymentForm({ serviceId: '', userId: '', amount: '', competence: '' });
        setIsPaymentModalOpen(true);
    };

    const closePaymentModal = () => setIsPaymentModalOpen(false);

    const handlePaymentSubmit = (e) => {
        e.preventDefault();

        // Convert competence YYYY-MM to Date string (YYYY-MM-01)
        const [year, month] = paymentForm.competence.split('-');
        const dateStr = `${year}-${month}-01`;

        addManualPayment({
            serviceId: paymentForm.serviceId,
            userId: Number(paymentForm.userId),
            amount: Number(paymentForm.amount),
            date: dateStr,
            status: 'pending' // Default status
        });

        closePaymentModal();
    };

    // Auto-fill amount when service changes
    const handlePaymentServiceChange = (e) => {
        const sId = e.target.value;
        const s = services.find(srv => srv.id === sId);
        setPaymentForm(prev => ({
            ...prev,
            serviceId: sId,
            amount: s ? s.price : ''
        }));
    };

    // --- NOTIFICATIONS ---
    const pendingRequests = useMemo(() => {
        // Filter logs for requests in the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Get all relevant requests
        const requests = logs.filter(l =>
            (l.action === 'SOLICITACAO_ADESAO' || l.action === 'SOLICITACAO_CANCELAMENTO') &&
            new Date(l.timestamp) > sevenDaysAgo
        );

        // Filter out those that have been resolved
        // Resolution is determined if there is a newer log with action RESOLUCAO_SOLICITACAO relating to same user/service
        return requests.filter(req => {
            // Normalize strings for robust matching
            const requestActorName = req.actor.split(' (')[0].trim().toLowerCase();
            // Extract service name from request details for extra safety
            const serviceNameMatch = req.details.match(/ a (.+)$/) || req.details.match(/ de (.+)$/);
            const reqServiceName = serviceNameMatch ? serviceNameMatch[1].toLowerCase() : '';

            const hasResolution = logs.some(l => {
                if (l.action !== 'RESOLUCAO_SOLICITACAO') return false;
                // Use >= to account for fast executions (though unlikely to be same ms)
                // Also ensures if clocks are weirdly synced we aren't too strict
                if (new Date(l.timestamp) < new Date(req.timestamp)) return false;

                const logDetails = l.details.toLowerCase();
                // Check if it mentions the same user AND the same service
                // This prevents hiding "Spotify" request when "Netflix" is rejected
                return logDetails.includes(requestActorName) && logDetails.includes(reqServiceName);
            });

            if (hasResolution) return false;

            if (hasResolution) return false;

            // Check if manually dismissed in this session
            // Check persistent processed list
            if (processedRequests.includes(req.id)) return false;

            // Note: Ideally we'd match by request ID...
            const serviceName = serviceNameMatch ? serviceNameMatch[1] : null;
            const service = services.find(s => s.name === serviceName);

            // Extract user info from log (we need to find the user object to check membership)
            // Log 'user' field is string "Name (Role)". 
            const userName = req.actor.split(' (')[0];
            const userObj = users.find(u => u.name === userName);

            if (!service || !userObj) return false; // Invalid data, hide

            const isMember = service.members?.some(m => (typeof m === 'object' ? m.id : m) === userObj.id);

            if (req.action === 'SOLICITACAO_ADESAO' && isMember) return false; // Already joined
            if (req.action === 'SOLICITACAO_CANCELAMENTO' && !isMember) return false; // Already left

            // Check for explicit "Reject/Wait" log linked to this interaction (by timestamp proximity or explicit tag if we added one)
            // We will stick to the state-based check above + explicit "Hidden" list for Rejected items
            return true;
        }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }, [logs, services, users, processedRequests]);

    // --- PAYMENT ROTATION LOGIC ---

    const handleRequestAction = (req, action) => {
        const serviceNameMatch = req.details.match(/ a (.+)$/) || req.details.match(/ de (.+)$/);
        const serviceName = serviceNameMatch ? serviceNameMatch[1] : null;
        const service = services.find(s => s.name === serviceName);

        // Robust name extraction
        const actorNameRaw = req.actor.split(' (')[0].trim();
        const userObj = users.find(u => u.name.toLowerCase() === actorNameRaw.toLowerCase());


        if (!service) return; // Service required. User object is preferred but we can fallback to name for logging if needed.

        if (action === 'APPROVE') {
            if (!userObj) return; // Need actual ID for membership changes

            const currentMembers = service.members || [];
            let newMembers = [...currentMembers];

            if (req.action === 'SOLICITACAO_ADESAO') {
                // Add to FRONT of the list (unshift) so they take the next payment
                if (!newMembers.some(m => String(typeof m === 'object' ? m.id : m) === String(userObj.id))) {
                    newMembers.unshift({ id: userObj.id });
                }
            } else {
                // Remove
                newMembers = newMembers.filter(m => String(typeof m === 'object' ? m.id : m) !== String(userObj.id));
            }

            updateService(service.id, { ...service, members: newMembers });

            // Mark as processed persistently
            markRequestAsProcessed(req.id);
        } else if (action === 'REJECT') {
            addLog({
                type: 'WARNING',
                action: 'RESOLUCAO_SOLICITACAO',
                details: `Solicitação de ${actorNameRaw} para ${service.name} foi REJEITADA por ${currentUser.name}`,
                user: currentUser
            });

            // Mark as processed persistently
            markRequestAsProcessed(req.id);
        }
    };


    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 tracking-tight">Administração</h1>
                    <p className="text-gray-400">
                        {isSupervisor ? 'Gestão de Pagamentos (Supervisor)' : 'Gestão Global'}
                    </p>
                </div>
            </div>

            {/* EFFECTIVE DATE CONFIRMATION MODAL */}
            {showEffectiveDate && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-fade-in">
                        <h2 className="text-xl font-bold mb-4 text-gray-900">Alteração de Valor/Tipo</h2>
                        <p className="text-gray-500 text-sm mb-6">
                            Você alterou o preço ou a periodicidade deste serviço. A partir de qual competência (Mês/Ano) essa mudança deve valer para os pagamentos pendentes?
                        </p>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Validade (Mês/Ano)</label>
                            <input
                                type="month"
                                className="w-full p-3 bg-gray-50 border rounded-xl outline-none font-bold text-gray-800"
                                value={effectiveDate}
                                onChange={e => setEffectiveDate(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => { setShowEffectiveDate(false); setPendingServiceUpdate(null); }}
                                className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmUpdate}
                                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200"
                            >
                                Aplicar Mudança
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-100 overflow-x-auto">
                <button onClick={() => setActiveTab('payments')} className={`pb-4 px-2 font-bold transition-all whitespace-nowrap ${activeTab === 'payments' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-400'}`}>Pagamentos</button>

                <button onClick={() => setActiveTab('services')} className={`pb-4 px-2 font-bold transition-all whitespace-nowrap ${activeTab === 'services' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-400'}`}>Serviços</button>

                {!isSupervisor && (
                    <>
                        <button onClick={() => setActiveTab('users')} className={`pb-4 px-2 font-bold transition-all whitespace-nowrap ${activeTab === 'users' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-400'}`}>Usuários</button>

                        <button onClick={() => setActiveTab('requests')} className={`pb-4 px-2 font-bold transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'requests' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-400'}`}>
                            Solicitações
                            {pendingRequests.length > 0 && (
                                <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-bounce">{pendingRequests.length}</span>
                            )}
                        </button>

                        <button onClick={() => setActiveTab('logs')} className={`pb-4 px-2 font-bold transition-all whitespace-nowrap ${activeTab === 'logs' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-400'}`}>
                            <span className="flex items-center gap-2"><ScrollText size={16} /> Logs</span>
                        </button>

                        <button onClick={() => setActiveTab('settings')} className={`pb-4 px-2 font-bold transition-all whitespace-nowrap ${activeTab === 'settings' ? 'text-gray-800 border-b-2 border-gray-800' : 'text-gray-400'}`}>
                            <span className="flex items-center gap-2"><Key size={16} /> Config</span>
                        </button>
                    </>
                )}
            </div>

            {/* REQUESTS TAB */}
            {activeTab === 'requests' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[300px]">
                        <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <BellRing size={20} className="text-amber-500" /> Central de Solicitações
                            </h3>
                            <span className="text-xs font-bold text-gray-400 uppercase">
                                {pendingRequests.length} Pendentes
                            </span>
                        </div>

                        {pendingRequests.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                <CheckCircle size={48} className="text-gray-200 mb-4" />
                                <p>Nenhuma solicitação pendente.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {pendingRequests.map(req => {
                                    const isCancellation = req.action === 'SOLICITACAO_CANCELAMENTO';
                                    const serviceNameMatch = req.details.match(/ a (.+)$/) || req.details.match(/ de (.+)$/);
                                    const serviceName = serviceNameMatch ? serviceNameMatch[1] : null;
                                    const relatedService = serviceName ? services.find(s => s.name === serviceName) : null;

                                    // Extract User Avatar if possible
                                    const userName = req.actor.split(' (')[0];
                                    const userObj = users.find(u => u.name === userName);

                                    return (
                                        <div key={req.id} className="p-6 hover:bg-gray-50 transition-colors flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                            <div className="flex items-start gap-4">
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isCancellation ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                                                    {isCancellation ? <LogOut size={24} /> : <UserPlus size={24} />}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-900 text-lg mb-1">{isCancellation ? 'Solicitação de Saída' : 'Solicitação de Entrada'}</h4>
                                                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                                                        <span className="font-bold text-gray-700">{userObj?.name || userName}</span>
                                                        <span>•</span>
                                                        <span>{new Date(req.timestamp).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-gray-400 uppercase">Serviço:</span>
                                                        {relatedService ? (
                                                            <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-700">
                                                                <img src={relatedService.logo} className="w-4 h-4 object-contain" />
                                                                {relatedService.name}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-gray-500 italic">{serviceName || 'Desconhecido'}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3 w-full md:w-auto">
                                                <button
                                                    onClick={() => handleRequestAction(req, 'APPROVE')}
                                                    className="flex-1 md:flex-none px-6 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                                                >
                                                    <Check size={18} /> Aceitar
                                                </button>
                                                <button
                                                    onClick={() => handleRequestAction(req, 'REJECT')}
                                                    className="flex-1 md:flex-none px-6 py-3 bg-white border-2 border-gray-100 text-gray-500 font-bold rounded-xl hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <X size={18} /> Rejeitar
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* PAYMENTS TAB */}
            {activeTab === 'payments' && (
                <div className="space-y-6">
                    {/* Filters Bar */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-end">
                        <div className="flex flex-wrap gap-4 w-full">
                            <div className="flex flex-col">
                                <label className="text-xs font-bold text-gray-400 mb-1 ml-1">Usuário</label>
                                <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="bg-gray-50 border border-gray-200 text-gray-700 py-2 px-4 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-100 w-32 md:w-40">
                                    <option value="all">Todos</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                            {/* Other filters (Stream, Year, Month) ... */}
                            <div className="flex flex-col">
                                <label className="text-xs font-bold text-gray-400 mb-1 ml-1">Stream</label>
                                <select value={selectedService} onChange={(e) => setSelectedService(e.target.value)} className="bg-gray-50 border border-gray-200 text-gray-700 py-2 px-4 rounded-xl font-bold text-sm outline-none w-32">
                                    <option value="all">Todos</option>
                                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-bold text-gray-400 mb-1 ml-1">Ano</label>
                                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="bg-gray-50 border border-gray-200 text-gray-700 py-2 px-4 rounded-xl font-bold text-sm outline-none">
                                    <option value="all">Todos</option>
                                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <label className="text-xs font-bold text-gray-400 mb-1 ml-1">Mês</label>
                                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-gray-50 border border-gray-200 text-gray-700 py-2 px-4 rounded-xl font-bold text-sm outline-none">
                                    <option value="all">Todos</option>
                                    {MONTHS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </div>
                        </div>
                        <button onClick={openPaymentModal} className="bg-gray-900 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200 shrink-0">
                            <Plus size={18} /> Lançar
                        </button>
                    </div>

                    {/* Mobile Card View (md:hidden) */}
                    <div className="md:hidden space-y-4">
                        {filteredPayments.map(p => {
                            const service = services.find(s => s.id === p.serviceId) || { name: '?' };
                            const user = getUser(p.userId) || { name: '?' };
                            const [y, m] = p.date.split('-');
                            const canModify = !isSupervisor || (userData.supervisedServices || []).includes(p.serviceId);

                            return (
                                <div key={p.id} className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 relative">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-2xl bg-gray-50 p-2 border border-gray-100 flex items-center justify-center shrink-0">
                                                <img src={service.logo} className="object-contain max-w-full max-h-full" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 text-lg">{service.name}</h4>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase bg-gray-100 px-2 py-1 rounded-lg">
                                                    COMP: {m}/{y}
                                                </span>
                                            </div>
                                        </div>
                                        <StatusBadge payment={p} getStatus={getPaymentStatus} />
                                    </div>

                                    <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-xl">
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Responsável</span>
                                            <span className="font-bold text-gray-700 text-sm block">{user.name}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Valor</span>
                                            <span className="font-bold text-gray-900 text-lg block">{formatCurrency(p.amount)}</span>
                                        </div>
                                    </div>

                                    {canModify && (
                                        <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
                                            <button
                                                onClick={() => approvePayment(p.id, userData)}
                                                className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${p.status === 'paid' ? 'bg-emerald-50 text-emerald-600 cursor-default ring-1 ring-emerald-100' : 'bg-gray-900 text-white shadow-lg shadow-gray-200 hover:bg-gray-800'}`}
                                                disabled={p.status === 'paid'}
                                            >
                                                {p.status === 'paid' ? <Check size={18} /> : <CheckCircle size={18} />}
                                                {p.status === 'paid' ? 'Aprovado' : 'Aprovar'}
                                            </button>
                                            {p.status !== 'pending' && (
                                                <button
                                                    onClick={() => togglePaymentStatus(p.id, currentUser)}
                                                    className="w-12 flex items-center justify-center bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors"
                                                    title="Rejeitar"
                                                >
                                                    <X size={20} />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('Tem certeza que deseja excluir esta cobrança?')) {
                                                        deletePayment(p.id, userData);
                                                    }
                                                }}
                                                className="w-12 flex items-center justify-center bg-gray-50 text-gray-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop Table View (hidden md:block) */}
                    <div className="hidden md:block bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="p-4 font-bold text-gray-400 text-[10px] uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('serviceName')}>
                                        Serviço {sortConfig.key === 'serviceName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 font-bold text-gray-400 text-[10px] uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('userName')}>
                                        Responsável {sortConfig.key === 'userName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 font-bold text-gray-400 text-[10px] uppercase tracking-wider cursor-pointer hover:bg-gray-100" onClick={() => handleSort('amount')}>
                                        Valor {sortConfig.key === 'amount' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 font-bold text-gray-400 text-[10px] uppercase tracking-wider text-center cursor-pointer hover:bg-gray-100" onClick={() => handleSort('status')}>
                                        Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-4 font-bold text-gray-400 text-[10px] uppercase tracking-wider text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredPayments.map(p => {
                                    const service = services.find(s => s.id === p.serviceId) || { name: '?' };
                                    const user = getUser(p.userId) || { name: '?' };
                                    const [y, m] = p.date.split('-');
                                    const canModify = !isSupervisor || (userData.supervisedServices || []).includes(p.serviceId);

                                    return (
                                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 p-1 flex items-center justify-center shrink-0">
                                                        <img src={service.logo} className="max-w-full max-h-full object-contain" />
                                                    </div>
                                                    <div>
                                                        <span className="font-bold text-gray-900 block text-xs">{service.name}</span>
                                                        <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 rounded uppercase tracking-wide">COMP: {m}/{y}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-sm text-gray-600">{user.name}</td>
                                            <td className="p-4 text-xs font-bold text-gray-900">{formatCurrency(p.amount)}</td>
                                            <td className="p-4 text-center">
                                                <StatusBadge payment={p} getStatus={getPaymentStatus} />
                                            </td>
                                            <td className="p-4 text-right flex items-center justify-end gap-2">
                                                {canModify && (
                                                    <>
                                                        <button
                                                            onClick={() => approvePayment(p.id, userData)}
                                                            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors ${p.status === 'paid' ? 'text-emerald-500 cursor-default' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
                                                            disabled={p.status === 'paid'}
                                                        >
                                                            {p.status === 'paid' ? <Check size={12} /> : <CheckCircle size={12} />}
                                                            {p.status === 'paid' ? 'Aprovado' : 'Aprovar'}
                                                        </button>
                                                        {p.status !== 'pending' && (
                                                            <button
                                                                onClick={() => togglePaymentStatus(p.id, currentUser)}
                                                                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase transition-colors text-gray-400 hover:text-amber-600 hover:bg-amber-50"
                                                                title="Rejeitar / Tornar Pendente"
                                                            >
                                                                <X size={12} />
                                                                Rejeitar
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                if (window.confirm('Tem certeza que deseja excluir esta cobrança?')) {
                                                                    deletePayment(p.id, userData);
                                                                }
                                                            }}
                                                            className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                                                            title="Excluir Cobrança"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                </div>
            )}

            {/* USERS TAB */}
            {
                activeTab === 'users' && (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row justify-between gap-4 items-end">
                            <div className="flex gap-4 w-full md:w-auto">
                                <div className="flex-1 md:flex-none">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Buscar</label>
                                    <input
                                        type="text"
                                        placeholder="Nome ou usuário..."
                                        className="w-full md:w-64 p-2 bg-white border rounded-xl outline-none text-sm font-medium focus:ring-2 focus:ring-gray-200"
                                        value={userSearch}
                                        onChange={e => setUserSearch(e.target.value)}
                                    />
                                </div>
                                <div className="flex-1 md:flex-none">
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Filtrar por Serviço</label>
                                    <select
                                        className="w-full md:w-48 p-2 bg-white border rounded-xl outline-none text-sm font-medium focus:ring-2 focus:ring-gray-200"
                                        value={userServiceFilter}
                                        onChange={e => setUserServiceFilter(e.target.value)}
                                    >
                                        <option value="all">Todos</option>
                                        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            <button onClick={() => { setUserData({ id: null, name: '', username: '', phone: '', role: 'user', supervisedServices: [], avatar: '' }); setIsUserModalOpen(true); }} className="bg-gray-900 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200 shrink-0">
                                <UserPlus size={18} /> Novo Usuário
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {visibleUsers.map(u => (
                                <div key={u.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 relative group hover:shadow-md transition-all">
                                    <span className={`absolute top-4 right-4 px-2 py-1 bg-gray-100 rounded text-[10px] font-bold uppercase tracking-wide ${u.role === 'admin' ? 'text-purple-600 bg-purple-50' : u.role === 'supervisor' ? 'text-indigo-600 bg-indigo-50' : 'text-gray-500'}`}>
                                        {u.role}
                                    </span>
                                    <div className="flex items-center gap-4 mb-4">
                                        <img src={u.avatar || 'https://github.com/shadcn.png'} alt={u.name} className="w-16 h-16 rounded-full border-2 border-white shadow-md bg-gray-50 object-cover" />
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900">{u.name}</h3>
                                            <p className="text-sm text-gray-500">@{u.username}</p>
                                        </div>
                                    </div>
                                    {u.role === 'supervisor' && (
                                        <div className="mb-4">
                                            <p className="text-xs font-bold text-gray-400 uppercase mb-2">Supervisão:</p>
                                            <div className="flex flex-wrap gap-1">
                                                {u.supervisedServices?.map(sid => {
                                                    const s = services.find(ser => ser.id === sid);
                                                    return <span key={sid} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded-full font-bold">{s?.name}</span>
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex gap-2 mt-4">
                                        <button onClick={() => openEditUser(u)} className="flex-1 py-2 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors">
                                            <Edit size={14} /> Editar
                                        </button>
                                        <button onClick={() => resetPassword(u.id)} className="flex-1 py-2 bg-gray-50 text-gray-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors">
                                            <Key size={14} /> Reset
                                        </button>
                                        {u.role !== 'admin' && (
                                            <button onClick={() => removeUser(u.id)} className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors">
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Subscribed Services Tags */}
                                    <div className="mt-4 pt-4 border-t border-gray-50">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Assinaturas:</p>
                                        <div className="flex flex-wrap gap-2">
                                            {services
                                                .filter(s => s.members?.some(m => String(typeof m === 'object' ? m.id : m) === String(u.id)))
                                                .map(s => (
                                                    <div kye={s.id} className="flex items-center gap-1 bg-gray-50 border border-gray-100 pl-1 pr-2 py-1 rounded-lg">
                                                        <img src={s.logo} className="w-4 h-4 object-contain opacity-70" />
                                                        <span className="text-[10px] font-bold text-gray-600">{s.name}</span>
                                                    </div>
                                                ))
                                            }
                                            {services.filter(s => s.members?.some(m => String(typeof m === 'object' ? m.id : m) === String(u.id))).length === 0 && (
                                                <span className="text-[10px] text-gray-300 italic">Nenhuma assinatura ativa</span>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* SERVICES TAB */}
            {
                activeTab === 'services' && (
                    <div className="space-y-6">
                        <div className="flex justify-end">
                            {!isSupervisor && (
                                <button onClick={() => { setServiceForm({ name: '', price: '', logo: '', type: 'monthly', color: '#000000', members: [], accessType: 'individual', billingType: 'rotation' }); setIsServiceModalOpen(true); }} className="bg-gray-900 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200">
                                    <Plus size={18} /> Novo Serviço
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {visibleServices.map(s => (
                                <div key={s.id} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all cursor-pointer" onClick={() => openEditService(s)}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-xl flex items-center justify-center bg-gray-50 p-2">
                                            <img src={s.logo} alt={s.name} className="max-w-full max-h-full object-contain" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-900">{s.name}</h3>
                                            <p className="text-sm font-bold text-gray-500">{formatCurrency(s.price)} <span className="text-xs font-normal">/{s.type === 'yearly' ? 'ano' : 'mês'}</span></p>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 text-gray-400 p-2 rounded-xl group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                        <Edit size={18} />
                                    </div>
                                </div>
                            ))}
                            {visibleServices.length === 0 && (
                                <div className="col-span-full py-12 text-center text-gray-400 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                                    Nenhuma serviço encontrado sob sua supervisão.
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* LOGS TAB */}
            {
                activeTab === 'logs' && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <ScrollText size={20} className="text-indigo-500" /> Histórico do Sistema
                                </h3>
                                <p className="text-xs text-gray-400 mt-1">Últimos 100 registros</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="p-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Data/Hora</th>
                                            <th className="p-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Tipo</th>
                                            <th className="p-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Usuário</th>
                                            <th className="p-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Ação</th>
                                            <th className="p-4 font-bold text-gray-500 text-xs uppercase tracking-wider">Detalhes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {logs.slice(0, 100).map(log => (
                                            <tr key={log.id} className="hover:bg-gray-50/50 transition-colors text-sm">
                                                <td className="p-4 text-gray-500 whitespace-nowrap">
                                                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${log.type === 'ERROR' ? 'bg-rose-100 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
                                                        {log.type}
                                                    </span>
                                                </td>
                                                <td className="p-4 font-medium text-gray-700">
                                                    {log.actor}
                                                </td>
                                                <td className="p-4 font-bold text-gray-800">
                                                    {log.action}
                                                </td>
                                                <td className="p-4 text-gray-600 max-w-md truncate" title={log.details}>
                                                    {log.details}
                                                </td>
                                            </tr>
                                        ))}
                                        {logs.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="p-12 text-center text-gray-400">Nenhum registro encontrado.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* SETTINGS TAB */}
            {
                activeTab === 'settings' && (
                    <div className="space-y-6">

                    </div>
                )
            }

            {/* --- MODALS --- */}

            {/* USER MODAL */}
            {
                isUserModalOpen && (
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                            <h2 className="text-2xl font-bold mb-6 text-gray-900">{userData.id ? 'Editar Usuário' : 'Novo Usuário'}</h2>
                            <form onSubmit={handleUserSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Nome</label>
                                    <input className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-gray-200" value={userData.name} onChange={e => setUserData({ ...userData, name: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Usuário</label>
                                    <input className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-gray-200" value={userData.username} onChange={e => setUserData({ ...userData, username: e.target.value })} required />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Telefone (WhatsApp)</label>
                                    <input
                                        placeholder="(11) 99999-9999"
                                        className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-gray-200"
                                        value={userData.phone || ''}
                                        onChange={e => {
                                            let v = e.target.value.replace(/\D/g, '');
                                            v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
                                            v = v.replace(/(\d)(\d{4})$/, '$1-$2');
                                            setUserData({ ...userData, phone: v.substring(0, 15) });
                                        }}
                                    />
                                </div>

                                <ImagePicker value={userData.avatar} onChange={val => setUserData({ ...userData, avatar: val })} label="Foto (URL ou Arquivo)" />

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Função</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['user', 'supervisor', 'admin'].map(role => (
                                            <button
                                                key={role}
                                                type="button"
                                                onClick={() => setUserData({ ...userData, role })}
                                                className={`py-2 rounded-xl text-sm font-bold capitalize border-2 transition-all ${userData.role === role ? 'border-gray-900 bg-gray-900 text-white' : 'border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {userData.role === 'supervisor' && (
                                    <div className="bg-gray-50 p-4 rounded-xl">
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Pode aprovar:</label>
                                        <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                            {services.map(s => (
                                                <label key={s.id} className="flex items-center gap-3 cursor-pointer hover:bg-gray-100 p-2 rounded-lg transition-colors">
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${userData.supervisedServices.includes(s.id) ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-300'}`}>
                                                        {userData.supervisedServices.includes(s.id) && <Check size={12} className="text-white" />}
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={userData.supervisedServices.includes(s.id)}
                                                        onChange={() => toggleSupervisedService(s.id)}
                                                    />
                                                    <img src={s.logo} className="w-6 h-6 object-contain" />
                                                    <span className="text-sm font-medium text-gray-700">{s.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-3 mt-6">
                                    <button type="button" onClick={() => setIsUserModalOpen(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl">Cancelar</button>
                                    <button type="submit" className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800">Salvar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* SERVICE MODAL (Updated with ImagePicker) */}
            {
                isServiceModalOpen && (
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-900">{editingService ? 'Editar Serviço' : 'Novo Serviço'}</h2>
                                <button onClick={() => setIsServiceModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            <form onSubmit={handleServiceSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Serviço</label>
                                    <input className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-gray-200" value={serviceForm.name} onChange={e => setServiceForm({ ...serviceForm, name: e.target.value })} required />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Preço (R$)</label>
                                        <input type="number" step="0.01" className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-gray-200" value={serviceForm.price} onChange={e => setServiceForm({ ...serviceForm, price: e.target.value })} required />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Tipo</label>
                                        <select className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-gray-200" value={serviceForm.type} onChange={e => setServiceForm({ ...serviceForm, type: e.target.value })}>
                                            <option value="monthly">Mensal</option>
                                            <option value="yearly">Anual</option>
                                        </select>
                                    </div>
                                </div>

                                <ImagePicker value={serviceForm.logo} onChange={val => setServiceForm({ ...serviceForm, logo: val })} label="Logo (URL ou Arquivo)" />

                                {/* CREDENTIALS SECTION */}
                                <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                                    <h3 className="text-xs font-bold text-gray-400 uppercase">Acesso e Credenciais</h3>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Tipo de Acesso</label>
                                        <select
                                            className="w-full p-3 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-gray-200"
                                            value={serviceForm.accessType}
                                            onChange={e => setServiceForm({ ...serviceForm, accessType: e.target.value })}
                                        >
                                            <option value="individual">Login Individual (Cada usuário tem o seu)</option>
                                            <option value="shared">Compartilhado (Login/Senha únicos)</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Forma de Pagamento</label>
                                        <select
                                            className="w-full p-3 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-gray-200"
                                            value={serviceForm.billingType || (serviceForm.accessType === 'shared' ? 'split' : 'rotation')}
                                            onChange={e => setServiceForm({ ...serviceForm, billingType: e.target.value })}
                                        >
                                            <option value="rotation">Rodízio (Um paga o valor total por mês)</option>
                                            <option value="split">Rateio (Valor dividido igualmente)</option>
                                        </select>
                                    </div>

                                    {serviceForm.accessType === 'shared' && (
                                        <div className="grid grid-cols-2 gap-3 animate-fade-in">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">Login/Email</label>
                                                <input
                                                    className="w-full p-2 bg-white border rounded-lg outline-none text-sm"
                                                    value={serviceForm.login}
                                                    onChange={e => setServiceForm({ ...serviceForm, login: e.target.value })}
                                                    placeholder="ex: conta@netflix.com"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">Senha</label>
                                                <input
                                                    className="w-full p-2 bg-white border rounded-lg outline-none text-sm"
                                                    value={serviceForm.password}
                                                    onChange={e => setServiceForm({ ...serviceForm, password: e.target.value })}
                                                    placeholder="******"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* PAYMENT QR CODE */}
                                <div className="bg-emerald-50 p-4 rounded-xl space-y-3">
                                    <h3 className="text-xs font-bold text-emerald-600 uppercase">Dados de Pagamento</h3>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tipo de Chave</label>
                                            <select
                                                className="w-full p-2 bg-white border rounded-lg text-sm outline-none"
                                                value={serviceForm.pixKeyType}
                                                onChange={e => setServiceForm({ ...serviceForm, pixKeyType: e.target.value, pixKey: '' })}
                                            >
                                                <option value="random">Aleatória</option>
                                                <option value="cpf">CPF</option>
                                                <option value="phone">Celular</option>
                                            </select>
                                        </div>
                                        <div className="col-span-2 md:col-span-1">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Nome do Destinatário</label>
                                            <input
                                                className="w-full p-2 bg-white border rounded-lg text-sm outline-none"
                                                value={serviceForm.paymentRecipient || ''}
                                                onChange={e => setServiceForm({ ...serviceForm, paymentRecipient: e.target.value })}
                                                placeholder="Ex: João da Silva"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Chave Pix</label>
                                            <div className="relative">
                                                <input
                                                    className="w-full p-2 bg-white border rounded-lg text-sm outline-none font-mono pr-10"
                                                    value={serviceForm.pixKey}
                                                    onChange={e => handlePixKeyChange(e.target.value)}
                                                    placeholder={serviceForm.pixKeyType === 'cpf' ? '000.000.000-00' : serviceForm.pixKeyType === 'phone' ? '(00) 00000-0000' : 'Chave aleatória...'}
                                                />
                                                {serviceForm.pixKey && (
                                                    <button
                                                        type="button"
                                                        onClick={() => navigator.clipboard.writeText(serviceForm.pixKey)}
                                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-500"
                                                        title="Copiar"
                                                    >
                                                        <Copy size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* QR Code Image Picker REMOVED as per request */}
                                </div>

                                {/* GROUP MEMBERS SECTION */}
                                <div className="bg-indigo-50 p-4 rounded-xl space-y-3">
                                    <h3 className="text-xs font-bold text-indigo-600 uppercase flex justify-between items-center">
                                        Membros do Grupo
                                        <span className="text-[10px] bg-white px-2 py-0.5 rounded-full text-gray-500">
                                            {serviceForm.members?.length || 0} Selecionados
                                        </span>
                                    </h3>

                                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar bg-white p-2 rounded-xl border border-indigo-100">
                                        {/* Selected Members - Drag and Drop */}
                                        {(serviceForm.members || []).map((memberItem, index) => {
                                            // Handle both object {id: 1} and primitive ID 1 formats
                                            const memberId = typeof memberItem === 'object' ? memberItem.id : memberItem;
                                            const member = users.find(u => String(u.id) === String(memberId)) || { name: 'Desconhecido' };
                                            return (
                                                <div
                                                    key={memberId}
                                                    className={`flex items-center justify-between p-2 rounded-lg group cursor-move transition-all ${draggedMemberIndex === index ? 'bg-indigo-100 opacity-50 border-2 border-dashed border-indigo-300' : 'bg-gray-50 hover:bg-white hover:shadow-sm border border-transparent'}`}
                                                    draggable
                                                    onDragStart={(e) => onDragStart(e, index)}
                                                    onDragOver={(e) => onDragOver(e, index)}
                                                    onDrop={(e) => onDrop(e, index)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 flex justify-center text-gray-300 cursor-grab active:cursor-grabbing">
                                                            <LayoutGrid size={14} />
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-400 w-4">{index + 1}º</span>
                                                        <span className="text-sm font-bold text-gray-700">{member.name}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newMembers = (serviceForm.members || []).filter(m => {
                                                                    const mId = typeof m === 'object' ? m.id : m;
                                                                    return mId !== memberId;
                                                                });
                                                                setServiceForm({ ...serviceForm, members: newMembers });
                                                            }}
                                                            className="p-1 hover:bg-rose-100 rounded text-rose-500"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Add Member Dropdown */}
                                        <div className="relative pt-2 border-t border-gray-100 mt-2">
                                            <select
                                                className="w-full text-xs font-bold text-gray-500 bg-transparent outline-none cursor-pointer"
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        const val = Number(e.target.value);
                                                        const currentIds = (serviceForm.members || []).map(m => typeof m === 'object' ? m.id : m);

                                                        if (!currentIds.includes(val)) {
                                                            // Always add as Object now to match consistency
                                                            setServiceForm(prev => ({ ...prev, members: [...(prev.members || []), { id: val }] }));
                                                        }
                                                        e.target.value = '';
                                                    }
                                                }}
                                                value=""
                                            >
                                                <option value="">+ Adicionar Membro</option>
                                                {[...users]
                                                    .filter(u => {
                                                        const currentIds = (serviceForm.members || []).map(m => typeof m === 'object' ? m.id : m);
                                                        return !currentIds.includes(u.id);
                                                    })
                                                    .sort((a, b) => a.name.localeCompare(b.name))
                                                    .map(u => (
                                                        <option key={u.id} value={u.id}>{u.name}</option>
                                                    ))}
                                            </select>
                                        </div>
                                    </div>
                                    {(serviceForm.billingType === 'rotation' || (!serviceForm.billingType && serviceForm.accessType === 'individual')) && (
                                        <p className="text-[10px] text-indigo-400 text-center">
                                            Arraste os membros para definir a ordem do rodízio.
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button type="button" onClick={() => { setIsServiceModalOpen(false); setEditingService(null); }} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl">Cancelar</button>
                                    <button type="submit" className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800">Salvar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* MANUAL PAYMENT MODAL */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-fade-in relative">
                        <h2 className="text-xl font-bold mb-6 text-gray-900">Nova Cobrança Manual</h2>
                        <form onSubmit={handlePaymentSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Serviço</label>
                                <select
                                    required
                                    value={paymentForm.serviceId}
                                    onChange={handlePaymentServiceChange}
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-3 outline-none font-bold"
                                >
                                    <option value="">Selecione...</option>
                                    {users.some(u => u.role === 'supervisor') ?
                                        services.filter(s => !isSupervisor || (userData.supervisedServices || []).includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                                        : services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                                    }
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Usuário</label>
                                <select
                                    required
                                    value={paymentForm.userId}
                                    onChange={(e) => setPaymentForm({ ...paymentForm, userId: e.target.value })}
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-3 outline-none font-bold"
                                >
                                    <option value="">Selecione...</option>
                                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Valor (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={paymentForm.amount}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-3 outline-none font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Competência</label>
                                    <input
                                        type="month"
                                        required
                                        value={paymentForm.competence}
                                        onChange={(e) => setPaymentForm({ ...paymentForm, competence: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block p-3 outline-none font-bold"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={closePaymentModal}
                                    className="flex-1 py-3 text-gray-500 font-bold hover:text-gray-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-lg"
                                >
                                    Criar Cobrança
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ASSIGN MODAL (Kept same logic) */}
            {
                isAssignModalOpen && (
                    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-fade-in">
                            <h2 className="text-2xl font-bold mb-6 text-gray-900">Novo Lançamento</h2>
                            <form onSubmit={handleAssignService} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Usuário</label>
                                    <select className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-gray-200" value={assignData.userId} onChange={e => setAssignData({ ...assignData, userId: e.target.value })} required>
                                        <option value="">Selecione...</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Serviço</label>
                                    <select className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-gray-200" value={assignData.serviceId} onChange={e => setAssignData({ ...assignData, serviceId: e.target.value })} required>
                                        <option value="">Selecione...</option>
                                        {services.map(s => <option key={s.id} value={s.id}>{s.name} - {formatCurrency(s.price)} ({s.type === 'yearly' ? 'ano' : 'mês'})</option>)}
                                    </select>
                                </div>
                                <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700 font-medium">
                                    Isso irá gerar cobranças automáticas até Dez/2026.
                                </div>
                                <div className="flex gap-3 mt-6">
                                    <button type="button" onClick={() => setIsAssignModalOpen(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl">Cancelar</button>
                                    <button type="submit" className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800">Lançar</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Admin;
