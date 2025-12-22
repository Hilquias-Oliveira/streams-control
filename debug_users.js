
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
import 'dotenv/config';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

console.log("Initializing Firebase with project:", firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUsers() {
    console.log("Fetching users...");
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        let clarissaFound = false;

        for (const docSnap of querySnapshot.docs) {
            const u = docSnap.data();
            console.log(`User: ${u.name} | Role: ${u.role} | Services: ${JSON.stringify(u.supervisedServices)}`);

            if (u.name.toLowerCase().includes('clarissa')) {
                clarissaFound = true;
                if (u.role !== 'supervisor' || !u.supervisedServices || !u.supervisedServices.includes('APPLE TV')) {
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
