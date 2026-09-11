"""Tests of delivered planning helpers, not application implementation evidence."""
import copy
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import tempfile
import unittest
import warnings
import zipfile

import preflight_sources as pf
import validate_pack as vp

class PreflightTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(); self.base=Path(self.temp.name)
    def tearDown(self): self.temp.cleanup()
    def folder(self,name='renamed-input'):
        root=self.base/name
        for sentinel in pf.SENTINELS['archify']:
            p=root/sentinel;p.parent.mkdir(parents=True,exist_ok=True);p.write_text('{}')
        p=root/'README.md';p.write_text('sample\n')
        return root
    def archive(self,root,prefix='download/'):
        p=self.base/'sample.zip'
        with zipfile.ZipFile(p,'w') as z:
            for f in root.rglob('*'):
                if f.is_file():z.writestr(prefix+f.relative_to(root).as_posix(),f.read_bytes())
        return p
    def test_folder_and_zip_match(self):
        root=self.folder();a=pf.scan_folder(root,'archify')['entries'];b=pf.scan_zip(self.archive(root),'archify')['entries']
        self.assertTrue(pf.compare_inventory(a,b)['matches_baseline'])
    def test_renamed_wrapped_folder_discovery(self):
        root=self.folder();self.assertEqual(pf.discover_folder(self.base,'archify'),root)
    def test_unwrapped_zip(self):
        root=self.folder();self.assertEqual(len(pf.scan_zip(self.archive(root,''),'archify')['entries']),3)
    def test_content_change_is_drift(self):
        root=self.folder();before=pf.scan_folder(root,'archify')['entries'];(root/'README.md').write_text('changed')
        result=pf.compare_inventory(pf.scan_folder(root,'archify')['entries'],before)
        self.assertFalse(result['matches_baseline']);self.assertEqual(result['changed'][0]['path'],'README.md')
    def test_missing_and_extra(self):
        a=[pf.record('new','file','a'*64,1)];e=[pf.record('old','file','a'*64,1)]
        r=pf.compare_inventory(a,e);self.assertEqual(r['missing'],['old']);self.assertEqual(r['extra'],['new'])
    def test_unsafe_paths(self):
        for path in ['../escape','/etc/passwd','C:/file','root/../../escape','root\\bad']:
            with self.assertRaises(pf.PreflightError):pf.safe_name(path)
    def test_duplicate_archive_names(self):
        root=self.folder();p=self.archive(root)
        with warnings.catch_warnings():
            warnings.simplefilter('ignore')
            with zipfile.ZipFile(p,'a') as z:z.writestr('download/README.md','duplicate')
        with self.assertRaises(pf.PreflightError):pf.scan_zip(p,'archify')
    def test_symlink_type_is_distinct(self):
        a=pf.record('link','symlink','a'*64,3);e=pf.record('link','file','a'*64,3)
        self.assertFalse(pf.compare_inventory([a],[e])['matches_baseline'])
    @unittest.skipUnless(hasattr(os,'symlink'),'symlinks unavailable')
    def test_folder_symlink_is_not_followed(self):
        root=self.folder();external=self.base/'outside';external.write_text('must not be read')
        try:os.symlink(str(external),root/'outside-link')
        except OSError:self.skipTest('host does not permit symlinks')
        record=next(x for x in pf.scan_folder(root,'archify')['entries'] if x['path']=='outside-link')
        self.assertEqual(record['kind'],'symlink')
        self.assertEqual(record['sha256'],hashlib.sha256(str(external).encode()).hexdigest())
    def test_admin_folders_reported_not_traversed(self):
        root=self.folder();(root/'.git').mkdir();(root/'.git'/'config').write_text('ignored')
        scan=pf.scan_folder(root,'archify');self.assertIn('.git/',scan['excluded_admin_entries']);self.assertEqual(len(scan['entries']),3)
    def test_case_collision(self):
        a=[pf.record('A','file','a'*64,1),pf.record('a','file','b'*64,1)]
        self.assertFalse(pf.compare_inventory(a,a)['matches_baseline'])
    def test_report_inside_source_guard(self):
        root=self.folder();self.assertTrue(pf.is_inside(root/'report.json',root));self.assertFalse(pf.is_inside(self.base/'report.json',root))
    def test_ambiguous_source_root(self):
        self.folder('one');self.folder('two')
        with self.assertRaises(pf.PreflightError):pf.discover_folder(self.base,'archify')

class PackageTests(unittest.TestCase):
    def test_current_package_valid(self):
        root=Path(__file__).resolve().parents[1]
        result=vp.validate(root);self.assertEqual(result['ticket_count'],134);self.assertEqual(result['status'],'PASS')
    def test_dependency_corruption_fails(self):
        root=Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as tmp:
            dest=Path(tmp)/'pack';shutil.copytree(root,dest)
            p=dest/'backlog/tickets.json';data=json.loads(p.read_text());data['tickets'][0]['dependencies']=['AFM-999'];p.write_text(json.dumps(data))
            with self.assertRaises(vp.ValidationError):vp.validate(dest)

if __name__=='__main__':unittest.main()
