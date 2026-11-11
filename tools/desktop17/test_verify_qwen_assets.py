import importlib.util
import io
from pathlib import Path
import tempfile
import unittest
from contextlib import redirect_stdout, redirect_stderr
from unittest.mock import patch

FILE = Path(__file__).with_name('verify_qwen_assets.py')
spec = importlib.util.spec_from_file_location('verify_qwen_assets17', FILE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class StageAssetsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root/'bin').mkdir()
        (self.root/'models').mkdir()
        (self.root/'bin'/'llama-server.exe').write_bytes(b'MZtest')
        (self.root/'bin'/'ggml.dll').write_bytes(b'MZdll')
        (self.root/'models'/mod.MODEL).write_bytes(b'GGUFtesting GGUF')
        patcher=patch.object(mod,'MIN_MODEL_BYTES',8)
        patcher.start()
        self.addCleanup(patcher.stop)

    def run_cmd(self, *args):
        with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            return mod.main([*args,'--assets',str(self.root)])

    def test_check_only_read(self):
        self.assertEqual(self.run_cmd('--check'),0)
        self.assertFalse((self.root/mod.MANIFEST).exists())

    def test_prepare_verify_and_change_detection(self):
        self.assertEqual(self.run_cmd('--prepare'),0)
        self.assertEqual(self.run_cmd('--verify'),0)
        (self.root/'bin'/'ggml.dll').write_bytes(b'changed')
        self.assertEqual(self.run_cmd('--verify'),1)

    def test_missing_model_blocked(self):
        (self.root/'models'/mod.MODEL).unlink()
        self.assertEqual(self.run_cmd('--check'),1)

    def test_invalid_pe_blocked(self):
        (self.root/'bin'/'llama-server.exe').write_bytes(b'HTMLoops')
        self.assertEqual(self.run_cmd('--check'),1)

    def test_invalid_gguf_blocked(self):
        (self.root/'models'/mod.MODEL).write_bytes(b'<html>oops')
        self.assertEqual(self.run_cmd('--check'),1)

    def test_manifest_no_password(self):
        self.assertEqual(self.run_cmd('--prepare'),0)
        text = (self.root/mod.MANIFEST).read_text('utf8')
        self.assertNotIn('password',text.lower())
        self.assertIn('sha256',text)

if __name__ == '__main__': unittest.main()
