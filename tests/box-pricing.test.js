import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_BOX_TIERS} from '../server/box-pricing.js';
import {computeOrder} from '../server/rules.js';
test('all eight advertised and half-price scheme box tiers',()=>{
  assert.equal(DEFAULT_BOX_TIERS.length,8);
  assert.deepEqual(DEFAULT_BOX_TIERS.map(x=>x.advertised),[4000,6000,8000,10000,12000,15000,20000,30000]);
  assert.deepEqual(DEFAULT_BOX_TIERS.map(x=>x.scheme),[2000,3000,4000,5000,6000,7500,10000,15000]);
});
test('box pricing follows EMI vs direct order rules',()=>{
  const rows=DEFAULT_BOX_TIERS.map(b=>({pricingId:b.id,quantity:1}));
  const emi=computeOrder({kind:'EMI'},rows,[],DEFAULT_BOX_TIERS,{availableCredit:50000});
  const direct=computeOrder({kind:'DIRECT'},rows,[],DEFAULT_BOX_TIERS);
  assert.equal(emi.boxSubtotal,52500);
  assert.equal(direct.boxSubtotal,105000);
  assert.equal(emi.extraPayable,2500);
});
