import React, { createContext, useContext, useState, useEffect } from 'react';
import { useData } from './DataContext';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    // Try to recover session from localStorage
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('streams_user');
        return saved ? JSON.parse(saved) : null;
    });

    // Access users from Data Context (Firebase)
    const { users } = useData();

    const login = (username, password) => {
        // Validate against LIVE data from Firestore
        const foundUser = users.find(u => u.username === username && u.password === password);

        if (foundUser) {
            setUser(foundUser);
            localStorage.setItem('streams_user', JSON.stringify(foundUser));
            return true;
        }
        return false;
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('streams_user');
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
