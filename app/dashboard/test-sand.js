import 'dotenv/config';

const KORAPAY_SECRET_KEY = "sk_test_Msx3pTKYdTgMXSyj45DH63riKT6AxK77p8XSCeGb";

const res = await fetch('https://api.korapay.com/merchant/api/v1/virtual-bank-account/sandbox/credit', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
  },
  body: JSON.stringify({
    account_number: '1110034803',
    amount: 1000,
    currency: 'NGN',
  }),
});

console.log('KoraPay sandbox credit status:', res.status, res.statusText);
const data = await res.json();
console.log('KoraPay sandbox credit response:', JSON.stringify(data, null, 2));