import React, { useMemo, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { generatePixString } from '../../utils/pixUtils';
import { Copy, Check } from 'lucide-react';

import pixLogo from '../../assets/pix_logo.png';

const PixQRCode = ({
    pixKey,
    pixKeyType,
    merchantName = 'Streams Control',
    merchantCity = 'Recife',
    amount,
    txId,
    label
}) => {
    const [copied, setCopied] = useState(false);

    const pixPayload = useMemo(() => {
        if (!pixKey || !amount) return '';
        return generatePixString({
            key: pixKey,
            type: pixKeyType,
            name: merchantName,
            city: merchantCity,
            amount: amount,
            txId: txId || '***' // Default txId if None
        });
    }, [pixKey, pixKeyType, merchantName, merchantCity, amount, txId]);

    const handleCopy = () => {
        if (!pixPayload) return;
        navigator.clipboard.writeText(pixPayload);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!pixPayload) {
        return <div className="text-red-500 text-xs">Dados inválidos para gerar Pix.</div>;
    }

    return (
        <div className="flex flex-col items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm max-w-sm mx-auto">
            {label && <h4 className="font-bold text-gray-800 text-sm text-center">{label}</h4>}

            <div className="p-2 bg-white rounded-xl border border-gray-200 shadow-inner">
                <QRCodeCanvas
                    value={pixPayload}
                    size={200}
                    level={"M"}
                    includeMargin={true}
                    imageSettings={{
                        src: pixLogo,
                        x: undefined,
                        y: undefined,
                        height: 48,
                        width: 48,
                        excavate: true,
                    }}
                />
            </div>

            <div className="w-full space-y-2">
                <p className="text-[10px] text-gray-400 text-center uppercase font-bold tracking-wider">Pix Copia e Cola</p>
                <div
                    onClick={handleCopy}
                    className="flex items-center gap-2 bg-gray-50 border border-gray-200 p-3 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors group relative"
                >
                    <p className="font-mono text-xs text-gray-600 truncate flex-1 select-all break-all line-clamp-1">
                        {pixPayload}
                    </p>
                    <div className={`p-2 rounded-lg transition-all ${copied ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500 group-hover:bg-white group-hover:shadow-sm'}`}>
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                    </div>
                </div>
                {copied && <p className="text-center text-xs font-bold text-green-600 animate-fade-in">Código copiado!</p>}
            </div>
        </div>
    );
};

export default PixQRCode;
