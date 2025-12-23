import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, auth } from '../config/firebase';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, setDoc, doc, query, orderBy, limit, writeBatch, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { INITIAL_PAYMENTS, SERVICES as INITIAL_SERVICES, USERS } from '../data/mockData';
import { toast } from 'sonner';

const DataContext = createContext();

export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
    const [payments, setPayments] = useState([]);
    const [users, setUsers] = useState([]);
    const [services, setServices] = useState([]);
    const [logs, setLogs] = useState([]);
    const [processedRequests, setProcessedRequests] = useState([]);
    const [availableYears, setAvailableYears] = useState([new Date().getFullYear().toString()]);

    // FILTERS (Global State)
    const [globalFilter, setGlobalFilter] = useState({
        year: new Date().getFullYear().toString(),
        month: (new Date().getMonth() + 1).toString().padStart(2, '0')
    });

    // --- FIRESTORE LISTENERS ---

    // --- FIRESTORE LISTENERS ---
    useEffect(() => {
        let unsubServices, unsubUsers, unsubPayments, unsubLogs, unsubRequests;

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("Auth verified, connecting to Firestore...");

                // Services
                unsubServices = onSnapshot(collection(db, 'services'), (snapshot) => {
                    const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                    setServices(data);
                }, (error) => console.error("Services Listener Error:", error));

                // Users
                unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
                    const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                    setUsers(data);
                }, (error) => console.error("Users Listener Error:", error));

                // Years (Metadata - One time fetch)
                const fetchYears = async () => {
                    try {
                        const q = query(collection(db, 'payments'), orderBy('date', 'asc'), limit(1));
                        const snap = await import('firebase/firestore').then(mod => mod.getDocs(q));
                        if (!snap.empty) {
                            const oldestDate = snap.docs[0].data().date; // YYYY-MM-DD
                            const minYear = parseInt(oldestDate.split('-')[0]);
                            const currentYear = new Date().getFullYear();
                            const maxYear = currentYear + 1; // Rule: Max 12 months ahead

                            const years = [];
                            for (let y = minYear; y <= maxYear; y++) {
                                years.push(String(y));
                            }
                            setAvailableYears(years);
                        } else {
                            // No payments, just show current and next
                            const currentYear = new Date().getFullYear();
                            setAvailableYears([String(currentYear), String(currentYear + 1)]);
                        }
                    } catch (e) {
                        console.error("Error fetching years:", e);
                    }
                };
                fetchYears();

                // Payments (Dynamic Query)
                const buildPaymentQuery = () => {
                    const { year, month } = globalFilter;
                    const constraints = [orderBy('date', 'desc')]; // Always order by date

                    if (year && year !== 'all') {
                        let start = `${year}-01-01`;
                        let end = `${year}-12-31`;

                        if (month && month !== 'all') {
                            const lastDay = new Date(year, month, 0).getDate();
                            start = `${year}-${month}-01`;
                            end = `${year}-${month}-${lastDay}`;
                        }

                        constraints.push(where('date', '>=', start));
                        constraints.push(where('date', '<=', end));
                    }

                    // Note: Firestore requires an index for range filter + orderBy on different fields if we kept date/amount sorts etc.
                    // Since date is the range AND the sort, it works out of the box usually.

                    return query(collection(db, 'payments'), ...constraints);
                };

                unsubPayments = onSnapshot(buildPaymentQuery(), (snapshot) => {
                    const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                    setPayments(data);
                }, (error) => console.error("Payments Listener Error:", error));

                // Logs
                const qLogs = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(100));
                unsubLogs = onSnapshot(qLogs, (snapshot) => {
                    const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
                    setLogs(data);
                }, (error) => console.error("Logs Listener Error:", error));

                // Requests
                unsubRequests = onSnapshot(collection(db, 'processed_requests'), (snapshot) => {
                    const ids = snapshot.docs.map(doc => doc.id);
                    setProcessedRequests(ids);
                }, (error) => console.error("Requests Listener Error:", error));

            } else {
                // If user logs out or auth not ready, clear data or stop listening?
                // For anon auth, we usually just wait.
                console.log("Waiting for Auth...");
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubServices) unsubServices();
            if (unsubUsers) unsubUsers();
            if (unsubPayments) unsubPayments();
            if (unsubLogs) unsubLogs();
            if (unsubRequests) unsubRequests();
        };
    }, [globalFilter]); // Re-run when filters change


    // --- LOGGING ---
    const addLog = async ({ type = 'INFO', action, details, user }) => {
        try {
            const newLog = {
                timestamp: new Date().toISOString(),
                type,
                action,
                details,
                actor: user ? `${user.name} (${user.role})` : 'System'
            };
            await addDoc(collection(db, 'logs'), newLog);
        } catch (error) {
            console.error("Error adding log:", error);
        }
    };

    // --- Payment Actions ---
    const canApprove = (user, payment) => {
        if (!user) return false;
        if (user.role === 'admin') return true;
        if (user.role === 'supervisor') {
            return user.supervisedServices?.includes(payment.serviceId);
        }
        return false;
    };

    const approvePayment = async (id) => {
        try {
            const paymentRef = doc(db, 'payments', id);
            await updateDoc(paymentRef, { status: 'paid' });
            toast.success("Pagamento aprovado!");
        } catch (error) {
            console.error("Error approving payment:", error);
            toast.error("Erro ao aprovar pagamento. Verifique sua conexão.");
        }
    };

    const togglePaymentStatus = async (paymentId, user) => {
        const payment = payments.find(p => p.id === paymentId);
        if (!payment) return;

        const isAuthorized =
            user.role === 'admin' ||
            (user.role === 'supervisor' && user.supervisedServices?.includes(payment.serviceId));

        let newStatus = payment.status;
        let logDetails = '';

        if (payment.status === 'pending') {
            if (isAuthorized) {
                newStatus = 'paid';
                logDetails = `Pagamento de ${payment.amount} aprovado (Autorizado)`;
            } else {
                newStatus = 'waiting_approval';
                logDetails = `Pagamento de ${payment.amount} enviado para análise`;
            }
        } else if (payment.status === 'waiting_approval') {
            // SPAM PREVENTION: Users cannot revert "Waiting Approval". Only admins/supervisors.
            if (!isAuthorized) return;

            newStatus = 'pending';
            logDetails = `Pagamento de ${payment.amount} retornado para pendente`;
        } else if (payment.status === 'paid') {
            if (isAuthorized) {
                newStatus = 'pending';
                logDetails = `Pagamento de ${payment.amount} estornado`;
            }
        }

        if (newStatus !== payment.status) {
            try {
                const paymentRef = doc(db, 'payments', paymentId);
                await updateDoc(paymentRef, { status: newStatus });

                await addLog({
                    type: isAuthorized ? 'INFO' : 'WARNING',
                    action: 'ALTERAR_STATUS',
                    details: logDetails,
                    user
                });
                toast.success(newStatus === 'paid' ? "Pagamento confirmado!" : "Status atualizado.");
            } catch (error) {
                console.error("Error toggling payment status:", error);
                toast.error("Erro ao atualizar status. Tente novamente.");
            }
        }
    };

    // --- User Actions ---
    const addUser = async (userData) => {
        try {
            const newUser = {
                ...userData,
                role: userData.role || 'user',
                supervisedServices: userData.supervisedServices || [],
                avatar: userData.avatar || `https://i.pravatar.cc/150?u=${userData.username}`
            };
            await addDoc(collection(db, 'users'), newUser);
            toast.success("Usuário adicionado!");
            return true;
        } catch (error) {
            console.error("Error adding user:", error);
            toast.error("Erro ao criar usuário.");
            return false;
        }
    };

    const updateUser = async (id, updates) => {
        try {
            const userRef = doc(db, 'users', id);
            await updateDoc(userRef, updates);
            toast.success("Usuário atualizado!");
            return true;
        } catch (error) {
            console.error("Error updating user:", error);
            toast.error("Erro ao atualizar usuário.");
            return false;
        }
    };

    const deleteUser = async (id) => {
        try {
            await deleteDoc(doc(db, 'users', id));
            toast.success("Usuário removido.");
        } catch (error) {
            console.error("Error deleting user:", error);
            toast.error("Erro ao remover usuário.");
        }
    };

    const resetPassword = async (id) => {
        try {
            const userRef = doc(db, 'users', id);
            await updateDoc(userRef, { password: '123' });
            toast.success('Senha resetada para "123"!');
        } catch (error) {
            console.error("Error resetting password:", error);
            toast.error("Erro ao resetar senha.");
        }
    };

    // --- Service Actions ---
    const addService = async (serviceData) => {
        try {
            const id = serviceData.name.toUpperCase().replace(/\s+/g, '_');
            const newService = { ...serviceData };
            await setDoc(doc(db, 'services', id), newService);
            toast.success("Serviço criado!");
        } catch (error) {
            console.error("Error adding service:", error);
            toast.error("Erro ao criar serviço.");
        }
    };

    const deleteService = async (id) => {
        try {
            await deleteDoc(doc(db, 'services', id));
            toast.success("Serviço excluído.");
        } catch (error) {
            console.error("Error deleting service:", error);
            toast.error("Erro ao excluir serviço.");
        }
    };

    const assignService = async (userId, serviceId, startDate = new Date()) => {
        const service = services.find(s => s.id === serviceId);
        if (!service) return;

        // Limit to 12 months from start date
        const limitDate = new Date(startDate);
        limitDate.setFullYear(limitDate.getFullYear() + 1);

        let currentDate = new Date(startDate);

        let count = 0;
        while (currentDate <= limitDate) {
            const newPayment = {
                serviceId: service.id,
                userId: userId,
                date: currentDate.toISOString().split('T')[0],
                amount: Number(service.price),
                status: 'pending'
            };

            await addDoc(collection(db, 'payments'), newPayment);
            count++;

            if (service.type === 'yearly') {
                currentDate.setFullYear(currentDate.getFullYear() + 1);
            } else {
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        }
        console.log(`Assigned ${count} payments.`);
    };

    // --- Payment Calculation Helper ---
    const calculateGroupPayments = (service, startDateStr) => {
        if (!service.members || service.members.length === 0) return [];

        const newPayments = [];
        const [sYear, sMonth, sDay] = startDateStr.split('-').map(Number);
        const startObj = new Date(sYear, sMonth - 1, sDay);
        startObj.setDate(1);

        // Limit to 12 months from start date
        const limitDate = new Date(startObj);
        limitDate.setFullYear(limitDate.getFullYear() + 1);

        let walker = new Date(startObj);
        let safety = 0;
        let monthIndex = 0;

        const billingMode = service.billingType || (service.accessType === 'shared' ? 'split' : 'rotation');

        while (walker <= limitDate && safety < 100) {
            const y = walker.getFullYear();
            const m = String(walker.getMonth() + 1).padStart(2, '0');
            const d = '01';
            const dateStr = `${y}-${m}-${d}`;

            if (billingMode === 'split') {
                const shareAmount = Number(service.price) / service.members.length;
                service.members.forEach(member => {
                    const memberId = typeof member === 'object' ? member.id : member;
                    newPayments.push({
                        serviceId: service.id,
                        userId: memberId,
                        date: dateStr,
                        amount: shareAmount,
                        status: 'pending'
                    });
                });
            } else {
                const member = service.members[monthIndex % service.members.length];
                const memberId = typeof member === 'object' ? member.id : member;
                newPayments.push({
                    serviceId: service.id,
                    userId: memberId,
                    date: dateStr,
                    amount: Number(service.price),
                    status: 'pending'
                });
                monthIndex++;
            }

            if (service.type === 'yearly') {
                walker.setFullYear(walker.getFullYear() + 1);
            } else {
                walker.setMonth(walker.getMonth() + 1);
            }
            safety++;
        }
        return newPayments;
    };

    const updateService = async (id, updates, effectiveDate = null) => {
        try {
            const serviceRef = doc(db, 'services', id);
            await updateDoc(serviceRef, updates);

            if (effectiveDate) {
                const currentService = services.find(s => s.id === id);
                if (!currentService) return;

                const [eYear, eMonth] = effectiveDate.split('-').map(Number);
                const startObj = new Date(eYear, eMonth - 1, 1);

                const y = startObj.getFullYear();
                const m = String(startObj.getMonth() + 1).padStart(2, '0');
                const d = String(startObj.getDate()).padStart(2, '0');
                const strDate = `${y}-${m}-${d}`;

                const mergedService = { ...currentService, ...updates };

                await addLog({
                    type: 'INFO',
                    action: 'BULK_UPDATE_START',
                    details: `Alteração em ${currentService.name} a partir de ${strDate}. Cobrança: ${mergedService.billingType}.`,
                    user: { name: 'System', role: 'admin' }
                });

                const paymentsToRemove = payments.filter(p =>
                    p.serviceId === id &&
                    p.status === 'pending' &&
                    p.date >= strDate
                );

                for (const p of paymentsToRemove) {
                    await deleteDoc(doc(db, 'payments', p.id));
                }

                const newGenerated = calculateGroupPayments(mergedService, strDate);
                for (const p of newGenerated) {
                    await addDoc(collection(db, 'payments'), p);
                }

                await addLog({
                    type: 'INFO',
                    action: 'BULK_UPDATE_DONE',
                    details: `Removidos: ${paymentsToRemove.length}. Gerados: ${newGenerated.length}.`,
                    user: { name: 'System', role: 'admin' }
                });
            }
            toast.success("Serviço atualizado com sucesso!");
        } catch (error) {
            console.error("Error updating service:", error);
            toast.error("Erro ao atualizar serviço.");
        }
    };

    // --- Helpers ---
    const getPaymentStatus = (payment) => {
        if (payment.status === 'paid') return { label: 'PAGO', color: 'bg-emerald-100 text-emerald-700' };
        if (payment.status === 'waiting_approval') return { label: 'EM ANÁLISE', color: 'bg-amber-100 text-amber-700' };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [year, month, day] = payment.date.split('-').map(Number);
        const dueDate = new Date(year, month - 1, day);

        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // > 5 dias antes do vencimento -> A FATURAR
        if (diffDays > 5) return { label: 'A FATURAR', color: 'bg-gray-100 text-gray-500', canPay: false };

        // 5 dias antes até 5 dias depois (considerando margem de ~7 dias corridos para 5 úteis) -> FATURADO/PENDENTE
        if (diffDays <= 5 && diffDays >= -7) return { label: 'PENDENTE', color: 'bg-sky-100 text-sky-700', canPay: true };

        // Mais de 5 dias/7 dias depois -> ATRASADO
        return { label: 'ATRASADO', color: 'bg-rose-100 text-rose-700', canPay: true };
    };

    const getService = (id) => services.find(s => s.id === id);
    const getUser = (id) => users.find(u => String(u.id) === String(id)); // Handle Number/String mismatch

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const deletePayment = async (paymentId) => {
        const payment = payments.find(p => p.id === paymentId);
        if (payment) {
            try {
                await deleteDoc(doc(db, 'payments', paymentId));
                await addLog({
                    type: 'WARNING',
                    action: 'DELETE_PAYMENT',
                    details: `Pagamento de ${formatCurrency(payment.amount)} (Serviço: ${payment.serviceId}) removido.`,
                    user: { name: 'System', role: 'admin' }
                });
                toast.success("Pagamento removido.");
            } catch (error) {
                console.error("Error deleting payment:", error);
                toast.error("Erro ao remover pagamento.");
            }
        }
    };

    const addManualPayment = async (paymentData) => {
        try {
            const newPayment = {
                status: 'pending',
                ...paymentData
            };
            await addDoc(collection(db, 'payments'), newPayment);

            await addLog({
                type: 'CREATE',
                action: 'PAYMENT_ADDED',
                details: `Pagamento manual adicionado para serviço ${paymentData.serviceId}`,
                user: { name: 'Admin', role: 'admin' }
            });
            toast.success("Conteúdo adicionado!");
        } catch (error) {
            console.error("Error adding manual payment:", error);
            toast.error("Erro ao adicionar.");
        }
    };

    const markRequestAsProcessed = async (requestId) => {
        if (!import.meta.env.VITE_TEST_MODE) console.log('Marking request as processed (Firestore):', requestId);
        try {
            const docRef = doc(db, 'processed_requests', requestId);
            await setDoc(docRef, {
                processedAt: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error marking request as processed:", error);
        }
    };

    // --- MIGRATION TOOL ---
    const cleanupFuturePayments = async () => {
        if (!confirm("Isso apagará TODOS os pagamentos agendados para depois de 1 ano a partir de hoje. Continuar?")) return;

        console.log("Cleaning up future payments...");
        const limitDate = new Date();
        limitDate.setFullYear(limitDate.getFullYear() + 1);
        const limitStr = limitDate.toISOString().split('T')[0];

        const batch = writeBatch(db);
        let count = 0;

        payments.forEach(p => {
            if (p.date > limitStr && p.status === 'pending') {
                const ref = doc(db, 'payments', p.id);
                batch.delete(ref);
                count++;
            }
        });

        if (count > 0) {
            await batch.commit();
            alert(`Removidos ${count} pagamentos futuros (após ${limitStr}).`);
            window.location.reload();
        } else {
            alert("Nenhum pagamento futuro encontrado para remover.");
        }
    };

    const migrateData = async () => {
        const confirm = window.confirm("Isso importará dados do LocalStorage para o FIREBASE. Se já houver dados no Firebase, eles serão sobrescritos ou duplicados. Continuar?");
        if (!confirm) return;

        console.log("Starting Migration...");
        const batch = writeBatch(db);

        try {
            // 1. SERVICES
            const servicesLocal = JSON.parse(localStorage.getItem('streams_services')) || INITIAL_SERVICES;
            let sCount = 0;
            for (const s of servicesLocal) {
                const ref = doc(db, 'services', s.id);
                batch.set(ref, s);
                sCount++;
            }
            console.log(`Queued ${sCount} services for migration.`);

            // 2. USERS
            const usersLocal = JSON.parse(localStorage.getItem('streams_users')) || USERS;
            let uCount = 0;
            for (const u of usersLocal) {
                const ref = doc(db, 'users', String(u.id));
                batch.set(ref, u);
                uCount++;
            }
            console.log(`Queued ${uCount} users for migration.`);

            await batch.commit();
            console.log("Services and Users migrated successfully!");

            // 3. PAYMENTS
            const paymentsLocal = JSON.parse(localStorage.getItem('streams_payments')) || INITIAL_PAYMENTS;
            console.log(`Migrating ${paymentsLocal.length} payments...`);

            let pCount = 0;
            for (const p of paymentsLocal) {
                await setDoc(doc(db, 'payments', String(p.id)), p);
                pCount++;
                if (pCount % 50 === 0) console.log(`Migrated ${pCount} payments...`);
            }

            // 4. LOGS
            const logsLocal = JSON.parse(localStorage.getItem('streams_logs')) || [];
            if (logsLocal.length > 0) {
                const recentLogs = logsLocal.slice(0, 50);
                const logBatch = writeBatch(db);
                for (const l of recentLogs) {
                    const ref = doc(db, 'logs', String(l.id || Date.now() + Math.random()));
                    logBatch.set(ref, l);
                }
                await logBatch.commit();
            }

            // 5. PROCESSED REQUESTS
            const processedLocal = JSON.parse(localStorage.getItem('streams_processed_requests')) || [];
            if (processedLocal.length > 0) {
                const reqBatch = writeBatch(db);
                for (const pid of processedLocal) {
                    const ref = doc(db, 'processed_requests', pid);
                    reqBatch.set(ref, { processedAt: new Date().toISOString() });
                }
                await reqBatch.commit();
            }

            alert("Migração concluída com sucesso! Recarregue a página.");
            window.location.reload();
        } catch (e) {
            console.error("Migration Failed", e);
            alert("Erro na migração. Verifique o console.");
        }
    };

    return (
        <DataContext.Provider value={{
            payments,
            users,
            services,
            logs,
            processedRequests,

            setPayments,

            approvePayment, canApprove, togglePaymentStatus, deletePayment, addManualPayment,
            addUser, updateUser, deleteUser,
            addService, updateService, deleteService, assignService,
            markRequestAsProcessed, resetPassword,
            markRequestAsProcessed, resetPassword,
            migrateData, cleanupFuturePayments,

            getUser, getService, formatCurrency, getPaymentStatus, addLog,
            globalFilter, setGlobalFilter, availableYears
        }}>
            {children}
        </DataContext.Provider>
    );
};
