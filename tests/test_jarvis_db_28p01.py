"""Offline tests for the J.A.R.V.I.S. credentials launcher repair."""
from __future__ import annotations
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().with_name('napraw_jarvis_db_28p01.py')
if not SCRIPT.exists():
    SCRIPT = Path(__file__).resolve().parent.parent / 'napraw_jarvis_db_28p01.py'
SPEC = importlib.util.spec_from_file_location('jarvis_fix', SCRIPT)
mod = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)

SOURCE = Path(__file__).with_name('run_dev_sample.ps1').read_bytes()

class FixTests(unittest.TestCase):
    def test_install_idempotent_and_restore(self):
        for bom in (b'', b'\xef\xbb\xbf'):
            with self.subTest(bom=bom), tempfile.TemporaryDirectory() as tmp:
                root=Path(tmp)
                target,backup=mod.target_and_backup(root)
                target.parent.mkdir(parents=True)
                target.write_bytes(bom+SOURCE)
                self.assertEqual(mod.apply_patch(root),'PATCHED')
                self.assertEqual(mod.apply_patch(root),'ALREADY_INSTALLED')
                self.assertTrue(backup.exists())
                self.assertIn(mod.MARKER, target.read_text('utf-8-sig'))
                mod.rollback(root)
                self.assertEqual(target.read_bytes(),bom+SOURCE)
                self.assertFalse(backup.exists())

    def test_no_source_overwrite_if_altered(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); t,b=mod.target_and_backup(root)
            t.parent.mkdir(parents=True); t.write_bytes(SOURCE)
            mod.apply_patch(root)
            t.write_bytes(t.read_bytes()+b'\n# changed later\n')
            with self.assertRaises(mod.DiagnosticError): mod.rollback(root)
            self.assertTrue(b.exists())

    def test_invalid_launcher_is_not_modified(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); t,b=mod.target_and_backup(root)
            t.parent.mkdir(parents=True); t.write_text('hello',encoding='utf-8')
            with self.assertRaises(mod.DiagnosticError): mod.apply_patch(root)
            self.assertFalse(b.exists())

    def test_parse_private_env(self):
        with tempfile.TemporaryDirectory() as tmp:
            f=Path(tmp)/'backend.env'
            f.write_text('JARVIS_DB_HOST=127.0.0.1\nJARVIS_DB_PORT=5433\nJARVIS_DB_NAME=jarvis_db\nJARVIS_DB_USER=jarvis\nJARVIS_DB_PASSWORD="safe secret"\n',encoding='utf-8')
            self.assertEqual(mod.dotenv(f)['JARVIS_DB_PASSWORD'],'safe secret')
            f.write_text(f.read_text()+ 'JARVIS_DB_PASSWORD=duplicated\n',encoding='utf-8')
            with self.assertRaises(mod.DiagnosticError): mod.dotenv(f)

    def test_secret_in_stdin_only(self):
        class Result:
            returncode=0
            stdout=b'1\n'
        with patch.object(mod,'run',return_value=Result()) as runner:
            self.assertTrue(mod.postgres_probe('VERY_PRIVATE_TEST_SECRET','127.0.0.1',5432))
            cmd=runner.call_args.args[0]
            self.assertNotIn('VERY_PRIVATE_TEST_SECRET',' '.join(cmd))
            self.assertIn(b'VERY_PRIVATE_TEST_SECRET',runner.call_args.kwargs['input_bytes'])

    def test_patch_uses_only_private_db_and_standard_spring_vars(self):
        self.assertIn('$env:SPRING_DATASOURCE_PASSWORD',mod.PATCH)
        self.assertIn('$env:SPRING_DATASOURCE_URL',mod.PATCH)
        self.assertNotIn('ALTER ROLE',mod.PATCH)

if __name__ == '__main__': unittest.main(verbosity=2)
