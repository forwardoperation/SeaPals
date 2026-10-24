import test from 'node:test';
import assert from 'node:assert/strict';
import { manufacturingService, validatedBarcode, validatedReceiptItems } from './integration.mjs';
const id='10000000-0000-4000-8000-000000000001';
const order='20000000-0000-4000-8000-000000000002';
test('barcode validation preserves leading zeros and rejects scanner control characters',()=>{
 assert.equal(validatedBarcode('001234567890'),'001234567890');
 for(const v of ['',12,' 001','001\r','001\n','001\u0000','x'.repeat(129)]) assert.throws(()=>validatedBarcode(v));
 assert.deepEqual(validatedReceiptItems([{barcode:'02',quantity:1},{barcode:'01',quantity:2}]),[{barcode:'01',quantity:2},{barcode:'02',quantity:1}]);
 for(const items of [[],[{barcode:'01',quantity:0}],[{barcode:'01',quantity:1.5}],[{barcode:'01',quantity:'1'}],[{barcode:'01',quantity:1},{barcode:'01',quantity:1}],[{barcode:'01',quantity:100},{barcode:'02',quantity:1}]]) assert.throws(()=>validatedReceiptItems(items));
});
test('receiving validates before calling storage and forwards one stable operation identity',async()=>{
 const calls=[];
 const service=manufacturingService({rpc:async(name,args)=>{calls.push({name,args});return {data:{recorded:true},error:null};}});
 await assert.rejects(service.receiveStock(id,order,[{barcode:'001',quantity:1}],false));
 await assert.rejects(service.receiveStock('bad',order,[{barcode:'001',quantity:1}],true));
 assert.equal(calls.length,0);
 await service.receiveStock(id,order,[{barcode:'001',quantity:1}],true);
 assert.deepEqual(calls[0],{name:'manufacturing_receive_stock',args:{p_id:id,p_order:order,p_items:[{barcode:'001',quantity:1}],p_quality_confirmed:true}});
});
test('only explicit SQL rejections are definitive; transport failures retain pending receipt identity',async()=>{
 for(const code of ['PGRST000','XX000',undefined]) {
  const service=manufacturingService({rpc:async()=>({error:{code,message:'failure'}})});
  await assert.rejects(service.receiveStock(id,order,[{barcode:'001',quantity:1}],true),e=>e.status===503);
 }
 const thrown=manufacturingService({rpc:async()=>{throw new TypeError('fetch failed');}});
 await assert.rejects(thrown.receiveStock(id,order,[{barcode:'001',quantity:1}],true),e=>e.status===503);
 const rejected=manufacturingService({rpc:async()=>({error:{code:'P0001',message:'Quantity exceeds remaining'}})});
 await assert.rejects(rejected.receiveStock(id,order,[{barcode:'001',quantity:1}],true),e=>e.status===409 && e.message==='Quantity exceeds remaining');
});
test('inventory lists only the remaining unreceived batch quantity',async()=>{
 const data={manufacturing_stock:[{product_id:'reef-dive-pack',on_hand:3,reserved:1}],manufacturing_orders:[{stock_request:[{productId:'reef-dive-pack',quantity:5}],received_quantities:{'reef-dive-pack':2}}],manufacturing_stock_movements:[],manufacturing_product_barcodes:[{barcode:'001',product_id:'reef-dive-pack'}]};
 const service=manufacturingService({from(table){const q={select(){return q},order(){return q},eq(){return q},is(){return q},limit(){return q},then(resolve){return Promise.resolve({data:data[table],error:null}).then(resolve)}};return q;}});
 const result=await service.inventory();assert.equal(result.stock[0].planned,3);assert.equal(result.stock[0].available,2);assert.equal(result.barcodes[0].barcode,'001');
});
