const functions = require("firebase-functions");
const admin = require("firebase-admin");

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// --- HELPERS ---

const sendWhatsAppNotification = async (phoneNumber, message) => {
    try {
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const formattedPhone = cleanPhone.length >= 10 && cleanPhone.length <= 11 ? `55${cleanPhone}` : cleanPhone;

        console.log(`========= NOTIFICAÇÃO WHATSAPP (SIMULAÇÃO) =========`);
        console.log(`Para: ${formattedPhone}`);
        console.log(`Mensagem: \n${message}`);
        console.log(`====================================================`);

        return true;
    } catch (error) {
        console.error("Erro no envio:", error);
        return false;
    }
};

const formatCurrency = (value) => {
    return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Verifica se hoje é após o 5º dia útil do mês
const isAfter5thBusinessDay = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth(); // 0-11

    let businessDays = 0;
    // Percorre os dias desde o dia 1 até ontem
    for (let d = 1; d < today.getDate(); d++) {
        const date = new Date(year, month, d);
        const dayOfWeek = date.getDay(); // 0 (Dom) - 6 (Sab)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            businessDays++;
        }
    }

    // Se já passaram 5 dias úteis, retorna true
    return businessDays >= 5;
};

// --- FUNÇÕES ---

// 1. Gatilho de Pagamento Confirmado (Mantido)
exports.onPaymentUpdate = functions.firestore
    .document('payments/{paymentId}')
    .onWrite(async (change, context) => {
        const after = change.after.exists ? change.after.data() : null;
        const before = change.before.exists ? change.before.data() : null;

        if (!after || !after.status) return null;

        const isPaidNow = after.status === 'paid';
        const wasPaidBefore = before && before.status === 'paid';

        // 1. Pagamento Confirmado (Usuário Recebe)
        if (isPaidNow && !wasPaidBefore) {
            try {
                const userId = String(after.userId);
                const userDoc = await db.collection('users').doc(userId).get();
                if (!userDoc.exists) return null;
                const userData = userDoc.data();
                if (!userData.phone) return null;

                const serviceDoc = await db.collection('services').doc(after.serviceId).get();
                const serviceName = serviceDoc.exists ? serviceDoc.data().name : after.serviceId;
                const [ano, mes] = (after.date || '').split('-');

                const message = `Olá, ${userData.name.split(' ')[0]}! 👋\n\nSeu pagamento de *${formatCurrency(after.amount)}* referente ao serviço *${serviceName}* (${mes}/${ano}) foi confirmado. ✅\n\nObrigado!`;
                await sendWhatsAppNotification(userData.phone, message);
            } catch (error) {
                console.error("Erro onPaymentUpdate (Confirmado):", error);
            }
        }

        // 2. Pagamento Informado (Admin Recebe)
        // Regra: Status mudou para 'waiting_approval' E antes NÃO era 'waiting_approval'
        const isWaitingNow = after.status === 'waiting_approval';
        const wasWaitingBefore = before && before.status === 'waiting_approval';

        if (isWaitingNow && !wasWaitingBefore) {
            try {
                const userId = String(after.userId);
                const userDoc = await db.collection('users').doc(userId).get();
                const userName = userDoc.exists ? userDoc.data().name : 'Desconhecido';

                const serviceDoc = await db.collection('services').doc(after.serviceId).get();
                const serviceName = serviceDoc.exists ? serviceDoc.data().name : after.serviceId;

                // Buscar Admins para notificar
                const adminsSnapshot = await db.collection('users').where('role', '==', 'admin').get();

                if (!adminsSnapshot.empty) {
                    const message = `🔔 *Pagamento Informado*\n\nUsuário: *${userName}*\nServiço: *${serviceName}*\nValor: *${formatCurrency(after.amount)}*\n\nAcesse o painel para aprovar.`;

                    for (const adminDoc of adminsSnapshot.docs) {
                        const adminData = adminDoc.data();
                        if (adminData.phone) {
                            await sendWhatsAppNotification(adminData.phone, message);
                        }
                    }
                }

            } catch (error) {
                console.error("Erro onPaymentUpdate (Informado):", error);
            }
        }

        return null;
    });

