import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
test('private import validates source fields, escaping, counts, privacy and safe output in nine Python checks',()=>{
 execFileSync('python3',['-m','unittest','discover','-s','tests','-p','private_import_test.py'],{stdio:'pipe'});
});
