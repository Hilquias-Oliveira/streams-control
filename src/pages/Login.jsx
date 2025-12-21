import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

const Login = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login, firebaseUser, authError } = useAuth();
    const navigate = useNavigate();

    // DEBUG: Get raw users list to show count
    const { users } = useAuth().users ? useAuth() : { users: [] }; // Accessing via context isn't direct, need generic import
    // Actually, Login doesn't have access to DataContext directly via useAuth usually, but useAuth uses DataContext. 
    // Let's import useData directly to be sure.

    const handleSubmit = (e) => {
        e.preventDefault();
        const result = login(username, password);

        if (result === true) {
            navigate('/dashboard');
        } else if (result === undefined) {
            setError('Ainda carregando sistema... Tente em 5s.');
        } else {
            setError('Credenciais inválidas.');
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#1A1D29] text-white overflow-hidden relative">

            {/* Logo Area */}
            <div className="mb-8 z-10 w-48 text-center">
                {/* Replaced Text with a conceptual Logo placeholder if we don't have an asset, 
                     but using text with Disney font style fallback */}
                <h1 className="text-4xl font-black tracking-[0.2em] text-white drop-shadow-lg" style={{ fontFamily: '"Outfit", sans-serif' }}>STREAMS</h1>
            </div>

            <div className="bg-white rounded-3xl p-12 w-full max-w-[400px] z-10 shadow-2xl animate-fade-in text-gray-900">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold mb-2 text-[#1A1D29]">Acesso Administrativo</h2>
                    <p className="text-gray-500 text-sm">Painel de Controle</p>
                </div>

                {authError && (
                    <div className="mb-4 p-3 bg-rose-100 text-rose-700 text-xs rounded-lg text-center font-mono break-all border border-rose-200">
                        <strong>ERRO DETECTADO:</strong><br />
                        {authError}
                        <br />
                        <span className="text-[10px] opacity-75">(Tire print e me mande)</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-1">
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-100 border border-transparent rounded-lg focus:bg-white focus:border-gray-300 focus:ring-0 outline-none transition-colors text-base"
                            placeholder="Usuário"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-100 border border-transparent rounded-lg focus:bg-white focus:border-gray-300 focus:ring-0 outline-none transition-colors text-base"
                            placeholder="Senha"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full py-3 bg-[#000000] text-white font-bold rounded-full hover:bg-gray-800 transition-transform transform active:scale-95 text-lg tracking-wide shadow-lg"
                    >
                        Continuar
                    </button>
                </form>

                {/* Service Logos Removed for Compliance */}
                <div className="mt-8 pt-6 border-t border-gray-100">
                    <div className="text-center text-gray-400 text-xs">
                        <p>Painel de Gerenciamento Exclusivo</p>
                    </div>
                </div>
            </div>

            {/* Footer Links (Keep simplified or remove if preferred, leaving enabled as standard web practice) */}
            <div className="mt-8 text-xs text-gray-500 space-x-4 z-10 font-medium">
                <a href="#" className="hover:text-white transition-colors">Política</a>
                <span className="text-gray-700">•</span>
                <a href="#" className="hover:text-white transition-colors">Ajuda</a>
            </div>
        </div>
    );
};

export default Login;
