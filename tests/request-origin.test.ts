import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasAllowedOrigin} from '../src/server/request-origin';
test('origin uses the incoming host when Next normalizes its internal URL',()=>{
 for(const host of ['127.0.0.1:3101','localhost:3101','[::1]:3101']){
  assert(hasAllowedOrigin(new Request('http://localhost:3101/api/emotions',{headers:{host,origin:`http://${host}`}})));
 }
});
test('origin rejects foreign hosts, ports, protocols, null and malformed values',()=>{
 for(const origin of ['https://evil.example','http://localhost:3102','https://localhost:3101','null','broken','http://localhost:3101/path']){
  assert.equal(hasAllowedOrigin(new Request('http://localhost:3101/api/emotions',{headers:{host:'localhost:3101',origin}})),false);
 }
 assert(hasAllowedOrigin(new Request('http://localhost:3101/api/emotions')));
});
