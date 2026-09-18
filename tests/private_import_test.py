import csv
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('private_import',root/'scripts/private_import.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
actor='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';season='dddddddd-dddd-4ddd-addd-dddddddddddd'
class ImportTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory()
        self.path=Path(self.directory.name)/'synthetic.csv'
    def tearDown(self):self.directory.cleanup()
    def write(self,rows,headers=('source_id','full_name','position','age','height_cm','email','social_url')):
        with self.path.open('w',newline='') as source:
            writer=csv.DictWriter(source,fieldnames=headers);writer.writeheader();writer.writerows(rows)
    def sample(self):return [{'source_id':str(i),'full_name':f'Synthetic Import {i}'} for i in range(10)]
    def test_unknowns_stay_null_and_only_source_facts_import(self):
        self.write(self.sample());rows=module.load_rows(self.path)
        self.assertEqual(len(rows),10);self.assertEqual(rows[0]['facts']['age'],None);self.assertEqual(rows[0]['facts']['position'],None);self.assertNotIn('athleticism',rows[0]['facts']);self.assertNotIn('stage',rows[0]['facts'])
    def test_valid_positions_and_integer_boundaries(self):
        rows=self.sample();rows[0].update(position='Handler',age='16',height_cm='250');rows[1].update(position='Cutter',age='100',height_cm='100');self.write(rows)
        parsed=module.load_rows(self.path);self.assertEqual(parsed[0]['facts']['position'],'Handler');self.assertEqual(parsed[1]['facts']['position'],'Cutter');self.assertEqual(parsed[0]['facts']['height_cm'],250)
    def test_counts_and_duplicate_source_ids_block_batch(self):
        self.write(self.sample()[:9])
        with self.assertRaises(module.ImportErrorSafe):module.load_rows(self.path)
        rows=self.sample();rows[9]['source_id']='0';self.write(rows)
        with self.assertRaises(module.ImportErrorSafe):module.load_rows(self.path)
    def test_invalid_attributes_do_not_echo_source_values(self):
        for field,value in [('age','PRIVATE BAD VALUE'),('height_cm','180.5'),('position','Hybrid'),('email','invalid'),('social_url','javascript:alert(1)')]:
            rows=self.sample();rows[0][field]=value;self.write(rows)
            with self.assertRaises(module.ImportErrorSafe) as error:module.load_rows(self.path)
            self.assertNotIn(value,str(error.exception));self.assertIn('CSV row 2',str(error.exception))
    def test_unknown_headers_duplicate_headers_and_malformed_rows_block(self):
        self.write(self.sample(),('source_id','full_name','is_active'))
        with self.assertRaises(module.ImportErrorSafe):module.load_rows(self.path)
        self.path.write_text('source_id,full_name,full_name\n1,Synthetic,Synthetic\n')
        with self.assertRaises(module.ImportErrorSafe):module.load_rows(self.path,1)
        self.path.write_text('source_id,full_name\n1,Synthetic,extra\n')
        with self.assertRaises(module.ImportErrorSafe):module.load_rows(self.path,1)
    def test_sql_quote_and_json_encoding_cannot_inject_sql(self):
        rows=self.sample();rows[0]['full_name']="Synthetic O'Example; select 'x'; --";self.write(rows)
        sql=module.build_sql(module.load_rows(self.path),actor,season,'synthetic-test',module.PROJECT_REF)
        self.assertIn("O''Example",sql);self.assertIn('standard_conforming_strings=on',sql);self.assertIn('set local role authenticated',sql);self.assertIn('commit;',sql)
        with self.assertRaises(module.ImportErrorSafe):module.build_sql([],actor,season,"bad' id",module.PROJECT_REF)
        with self.assertRaises(module.ImportErrorSafe):module.build_sql([],actor,season,'test','wrong-project')
    def test_private_output_is_restricted_exclusive_and_owner_only(self):
        with self.assertRaises(module.ImportErrorSafe):module.write_private_sql(root/'docs/test.private.sql','PRIVATE')
        output=Path(self.directory.name)/'import.private.sql';module.write_private_sql(output,'synthetic')
        self.assertEqual(os.stat(output).st_mode&0o777,0o600)
        with self.assertRaises(FileExistsError):module.write_private_sql(output,'replacement')
    def test_explicit_existing_person_reference_is_validated(self):
        self.write([{'source_id':'one','full_name':'Synthetic Person','prospect_id':actor}],('source_id','full_name','prospect_id'))
        self.assertEqual(module.load_rows(self.path,1)[0]['prospect_id'],actor)
        self.write([{'source_id':'one','full_name':'Synthetic Person','prospect_id':'not-an-id'}],('source_id','full_name','prospect_id'))
        with self.assertRaises(module.ImportErrorSafe):module.load_rows(self.path,1)
    def test_default_cli_is_no_write_and_logs_only_totals(self):
        self.write(self.sample());result=subprocess.run([sys.executable,str(root/'scripts/private_import.py'),'--file',str(self.path)],capture_output=True,text=True)
        self.assertEqual(result.returncode,0);self.assertEqual(json.loads(result.stdout),{'validated':10,'database_changed':False});self.assertNotIn('Synthetic Import',result.stdout+result.stderr)
if __name__=='__main__':unittest.main()
