// src/utils/crypto.js
import CryptoJS from 'crypto-js';

export const generateKeyPair = () => {
  const passphrase = CryptoJS.lib.WordArray.random(32).toString();
  return { privateKey: passphrase, publicKey: passphrase };
};

export const encryptMessage = (message, publicKey) => {
  return CryptoJS.AES.encrypt(message, publicKey).toString();
};

export const decryptMessage = (ciphertext, privateKey) => {
  try {
    if (!ciphertext || !privateKey) {
      throw new Error('Відсутні ciphertext або privateKey');
    }
    const bytes = CryptoJS.AES.decrypt(ciphertext, privateKey);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) {
      return ciphertext;
    }
    return decrypted;
  } catch (e) {
    console.error('Помилка дешифрування:', e.message);
    return ciphertext;
  }
};