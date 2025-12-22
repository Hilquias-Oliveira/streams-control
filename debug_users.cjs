
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, doc, updateDoc } = require("firebase/firestore");
require('dotenv').config();

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

console.log("Initializing Firebase...");
// Use a fallback for environment variables if dotenv fails in this context (e.g. if .env is not in root or differently named)
if (!firebaseConfig.apiKey) {
    console.error("Error: Environment variables not loaded. Make sure .env exists.");
    process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUsers() {
    console.log("Fetching users...");
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        console.log(`Found ${querySnapshot.size} users.`);
        let clarissaFound = false;

        for (const docSnap of querySnapshot.docs) {
            const u = docSnap.data();
            console.log(`User: ${u.name} | Role: ${u.role}`);

            if (u.name && u.name.toLowerCase().includes('clarissa')) {
                clarissaFound = true;
                console.log("Checking Clarissa's permissions...", u.supervisedServices);

                const supervised = u.supervisedServices || [];
                const hasAppleTV = supervised.includes('APPLE TV'); // Check exact service ID match

                if (u.role !== 'supervisor' || !hasAppleTV) {
                    console.log("!!! FIXING CLARISSA !!!");
                    await updateDoc(doc(db, "users", docSnap.id), {
                        role: 'supervisor',
                        supervisedServices: ['APPLE TV']
                    });
                    console.log("Clarissa updated to Supervisor with APPLE TV.");
                } else {
                    console.log("Clarissa is already correct.");
                }
            }
        }

        if (!clarissaFound) console.log("Clarissa not found in DB.");

    } catch (error) {
        console.error("Error fetching users:", error);
    }
}

checkUsers();
