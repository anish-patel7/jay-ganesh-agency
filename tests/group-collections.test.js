import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentAccount} from '../server/rules.js';

const member=(id,emi)=>({id,emi,bonusApproved:false});
const entry=(customerId,installment,amount,status)=>({customerId,kind:'EMI',installment,amount,status});

test('customer and leader entries never increase order credit before group total confirmation',()=>{
 const c=member('A',500);
 const p=entry('A',1,750,'Awaiting Leader');
 assert.equal(paymentAccount(c,[p]).availableCredit,0);
 p.status='Leader Verified';
 assert.equal(paymentAccount(c,[p]).availableCredit,0);
 p.status='Group Batch Pending';
 assert.equal(paymentAccount(c,[p]).availableCredit,0);
 p.status='Verified';
 const verified=paymentAccount(c,[p]);
 assert.equal(verified.paidCash,750);
 assert.equal(verified.availableCredit,500);
 assert.equal(verified.packing,250);
});

test('one admin group-total confirmation can credit linked member installments once',()=>{
 const a=member('A',500),b=member('B',1000);
 const payments=[entry('A',1,750,'Group Batch Pending'),entry('B',1,1500,'Group Batch Pending')];
 const groupTotal=payments.reduce((sum,p)=>sum+p.amount,0);
 assert.equal(groupTotal,2250);
 assert.equal(paymentAccount(a,payments).availableCredit,0);
 assert.equal(paymentAccount(b,payments).availableCredit,0);
 payments.forEach(p=>p.status='Verified');
 assert.equal(paymentAccount(a,payments).availableCredit,500);
 assert.equal(paymentAccount(b,payments).availableCredit,1000);
 // The group remittance isn't a second EMI payment.
 assert.equal(paymentAccount(a,payments).paidCash+paymentAccount(b,payments).paidCash,2250);
});

test('rejected group collection returns to leader stage without verified EMI credit',()=>{
 const c=member('A',500),p=entry('A',2,500,'Group Batch Pending');
 p.status='Leader Verified';
 assert.equal(paymentAccount(c,[p]).paidCash,0);
 assert.equal(paymentAccount(c,[p]).availableCredit,0);
});
