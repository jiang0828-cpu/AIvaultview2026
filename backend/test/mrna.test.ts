import {test} from 'node:test';
import assert from 'node:assert/strict';
import {descriptionHash, seedFingerprint, mayRefreshSeed} from '../prisma/mrna-ownership.js';

const original={title:'Research',type:'text',scene:'work',topics:['health','research'],description:'<!-- mrna-v2-owned --> original',sortOrder:0,parentId:23};
const revised={...original,description:'new research'};
test('mRNA reseed preserves every metadata-only user edit and description edit',()=>{
  const baseline=seedFingerprint(original);
  for(const change of [{title:'Custom'},{type:'pdf'},{scene:'life'},{topics:['custom']},{sortOrder:10},{description:'Custom'}]){
    assert.equal(mayRefreshSeed({...original,...change},revised,baseline),false);
  }
  assert.equal(mayRefreshSeed(original,revised,baseline),true);
});
test('description-only seed baseline upgrades conservatively and a marker grants no overwrite',()=>{
  assert.equal(mayRefreshSeed(original,revised,undefined,descriptionHash(original.description)),true);
  assert.equal(mayRefreshSeed({...original,sortOrder:1},revised,undefined,descriptionHash(original.description)),false);
  assert.equal(mayRefreshSeed({...original,description:'<!-- mrna-v2-owned --> user edit'},revised),false);
});