// 2. Cron: Aviso de Nova Fatura (Dia 1 de todo mês às 09:00 BRT)
// BRT é UTC-3. Então 09:00 BRT = 12:00 UTC.
exports.monthlyBillNotification = functions.pubsub.schedule('0 12 1 * *')
    .timeZone('America/Sao_Paulo') // Força fuso horário se suportado, senão usa UTC ajustado
    .onRun(async (context) => {
        console.log("Iniciando rotina de fatura mensal...");

        try {
            const today = new Date();
            const yearStr = today.getFullYear();
            const monthStr = String(today.getMonth() + 1).padStart(2, '0');
            const competencePrefix = `${yearStr}-${monthStr}`; // ex: 2025-01

            // Buscar todos os pagamentos DESTE mês que estão pendentes
            // Nota: Isso assume que o campo 'date' é 'YYYY-MM-DD'
            const paymentsSnapshot = await db.collection('payments')
                .where('date', '>=', `${competencePrefix}-01`)
                .where('date', '<=', `${competencePrefix}-31`)
                .get();

            if (paymentsSnapshot.empty) {
                console.log("Nenhum pagamento encontrado para este mês.");
                return null;
            }

            // Agrupar por usuário
            const userPayments = {};
            paymentsSnapshot.forEach(doc => {
                const p = doc.data();
                if (p.status !== 'pending') return; // Só avisa pendentes (em aberto)

                const uid = String(p.userId);
                if (!userPayments[uid]) userPayments[uid] = [];
                userPayments[uid].push(p);
            });

            // Enviar mensagens
            for (const [userId, payments] of Object.entries(userPayments)) {
                const userDoc = await db.collection('users').doc(userId).get();
                if (!userDoc.exists) continue;
                const userData = userDoc.data();
                if (!userData.phone) continue;

                let total = 0;
                let details = "";

                for (const p of payments) {
                    const serviceDoc = await db.collection('services').doc(p.serviceId).get();
                    const sName = serviceDoc.exists ? serviceDoc.data().name : p.serviceId;
                    total += Number(p.amount);
                    details += `- ${sName}: ${formatCurrency(p.amount)}\n`;
                }

                const message = `📅 *Resumo de ${monthStr}/${yearStr}*\n\nOlá ${userData.name.split(' ')[0]}, suas faturas do mês estão disponíveis:\n\n${details}\n*Total: ${formatCurrency(total)}*\n\nAcesse o app para pegar o Pix e pagar.`;

                await sendWhatsAppNotification(userData.phone, message);
            }

        } catch (error) {
            console.error("Erro monthlyBillNotification:", error);
        }
        return null;
    });

// 3. Cron: Aviso de Atraso (Diário às 10:00 BRT)
exports.overdueNotification = functions.pubsub.schedule('0 13 * * *')
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
        // Regra: Só executa se já passamos do 5º dia útil
        if (!isAfter5thBusinessDay()) {
            console.log("Ainda não passamos do 5º dia útil. Sem cobranças de atraso hoje.");
            return null;
        }

        console.log("Verificando atrasados...");

        try {
            const today = new Date();
            const yearStr = today.getFullYear();
            const monthStr = String(today.getMonth() + 1).padStart(2, '0');
            const competencePrefix = `${yearStr}-${monthStr}`;

            // Busca pagamentos DO MÊS ATUAL que ainda estão pendentes
            const paymentsSnapshot = await db.collection('payments')
                .where('date', '>=', `${competencePrefix}-01`)
                .where('date', '<=', `${competencePrefix}-31`)
                .where('status', '==', 'pending')
                .get();

            if (paymentsSnapshot.empty) return null;

            for (const doc of paymentsSnapshot.docs) {
                const payment = doc.data();

                // Evitar spam: Verificar se já notificamos hoje ou recentemente?
                // Para MVP simples: Vamos verificar um campo 'lastOverdueNotification'
                // Se mandamos mensagem há menos de 3 dias, não manda de novo.
                if (payment.lastOverdueNotification) {
                    const lastDate = new Date(payment.lastOverdueNotification);
                    const diffDays = (today - lastDate) / (1000 * 60 * 60 * 24);
                    if (diffDays < 3) continue; // Dá um descanso de 3 dias
                }

                const userDoc = await db.collection('users').doc(String(payment.userId)).get();
                if (!userDoc.exists) continue;
                const userData = userDoc.data();
                if (!userData.phone) continue;

                const serviceDoc = await db.collection('services').doc(payment.serviceId).get();
                const sName = serviceDoc.exists ? serviceDoc.data().name : payment.serviceId;

                const message = `⚠️ *Aviso de Atraso*\n\nOlá ${userData.name.split(' ')[0]}, constou aqui que o pagamento de *${sName}* (${formatCurrency(payment.amount)}) ainda está pendente.\n\nEvite o corte do serviço! Caso já tenha pago, por favor envie o comprovante.`;

                const sent = await sendWhatsAppNotification(userData.phone, message);

                if (sent) {
                    // Marca que avisou para não flodar
                    await db.collection('payments').doc(doc.id).update({
                        lastOverdueNotification: new Date().toISOString()
                    });
                }
            }

        } catch (error) {
            console.error("Erro overdueNotification:", error);
        }
        return null;
    });

