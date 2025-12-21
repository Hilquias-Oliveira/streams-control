// CRC16-CCITT implementation (Poly: 0x1021, Init: 0xFFFF)
function crc16ccitt(text) {
    let crc = 0xFFFF;
    for (let i = 0; i < text.length; i++) {
        let code = text.charCodeAt(i);
        crc ^= code << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
            crc = crc & 0xFFFF; // Ensure 16-bit
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

// Helper to strip special chars and limit length
const normalizeStr = (str, maxLength) => {
    if (!str) return '';
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9\s]/g, "") // Remove non-alphanumeric except spaces
        .substring(0, maxLength);
};

// Helper to format field: ID + LENGTH (2 chars) + VALUE
const formatField = (id, value) => {
    const valStr = String(value);
    const len = valStr.length.toString().padStart(2, '0');
    return `${id}${len}${valStr}`;
};

const formatPixKey = (key, type) => {
    if (!key) return '';
    const cleanKey = key.trim();

    // Normalize based on type if provided, otherwise generic auto-detection
    const typeLower = type ? type.toLowerCase() : '';

    if (['cpf', 'cnpj', 'phone', 'celular', 'telefone'].includes(typeLower)) {
        // Strip everything except digits for these types (and + for international phones if needed, but standard BR uses just digits usually for dict)
        // Actually, for Phone in BR Dict: +55...
        // For CPF/CNPJ: Digits only.

        if (typeLower.includes('phone') || typeLower.includes('celular') || typeLower.includes('telefone')) {
            return cleanKey.replace(/[^0-9+]/g, '');
        }
        return cleanKey.replace(/[^0-9]/g, '');
    }

    // Checks for specific formats if type not provided
    const digitsOnly = cleanKey.replace(/[^0-9]/g, '');

    // CPF-like (11 digits) or CNPJ-like (14 digits) and contains punctuation
    if ((digitsOnly.length === 11 || digitsOnly.length === 14) && /[\.\-\/]/.test(cleanKey) && !cleanKey.includes('@')) {
        return digitsOnly;
    }

    return cleanKey;
};

export const generatePixString = ({ key, type, name, city, amount, txId = '***' }) => {
    if (!key || !amount) return '';

    const cleanName = normalizeStr(name, 25) || 'Recebedor';
    const cleanCity = normalizeStr(city, 15) || 'Cidade';
    const cleanTxId = txId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***';
    const cleanAmount = Number(amount).toFixed(2);

    const sanitizedKey = formatPixKey(key, type);

    // 1. Payload Format Indicator
    const pfi = formatField('00', '01');

    // 2. Merchant Account Information (GUI + Key)
    const gui = formatField('00', 'br.gov.bcb.pix');
    const pixKey = formatField('01', sanitizedKey);
    const merchantAccount = formatField('26', gui + pixKey);

    // 3. Merchant Category Code (0000 = Not specified / General)
    const mcc = formatField('52', '0000');

    // 4. Transaction Currency (986 = BRL)
    const currency = formatField('53', '986');

    // 5. Transaction Amount
    const txnAmount = formatField('54', cleanAmount);

    // 6. Country Code
    const country = formatField('58', 'BR');

    // 7. Merchant Name
    const merchantName = formatField('59', cleanName);

    // 8. Merchant City
    const merchantCity = formatField('60', cleanCity);

    // 9. Additional Data Field Template (TxID)
    const txIdField = formatField('05', cleanTxId);
    const additionalData = formatField('62', txIdField);

    // Assemble Payload without CRC
    const rawPayload = pfi + merchantAccount + mcc + currency + txnAmount + country + merchantName + merchantCity + additionalData + '6304';

    // Calculate CRC16
    const crc = crc16ccitt(rawPayload);

    return rawPayload + crc;
};
