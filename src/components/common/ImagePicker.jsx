import React, { useState, useRef } from 'react';
import { Upload, Link, Image as ImageIcon } from 'lucide-react';

const ImagePicker = ({ value, onChange, label = "Imagem" }) => {
    const [mode, setMode] = useState('url'); // 'url' or 'file'
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Limit text file size to avoid LocalStorage quota issues (e.g. 500KB)
            if (file.size > 700 * 1024) {
                alert("A imagem deve ter no máximo 700KB para não sobrecarregar o sistema.");
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                onChange(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 mb-1">{label}</label>

            <div className="flex gap-2 mb-2">
                <button
                    type="button"
                    onClick={() => setMode('url')}
                    className={`flex-1 py-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1 ${mode === 'url' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                    <Link size={12} /> Link (URL)
                </button>
                <button
                    type="button"
                    onClick={() => setMode('file')}
                    className={`flex-1 py-1 text-xs font-bold rounded-lg flex items-center justify-center gap-1 ${mode === 'file' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                >
                    <Upload size={12} /> Computador
                </button>
            </div>

            {mode === 'url' ? (
                <input
                    className="w-full p-3 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-gray-200 text-sm"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder="https://..."
                />
            ) : (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-6 bg-gray-50 border border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                    />
                    {value && value.startsWith('data:') ? (
                        <div className="text-center">
                            <img src={value} className="w-16 h-16 object-contain mx-auto mb-2 rounded" />
                            <span className="text-xs text-green-600 font-bold">Imagem carregada!</span>
                        </div>
                    ) : (
                        <>
                            <ImageIcon className="text-gray-400 mb-2" />
                            <span className="text-xs text-gray-500 font-medium">Clique para selecionar</span>
                        </>
                    )}
                </div>
            )}

            {/* Preview Small */}
            {value && (
                <div className="mt-2 flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
                    <img src={value} alt="Preview" className="w-8 h-8 rounded object-cover bg-white" />
                    <span className="text-xs text-gray-400 truncate flex-1">{value.substring(0, 30)}...</span>
                </div>
            )}
        </div>
    );
};

export default ImagePicker;
