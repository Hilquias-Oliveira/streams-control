import React, { useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings, LogOut, Tv, User, LayoutGrid } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import ImagePicker from '../common/ImagePicker';

const Sidebar = ({ isOpen, onClose }) => {
    const location = useLocation();
    const { logout, user: authUser } = useAuth();
    const { updateUser, users } = useData();

    // Use live data from DataContext if available, otherwise session data
    const user = users.find(u => u.id === authUser?.id) || authUser;

    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
    const [phone, setPhone] = useState(user?.phone || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');

    const handleUpdateProfile = (e) => {
        e.preventDefault();

        if (password) {
            if (password !== confirmPassword) {
                alert("As novas senhas não coincidem!");
                return;
            }
            if (currentPassword !== user.password) {
                alert("Senha atual incorreta!");
                return;
            }
        }

        const updates = { avatar: avatarUrl, phone };
        if (password) updates.password = password;

        // Update Firestore
        // Use user.id which might be string or number, but firestore expects string doc ID
        updateUser(user.id, updates);

        setIsProfileOpen(false);
        setPassword('');
        setConfirmPassword('');
        setCurrentPassword('');

        // Wait a bit for propagation then reload to refresh context
        setTimeout(() => {
            window.location.reload();
        }, 500);
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm"
                    onClick={onClose}
                />
            )}

            <aside className={`w-64 bg-white border-r border-gray-100 flex flex-col h-screen fixed left-0 top-0 z-40 transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 shadow-2xl md:shadow-none`}>
                <div className="p-8">
                    <h2 className="text-2xl font-bold text-gray-800 tracking-tight">
                        Streams
                    </h2>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    <Link
                        to="/"
                        onClick={() => window.innerWidth < 768 && onClose && onClose()}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${location.pathname === '/' || location.pathname === '/dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-gray-500 hover:bg-white hover:text-indigo-600'}`}
                    >
                        <LayoutGrid size={20} />
                        <span className="font-bold">Dashboard</span>
                    </Link>

                    <Link
                        to="/streams"
                        onClick={() => window.innerWidth < 768 && onClose && onClose()}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${location.pathname === '/streams' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-gray-500 hover:bg-white hover:text-indigo-600'}`}
                    >
                        <Tv size={20} />
                        <span className="font-bold">Meus Streams</span>
                    </Link>

                    {(user?.role === 'admin' || user?.role === 'supervisor') && (
                        <Link
                            to="/admin"
                            onClick={() => window.innerWidth < 768 && onClose && onClose()}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${location.pathname === '/admin' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-gray-500 hover:bg-white hover:text-indigo-600'}`}
                        >
                            <Settings size={20} />
                            <span className="font-bold">Admin</span>
                        </Link>
                    )}
                </nav>

                <div className="p-4 border-t border-gray-100 space-y-2">
                    <div
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 rounded-xl transition-colors"
                        onClick={() => {
                            setAvatarUrl(user?.avatar || '');
                            setPhone(user?.phone || '');
                            setIsProfileOpen(true);
                        }}
                    >
                        <img
                            src={user?.avatar || 'https://github.com/shadcn.png'}
                            alt="User"
                            className="w-10 h-10 rounded-full border border-gray-200 object-cover"
                        />
                        <div className="overflow-hidden">
                            <p className="text-sm font-bold text-gray-900 truncate">{user?.name}</p>
                            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                        </div>
                    </div>

                    <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors font-bold"
                    >
                        <LogOut size={20} />
                        <span>Sair</span>
                    </button>
                </div>
            </aside>

            {/* PROFILE MODAL */}
            {isProfileOpen && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-fade-in relative z-50">
                        <h2 className="text-xl font-bold mb-6 text-gray-900">Editar Perfil</h2>
                        <form onSubmit={handleUpdateProfile} className="space-y-4">

                            <ImagePicker
                                label="Sua Foto"
                                value={avatarUrl}
                                onChange={setAvatarUrl}
                            />

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Telefone (WhatsApp)</label>
                                <input
                                    placeholder="(11) 99999-9999"
                                    className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-gray-200 text-sm"
                                    value={phone}
                                    onChange={e => {
                                        let v = e.target.value.replace(/\D/g, '');
                                        v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
                                        v = v.replace(/(\d)(\d{4})$/, '$1-$2');
                                        setPhone(v.substring(0, 15));
                                    }}
                                />
                            </div>

                            <div className="border-t border-gray-100 pt-4 mt-4">
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-3">Alterar Senha</label>
                                <div className="space-y-3">
                                    <div>
                                        <input
                                            type="password"
                                            className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-gray-200 text-sm"
                                            value={currentPassword}
                                            onChange={e => setCurrentPassword(e.target.value)}
                                            placeholder="Senha Atual"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="password"
                                            className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-gray-200 text-sm"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            placeholder="Nova Senha"
                                        />
                                    </div>
                                    <div>
                                        <input
                                            type="password"
                                            className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-gray-200 text-sm"
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            placeholder="Confirmar Nova Senha"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={() => setIsProfileOpen(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800">Salvar</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
};

export default Sidebar;
