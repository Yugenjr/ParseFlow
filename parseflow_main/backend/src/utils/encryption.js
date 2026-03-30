const CryptoJS = require('crypto-js');

const SECRET = process.env.DATA_ENCRYPTION_KEY || 'default_key';

function encrypt(data) {
  return CryptoJS.AES.encrypt(
    JSON.stringify(data),
    SECRET
  ).toString();
}

function decrypt(cipher) {
  const bytes = CryptoJS.AES.decrypt(cipher, SECRET);
  return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
}

module.exports = { encrypt, decrypt };