// 4. Cron: Gerar Pagamentos Futuros (Dia 1 de todo mês às 08:00 BRT)
// Mantém a janela de 1 ano sempre preenchida
exports.generateMonthlyPayments = functions.pubsub.schedule('0 11 1 * *')
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
        console.log("Iniciando geração de pagamentos futuros (Rolling Window)...");

        try {
            const today = new Date();
            // Queremos gerar pagamentos para o mês "Daqui a 12 meses"
            const targetDate = new Date(today.getFullYear() + 1, today.getMonth(), 1); // +1 ano
            const targetYear = targetDate.getFullYear();
            const targetMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
            const targetDateStr = `${targetYear}-${targetMonth}-01`;

            console.log(`Gerando para competência: ${targetMonth}/${targetYear}`);

            // Buscar serviços ativos
            const servicesSnapshot = await db.collection('services').get();
            if (servicesSnapshot.empty) return null;

            const batch = db.batch();
            let batchCount = 0;

            for (const doc of servicesSnapshot.docs) {
                const service = { ...doc.data(), id: doc.id };

                if (service.type === 'yearly') {
                    // TODO: Lógica para anual
                    continue;
                }

                // Lógica para Mensais (comum, rodízio, split)

                // Verificar se JÁ EXISTE pagamento para este serviço neste mês target
                const existsQuery = await db.collection('payments')
                    .where('serviceId', '==', service.id)
                    .where('date', '==', targetDateStr)
                    .limit(1)
                    .get();

                if (!existsQuery.empty) continue; // Já existe

                // Calcular quem paga
                // 1. Split
                if (service.accessType === 'shared' || service.billingType === 'split') {
                    if (!service.members || service.members.length === 0) continue;

                    const shareAmount = Number(service.price) / service.members.length;

                    for (const member of service.members) {
                        const memberId = typeof member === 'object' ? member.id : member;
                        const newRef = db.collection('payments').doc();
                        batch.set(newRef, {
                            serviceId: service.id,
                            userId: memberId,
                            date: targetDateStr,
                            amount: shareAmount,
                            status: 'pending',
                            generatedBy: 'auto_rolling'
                        });
                        batchCount++;
                    }
                }
                // 2. Rodízio (Rotation) ou Individual
                else {
                    let payerId = null;

                    if (service.members && service.members.length > 0) {
                        // Lógica de Rodízio: 
                        // Vamos tentar achar o último pagamento agendado (mês anterior ao target)

                        const prevDate = new Date(targetDate);
                        prevDate.setMonth(prevDate.getMonth() - 1);
                        const prevYear = prevDate.getFullYear();
                        const prevMonth = String(prevDate.getMonth() + 1).padStart(2, '0');
                        const prevDateStr = `${prevYear}-${prevMonth}-01`;

                        const prevPaymentQuery = await db.collection('payments')
                            .where('serviceId', '==', service.id)
                            .where('date', '==', prevDateStr)
                            .limit(1)
                            .get();

                        if (!prevPaymentQuery.empty) {
                            const prevPayerId = prevPaymentQuery.docs[0].data().userId;
                            const membersIds = service.members.map(m => typeof m === 'object' ? m.id : m);
                            const currentIndex = membersIds.indexOf(prevPayerId);

                            if (currentIndex !== -1) {
                                const nextIndex = (currentIndex + 1) % membersIds.length;
                                payerId = membersIds[nextIndex];
                            } else {
                                payerId = membersIds[0];
                            }
                        } else {
                            payerId = typeof service.members[0] === 'object' ? service.members[0].id : service.members[0];
                        }

                    } else {
                        continue;
                    }

                    if (payerId) {
                        const newRef = db.collection('payments').doc();
                        batch.set(newRef, {
                            serviceId: service.id,
                            userId: payerId,
                            date: targetDateStr,
                            amount: Number(service.price),
                            status: 'pending',
                            generatedBy: 'auto_rolling'
                        });
                        batchCount++;
                    }
                }
            }

            if (batchCount > 0) {
                await batch.commit();
                console.log(`Gerados ${batchCount} novos pagamentos para ${targetDateStr}`);
            }

        } catch (error) {
            console.error("Erro generateMonthlyPayments:", error);
        }
        return null;
    });
