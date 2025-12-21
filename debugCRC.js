
// Known working Pix example (Static for test)
// String: 00020126330014br.gov.bcb.pix0111+5511999999995204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304
// Expected CRC: 1D3D (This is a hypothetical example, I will use the function to see what it generates and compare logic)

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

// Test cases
const testPayload = "00020126360014br.gov.bcb.pix0114+551199999999520400005303986540510.005802BR5913Fulano de Tal6008BRASILIA62070503***6304";
// Note: This payload is just a constructed string ending in "6304" ready for CRC.

console.log("Payload:", testPayload);
console.log("Calculated CRC:", crc16ccitt(testPayload));

// Let's compare with a known good implementation logic if possible
// A common issue is the bitwise order or the XOR out.
// For Pix: Polynomial 0x1021, Initial 0xFFFF, No XOR Out, No Reflection.
