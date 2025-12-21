
const services = [
    { id: 'disney', name: 'Disney+', price: 20, type: 'monthly' }
];

const payments = [
    { id: 1, serviceId: 'disney', userId: 101, date: '2026-01-01', status: 'pending' },
    { id: 2, serviceId: 'disney', userId: 101, date: '2026-02-01', status: 'pending' },
    { id: 3, serviceId: 'disney', userId: 101, date: '2026-03-01', status: 'pending' }, // Should be replaced
    { id: 4, serviceId: 'disney', userId: 101, date: '2026-04-01', status: 'pending' }  // Should be replaced
];

const updates = { price: 64 };
const id = 'disney';
const effectiveDate = new Date(2026, 2, 1); // March 1st 2026 (Month is 0-indexed: 0=Jan, 1=Feb, 2=Mar)

console.log("Effective Date:", effectiveDate.toISOString());

// --- LOGIC FROM CODE ---
const startObj = new Date(effectiveDate);
const strDate = startObj.toISOString().split('T')[0];

console.log("StrDate for filtering:", strDate);

const affectedUsers = new Set();
// Filter out old future pending payments
const keptPayments = payments.filter(p => {
    const isTarget = p.serviceId === id && p.status === 'pending' && p.date >= strDate;
    if (isTarget) {
        affectedUsers.add(p.userId);
        return false;
    }
    return true;
});

console.log("Affected Users:", Array.from(affectedUsers));
console.log("Kept Payments Count:", keptPayments.length);

// Generate new
const newGenerated = [];
const limitDate = new Date('2026-12-31');

console.log("Limit Date:", limitDate.toISOString());

const currentService = services.find(s => s.id === id);
const mergedService = { ...currentService, ...updates };

affectedUsers.forEach(userId => {
    let walker = new Date(startObj);
    console.log("Walker Start:", walker.toISOString());
    console.log("Should Loop:", walker <= limitDate);

    let count = 0;
    while (walker <= limitDate && count < 20) { // Safety break
        const dateStr = walker.toISOString().split('T')[0];
        console.log("Generating for:", dateStr);

        newGenerated.push({
            id: Date.now() + Math.random(),
            serviceId: id,
            userId: userId,
            date: dateStr,
            amount: Number(mergedService.price),
            status: 'pending'
        });

        if (mergedService.type === 'yearly') {
            walker.setFullYear(walker.getFullYear() + 1);
        } else {
            walker.setMonth(walker.getMonth() + 1);
        }
        count++;
    }
});

console.log("Total Generated:", newGenerated.length);
console.log("Final Payment List Count:", keptPayments.length + newGenerated.length);
